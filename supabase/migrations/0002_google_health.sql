-- Optional Google Health (Fitbit) integration. Run only if you enable it (see docs/GOOGLE-HEALTH.md).
-- These tables hold secrets (OAuth refresh tokens). They have Row Level Security ON and NO policies,
-- and all client roles are revoked, so only the Edge Functions (service role) can read or write them.

create table if not exists public.health_connections (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null default 'google_health',
  refresh_token      text not null,
  scopes             text,
  connected_at       timestamptz not null default now(),
  refresh_expires_at timestamptz
);
alter table public.health_connections enable row level security;
revoke all on public.health_connections from anon, authenticated;

-- Short-lived anti-forgery values for the OAuth redirect (deleted on use).
create table if not exists public.health_oauth_states (
  state      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.health_oauth_states enable row level security;
revoke all on public.health_oauth_states from anon, authenticated;
