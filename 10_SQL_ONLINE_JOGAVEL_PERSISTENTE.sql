-- KINGSWORLD
-- 10. PACOTE CONSOLIDADO PARA JOGO ONLINE, JOGAVEL E PERSISTENTE
-- Executar APOS o 03_SUPABASE_SCHEMA.sql
-- Este arquivo consolida e corrige os pontos dos holds 05/06/07/08/09
-- e adiciona persistencia para estados que hoje vivem em localStorage.

begin;

alter type public.world_phase add value if not exists 'phase_3';
alter type public.world_phase add value if not exists 'phase_4';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'city_class') then
    create type public.city_class as enum ('neutral', 'metropole', 'posto_avancado', 'bastiao', 'celeiro');
  end if;
  if not exists (select 1 from pg_type where typname = 'city_origin_kind') then
    create type public.city_origin_kind as enum ('claimed_city', 'wild_empty', 'abandoned_city', 'frontier_ruins', 'hotspot');
  end if;
  if not exists (select 1 from pg_type where typname = 'terrain_kind') then
    create type public.terrain_kind as enum ('crown_heartland', 'riverlands', 'frontier_pass', 'ironridge', 'ashen_fields');
  end if;
  if not exists (select 1 from pg_type where typname = 'hero_specialist_id') then
    create type public.hero_specialist_id as enum ('engineer', 'marshal', 'navigator', 'intendente', 'erudite');
  end if;
  if not exists (select 1 from pg_type where typname = 'map_order_status') then
    create type public.map_order_status as enum ('planned', 'traveling', 'resolving', 'resolved', 'cancelled', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'map_command_action') then
    create type public.map_command_action as enum ('build', 'go', 'attack', 'annex', 'spy');
  end if;
  if not exists (select 1 from pg_type where typname = 'build_mode') then
    create type public.build_mode as enum ('outpost', 'road');
  end if;
  if not exists (select 1 from pg_type where typname = 'troop_preset') then
    create type public.troop_preset as enum ('light', 'balanced', 'heavy', 'custom');
  end if;
end
$$;

alter table public.worlds
  add column if not exists capital_troop_pool_mode boolean not null default true,
  add column if not exists internal_aid_speed_multiplier numeric(6,2) not null default 5.00,
  add column if not exists support_donation_only boolean not null default true,
  add column if not exists imperial_treasury_mode boolean not null default true,
  add column if not exists instant_internal_resource_flow boolean not null default true,
  add column if not exists village_construction_cap_mode boolean not null default true,
  add column if not exists runtime_started boolean not null default false,
  add column if not exists runtime_real_time_enabled boolean not null default false,
  add column if not exists runtime_anchor_day integer not null default 0,
  add column if not exists runtime_anchor_started_at timestamptz,
  add column if not exists sandbox_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'worlds_internal_aid_speed_multiplier_chk'
      and conrelid = 'public.worlds'::regclass
  ) then
    alter table public.worlds
      add constraint worlds_internal_aid_speed_multiplier_chk
      check (internal_aid_speed_multiplier >= 1 and internal_aid_speed_multiplier <= 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'worlds_runtime_anchor_day_chk'
      and conrelid = 'public.worlds'::regclass
  ) then
    alter table public.worlds
      add constraint worlds_runtime_anchor_day_chk
      check (runtime_anchor_day >= 0 and runtime_anchor_day <= 120);
  end if;
end
$$;

alter table public.villages
  add column if not exists settlement_role text not null default 'Colonia',
  add column if not exists city_class public.city_class not null default 'neutral',
  add column if not exists city_class_locked boolean not null default false,
  add column if not exists origin_kind public.city_origin_kind not null default 'claimed_city',
  add column if not exists terrain_kind public.terrain_kind not null default 'ashen_fields',
  add column if not exists terrain_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'villages_settlement_role_check'
      and conrelid = 'public.villages'::regclass
  ) then
    alter table public.villages
      add constraint villages_settlement_role_check
      check (settlement_role in ('Capital', 'Colonia'));
  end if;
