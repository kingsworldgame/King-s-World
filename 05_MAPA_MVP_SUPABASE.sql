-- KINGSWORLD
-- 05. MAPA MVP HEX (RAIO 40) + ALDEIAS VAZIAS + ESPOLIOS
-- Rode este arquivo APOS o 03_SUPABASE_SCHEMA.sql

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'map_zone') then
    create type map_zone as enum ('outer', 'mid', 'core');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'map_site_kind') then
    create type map_site_kind as enum (
      'capital_slot',
      'neutral_village_t1',
      'neutral_village_t2',
      'neutral_village_t3',
      'spoil_common',
      'spoil_military',
      'spoil_relic',
      'spoil_convoy'
    );
  end if;
end
$$;

create table if not exists public.map_site_profiles (
  site_id uuid primary key references public.map_sites(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  site_type site_type not null,
  zone map_zone not null,
  site_kind map_site_kind not null,
  tier smallint check (tier is null or tier between 1 and 3),
  guard_power integer not null default 0 check (guard_power >= 0),
  influence_capture_cost integer not null default 0 check (influence_capture_cost >= 0),
  loot_table_json jsonb not null default '{}'::jsonb,
  respawn_seconds integer check (respawn_seconds is null or respawn_seconds >= 0),
  last_claimed_at timestamptz,
  next_respawn_at timestamptz,
  is_claimable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_site_respawns (
  site_id uuid primary key references public.map_sites(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  respawn_enabled boolean not null default true,
  respawn_seconds integer not null check (respawn_seconds >= 0),
  last_depleted_at timestamptz,
  next_respawn_at timestamptz,
  depletion_count bigint not null default 0 check (depletion_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_site_claims (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  site_id uuid not null references public.map_sites(id) on delete cascade,
  claimer_world_player_id uuid references public.world_players(id) on delete set null,
  claim_action text not null check (claim_action in ('loot', 'capture', 'scout', 'system', 'bot_loot')),
  reward_materials bigint not null default 0 check (reward_materials >= 0),
  reward_supplies bigint not null default 0 check (reward_supplies >= 0),
  reward_energy bigint not null default 0 check (reward_energy >= 0),
  reward_influence bigint not null default 0 check (reward_influence >= 0),
  reward_json jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  resolved_at timestamptz
);

drop trigger if exists set_updated_at_map_site_profiles on public.map_site_profiles;
create trigger set_updated_at_map_site_profiles
before update on public.map_site_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_map_site_respawns on public.map_site_respawns;
create trigger set_updated_at_map_site_respawns
before update on public.map_site_respawns
for each row execute function public.set_updated_at();

create index if not exists idx_map_site_profiles_world_kind
  on public.map_site_profiles (world_id, site_kind, zone);

create index if not exists idx_map_site_profiles_world_claimable
  on public.map_site_profiles (world_id, is_claimable, next_respawn_at);

create index if not exists idx_map_site_respawns_world_next
  on public.map_site_respawns (world_id, respawn_enabled, next_respawn_at);

create index if not exists idx_map_site_claims_site_claimed
  on public.map_site_claims (site_id, claimed_at desc);

create index if not exists idx_map_site_claims_world_claimed
  on public.map_site_claims (world_id, claimed_at desc);

create or replace function public.kw_hash_int(p_text text, p_mod integer)
returns integer
language sql
immutable
as $$
  select
    case
      when p_mod <= 0 then 0
      else ((('x' || substr(md5(p_text), 1, 8))::bit(32)::int & 2147483647) % p_mod)
    end;
$$;

create or replace function public.kw_zone_for_tile(
  p_x integer,
  p_y integer,
  p_width integer,
  p_height integer
)
returns map_zone
language plpgsql
immutable
as $$
declare
  v_center_x numeric;
  v_center_y numeric;
  v_distance numeric;
begin
  v_center_x := (p_width - 1) / 2.0;
  v_center_y := (p_height - 1) / 2.0;
  v_distance := sqrt((p_x - v_center_x) * (p_x - v_center_x) + (p_y - v_center_y) * (p_y - v_center_y));

  if v_distance <= ((least(p_width, p_height) - 1) * 0.17) then
    return 'core';
  elsif v_distance <= ((least(p_width, p_height) - 1) * 0.34) then
    return 'mid';
  else
    return 'outer';
  end if;
end;
$$;

create or replace function public.kw_generate_mvp_map(
  p_world_id uuid,
  p_seed integer default 20260307,
  p_overwrite boolean default true,
  p_force_mvp_dimensions boolean default true
)
returns jsonb
language plpgsql
as $$
declare
  v_width integer;
  v_height integer;
  v_radius integer;
  v_has_tiles boolean;
  v_placed integer;
  v_candidate record;
  v_summary jsonb;
begin
  if p_force_mvp_dimensions then
    update public.worlds
       set map_width = 81,
           map_height = 81,
           map_hex_radius = 40,
           base_move_time_minutes = 45,
           road_move_time_minutes = 15
     where id = p_world_id;
  end if;

  select w.map_width, w.map_height, w.map_hex_radius
    into v_width, v_height, v_radius
    from public.worlds w
   where w.id = p_world_id
   for update;

  if not found then
    raise exception 'World % nao encontrado.', p_world_id;
  end if;

  v_radius := coalesce(v_radius, least((v_width - 1) / 2, (v_height - 1) / 2));

  if v_radius <= 0 then
    raise exception 'Raio invalido em worlds(map_hex_radius).';
  end if;

  v_width := (v_radius * 2) + 1;
  v_height := (v_radius * 2) + 1;

  select exists(select 1 from public.map_tiles t where t.world_id = p_world_id)
    into v_has_tiles;

  if v_has_tiles and not p_overwrite then
    raise exception 'Mapa do mundo % ja existe. Use p_overwrite = true.', p_world_id;
  end if;

  delete from public.map_tiles where world_id = p_world_id;

  insert into public.map_tiles (world_id, q, r, biome_type, terrain_type)
  select
    p_world_id,
    gx,
    gy,
    case public.kw_zone_for_tile(gx + v_radius, gy + v_radius, v_width, v_height)
      when 'core' then
        case
          when public.kw_hash_int(format('%s:%s:%s:%s', p_seed, p_world_id::text, gx, gy), 100) < 60 then 'badlands'
          else 'highland'
        end
      when 'mid' then
        case
          when public.kw_hash_int(format('%s:%s:%s:%s', p_seed, p_world_id::text, gx, gy), 100) < 33 then 'forest'
          when public.kw_hash_int(format('%s:%s:%s:%s', p_seed + 1, p_world_id::text, gx, gy), 100) < 50 then 'plains'
          else 'hills'
        end
      else
        case
          when public.kw_hash_int(format('%s:%s:%s:%s', p_seed, p_world_id::text, gx, gy), 100) < 48 then 'plains'
          when public.kw_hash_int(format('%s:%s:%s:%s', p_seed + 2, p_world_id::text, gx, gy), 100) < 78 then 'forest'
          else 'riverland'
        end
    end as biome_type,
    case
      when public.kw_hash_int(format('%s:%s:%s:%s', p_seed + 3, p_world_id::text, gx, gy), 100) < 12 then 'rough'
      else 'normal'
    end as terrain_type
  from generate_series(-v_radius, v_radius) as gx
  cross join generate_series(-v_radius, v_radius) as gy
  where greatest(abs(gx), abs(gy), abs(-gx - gy)) <= v_radius;

  create temporary table tmp_map_candidates on commit drop as
  select
    t.id as tile_id,
    t.q as x,
    t.r as y,
    public.kw_zone_for_tile(t.q + v_radius, t.r + v_radius, v_width, v_height) as zone,
    public.kw_hash_int(format('%s:%s:%s:%s', p_seed + 7919, p_world_id::text, t.q, t.r), 2147483647) as ord
  from public.map_tiles t
  where t.world_id = p_world_id
    and t.q between (-v_radius + 2) and (v_radius - 2)
    and t.r between (-v_radius + 2) and (v_radius - 2);

  create index tmp_map_candidates_zone_ord_idx on tmp_map_candidates (zone, ord);

  create temporary table tmp_map_selected (
    tile_id uuid primary key,
    x integer not null,
    y integer not null,
    zone map_zone not null,
    site_type site_type not null,
    site_kind map_site_kind not null,
    tier smallint,
    guard_power integer not null default 0,
    influence_capture_cost integer not null default 0,
    loot_table_json jsonb not null default '{}'::jsonb,
    respawn_seconds integer
  ) on commit drop;

  -- 1) 50 slots de capital (village capital vazio)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone in ('outer', 'mid')
    order by c.ord
  loop
    exit when v_placed >= 50;

    if exists (
      select 1
      from tmp_map_selected s
      where ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 64
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'village', 'capital_slot', null, 800, 0, '{}'::jsonb, null);
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 50 then
    raise exception 'Nao foi possivel posicionar 50 capital slots (posicionados: %).', v_placed;
  end if;

  -- 2) 120 aldeias vazias tier 1 (outer)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone = 'outer'
    order by c.ord
  loop
    exit when v_placed >= 120;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_kind = 'capital_slot'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 25
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 16
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'village', 'neutral_village_t1', 1, 220, 80, '{}'::jsonb, null);
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 120 then
    raise exception 'Nao foi possivel posicionar 120 aldeias vazias tier 1 (posicionadas: %).', v_placed;
  end if;

  -- 3) 80 aldeias vazias tier 2 (mid com fallback outer)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone in ('mid', 'outer')
    order by case when c.zone = 'mid' then 0 else 1 end, c.ord
  loop
    exit when v_placed >= 80;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_kind = 'capital_slot'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 36
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 16
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'village', 'neutral_village_t2', 2, 420, 140, '{}'::jsonb, null);
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 80 then
    raise exception 'Nao foi possivel posicionar 80 aldeias vazias tier 2 (posicionadas: %).', v_placed;
  end if;

  -- 4) 40 aldeias vazias tier 3 (core com fallback mid)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone in ('core', 'mid')
    order by case when c.zone = 'core' then 0 else 1 end, c.ord
  loop
    exit when v_placed >= 40;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_kind = 'capital_slot'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 49
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 25
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'village', 'neutral_village_t3', 3, 760, 260, '{}'::jsonb, null);
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 40 then
    raise exception 'Nao foi possivel posicionar 40 aldeias vazias tier 3 (posicionadas: %).', v_placed;
  end if;

  -- 5) 300 espolios comuns (ruin)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    order by case c.zone when 'outer' then 0 when 'mid' then 1 else 2 end, c.ord
  loop
    exit when v_placed >= 300;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 4
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'ruin'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 9
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (
      v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'ruin', 'spoil_common', 1, 120, 0,
      '{"materials":[400,1200],"supplies":[300,1000],"energy":[180,620],"influence":[20,80]}'::jsonb,
      21600
    );
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 300 then
    raise exception 'Nao foi possivel posicionar 300 espolios comuns (posicionados: %).', v_placed;
  end if;

  -- 6) 150 espolios militares (ruin)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone in ('mid', 'core')
    order by case when c.zone = 'mid' then 0 else 1 end, c.ord
  loop
    exit when v_placed >= 150;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 4
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'ruin'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 9
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (
      v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'ruin', 'spoil_military', 2, 280, 0,
      '{"materials":[700,1900],"supplies":[500,1500],"energy":[300,980],"influence":[40,120],"officer_shard":[1,3]}'::jsonb,
      43200
    );
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 150 then
    raise exception 'Nao foi possivel posicionar 150 espolios militares (posicionados: %).', v_placed;
  end if;

  -- 7) 50 espolios relic (ruin)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone in ('core', 'mid')
    order by case when c.zone = 'core' then 0 else 1 end, c.ord
  loop
    exit when v_placed >= 50;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 9
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'ruin'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 16
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (
      v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'ruin', 'spoil_relic', 3, 520, 0,
      '{"materials":[1500,3200],"supplies":[1200,2800],"energy":[900,2100],"influence":[180,480],"relic_points":[15,45]}'::jsonb,
      86400
    );
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 50 then
    raise exception 'Nao foi possivel posicionar 50 espolios relic (posicionados: %).', v_placed;
  end if;

  -- 8) 20 espolios convoy (ruin)
  v_placed := 0;
  for v_candidate in
    select c.*
    from tmp_map_candidates c
    where c.zone in ('mid', 'core')
    order by c.ord
  loop
    exit when v_placed >= 20;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'village'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 9
    ) then
      continue;
    end if;

    if exists (
      select 1
      from tmp_map_selected s
      where s.site_type = 'ruin'
        and ((s.x - v_candidate.x) * (s.x - v_candidate.x) + (s.y - v_candidate.y) * (s.y - v_candidate.y)) < 36
    ) then
      continue;
    end if;

    insert into tmp_map_selected (tile_id, x, y, zone, site_type, site_kind, tier, guard_power, influence_capture_cost, loot_table_json, respawn_seconds)
    values (
      v_candidate.tile_id, v_candidate.x, v_candidate.y, v_candidate.zone, 'ruin', 'spoil_convoy', 3, 700, 0,
      '{"materials":[1800,3600],"supplies":[1400,3200],"energy":[1100,2500],"influence":[240,600],"event_token":[1,2]}'::jsonb,
      28800
    );
    v_placed := v_placed + 1;
  end loop;

  if v_placed < 20 then
    raise exception 'Nao foi possivel posicionar 20 espolios convoy (posicionados: %).', v_placed;
  end if;

  create temporary table tmp_map_inserted_sites on commit drop as
  with inserted as (
    insert into public.map_sites (world_id, tile_id, site_type, status)
    select p_world_id, s.tile_id, s.site_type, 'active'::site_status
    from tmp_map_selected s
    returning id, tile_id, site_type
  )
  select
    i.id as site_id,
    s.tile_id,
    s.x,
    s.y,
    s.zone,
    s.site_type,
    s.site_kind,
    s.tier,
    s.guard_power,
    s.influence_capture_cost,
    s.loot_table_json,
    s.respawn_seconds
  from inserted i
  join tmp_map_selected s on s.tile_id = i.tile_id;

  insert into public.map_site_profiles (
    site_id,
    world_id,
    site_type,
    zone,
    site_kind,
    tier,
    guard_power,
    influence_capture_cost,
    loot_table_json,
    respawn_seconds,
    last_claimed_at,
    next_respawn_at,
    is_claimable,
    created_at,
    updated_at
  )
  select
    t.site_id,
    p_world_id,
    t.site_type,
    t.zone,
    t.site_kind,
    t.tier,
    t.guard_power,
    t.influence_capture_cost,
    coalesce(t.loot_table_json, '{}'::jsonb),
    t.respawn_seconds,
    null,
    case when t.respawn_seconds is not null then now() + make_interval(secs => t.respawn_seconds) end,
    t.site_kind <> 'capital_slot',
    now(),
    now()
  from tmp_map_inserted_sites t;

  with village_rows as (
    select
      t.*,
      row_number() over (partition by t.site_kind order by t.y, t.x) as seq
    from tmp_map_inserted_sites t
    where t.site_type = 'village'
  )
  insert into public.villages (
    site_id,
    world_id,
    owner_world_player_id,
    founder_world_player_id,
    name,
    village_type,
    political_state,
    capital_eligibility_status,
    is_original_capital,
    founded_at,
    last_political_change_at
  )
  select
    v.site_id,
    p_world_id,
    null,
    null,
    case v.site_kind
      when 'capital_slot' then format('Capital Slot %s', v.seq)
      when 'neutral_village_t1' then format('Aldeia Vazia I-%s', v.seq)
      when 'neutral_village_t2' then format('Aldeia Vazia II-%s', v.seq)
      else format('Aldeia Vazia III-%s', v.seq)
    end,
    case when v.site_kind = 'capital_slot' then 'capital'::village_type else 'colony'::village_type end,
    'stable'::political_state,
    case when v.site_kind = 'capital_slot' then 'eligible'::capital_eligibility_status else 'pending_review'::capital_eligibility_status end,
    false,
    now(),
    now()
  from village_rows v;

  insert into public.village_resource_states (
    village_site_id,
    materials_stock,
    supplies_stock,
    energy_stock,
    influence_stock,
    materials_capacity,
    supplies_capacity,
    energy_capacity,
    influence_capacity,
    materials_rate_per_minute,
    supplies_rate_per_minute,
    energy_rate_per_minute,
    influence_rate_per_minute,
    supplies_upkeep_per_minute,
    energy_upkeep_per_minute,
    last_reconciled_at,
    updated_at
  )
  select
    v.site_id,
    case p.site_kind when 'neutral_village_t1' then 2500 when 'neutral_village_t2' then 4200 when 'neutral_village_t3' then 6500 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 2100 when 'neutral_village_t2' then 3600 when 'neutral_village_t3' then 5400 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 900 when 'neutral_village_t2' then 1700 when 'neutral_village_t3' then 2600 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 160 when 'neutral_village_t2' then 320 when 'neutral_village_t3' then 560 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 12000 when 'neutral_village_t2' then 18000 when 'neutral_village_t3' then 26000 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 10000 when 'neutral_village_t2' then 16000 when 'neutral_village_t3' then 24000 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 7000 when 'neutral_village_t2' then 12000 when 'neutral_village_t3' then 18000 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 1800 when 'neutral_village_t2' then 2600 when 'neutral_village_t3' then 3800 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 12 when 'neutral_village_t2' then 22 when 'neutral_village_t3' then 34 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 11 when 'neutral_village_t2' then 20 when 'neutral_village_t3' then 30 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 6 when 'neutral_village_t2' then 12 when 'neutral_village_t3' then 19 else 0 end,
    case p.site_kind when 'neutral_village_t1' then 1 when 'neutral_village_t2' then 2 when 'neutral_village_t3' then 4 else 0 end,
    0,
    0,
    now(),
    now()
  from public.villages v
  join public.map_site_profiles p on p.site_id = v.site_id
  where v.world_id = p_world_id
    and v.owner_world_player_id is null;

  insert into public.map_site_respawns (
    site_id,
    world_id,
    respawn_enabled,
    respawn_seconds,
    last_depleted_at,
    next_respawn_at,
    depletion_count,
    updated_at
  )
  select
    p.site_id,
    p.world_id,
    true,
    p.respawn_seconds,
    null,
    p.next_respawn_at,
    0,
    now()
  from public.map_site_profiles p
  where p.world_id = p_world_id
    and p.respawn_seconds is not null
  on conflict (site_id) do update
    set world_id = excluded.world_id,
        respawn_enabled = excluded.respawn_enabled,
        respawn_seconds = excluded.respawn_seconds,
        last_depleted_at = excluded.last_depleted_at,
        next_respawn_at = excluded.next_respawn_at,
        depletion_count = excluded.depletion_count,
        updated_at = now();

  select jsonb_build_object(
    'world_id', p_world_id,
    'map_size', format('%sx%s', v_width, v_height),
    'map_radius', v_radius,
    'tiles', (select count(*) from public.map_tiles where world_id = p_world_id),
    'capital_slots', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'capital_slot'),
    'neutral_village_t1', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'neutral_village_t1'),
    'neutral_village_t2', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'neutral_village_t2'),
    'neutral_village_t3', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'neutral_village_t3'),
    'spoil_common', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'spoil_common'),
    'spoil_military', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'spoil_military'),
    'spoil_relic', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'spoil_relic'),
    'spoil_convoy', (select count(*) from public.map_site_profiles where world_id = p_world_id and site_kind = 'spoil_convoy')
  )
  into v_summary;

  return v_summary;
end;
$$;

create or replace view public.v_world_map_distribution as
select
  p.world_id,
  p.zone,
  p.site_kind,
  count(*)::bigint as total_sites
from public.map_site_profiles p
group by p.world_id, p.zone, p.site_kind;

comment on function public.kw_generate_mvp_map(uuid, integer, boolean, boolean)
  is 'Gera mapa MVP hex (raio 40 por padrao) com 50 capital slots, 240 aldeias vazias e 520 espolios.';

-- EXEMPLO DE USO:
-- select public.kw_generate_mvp_map('<WORLD_UUID>'::uuid, 20260307, true, true);
-- select * from public.v_world_map_distribution where world_id = '<WORLD_UUID>'::uuid order by zone, site_kind;

commit;
