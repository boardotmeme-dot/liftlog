-- liftlog schema. Run once in the Supabase SQL editor (or `supabase db push`).

-- 1. Exercise catalog: public, read-only. Filled by supabase/seed.sql (generated from catalog/exercises/*.json).
create table if not exists public.exercises (
  slug         text primary key,
  name         text not null,
  muscle_group text not null,
  equipment    text not null,
  mechanic     text not null,
  level        text not null,
  data         jsonb not null
);
alter table public.exercises enable row level security;
create policy "catalog is public" on public.exercises
  for select to anon, authenticated using (true);

-- 2. Per-user plan, custom exercises and settings (one row per user).
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       jsonb not null default '[]'::jsonb,
  custom     jsonb not null default '[]'::jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "own row select" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row insert" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row update" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row delete" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Finished workouts: one row per workout, created on the device (client-generated uuid),
--    so two devices can never overwrite each other's history. Deletions are soft (deleted_at).
create table if not exists public.workout_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  ended_at   timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index if not exists workout_logs_user_updated on public.workout_logs (user_id, updated_at);
alter table public.workout_logs enable row level security;
create policy "own logs select" on public.workout_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own logs insert" on public.workout_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own logs update" on public.workout_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own logs delete" on public.workout_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
