-- =============================================================
-- KingsWorld #2 / 2c-tuning: conquista vi�vel (a guerra drena tropa)
-- Rodar no SQL Editor (King's World!) AP�S 34. create-or-replace.
-- Muda 2 n�meros: limiar de conquista (milicia>=200 -> >=100) e guarni��o
-- exigida (c_garrison 12 -> 3). Resto id�ntico ao 33/34.
-- =============================================================

-- resolve: garrison 12 -> 3
create or replace function public.kw_resolve_attack(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_order public.world_player_map_orders%rowtype; v_def_owner uuid; v_class text; v_disp jsonb;
  v_am numeric; v_as numeric; v_asc numeric; v_amac numeric;
  v_att_power numeric; v_def_power numeric; v_def_mult numeric;
  v_att_loss numeric; v_def_loss numeric; v_winner text; v_def record;
  v_loot_mat bigint; v_loot_sup bigint;
  v_with_hero boolean; v_city_size int; v_survivors numeric; v_required numeric; v_def_cap uuid;
  c_garrison constant numeric := 3;
begin
  select * into v_order from public.world_player_map_orders where id=p_order_id for update;
  if not found then return; end if;
  select owner_world_player_id, city_class into v_def_owner, v_class from public.villages where site_id=v_order.target_site_id;
  v_with_hero := coalesce((v_order.meta_json->>'with_hero')::boolean, false);
  v_disp := coalesce(v_order.troop_dispatch_json,'{}'::jsonb);
  v_am:=coalesce((v_disp->>'militia')::numeric,0); v_as:=coalesce((v_disp->>'shooters')::numeric,0);
  v_asc:=coalesce((v_disp->>'scouts')::numeric,0); v_amac:=coalesce((v_disp->>'machinery')::numeric,0);
  v_att_power := v_am*1 + v_as*1.5 + v_asc*0.5 + v_amac*4;
  if v_att_power <= 0 then
    update public.world_player_map_orders set status='resolved',result_code='no_army',resolved_at=now() where id=p_order_id; return;
  end if;
  if v_def_owner is null then v_def_power := 60;
  else
    select militia_count,shooters_count,scouts_count,machinery_count,materials_stock,supplies_stock
      into v_def from public.world_player_imperial_states where world_player_id=v_def_owner for update;
    v_def_mult := case when v_class='bastiao' then 1.6 when v_class='posto_avancado' then 1.2 else 1.0 end;
    v_def_power := (coalesce(v_def.militia_count,0)*1+coalesce(v_def.shooters_count,0)*1.5
                  +coalesce(v_def.scouts_count,0)*0.5+coalesce(v_def.machinery_count,0)*4)*v_def_mult + 30;
  end if;
  v_winner := case when v_att_power >= v_def_power then 'attacker' else 'defender' end;
  v_att_loss := least(1.0,(v_def_power/v_att_power)*0.5);
  v_def_loss := least(1.0,(v_att_power/greatest(v_def_power,1))*0.5);
  update public.world_player_imperial_states set
    militia_count=greatest(0,militia_count-floor(v_am*v_att_loss)::bigint),
    shooters_count=greatest(0,shooters_count-floor(v_as*v_att_loss)::bigint),
    scouts_count=greatest(0,scouts_count-floor(v_asc*v_att_loss)::bigint),
    machinery_count=greatest(0,machinery_count-floor(v_amac*v_att_loss)::bigint), updated_at=now()
  where world_player_id=v_order.world_player_id;
  if v_def_owner is not null then
    update public.world_player_imperial_states set
      militia_count=greatest(0,floor(coalesce(v_def.militia_count,0)*(1-v_def_loss))::bigint),
      shooters_count=greatest(0,floor(coalesce(v_def.shooters_count,0)*(1-v_def_loss))::bigint),
      scouts_count=greatest(0,floor(coalesce(v_def.scouts_count,0)*(1-v_def_loss))::bigint),
      machinery_count=greatest(0,floor(coalesce(v_def.machinery_count,0)*(1-v_def_loss))::bigint), updated_at=now()
    where world_player_id=v_def_owner;
    if v_winner='attacker' then
      v_loot_mat:=floor(coalesce(v_def.materials_stock,0)*0.25)::bigint; v_loot_sup:=floor(coalesce(v_def.supplies_stock,0)*0.25)::bigint;
      update public.world_player_imperial_states set materials_stock=greatest(0,materials_stock-v_loot_mat),
        supplies_stock=greatest(0,supplies_stock-v_loot_sup), updated_at=now() where world_player_id=v_def_owner;
      update public.world_player_imperial_states set materials_stock=materials_stock+v_loot_mat,
        supplies_stock=supplies_stock+v_loot_sup, updated_at=now() where world_player_id=v_order.world_player_id;
    end if;
  end if;
  if v_winner='attacker' and v_with_hero and v_def_owner is not null then
    select coalesce(sum(level),0) into v_city_size from public.village_structure_states where village_site_id=v_order.target_site_id;
    v_survivors := (v_am+v_as+v_asc+v_amac) * (1 - v_att_loss);
    v_required  := v_city_size * c_garrison;
    if v_survivors >= v_required then
      update public.villages set owner_world_player_id=v_order.world_player_id, conquered_at=now(), updated_at=now() where site_id=v_order.target_site_id;
      update public.village_structure_states set world_player_id=v_order.world_player_id, updated_at=now() where village_site_id=v_order.target_site_id;
      select current_capital_site_id into v_def_cap from public.world_players where id=v_def_owner;
      if v_def_cap = v_order.target_site_id then
        update public.world_players set status='eliminated', eliminated_at=now(), elimination_reason='conquista', current_capital_site_id=null, updated_at=now() where id=v_def_owner;
      end if;
      update public.world_player_map_orders set status='resolved',result_code='conquered',resolved_at=now() where id=p_order_id; return;
    end if;
  end if;
  if v_winner='defender' and v_with_hero then
    update public.world_players set npc_has_hero=false, npc_hero_recovers_at=now()+interval '30 minutes', updated_at=now() where id=v_order.world_player_id;
  end if;
  update public.world_player_map_orders set status='resolved',result_code=v_winner,resolved_at=now() where id=p_order_id;
end; $$;
revoke all on function public.kw_resolve_attack from public, authenticated, anon;
grant execute on function public.kw_resolve_attack to service_role;

-- decide: conquista a partir de milicia>=100 (era 200), chance 0.7
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_att record; v_target record; v_count int:=0; v_disp jsonb; v_hero_ok boolean; v_conquest boolean; v_frac numeric;
begin
  for v_att in
    select wp.id as wp_id, wp.current_capital_site_id as origin, s.militia_count,s.shooters_count,s.scouts_count,s.machinery_count,
           wp.npc_has_hero, wp.npc_hero_recovers_at
    from public.world_players wp join public.world_player_imperial_states s on s.world_player_id=wp.id
    where wp.world_id=p_world_id and wp.is_ai and wp.status='alive'
      and wp.current_capital_site_id is not null and s.militia_count>=80 and random()<0.15
      and not exists (select 1 from public.world_player_map_orders o where o.world_player_id=wp.id and o.status in ('traveling','resolving'))
  loop
    select v.site_id as target_site, ms.tile_id as target_tile, (t.q||':'||t.r) as target_coord into v_target
      from public.world_players wp2
      join public.villages v on v.owner_world_player_id=wp2.id
      join public.map_sites ms on ms.id=v.site_id
      join public.map_tiles t on t.id=ms.tile_id
      join public.world_player_imperial_states ds on ds.world_player_id=wp2.id
      where wp2.world_id=p_world_id and wp2.is_ai and wp2.status='alive' and wp2.id<>v_att.wp_id
      order by (ds.militia_count + random()*150) asc limit 1;
    if not found then continue; end if;
    v_hero_ok := v_att.npc_has_hero and (v_att.npc_hero_recovers_at is null or v_att.npc_hero_recovers_at <= now());
    v_conquest := v_hero_ok and v_att.militia_count >= 100 and random() < 0.7;
    v_frac := case when v_conquest then 0.95 else 0.6 end;
    v_disp := jsonb_build_object('militia',floor(v_att.militia_count*v_frac),'shooters',floor(v_att.shooters_count*v_frac),
                                 'scouts',floor(v_att.scouts_count*v_frac),'machinery',floor(v_att.machinery_count*v_frac));
    insert into public.world_player_map_orders
      (world_id, world_player_id, origin_site_id, target_site_id, target_tile_id, target_coord,
       movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, meta_json)
    values (p_world_id, v_att.wp_id, v_att.origin, v_target.target_site, v_target.target_tile, v_target.target_coord,
       'attack', 'attack', v_disp, 2, now()+interval '90 seconds', jsonb_build_object('with_hero', v_conquest));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('attacks_launched',v_count);
end; $$;
revoke all on function public.kw_npc_decide_attacks from public, authenticated, anon;
grant execute on function public.kw_npc_decide_attacks to service_role;
