-- KINGSWORLD
-- 07. SQL HOLD - TESOURO IMPERIAL E CAP DE OBRAS
-- Data: 2026-03-09
-- Objetivo: preparar o modelo onde recursos sobem direto para o Tesouro Imperial
-- e cada aldeia tem um cap generoso de obra, evitando rush instantaneo para 100/100.

begin;

alter table public.worlds
  add column if not exists imperial_treasury_mode boolean not null default true,
  add column if not exists instant_internal_resource_flow boolean not null default true,
  add column if not exists village_construction_cap_mode boolean not null default true;

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

create index if not exists idx_imperial_treasuries_world_id
  on public.imperial_treasuries (world_id);

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

comment on view public.v_imperial_treasury_seed is
  'Snapshot para semear o Tesouro Imperial somando o estoque atual de todas as aldeias do jogador.';

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

comment on view public.v_village_construction_summary is
  'Painel pronto para UI: mostra o cap de obra da aldeia, o quanto ja foi usado e o saldo restante.';

commit;