end
$$;

update public.villages
set settlement_role = case when village_type = 'capital' then 'Capital' else 'Colonia' end
where settlement_role not in ('Capital', 'Colonia');

create table if not exists public.imperial_treasuries (
  world_player_id uuid primary key references public.world_players(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  materials_stock bigint not null default 0 check (materials_stock >= 0),
  supplies_stock bigint not null default 0 check (supplies_stock >= 0),
  energy_stock bigint not null default 0 check (energy_stock >= 0),
  influence_stock bigint not null default 0 check (influence_stock >= 0),
  source_mode text not null default 'sum_of_villages'
    check (source_mode in ('sum_of_villages', 'hybrid', 'manual')),
  last_reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.village_construction_caps (
  village_site_id uuid primary key references public.villages(site_id) on delete cascade,
  capacity_points integer not null default 0 check (capacity_points >= 0),
  used_points integer not null default 0 check (used_points >= 0),
  source_mode text not null default 'formula'
    check (source_mode in ('formula', 'manual')),
  last_recomputed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_points <= capacity_points)
);

create table if not exists public.world_player_imperial_states (
  world_player_id uuid primary key references public.world_players(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  version integer not null default 9,
  materials_stock bigint not null default 0 check (materials_stock >= 0),
  supplies_stock bigint not null default 0 check (supplies_stock >= 0),
  energy_stock bigint not null default 0 check (energy_stock >= 0),
  influence_stock bigint not null default 0 check (influence_stock >= 0),
  militia_count bigint not null default 0 check (militia_count >= 0),
  shooters_count bigint not null default 0 check (shooters_count >= 0),
  scouts_count bigint not null default 0 check (scouts_count >= 0),
  machinery_count bigint not null default 0 check (machinery_count >= 0),
  recruited_diplomats integer not null default 0 check (recruited_diplomats between 0 and 9),
  recruited_tribe_envoys integer not null default 0 check (recruited_tribe_envoys between 0 and 2),
  tribe_envoys_committed integer not null default 0 check (tribe_envoys_committed between 0 and 2),
  annex_envoys_committed integer not null default 0 check (annex_envoys_committed between 0 and 9),
  sandbox_strategy_id text,
  sandbox_completed_action_ids jsonb not null default '[]'::jsonb,
  sandbox_quests_completed integer not null default 0 check (sandbox_quests_completed between 0 and 3),
  sandbox_wonders_built integer not null default 0 check (sandbox_wonders_built between 0 and 5),
  sandbox_dome_active boolean not null default false,
  sandbox_march_started boolean not null default false,
  sandbox_last_synced_day integer not null default 0 check (sandbox_last_synced_day between 0 and 120),
  sandbox_snapshots_json jsonb not null default '{}'::jsonb,
  logs_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, world_player_id)
);

create table if not exists public.village_specialist_assignments (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  village_site_id uuid not null references public.villages(site_id) on delete cascade,
  hero_slot public.hero_specialist_id,
  diplomat_assigned boolean not null default false,
  deployed_troops bigint not null default 0 check (deployed_troops >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_player_id, village_site_id)
);

create table if not exists public.world_player_map_orders (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  origin_site_id uuid references public.map_sites(id) on delete set null,
  target_site_id uuid references public.map_sites(id) on delete set null,
  target_tile_id uuid references public.map_tiles(id) on delete set null,
  target_coord text not null,
  target_label text,
  movement_type public.movement_type not null,
  command_action public.map_command_action not null,
  build_mode public.build_mode,
  troop_preset public.troop_preset,
  troop_dispatch_json jsonb not null default '{}'::jsonb,
  eta_minutes integer not null check (eta_minutes > 0),
  launched_at timestamptz not null default now(),
  arrival_at timestamptz not null,
  status public.map_order_status not null default 'traveling',
  result_code text,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (arrival_at > launched_at)
);

create table if not exists public.city_diplomats (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  village_site_id uuid not null references public.villages(site_id) on delete cascade,
  owner_world_player_id uuid not null references public.world_players(id) on delete cascade,
  unlocked boolean not null default false,
  assigned_locally boolean not null default false,
  assigned_to_tribe boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, village_site_id)
);

