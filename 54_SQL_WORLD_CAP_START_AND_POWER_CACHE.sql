-- =============================================================
-- KingsWorld #54 - Cap de participantes, start honesto e power cache
-- Rodar no SQL Editor do Supabase correto. Idempotente.
--
-- Regras:
--  * world.player_cap e a fonte do limite de jogadores/IA.
--  * mundo open nao progride: recursos, NPC e ordens so em status = running.
--  * power_score_cached reflete as tropas persistidas em world_player_imperial_states.
-- =============================================================

begin;

alter table public.worlds
  add column if not exists player_cap integer not null default 25;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'worlds_player_cap_range_chk'
      and conrelid = 'public.worlds'::regclass
  ) then
    alter table public.worlds
      add constraint worlds_player_cap_range_chk
      check (player_cap between 1 and 50);
  end if;
end $$;

create or replace function public.kw_player_power_score(
  p_militia bigint,
  p_shooters bigint,
  p_scouts bigint,
  p_machinery bigint
)
returns bigint
language sql
immutable
as $$
  select greatest(0, coalesce(p_militia, 0))
       + greatest(0, coalesce(p_shooters, 0)) * 2
       + greatest(0, coalesce(p_scouts, 0)) * 2
       + greatest(0, coalesce(p_machinery, 0)) * 4;
$$;

create or replace function public.kw_recalculate_power_scores(p_world_id uuid default null)
returns table(world_player_id uuid, previous_score bigint, next_score bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with computed as (
    select
      wp.id as world_player_id,
      wp.power_score_cached as previous_score,
      public.kw_player_power_score(
        s.militia_count,
        s.shooters_count,
        s.scouts_count,
        s.machinery_count
      ) as next_score
    from public.world_players wp
    join public.world_player_imperial_states s
      on s.world_player_id = wp.id
    where p_world_id is null
       or wp.world_id = p_world_id
  ),
  updated as (
    update public.world_players wp
       set power_score_cached = computed.next_score,
           updated_at = now()
      from computed
     where wp.id = computed.world_player_id
       and wp.power_score_cached is distinct from computed.next_score
     returning computed.world_player_id, computed.previous_score, computed.next_score
  )
  select * from updated;
end;
$$;

revoke all on function public.kw_player_power_score(bigint, bigint, bigint, bigint) from public, authenticated, anon;
grant execute on function public.kw_player_power_score(bigint, bigint, bigint, bigint) to service_role;

revoke all on function public.kw_recalculate_power_scores(uuid) from public, authenticated, anon;
grant execute on function public.kw_recalculate_power_scores(uuid) to service_role;

create or replace function public.kw_settle_player(p_world_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.world_player_imperial_states%rowtype;
  v_world public.worlds%rowtype;
  v_now timestamptz := now();
  v_mat numeric;
  v_sup numeric;
  v_mat_elapsed numeric;
  v_sup_elapsed numeric;
begin
  select s.* into v_row
  from public.world_player_imperial_states s
  where s.world_player_id = p_world_player_id
  for update;

  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  select w.* into v_world
  from public.worlds w
  where w.id = v_row.world_id;

  if not found then
    raise exception 'WORLD_NOT_FOUND';
  end if;

  if v_world.status <> 'running'
     or coalesce(v_world.runtime_started, false) is not true
     or coalesce(v_world.runtime_real_time_enabled, false) is not true then
    update public.world_player_imperial_states
       set materials_anchor_at = v_now,
           supplies_anchor_at = v_now,
           updated_at = v_now
     where world_player_id = p_world_player_id;

    return jsonb_build_object(
      'world_player_id', p_world_player_id,
      'materials', v_row.materials_anchor_value,
      'supplies', v_row.supplies_anchor_value,
      'settled_at', v_now,
      'skipped', true,
      'reason', 'world_not_running'
    );
  end if;

  v_mat_elapsed := greatest(0, extract(epoch from (v_now - v_row.materials_anchor_at)));
  v_sup_elapsed := greatest(0, extract(epoch from (v_now - v_row.supplies_anchor_at)));

  v_mat := least(
    coalesce(v_row.materials_capacity, 8000),
    greatest(0, v_row.materials_anchor_value + v_row.materials_rate_per_sec * v_mat_elapsed)
  );
  v_sup := least(
    coalesce(v_row.supplies_capacity, 8000),
    greatest(0, v_row.supplies_anchor_value + v_row.supplies_rate_per_sec * v_sup_elapsed)
  );

  update public.world_player_imperial_states
     set materials_anchor_value = v_mat,
         materials_anchor_at = v_now,
         supplies_anchor_value = v_sup,
         supplies_anchor_at = v_now,
         materials_stock = greatest(0, floor(v_mat)::bigint),
         supplies_stock = greatest(0, floor(v_sup)::bigint),
         updated_at = v_now
   where world_player_id = p_world_player_id;

  update public.world_players
     set power_score_cached = public.kw_player_power_score(
           v_row.militia_count,
           v_row.shooters_count,
           v_row.scouts_count,
           v_row.machinery_count
         ),
         updated_at = v_now
   where id = p_world_player_id;

  return jsonb_build_object(
    'world_player_id', p_world_player_id,
    'materials', v_mat,
    'supplies', v_sup,
    'settled_at', v_now
  );
end;
$$;

revoke all on function public.kw_settle_player(uuid) from public, authenticated, anon;
grant execute on function public.kw_settle_player(uuid) to service_role;

commit;

-- Depois de rodar, para corrigir teu mundo atual:
-- select * from public.kw_recalculate_power_scores(
--   (select id from public.worlds where slug = 'meu-mundo')
-- );
