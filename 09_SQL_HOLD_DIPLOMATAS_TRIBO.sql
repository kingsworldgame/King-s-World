-- KingsWorld - hold de diplomatas de cidade e enviados da Tribo

create table if not exists public.city_diplomats (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  village_id uuid not null references public.villages(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  unlocked boolean not null default false,
  assigned_locally boolean not null default false,
  assigned_to_tribe boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, village_id)
);

create table if not exists public.tribe_envoy_commits (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  envoy_slots integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, tribe_id, owner_id),
  constraint tribe_envoy_slots_check check (envoy_slots between 0 and 4)
);

comment on table public.city_diplomats is 'Pool paralelo aos 5 especialistas. Cada colonia madura pode liberar 1 diplomata.';
comment on table public.tribe_envoy_commits is 'Quantos diplomatas de um jogador foram desviados para o edificio da Tribo.';