create table if not exists public.tribe_envoy_commits (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  owner_world_player_id uuid not null references public.world_players(id) on delete cascade,
  envoy_slots integer not null default 0 check (envoy_slots between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, tribe_id, owner_world_player_id)
);

create table if not exists public.map_site_profiles (
  site_id uuid primary key references public.map_sites(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  site_type public.site_type not null,
  zone text not null check (zone in ('outer', 'mid', 'core')),
  site_kind text not null,
  tier smallint check (tier is null or tier between 1 and 3),
  guard_power integer not null default 0 check (guard_power >= 0),
  influence_capture_cost integer not null default 0 check (influence_capture_cost >= 0),
  loot_table_json jsonb not null default '{}'::jsonb,
  respawn_seconds integer check (respawn_seconds is null or respawn_seconds >= 0),
  last_claimed_at timestamptz,
  next_respawn_at timestamptz,
  is_claimable boolean not null default true,
  starts_with_structures boolean not null default false,
  recommended_city_class public.city_class,
  occupation_kind public.city_origin_kind,
  terrain_kind public.terrain_kind,
  terrain_label text,
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

create or replace function public.is_friendly_target_site(
  p_actor_world_player_id uuid,
  p_target_site_id uuid
)
returns boolean
language plpgsql
stable
as $$
declare
  v_actor_tribe_id uuid;
  v_target_owner_id uuid;
  v_target_tribe_id uuid;
begin
  select wp.tribe_id
    into v_actor_tribe_id
  from public.world_players wp
  where wp.id = p_actor_world_player_id;

  select v.owner_world_player_id, wp.tribe_id
    into v_target_owner_id, v_target_tribe_id
  from public.villages v
  left join public.world_players wp on wp.id = v.owner_world_player_id
  where v.site_id = p_target_site_id
    and v.destroyed_at is null
  limit 1;

  if v_target_owner_id is not null then
    if v_target_owner_id = p_actor_world_player_id then
      return true;
    end if;
    if v_actor_tribe_id is not null and v_target_tribe_id = v_actor_tribe_id then
      return true;
    end if;
    return false;
  end if;

  select tc.tribe_id
    into v_target_tribe_id
  from public.tribe_citadels tc
  where tc.site_id = p_target_site_id
    and tc.status in ('planned', 'building', 'active')
  limit 1;

  if v_target_tribe_id is not null and v_actor_tribe_id = v_target_tribe_id then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.enforce_capital_home_troops()
returns trigger
language plpgsql
as $$
declare
  v_world_id uuid;
  v_owner_id uuid;
  v_village_type public.village_type;
  v_capital_mode boolean;
begin
  if new.stationing_type <> 'home' then
    return new;
  end if;

  select v.world_id, v.owner_world_player_id, v.village_type, w.capital_troop_pool_mode
    into v_world_id, v_owner_id, v_village_type, v_capital_mode
  from public.villages v
  join public.worlds w on w.id = v.world_id
  where v.site_id = new.site_id
    and v.destroyed_at is null
  limit 1;

  if v_world_id is null then
    return new;
  end if;

  if v_capital_mode and v_village_type <> 'capital' then
    raise exception 'Modo tropa-central ativo: apenas aldeia capital pode manter stationing_type=home.';
  end if;

  if v_owner_id is not null and new.owner_world_player_id <> v_owner_id then
    raise exception 'Stack home invalida: owner da stack difere do owner da aldeia.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_donation_only_resource_movement()
returns trigger
language plpgsql
as $$
declare
  v_actor_world_player_id uuid;
  v_target_site_id uuid;
  v_movement_type public.movement_type;
  v_support_donation_only boolean;
begin
  select m.actor_world_player_id, m.target_site_id, m.movement_type, w.support_donation_only
    into v_actor_world_player_id, v_target_site_id, v_movement_type, v_support_donation_only
  from public.movements m
  join public.worlds w on w.id = m.world_id
  where m.id = new.movement_id
  limit 1;

  if v_movement_type in ('support', 'transport', 'supply') and v_support_donation_only and v_target_site_id is not null then
    if not public.is_friendly_target_site(v_actor_world_player_id, v_target_site_id) then
      raise exception 'Movimento de apoio/recurso invalido: alvo nao amigavel para modo doacao.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_village_specialist_assignment_world()
returns trigger
language plpgsql
as $$
declare
  v_world_id uuid;
begin
  select world_id into v_world_id
  from public.world_players
  where id = new.world_player_id;

  if v_world_id is not null then
    new.world_id := v_world_id;
  end if;

  return new;
end;
$$;

create or replace function public.sync_world_player_imperial_state_world()
returns trigger
language plpgsql
as $$
declare
  v_world_id uuid;
begin
  select world_id into v_world_id
  from public.world_players
  where id = new.world_player_id;

  if v_world_id is null then
    raise exception 'world_player_imperial_states exige world_player valido.';
  end if;

  new.world_id := v_world_id;
  return new;
end;
$$;

create or replace function public.set_imperial_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_capital_home_troops on public.site_troop_stacks;
create trigger trg_enforce_capital_home_troops
before insert or update on public.site_troop_stacks
for each row
execute function public.enforce_capital_home_troops();

drop trigger if exists trg_validate_donation_only_resource_movement on public.movement_resources;
create trigger trg_validate_donation_only_resource_movement
before insert or update on public.movement_resources
for each row
execute function public.validate_donation_only_resource_movement();

drop trigger if exists trg_sync_world_player_imperial_state_world on public.world_player_imperial_states;
create trigger trg_sync_world_player_imperial_state_world
before insert or update on public.world_player_imperial_states
for each row
execute function public.sync_world_player_imperial_state_world();

drop trigger if exists trg_sync_village_specialist_assignment_world on public.village_specialist_assignments;
create trigger trg_sync_village_specialist_assignment_world
before insert or update on public.village_specialist_assignments
for each row
execute function public.sync_village_specialist_assignment_world();

drop trigger if exists set_updated_at_imperial_treasuries on public.imperial_treasuries;
create trigger set_updated_at_imperial_treasuries
before update on public.imperial_treasuries
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_village_construction_caps on public.village_construction_caps;
create trigger set_updated_at_village_construction_caps
before update on public.village_construction_caps
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_world_player_imperial_states on public.world_player_imperial_states;
create trigger set_updated_at_world_player_imperial_states
before update on public.world_player_imperial_states
for each row execute function public.set_imperial_state_updated_at();

drop trigger if exists set_updated_at_village_specialist_assignments on public.village_specialist_assignments;
create trigger set_updated_at_village_specialist_assignments
before update on public.village_specialist_assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_world_player_map_orders on public.world_player_map_orders;
create trigger set_updated_at_world_player_map_orders
before update on public.world_player_map_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_city_diplomats on public.city_diplomats;
create trigger set_updated_at_city_diplomats
before update on public.city_diplomats
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tribe_envoy_commits on public.tribe_envoy_commits;
create trigger set_updated_at_tribe_envoy_commits
before update on public.tribe_envoy_commits
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_map_site_profiles on public.map_site_profiles;
create trigger set_updated_at_map_site_profiles
before update on public.map_site_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_map_site_respawns on public.map_site_respawns;
create trigger set_updated_at_map_site_respawns
before update on public.map_site_respawns
for each row execute function public.set_updated_at();

create index if not exists idx_imperial_treasuries_world_id
  on public.imperial_treasuries (world_id);

create index if not exists idx_world_player_imperial_states_world_id
  on public.world_player_imperial_states (world_id);

create index if not exists idx_village_specialist_assignments_player_village
  on public.village_specialist_assignments (world_player_id, village_site_id);

create index if not exists idx_world_player_map_orders_player_status_arrival
  on public.world_player_map_orders (world_player_id, status, arrival_at);

create index if not exists idx_world_player_map_orders_world_status_arrival
  on public.world_player_map_orders (world_id, status, arrival_at);

create index if not exists idx_city_diplomats_owner_unlocked
  on public.city_diplomats (owner_world_player_id, unlocked, assigned_locally, assigned_to_tribe);

create index if not exists idx_tribe_envoy_commits_owner
  on public.tribe_envoy_commits (owner_world_player_id, tribe_id);

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

create or replace view public.v_imperial_treasury_seed as
select
  v.world_id,
  v.owner_world_player_id as world_player_id,
  sum(vrs.materials_stock)::bigint as materials_stock,
  sum(vrs.supplies_stock)::bigint as supplies_stock,
  sum(vrs.energy_stock)::bigint as energy_stock,
  sum(vrs.influence_stock)::bigint as influence_stock,
  max(vrs.last_reconciled_at) as last_reconciled_at
from public.villages v
join public.village_resource_states vrs on vrs.village_site_id = v.site_id
where v.destroyed_at is null
  and v.owner_world_player_id is not null
group by v.world_id, v.owner_world_player_id;

create or replace view public.v_village_construction_summary as
select
  v.world_id,
  v.owner_world_player_id,
  v.site_id as village_site_id,
  v.name as village_name,
  coalesce(vcc.capacity_points, 0) as capacity_points,
  coalesce(vcc.used_points, 0) as used_points,
  greatest(coalesce(vcc.capacity_points, 0) - coalesce(vcc.used_points, 0), 0) as remaining_points,
  vcc.last_recomputed_at,
  vcc.updated_at
from public.villages v
left join public.village_construction_caps vcc on vcc.village_site_id = v.site_id
where v.destroyed_at is null;

create or replace view public.v_village_resource_eta as
select
  vrs.village_site_id,
  v.world_id,
  v.owner_world_player_id,
  v.name as village_name,
  vrs.materials_stock,
  vrs.materials_capacity,
  vrs.materials_rate_per_minute,
  case
    when vrs.materials_stock >= vrs.materials_capacity then 0
    when vrs.materials_rate_per_minute <= 0 then null
    else ceil((vrs.materials_capacity - vrs.materials_stock)::numeric / vrs.materials_rate_per_minute::numeric)::bigint
  end as materials_minutes_to_cap,
  vrs.supplies_stock,
  vrs.supplies_capacity,
  vrs.supplies_rate_per_minute,
  vrs.supplies_upkeep_per_minute,
  (vrs.supplies_rate_per_minute - vrs.supplies_upkeep_per_minute) as supplies_net_rate_per_minute,
  case
    when vrs.supplies_stock >= vrs.supplies_capacity then 0
    when (vrs.supplies_rate_per_minute - vrs.supplies_upkeep_per_minute) <= 0 then null
    else ceil((vrs.supplies_capacity - vrs.supplies_stock)::numeric / (vrs.supplies_rate_per_minute - vrs.supplies_upkeep_per_minute)::numeric)::bigint
  end as supplies_minutes_to_cap,
  vrs.energy_stock,
  vrs.energy_capacity,
  vrs.energy_rate_per_minute,
  vrs.energy_upkeep_per_minute,
  (vrs.energy_rate_per_minute - vrs.energy_upkeep_per_minute) as energy_net_rate_per_minute,
  case
    when vrs.energy_stock >= vrs.energy_capacity then 0
    when (vrs.energy_rate_per_minute - vrs.energy_upkeep_per_minute) <= 0 then null
    else ceil((vrs.energy_capacity - vrs.energy_stock)::numeric / (vrs.energy_rate_per_minute - vrs.energy_upkeep_per_minute)::numeric)::bigint
  end as energy_minutes_to_cap,
  vrs.influence_stock,
  vrs.influence_capacity,
  vrs.influence_rate_per_minute,
  case
    when vrs.influence_stock >= vrs.influence_capacity then 0
    when vrs.influence_rate_per_minute <= 0 then null
    else ceil((vrs.influence_capacity - vrs.influence_stock)::numeric / vrs.influence_rate_per_minute::numeric)::bigint
  end as influence_minutes_to_cap,
  vrs.last_reconciled_at,
  vrs.updated_at
from public.village_resource_states vrs
join public.villages v on v.site_id = vrs.village_site_id;

insert into public.building_catalog (
  building_code,
  name,
  category,
  max_level,
  base_cost_json,
  base_time_seconds,
  unlock_rules_json,
  effect_rules_json
)
values
  ('palace', 'Palacio', 'core', 10, '{"materials":450,"supplies":180,"energy":130,"influence":60}'::jsonb, 1440, '{}'::jsonb, '{"benefit":"Cap politico","base":100,"per_level":45,"unit":"pts"}'::jsonb),
  ('senate', 'Senado', 'core', 10, '{"materials":620,"supplies":210,"energy":250,"influence":110}'::jsonb, 1560, '{"requires":{"palace":1}}'::jsonb, '{"benefit":"Cap de influencia","base":500,"per_level":250,"unit":"pts"}'::jsonb),
  ('mines', 'Minas', 'economy', 10, '{"materials":320,"supplies":120,"energy":110,"influence":36}'::jsonb, 960, '{"requires":{"palace":1}}'::jsonb, '{"benefit":"Materiais","base":260,"per_level":58,"unit":"per_hour"}'::jsonb),
  ('farms', 'Fazendas', 'economy', 10, '{"materials":300,"supplies":135,"energy":80,"influence":34}'::jsonb, 960, '{"requires":{"palace":1}}'::jsonb, '{"benefit":"Suprimentos","base":240,"per_level":55,"unit":"per_hour"}'::jsonb),
  ('housing', 'Habitacoes', 'economy', 10, '{"materials":360,"supplies":180,"energy":95,"influence":40}'::jsonb, 1080, '{"requires":{"palace":1}}'::jsonb, '{"benefit":"Slots populacionais","base":8,"per_level":1,"unit":"slots"}'::jsonb),
  ('research', 'C. Pesquisa', 'science', 10, '{"materials":520,"supplies":220,"energy":190,"influence":78}'::jsonb, 1380, '{"requires":{"palace":2}}'::jsonb, '{"benefit":"Velocidade de pesquisa","base":4,"per_level":1.4,"unit":"percent"}'::jsonb),
  ('roads', 'M. Viaria', 'infrastructure', 10, '{"materials":520,"supplies":320,"energy":220,"influence":85}'::jsonb, 1200, '{"requires":{"palace":2}}'::jsonb, '{"benefit":"Velocidade de deslocamento","base":1.02,"per_level":0.02,"unit":"multiplier"}'::jsonb),
  ('barracks', 'Quartel', 'military', 10, '{"materials":420,"supplies":260,"energy":140,"influence":55}'::jsonb, 1200, '{"requires":{"palace":2}}'::jsonb, '{"benefit":"Capacidade de treinamento","base":12,"per_level":2,"unit":"percent"}'::jsonb),
  ('arsenal', 'Arsenal', 'military', 10, '{"materials":560,"supplies":260,"energy":170,"influence":65}'::jsonb, 1320, '{"requires":{"barracks":2}}'::jsonb, '{"benefit":"Ataque do exercito","base":10,"per_level":2.5,"unit":"percent"}'::jsonb),
  ('wall', 'Muralha', 'defense', 10, '{"materials":680,"supplies":120,"energy":190,"influence":70}'::jsonb, 1680, '{"requires":{"palace":2}}'::jsonb, '{"benefit":"Defesa estrutural","base":120,"per_level":18,"unit":"percent"}'::jsonb),
  ('wonder', 'Maravilha', 'endgame', 1, '{"materials":1300,"supplies":800,"energy":620,"influence":260}'::jsonb, 2040, '{"requires":{"palace":10,"senate":8,"mines":8,"farms":8,"housing":8,"research":8,"barracks":8,"arsenal":8,"wall":8}}'::jsonb, '{"benefit":"Poder imperial","base":2,"per_level":1.8,"unit":"percent"}'::jsonb)
on conflict (building_code) do update
set
  name = excluded.name,
  category = excluded.category,
  max_level = excluded.max_level,
  base_cost_json = excluded.base_cost_json,
  base_time_seconds = excluded.base_time_seconds,
  unlock_rules_json = excluded.unlock_rules_json,
  effect_rules_json = excluded.effect_rules_json;

insert into public.unit_catalog (
  catalog_key,
  unit_code,
  unit_tier,
  unit_grade,
  attack_value,
  defense_value,
  speed_value,
  carry_capacity,
  upkeep_supplies_per_minute,
  upkeep_energy_per_minute,
  train_cost_json,
  train_time_seconds,
  special_rules_json
)
values
  ('militia_bronze_t1', 'militia', 1, 'bronze', 12, 16, 8, 20, 1, 0, '{"materials":110,"supplies":90,"energy":18,"influence":0}'::jsonb, 180, '{}'::jsonb),
  ('shooters_bronze_t1', 'shooters', 1, 'bronze', 18, 10, 8, 18, 1, 0, '{"materials":140,"supplies":85,"energy":24,"influence":0}'::jsonb, 210, '{}'::jsonb),
  ('scouts_bronze_t1', 'scouts', 1, 'bronze', 9, 8, 12, 14, 1, 0, '{"materials":120,"supplies":70,"energy":28,"influence":0}'::jsonb, 180, '{}'::jsonb),
  ('machinery_bronze_t1', 'machinery', 1, 'bronze', 34, 18, 5, 40, 2, 1, '{"materials":240,"supplies":120,"energy":75,"influence":6}'::jsonb, 360, '{}'::jsonb)
on conflict (catalog_key) do update
set
  unit_code = excluded.unit_code,
  unit_tier = excluded.unit_tier,
  unit_grade = excluded.unit_grade,
  attack_value = excluded.attack_value,
  defense_value = excluded.defense_value,
  speed_value = excluded.speed_value,
  carry_capacity = excluded.carry_capacity,
  upkeep_supplies_per_minute = excluded.upkeep_supplies_per_minute,
  upkeep_energy_per_minute = excluded.upkeep_energy_per_minute,
  train_cost_json = excluded.train_cost_json,
  train_time_seconds = excluded.train_time_seconds,
  special_rules_json = excluded.special_rules_json;

comment on table public.world_player_imperial_states is
  'Estado persistente que hoje vive no localStorage: tesouro agregado, tropas, sandbox, logs e progresso operacional do jogador.';

comment on table public.village_specialist_assignments is
  'Alocacao por cidade de heroi, diplomata e destacamento local de tropas. Substitui heroByVillage, diplomatByVillage e deployedByVillage do navegador.';

comment on table public.world_player_map_orders is
  'Persistencia das ordens do mapa em nivel de coordenada/hex, inclusive fundacao, anexacao, espionagem, portal e ataques.';

comment on table public.city_diplomats is
  'Pool de diplomatas de cidade liberados por desenvolvimento de Colonias.';

comment on table public.tribe_envoy_commits is
  'Controle dos enviados especiais consumidos pela progressao tribal.';

comment on view public.v_imperial_treasury_seed is
  'Snapshot para inicializar o tesouro imperial a partir da soma dos estoques das aldeias do jogador.';

comment on view public.v_village_construction_summary is
  'Painel pronto para UI: cap de obra da aldeia, usado e saldo restante.';

comment on view public.v_village_resource_eta is
  'Painel pronto para UI: ETA para lotacao de materiais, suprimentos, energia e influencia por aldeia.';

commit;
