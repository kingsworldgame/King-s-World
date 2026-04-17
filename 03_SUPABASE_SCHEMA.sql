-- KINGSWORLD
-- 03. SUPABASE / POSTGRESQL SCHEMA
-- Schema base para banco novo.
-- Se usar Supabase Auth, mapeie public.users.auth_user_id para auth.users.id.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create type account_status as enum ('pending', 'active', 'disabled', 'banned');
create type world_status as enum ('open', 'running', 'finalized');
create type world_phase as enum ('phase_1', 'phase_2', 'closed');
create type world_player_status as enum ('alive', 'eliminated', 'resigned', 'archived');
create type tribe_status as enum ('active', 'collapsed', 'dissolved');
create type invite_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
create type site_type as enum ('village', 'citadel', 'ruin');
create type site_status as enum ('active', 'ruined', 'destroyed', 'hidden');
create type village_type as enum ('capital', 'colony');
create type political_state as enum ('stable', 'succession_pending', 'fallen', 'ruined');
create type capital_eligibility_status as enum ('eligible', 'ineligible', 'pending_review');
create type citadel_status as enum ('planned', 'building', 'active', 'destroyed');
create type building_operational_state as enum ('operational', 'paused', 'damaged', 'destroyed');
create type job_status as enum ('queued', 'running', 'completed', 'cancelled', 'failed');
create type building_job_type as enum ('upgrade', 'downgrade', 'repair');
create type target_scope_type as enum ('world_player', 'village');
create type protocol_status as enum ('active', 'resolved', 'expired', 'cancelled');
create type royal_type as enum ('king', 'prince');
create type officer_type as enum ('war_leader', 'hero', 'general', 'diplomat', 'spy', 'engineer', 'agriculturist');
create type unit_presence_status as enum ('stationed', 'moving', 'dead', 'unavailable');
create type troop_unit_code as enum ('militia', 'shooters', 'scouts', 'machinery');
create type unit_grade as enum ('bronze', 'silver', 'gold');
create type stationing_type as enum ('home', 'support', 'citadel_guard');
create type actor_type as enum ('player', 'npc');
create type movement_type as enum ('attack', 'support', 'spy', 'transport', 'supply', 'return', 'horde');
create type movement_status as enum ('traveling', 'resolving', 'returning', 'completed', 'cancelled', 'failed');
create type tribe_effect_type as enum ('citadel_bonus', 'collapse_debuff');
create type effect_status as enum ('active', 'expired', 'cancelled');
create type event_type as enum ('phase_transition', 'catastrophe', 'tribute', 'horde_wave', 'system_notice');
create type event_status as enum ('scheduled', 'active', 'resolved', 'failed', 'expired');
create type event_target_type as enum ('world_player', 'tribe', 'site');
create type event_target_status as enum ('pending', 'paid', 'failed', 'resolved');
create type report_type as enum ('battle', 'spy', 'loot', 'support', 'horde', 'tribute', 'system');
create type report_visibility_reason as enum ('personal', 'tribe_shared', 'system_forced');
create type score_subject_type as enum ('world_player', 'tribe');
create type standing_type as enum ('individual', 'tribe');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.building_catalog (
  building_code text primary key,
  name text not null,
  category text not null,
  max_level integer not null check (max_level > 0),
  base_cost_json jsonb not null default '{}'::jsonb,
  base_time_seconds integer not null default 60 check (base_time_seconds >= 0),
  unlock_rules_json jsonb not null default '{}'::jsonb,
  effect_rules_json jsonb not null default '{}'::jsonb
);

create table public.research_catalog (
  research_code text primary key,
  branch_code text not null,
  max_level integer not null check (max_level > 0),
  base_cost_json jsonb not null default '{}'::jsonb,
  base_time_seconds integer not null default 60 check (base_time_seconds >= 0),
  prerequisite_rules_json jsonb not null default '{}'::jsonb,
  effect_rules_json jsonb not null default '{}'::jsonb
);

