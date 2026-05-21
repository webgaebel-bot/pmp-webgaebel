-- Align time tracking schema with the frontend contract.
-- This migration is intentionally defensive:
-- - creates the missing time_tracking_sessions table
-- - adds missing compatibility columns to time_logs
-- - keeps session ids text-based so local fallback ids continue to work
-- - adds permissive authenticated policies so the browser client can keep working

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- time_logs compatibility columns
-- ---------------------------------------------------------------------------
alter table if exists public.time_logs
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table if exists public.time_logs
  add column if not exists session_id text;

alter table if exists public.time_logs
  add column if not exists source_platform text;

alter table if exists public.time_logs
  add column if not exists source_platform_other text;

alter table if exists public.time_logs
  add column if not exists work_type text;

alter table if exists public.time_logs
  add column if not exists manual_leads_count integer default 0;

alter table if exists public.time_logs
  add column if not exists approval_status text default 'pending';

alter table if exists public.time_logs
  add column if not exists lead_source text;

alter table if exists public.time_logs
  add column if not exists timer_type text default 'sales';

-- Keep timer type values predictable.
alter table if exists public.time_logs
  drop constraint if exists time_logs_timer_type_check;

alter table if exists public.time_logs
  add constraint time_logs_timer_type_check
  check (timer_type is null or timer_type in ('sales', 'project', 'manual'));

-- Helpful indexes for the UI and RPC fallbacks.
create index if not exists time_logs_lead_id_idx
  on public.time_logs (lead_id);

create index if not exists time_logs_session_id_idx
  on public.time_logs (session_id);

create index if not exists time_logs_source_platform_idx
  on public.time_logs (source_platform);

create index if not exists time_logs_work_type_idx
  on public.time_logs (work_type);

-- ---------------------------------------------------------------------------
-- time_tracking_sessions table
-- ---------------------------------------------------------------------------
create table if not exists public.time_tracking_sessions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  session_status text not null default 'running',
  entry_mode text not null default 'timer',
  source_platform text,
  source_platform_other text,
  lead_generation_target integer not null default 0,
  manual_leads_count integer not null default 0,
  notes text,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.time_tracking_sessions
  add constraint time_tracking_sessions_status_check
  check (session_status in ('running', 'paused', 'stopped', 'archived'));

alter table if exists public.time_tracking_sessions
  add constraint time_tracking_sessions_entry_mode_check
  check (entry_mode in ('timer', 'manual'));

create index if not exists time_tracking_sessions_user_status_idx
  on public.time_tracking_sessions (user_id, session_status, started_at desc);

create index if not exists time_tracking_sessions_project_idx
  on public.time_tracking_sessions (project_id, started_at desc);

create index if not exists time_tracking_sessions_lead_idx
  on public.time_tracking_sessions (lead_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table if exists public.time_logs enable row level security;
alter table if exists public.time_tracking_sessions enable row level security;

drop policy if exists "time_logs_authenticated_select" on public.time_logs;
create policy "time_logs_authenticated_select"
  on public.time_logs
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "time_logs_authenticated_insert" on public.time_logs;
create policy "time_logs_authenticated_insert"
  on public.time_logs
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "time_logs_authenticated_update" on public.time_logs;
create policy "time_logs_authenticated_update"
  on public.time_logs
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "time_logs_authenticated_delete" on public.time_logs;
create policy "time_logs_authenticated_delete"
  on public.time_logs
  for delete
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "time_sessions_authenticated_select" on public.time_tracking_sessions;
create policy "time_sessions_authenticated_select"
  on public.time_tracking_sessions
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "time_sessions_authenticated_insert" on public.time_tracking_sessions;
create policy "time_sessions_authenticated_insert"
  on public.time_tracking_sessions
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "time_sessions_authenticated_update" on public.time_tracking_sessions;
create policy "time_sessions_authenticated_update"
  on public.time_tracking_sessions
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "time_sessions_authenticated_delete" on public.time_tracking_sessions;
create policy "time_sessions_authenticated_delete"
  on public.time_tracking_sessions
  for delete
  to authenticated
  using (auth.uid() is not null);
