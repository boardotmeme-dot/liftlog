-- Body-weight entries: one row per entry, created on the device (client-generated uuid),
-- merged between devices exactly like workout_logs. Deletions are soft (deleted_at).
create table if not exists public.body_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  logged_at  timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index if not exists body_logs_user_updated on public.body_logs (user_id, updated_at);
alter table public.body_logs enable row level security;
drop policy if exists "own body select" on public.body_logs;
create policy "own body select" on public.body_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "own body insert" on public.body_logs;
create policy "own body insert" on public.body_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "own body update" on public.body_logs;
create policy "own body update" on public.body_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own body delete" on public.body_logs;
create policy "own body delete" on public.body_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
