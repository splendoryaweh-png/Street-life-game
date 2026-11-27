create table if not exists public.streetgangstar_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{5,8}$'),
  host_telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  country_code text not null default 'NG',
  status text not null default 'waiting' check (status in ('waiting','active','closed')),
  max_players integer not null default 16 check (max_players between 2 and 32),
  room_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);
create index if not exists streetgangstar_rooms_status_expiry_idx on public.streetgangstar_rooms(status, expires_at);

create table if not exists public.streetgangstar_room_players (
  room_id uuid not null references public.streetgangstar_rooms(id) on delete cascade,
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  player_name text not null default 'Street Player',
  team text not null default 'blue' check (team in ('blue','red')),
  player_state jsonb not null default '{}'::jsonb,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, telegram_id)
);
create index if not exists streetgangstar_room_players_presence_idx on public.streetgangstar_room_players(room_id, last_seen_at desc);

alter table public.streetgangstar_rooms enable row level security;
alter table public.streetgangstar_room_players enable row level security;
revoke all on public.streetgangstar_rooms from anon, authenticated;
revoke all on public.streetgangstar_room_players from anon, authenticated;
grant all on public.streetgangstar_rooms to service_role;
grant all on public.streetgangstar_room_players to service_role;