create table public.protocol_catalog (
  protocol_code text primary key,
  target_scope_type target_scope_type not null,
  cost_rules_json jsonb not null default '{}'::jsonb,
  effect_rules_json jsonb not null default '{}'::jsonb,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0)
);

create table public.medal_catalog (
  medal_code text primary key,
  name text not null,
  description text not null,
  permanent_flag boolean not null default true
);

create table public.event_catalog (
  event_code text primary key,
  event_type event_type not null,
  payload_template_json jsonb not null default '{}'::jsonb,
  scaling_rules_json jsonb not null default '{}'::jsonb
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  username citext not null unique,
  email citext not null unique,
  password_hash text,
  global_score_cached bigint not null default 0 check (global_score_cached >= 0),
  account_status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  status world_status not null default 'open',
  phase world_phase not null default 'phase_1',
  day_number integer not null default 0 check (day_number >= 0 and day_number <= 120),
  registration_opens_at timestamptz not null,
  starts_at timestamptz not null,
  phase_2_starts_at timestamptz not null,
  ends_at timestamptz not null,
  finalized_at timestamptz,
  player_cap integer not null default 50 check (player_cap > 0),
  tribe_member_cap integer not null default 6 check (tribe_member_cap > 0),
  map_width integer not null check (map_width > 0),
  map_height integer not null check (map_height > 0),
  map_hex_radius integer not null default 40 check (map_hex_radius > 0),
  base_move_time_minutes integer not null default 45 check (base_move_time_minutes > 0),
  road_move_time_minutes integer not null default 15 check (road_move_time_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phase_2_starts_at > starts_at),
  check (ends_at > phase_2_starts_at),
  check (road_move_time_minutes <= base_move_time_minutes)
);

create table public.user_medals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  world_id uuid references public.worlds(id) on delete set null,
  medal_code text not null references public.medal_catalog(medal_code),
  awarded_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create table public.user_world_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  final_rank_individual integer check (final_rank_individual is null or final_rank_individual > 0),
  final_rank_tribe integer check (final_rank_tribe is null or final_rank_tribe > 0),
  final_power_score bigint not null default 0,
  survived_to_end boolean not null default false,
  legacy_summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, world_id)
);

create table public.world_players (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  tribe_id uuid,
  status world_player_status not null default 'alive',
  joined_at timestamptz not null default now(),
  eliminated_at timestamptz,
  elimination_reason text,
  current_capital_site_id uuid,
  power_score_cached bigint not null default 0 check (power_score_cached >= 0),
  is_alive_cached boolean not null default true,
  tribute_debt_cached bigint not null default 0 check (tribute_debt_cached >= 0),
  last_score_recalc_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (world_id, user_id)
);

create table public.tribes (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  name citext not null,
  tag citext not null,
  leader_world_player_id uuid,
  status tribe_status not null default 'active',
  total_score_cached bigint not null default 0 check (total_score_cached >= 0),
  collapse_started_at timestamptz,
  collapse_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, name),
  unique (world_id, tag)
);

alter table public.world_players
  add constraint world_players_tribe_id_fkey foreign key (tribe_id) references public.tribes(id) on delete set null;

alter table public.tribes
  add constraint tribes_leader_world_player_id_fkey foreign key (leader_world_player_id) references public.world_players(id) on delete set null;

create table public.tribe_invites (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  invited_world_player_id uuid not null references public.world_players(id) on delete cascade,
  invited_by_world_player_id uuid not null references public.world_players(id) on delete cascade,
  status invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz
);

create table public.map_tiles (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  q integer not null,
  r integer not null,
  x integer generated always as (q) stored,
  y integer generated always as (r) stored,
  axial_key text generated always as (((q)::text || ',') || (r)::text) stored,
  biome_type text not null,
  terrain_type text not null default 'normal',
  created_at timestamptz not null default now(),
  unique (world_id, q, r)
);

