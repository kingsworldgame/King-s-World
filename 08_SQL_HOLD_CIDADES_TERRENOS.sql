-- KingsWorld - hold de cidades, colonias, terreno e ocupacao
-- Executar depois, junto do pacote final do schema.

alter table public.villages
  add column if not exists settlement_role text not null default 'Colonia',
  add column if not exists city_class text not null default 'neutral',
  add column if not exists city_class_locked boolean not null default false,
  add column if not exists origin_kind text not null default 'claimed_city',
  add column if not exists terrain_kind text not null default 'ashen_fields',
  add column if not exists terrain_label text;

alter table public.villages
  add constraint villages_settlement_role_check
    check (settlement_role in ('Capital', 'Colonia'));

alter table public.villages
  add constraint villages_city_class_check
    check (city_class in ('neutral', 'metropole', 'posto_avancado', 'bastiao', 'celeiro'));

alter table public.villages
  add constraint villages_origin_kind_check
    check (origin_kind in ('claimed_city', 'wild_empty', 'abandoned_city', 'frontier_ruins', 'hotspot'));

alter table public.villages
  add constraint villages_terrain_kind_check
    check (terrain_kind in ('crown_heartland', 'riverlands', 'frontier_pass', 'ironridge', 'ashen_fields'));

create table if not exists public.world_sites (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  q integer not null,
  r integer not null,
  owner_village_id uuid null references public.villages(id) on delete set null,
  relation text not null default 'Neutro',
  site_name text not null,
  site_type text not null default 'Cidade',
  occupation_kind text not null default 'wild_empty',
  terrain_kind text not null default 'ashen_fields',
  terrain_label text null,
  recommended_city_class text not null default 'neutral',
  garrison_power integer not null default 0,
  starts_with_structures boolean not null default false,
  is_hotspot boolean not null default false,
  created_at timestamptz not null default now(),
  unique (world_id, q, r),
  constraint world_sites_relation_check
    check (relation in ('Proprio', 'Aliado', 'Inimigo', 'Neutro')),
  constraint world_sites_occupation_kind_check
    check (occupation_kind in ('claimed_city', 'wild_empty', 'abandoned_city', 'frontier_ruins', 'hotspot')),
  constraint world_sites_terrain_kind_check
    check (terrain_kind in ('crown_heartland', 'riverlands', 'frontier_pass', 'ironridge', 'ashen_fields')),
  constraint world_sites_recommended_city_class_check
    check (recommended_city_class in ('neutral', 'metropole', 'posto_avancado', 'bastiao', 'celeiro'))
);

create unique index if not exists one_capital_per_world_owner_idx
  on public.villages (world_id, owner_id)
  where settlement_role = 'Capital';

comment on column public.villages.settlement_role is 'Capital unica ou Colonia. Tudo e cidade; o role distingue a capital do resto.';
comment on column public.villages.city_class is 'Classe funcional da cidade: neutral, metropole, posto_avancado, bastiao, celeiro.';
comment on column public.villages.city_class_locked is 'Colonias travam a classe depois da escolha ou quando o terreno ja define a classe.';
comment on column public.villages.origin_kind is 'Origem da cidade: cidade tomada, vazio duro, cidade abandonada, ruina instavel ou hotspot.';
comment on column public.villages.terrain_kind is 'Terreno base que sugere ou trava a classe da cidade.';
