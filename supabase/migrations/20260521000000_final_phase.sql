-- Final phase migration.
-- This syncs existing Supabase databases to the final application contract.
-- The authoritative end-state schema remains in supabase/schema.sql.

create extension if not exists pgcrypto;

-- Lead / time tracking compatibility columns.
alter table if exists public.lead_contacts
  add column if not exists role varchar(100);

alter table if exists public.time_logs
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table if exists public.time_logs
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table if exists public.time_logs
  add column if not exists timer_type text default 'sales';

alter table if exists public.time_logs
  add column if not exists lead_source text;

alter table if exists public.time_logs
  drop constraint if exists time_logs_timer_type_check;

alter table if exists public.time_logs
  add constraint time_logs_timer_type_check
  check (timer_type is null or timer_type in ('sales', 'project', 'manual'));

alter table if exists public.time_logs
  drop constraint if exists time_logs_created_by_fkey;

alter table if exists public.time_logs
  add constraint time_logs_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table if exists public.time_logs
  drop constraint if exists time_logs_updated_by_fkey;

alter table if exists public.time_logs
  add constraint time_logs_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

-- Keep row access aligned with the app's final RBAC model.
alter table if exists public.lead_contacts enable row level security;
alter table if exists public.time_logs enable row level security;
alter table if exists public.time_tracking_sessions enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.expenses enable row level security;
alter table if exists public.salary_runs enable row level security;
alter table if exists public.salary_entries enable row level security;
alter table if exists public.project_taxes enable row level security;
alter table if exists public.project_commissions enable row level security;
alter table if exists public.lead_taxonomies enable row level security;
alter table if exists public.lead_taxonomy_links enable row level security;
alter table if exists public.notifications
  add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table if exists public.notifications
  add column if not exists audience_type text not null default 'user';
alter table if exists public.payments
  add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table if exists public.expenses
  add column if not exists project_id uuid references public.projects(id) on delete set null;
-- Performance indexes for the final UI/API queries.
create index if not exists notifications_user_read_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_project_idx
  on public.notifications (project_id, created_at desc);

create index if not exists notifications_audience_type_idx
  on public.notifications (audience_type, created_at desc);

create index if not exists payments_project_date_idx
  on public.payments (project_id, payment_date desc);

create index if not exists payments_created_by_idx
  on public.payments (created_by);

create index if not exists payments_status_idx
  on public.payments (status);

create index if not exists expenses_project_date_idx
  on public.expenses (project_id, expense_date desc);

create index if not exists expenses_created_by_idx
  on public.expenses (created_by);

create index if not exists expenses_category_idx
  on public.expenses (category);

create index if not exists time_logs_created_by_idx
  on public.time_logs (created_by);

create index if not exists time_logs_updated_by_idx
  on public.time_logs (updated_by);

create index if not exists time_logs_timer_type_idx
  on public.time_logs (timer_type);

create index if not exists time_logs_lead_source_idx
  on public.time_logs (lead_source);

create index if not exists lead_contacts_lead_id_idx
  on public.lead_contacts (lead_id);