create table public.map_sites (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  tile_id uuid not null unique references public.map_tiles(id) on delete cascade,
  site_type site_type not null,
  status site_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.world_players
  add constraint world_players_current_capital_site_id_fkey foreign key (current_capital_site_id) references public.map_sites(id) on delete set null;

create table public.villages (
  site_id uuid primary key references public.map_sites(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  owner_world_player_id uuid references public.world_players(id) on delete set null,
  founder_world_player_id uuid references public.world_players(id) on delete set null,
  name text not null,
  village_type village_type not null,
  political_state political_state not null default 'stable',
  capital_eligibility_status capital_eligibility_status not null default 'pending_review',
  is_original_capital boolean not null default false,
  founded_at timestamptz not null default now(),
  conquered_at timestamptz,
  destroyed_at timestamptz,
  last_political_change_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index villages_one_active_capital_per_player_idx
  on public.villages (owner_world_player_id)
  where village_type = 'capital' and destroyed_at is null and owner_world_player_id is not null;

create table public.tribe_citadels (
  site_id uuid primary key references public.map_sites(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  tribe_id uuid not null unique references public.tribes(id) on delete cascade,
  status citadel_status not null default 'planned',
  construction_progress bigint not null default 0 check (construction_progress >= 0),
  level integer not null default 0 check (level >= 0),
  destroyed_at timestamptz,
  collapse_triggered_at timestamptz,
  bonus_profile_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.village_resource_states (
  village_site_id uuid primary key references public.villages(site_id) on delete cascade,
  materials_stock bigint not null default 0 check (materials_stock >= 0),
  supplies_stock bigint not null default 0 check (supplies_stock >= 0),
  energy_stock bigint not null default 0 check (energy_stock >= 0),
  influence_stock bigint not null default 0 check (influence_stock >= 0),
  materials_capacity bigint not null default 0 check (materials_capacity >= 0),
  supplies_capacity bigint not null default 0 check (supplies_capacity >= 0),
  energy_capacity bigint not null default 0 check (energy_capacity >= 0),
  influence_capacity bigint not null default 0 check (influence_capacity >= 0),
  materials_rate_per_minute bigint not null default 0,
  supplies_rate_per_minute bigint not null default 0,
  energy_rate_per_minute bigint not null default 0,
  influence_rate_per_minute bigint not null default 0,
  supplies_upkeep_per_minute bigint not null default 0 check (supplies_upkeep_per_minute >= 0),
  energy_upkeep_per_minute bigint not null default 0 check (energy_upkeep_per_minute >= 0),
  last_reconciled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.village_buildings (
  id uuid primary key default gen_random_uuid(),
  village_site_id uuid not null references public.villages(site_id) on delete cascade,
  building_code text not null references public.building_catalog(building_code),
  level integer not null default 0 check (level >= 0),
  operational_state building_operational_state not null default 'operational',
  updated_at timestamptz not null default now(),
  unique (village_site_id, building_code)
);

create table public.building_jobs (
  id uuid primary key default gen_random_uuid(),
  village_site_id uuid not null references public.villages(site_id) on delete cascade,
  building_code text not null references public.building_catalog(building_code),
  job_type building_job_type not null,
  from_level integer not null default 0 check (from_level >= 0),
  to_level integer not null default 0 check (to_level >= 0),
  status job_status not null default 'queued',
  cost_materials bigint not null default 0 check (cost_materials >= 0),
  cost_supplies bigint not null default 0 check (cost_supplies >= 0),
  cost_energy bigint not null default 0 check (cost_energy >= 0),
  cost_influence bigint not null default 0 check (cost_influence >= 0),
  refund_materials bigint not null default 0 check (refund_materials >= 0),
  refund_supplies bigint not null default 0 check (refund_supplies >= 0),
  refund_energy bigint not null default 0 check (refund_energy >= 0),
  refund_influence bigint not null default 0 check (refund_influence >= 0),
  queued_at timestamptz not null default now(),
  starts_at timestamptz,
  completes_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  source_reason text
);

create table public.world_player_research (
  id uuid primary key default gen_random_uuid(),
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  research_code text not null references public.research_catalog(research_code),
  current_level integer not null default 0 check (current_level >= 0),
  unlocked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_player_id, research_code)
);

create table public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  research_code text not null references public.research_catalog(research_code),
  from_level integer not null default 0 check (from_level >= 0),
  to_level integer not null default 0 check (to_level >= 0),
  status job_status not null default 'queued',
  started_at timestamptz,
  completes_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table public.protocol_activations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  owner_world_player_id uuid not null references public.world_players(id) on delete cascade,
  target_scope_type target_scope_type not null,
  target_site_id uuid references public.map_sites(id) on delete cascade,
  protocol_code text not null references public.protocol_catalog(protocol_code),
  status protocol_status not null default 'active',
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  resolved_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb,
  check ((target_scope_type = 'world_player' and target_site_id is null) or (target_scope_type = 'village' and target_site_id is not null))
);

create table public.world_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  event_code text not null references public.event_catalog(event_code),
  event_type event_type not null,
  phase_scope world_phase,
  status event_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.world_event_targets (
  id uuid primary key default gen_random_uuid(),
  world_event_id uuid not null references public.world_events(id) on delete cascade,
  target_type event_target_type not null,
  target_world_player_id uuid references public.world_players(id) on delete cascade,
  target_tribe_id uuid references public.tribes(id) on delete cascade,
  target_site_id uuid references public.map_sites(id) on delete cascade,
  requirement_materials bigint not null default 0 check (requirement_materials >= 0),
  requirement_supplies bigint not null default 0 check (requirement_supplies >= 0),
  requirement_energy bigint not null default 0 check (requirement_energy >= 0),
  requirement_influence bigint not null default 0 check (requirement_influence >= 0),
  paid_materials bigint not null default 0 check (paid_materials >= 0),
  paid_supplies bigint not null default 0 check (paid_supplies >= 0),
  paid_energy bigint not null default 0 check (paid_energy >= 0),
  paid_influence bigint not null default 0 check (paid_influence >= 0),
  status event_target_status not null default 'pending',
  resolved_at timestamptz,
  outcome_json jsonb not null default '{}'::jsonb,
  check (
    (target_type = 'world_player' and target_world_player_id is not null and target_tribe_id is null and target_site_id is null)
    or (target_type = 'tribe' and target_world_player_id is null and target_tribe_id is not null and target_site_id is null)
    or (target_type = 'site' and target_world_player_id is null and target_tribe_id is null and target_site_id is not null)
  )
);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  actor_type actor_type not null default 'player',
  actor_world_player_id uuid references public.world_players(id) on delete set null,
  source_event_id uuid references public.world_events(id) on delete set null,
  origin_site_id uuid references public.map_sites(id) on delete set null,
  target_site_id uuid not null references public.map_sites(id) on delete cascade,
  movement_type movement_type not null,
  status movement_status not null default 'traveling',
  launched_at timestamptz not null,
  arrival_at timestamptz not null,
  resolved_at timestamptz,
  return_arrival_at timestamptz,
  completed_at timestamptz,
  result_code text,
  created_at timestamptz not null default now(),
  check (arrival_at > launched_at)
);

create table public.royal_units (
  id uuid primary key default gen_random_uuid(),
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  royal_type royal_type not null,
  status unit_presence_status not null default 'stationed',
  current_site_id uuid references public.map_sites(id) on delete set null,
  current_movement_id uuid,
  last_known_to_owner_at timestamptz not null default now(),
  died_at timestamptz,
  death_report_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_player_id, royal_type),
  check ((status = 'stationed' and current_site_id is not null and current_movement_id is null) or (status = 'moving' and current_site_id is null) or (status = 'dead' and died_at is not null) or (status = 'unavailable'))
);

create table public.officer_units (
  id uuid primary key default gen_random_uuid(),
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  officer_type officer_type not null,
  status unit_presence_status not null default 'stationed',
  current_site_id uuid references public.map_sites(id) on delete set null,
  current_movement_id uuid,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check ((status = 'stationed' and current_site_id is not null and current_movement_id is null) or (status = 'moving' and current_site_id is null) or (status = 'dead') or (status = 'unavailable'))
);

alter table public.royal_units
  add constraint royal_units_current_movement_id_fkey foreign key (current_movement_id) references public.movements(id) on delete set null;

alter table public.officer_units
  add constraint officer_units_current_movement_id_fkey foreign key (current_movement_id) references public.movements(id) on delete set null;

create table public.site_troop_stacks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.map_sites(id) on delete cascade,
  owner_world_player_id uuid not null references public.world_players(id) on delete cascade,
  unit_code troop_unit_code not null,
  unit_grade unit_grade not null,
  stationing_type stationing_type not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (site_id, owner_world_player_id, unit_code, unit_grade, stationing_type)
);

create table public.movement_troops (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.movements(id) on delete cascade,
  owner_world_player_id uuid not null references public.world_players(id) on delete cascade,
  unit_code troop_unit_code not null,
  unit_grade unit_grade not null,
  quantity_sent bigint not null check (quantity_sent > 0),
  quantity_survived bigint check (quantity_survived is null or quantity_survived >= 0),
  unique (movement_id, owner_world_player_id, unit_code, unit_grade)
);

create table public.movement_officers (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.movements(id) on delete cascade,
  officer_unit_id uuid not null references public.officer_units(id) on delete cascade,
  role_code text not null,
  survived boolean,
  unique (movement_id, officer_unit_id)
);

create table public.movement_royals (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.movements(id) on delete cascade,
  royal_unit_id uuid not null references public.royal_units(id) on delete cascade,
  survived boolean,
  unique (movement_id, royal_unit_id)
);

create table public.movement_resources (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null unique references public.movements(id) on delete cascade,
  materials_amount bigint not null default 0 check (materials_amount >= 0),
  supplies_amount bigint not null default 0 check (supplies_amount >= 0),
  energy_amount bigint not null default 0 check (energy_amount >= 0),
  influence_amount bigint not null default 0 check (influence_amount >= 0)
);

create table public.citadel_donations (
  id uuid primary key default gen_random_uuid(),
  citadel_site_id uuid not null references public.tribe_citadels(site_id) on delete cascade,
  donor_world_player_id uuid not null references public.world_players(id) on delete cascade,
  materials_amount bigint not null default 0 check (materials_amount >= 0),
  supplies_amount bigint not null default 0 check (supplies_amount >= 0),
  energy_amount bigint not null default 0 check (energy_amount >= 0),
  influence_amount bigint not null default 0 check (influence_amount >= 0),
  donated_at timestamptz not null default now()
);

create table public.tribe_effects (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  effect_type tribe_effect_type not null,
  status effect_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source_site_id uuid references public.map_sites(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  report_type report_type not null,
  source_type text not null,
  source_id uuid,
  title text not null,
  body_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.report_recipients (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  visibility_reason report_visibility_reason not null,
  is_read boolean not null default false,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  unique (report_id, world_player_id, visibility_reason)
);

create table public.score_entries (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  subject_type score_subject_type not null,
  subject_world_player_id uuid references public.world_players(id) on delete cascade,
  subject_tribe_id uuid references public.tribes(id) on delete cascade,
  reason_code text not null,
  delta_score bigint not null,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  check ((subject_type = 'world_player' and subject_world_player_id is not null and subject_tribe_id is null) or (subject_type = 'tribe' and subject_world_player_id is null and subject_tribe_id is not null))
);

create table public.world_final_standings (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  standing_type standing_type not null,
  subject_world_player_id uuid references public.world_players(id) on delete cascade,
  subject_tribe_id uuid references public.tribes(id) on delete cascade,
  final_rank integer not null check (final_rank > 0),
  final_score bigint not null,
  snapshot_at timestamptz not null default now(),
  check ((standing_type = 'individual' and subject_world_player_id is not null and subject_tribe_id is null) or (standing_type = 'tribe' and subject_world_player_id is null and subject_tribe_id is not null)),
  unique (world_id, standing_type, final_rank)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references public.worlds(id) on delete set null,
  actor_type text,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid,
  action_code text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger set_updated_at_users before update on public.users for each row execute function public.set_updated_at();
create trigger set_updated_at_worlds before update on public.worlds for each row execute function public.set_updated_at();
create trigger set_updated_at_world_players before update on public.world_players for each row execute function public.set_updated_at();
create trigger set_updated_at_tribes before update on public.tribes for each row execute function public.set_updated_at();
create trigger set_updated_at_map_sites before update on public.map_sites for each row execute function public.set_updated_at();
create trigger set_updated_at_villages before update on public.villages for each row execute function public.set_updated_at();
create trigger set_updated_at_tribe_citadels before update on public.tribe_citadels for each row execute function public.set_updated_at();
create trigger set_updated_at_village_resource_states before update on public.village_resource_states for each row execute function public.set_updated_at();
create trigger set_updated_at_village_buildings before update on public.village_buildings for each row execute function public.set_updated_at();
create trigger set_updated_at_world_player_research before update on public.world_player_research for each row execute function public.set_updated_at();
create trigger set_updated_at_world_events before update on public.world_events for each row execute function public.set_updated_at();
create trigger set_updated_at_royal_units before update on public.royal_units for each row execute function public.set_updated_at();
create trigger set_updated_at_officer_units before update on public.officer_units for each row execute function public.set_updated_at();
create trigger set_updated_at_site_troop_stacks before update on public.site_troop_stacks for each row execute function public.set_updated_at();

create index idx_world_players_world_status on public.world_players (world_id, status);
create index idx_world_players_world_score on public.world_players (world_id, power_score_cached desc);
create index idx_tribes_world_score on public.tribes (world_id, total_score_cached desc);
create index idx_map_tiles_world_qr on public.map_tiles (world_id, q, r);
create index idx_map_sites_world_type on public.map_sites (world_id, site_type, status);
create index idx_villages_owner_state on public.villages (owner_world_player_id, village_type, political_state);
create index idx_village_buildings_site_code on public.village_buildings (village_site_id, building_code);
create index idx_building_jobs_status_completes_at on public.building_jobs (status, completes_at);
create index idx_world_player_research_player_code on public.world_player_research (world_player_id, research_code);
create index idx_research_jobs_status_completes_at on public.research_jobs (status, completes_at);
create index idx_protocol_activations_owner_status on public.protocol_activations (owner_world_player_id, status);
create index idx_world_events_world_status_starts_at on public.world_events (world_id, status, starts_at);
create index idx_world_event_targets_event_status on public.world_event_targets (world_event_id, status);
create index idx_movements_world_status_arrival on public.movements (world_id, status, arrival_at);
create index idx_movements_target_status_arrival on public.movements (target_site_id, status, arrival_at);
create index idx_royal_units_player_status on public.royal_units (world_player_id, status);
create index idx_officer_units_player_status on public.officer_units (world_player_id, status);
create index idx_site_troop_stacks_site_owner on public.site_troop_stacks (site_id, owner_world_player_id);
create index idx_reports_world_created_at on public.reports (world_id, created_at desc);
create index idx_report_recipients_player_read on public.report_recipients (world_player_id, is_read, delivered_at desc);
create index idx_score_entries_world_created_at on public.score_entries (world_id, created_at desc);
create index idx_world_final_standings_world_type_rank on public.world_final_standings (world_id, standing_type, final_rank);
create index idx_audit_events_world_created_at on public.audit_events (world_id, created_at desc);

create table public.unit_catalog (
  catalog_key text primary key,
  unit_code text not null,
  unit_tier smallint not null check (unit_tier in (1, 2, 3)),
  unit_grade unit_grade,
  attack_value bigint not null default 0,
  defense_value bigint not null default 0,
  speed_value integer not null default 0,
  carry_capacity bigint not null default 0,
  upkeep_supplies_per_minute bigint not null default 0,
  upkeep_energy_per_minute bigint not null default 0,
  train_cost_json jsonb not null default '{}'::jsonb,
  train_time_seconds integer not null default 0 check (train_time_seconds >= 0),
  special_rules_json jsonb not null default '{}'::jsonb
);

commit;
