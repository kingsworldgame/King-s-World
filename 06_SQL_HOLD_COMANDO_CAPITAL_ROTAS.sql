-- KINGSWORLD
-- 06. SQL HOLD - COMANDO CENTRAL, DOACAO INTERNA E ETA DE RECURSOS
-- Data: 2026-03-08
-- Objetivo: manter pronto para rodar no Supabase depois.
-- Escopo: nao remove nada antigo; apenas adiciona regras e visoes.

begin;

alter table public.worlds
  add column if not exists capital_troop_pool_mode boolean not null default true,
  add column if not exists internal_aid_speed_multiplier numeric(6,2) not null default 5.00,
  add column if not exists support_donation_only boolean not null default true;

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
end
$$;

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

drop trigger if exists trg_enforce_capital_home_troops on public.site_troop_stacks;
create trigger trg_enforce_capital_home_troops
before insert or update on public.site_troop_stacks
for each row
execute function public.enforce_capital_home_troops();

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

  if v_movement_type in ('support', 'transport', 'supply') and v_support_donation_only then
    if not public.is_friendly_target_site(v_actor_world_player_id, v_target_site_id) then
      raise exception 'Movimento de apoio/recurso invalido: alvo nao amigavel para modo doacao.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_donation_only_resource_movement on public.movement_resources;
create trigger trg_validate_donation_only_resource_movement
before insert or update on public.movement_resources
for each row
execute function public.validate_donation_only_resource_movement();

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

comment on view public.v_village_resource_eta is
  'Painel pronto para UI: tempo estimado para lotacao de materiais/suprimentos/energia/influencia por aldeia.';

create index if not exists idx_site_troop_stacks_owner_stationing
  on public.site_troop_stacks (owner_world_player_id, stationing_type);

create index if not exists idx_movements_actor_type_status
  on public.movements (actor_world_player_id, movement_type, status);

commit;
