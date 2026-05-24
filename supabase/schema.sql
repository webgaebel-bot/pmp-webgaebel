-- Canonical Supabase schema for Orbit Grid Suite / PMP Frontend.
-- This file consolidates the current application contract into one importable SQL script.

grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core auth / RBAC
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  module text not null default 'general',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  profile_image text,
  status text not null default 'active',
  role_id uuid references public.roles(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Projects / tasks
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'planning',
  priority text not null default 'medium',
  progress numeric(5,2) not null default 0,
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_projects_touch_updated_at on public.projects;
create trigger trg_projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  assignee_id uuid references public.profiles(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null,
  due_date date,
  estimated_hours numeric(10,2),
  actual_hours numeric(10,2),
  comments_count integer not null default 0,
  attachments_count integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tasks_touch_updated_at on public.tasks;
create trigger trg_tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.task_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_task_comments_touch_updated_at on public.task_comments;
create trigger trg_task_comments_touch_updated_at
before update on public.task_comments
for each row execute function public.touch_updated_at();

create table if not exists public.project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_roles_project_name_unique_idx
  on public.project_roles (project_id, name);

drop trigger if exists trg_project_roles_touch_updated_at on public.project_roles;
create trigger trg_project_roles_touch_updated_at
before update on public.project_roles
for each row execute function public.touch_updated_at();

create table if not exists public.project_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  related_id text not null,
  related_type text not null,
  original_name text,
  file_name text not null,
  file_path text not null,
  file_url text,
  file_size bigint not null default 0,
  file_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_files_touch_updated_at on public.files;
create trigger trg_files_touch_updated_at
before update on public.files
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Activity / notifications
-- ---------------------------------------------------------------------------

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  entity_name text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  entity_type text,
  entity_id text,
  project_id uuid references public.projects(id) on delete set null,
  audience_type text not null default 'user',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_project_idx
  on public.notifications (project_id, created_at desc);

create index if not exists notifications_audience_type_idx
  on public.notifications (audience_type, created_at desc);

-- ---------------------------------------------------------------------------
-- Leads CRM
-- ---------------------------------------------------------------------------

create table if not exists public.lead_taxonomies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  taxonomy_type text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists lead_taxonomies_name_type_unique_idx
  on public.lead_taxonomies (lower(name), taxonomy_type);

create table if not exists public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  designation text,
  website text,
  linkedin_url text,
  facebook_url text,
  instagram_url text,
  x_url text,
  services_offered text,
  status text not null default 'new',
  pipeline_stage text not null default 'new',
  source text not null default 'manual',
  priority text not null default 'medium',
  lead_score numeric(10,2) not null default 0,
  budget numeric(14,2),
  expected_close_date date,
  outreach_status text not null default 'not_contacted',
  outreach_channel text,
  first_contacted_at timestamptz,
  last_reachout_at timestamptz,
  followup_sent_at timestamptz,
  followup_notes text,
  close_value numeric(14,2),
  assigned_to uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  completed boolean not null default false,
  completed_at timestamptz,
  converted_at timestamptz,
  lost_reason text,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leads_touch_updated_at on public.leads;
create trigger trg_leads_touch_updated_at
before update on public.leads
for each row execute function public.touch_updated_at();

create index if not exists leads_created_by_idx on public.leads (created_by);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_project_id_idx on public.leads (project_id);
create index if not exists leads_pipeline_stage_idx on public.leads (pipeline_stage);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);

create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lead_contacts_lead_id_idx
  on public.lead_contacts (lead_id);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  activity_type text not null default 'note',
  summary text,
  description text,
  duration_minutes integer,
  outcome text,
  activity_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  note text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_lead_notes_touch_updated_at on public.lead_notes;
create trigger trg_lead_notes_touch_updated_at
before update on public.lead_notes
for each row execute function public.touch_updated_at();

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text,
  description text,
  notes text,
  followup_type text not null default 'call',
  scheduled_at timestamptz not null,
  due_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  reminder_sent boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_lead_followups_touch_updated_at on public.lead_followups;
create trigger trg_lead_followups_touch_updated_at
before update on public.lead_followups
for each row execute function public.touch_updated_at();

create table if not exists public.lead_tag_links (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.lead_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lead_id, tag_id)
);

create table if not exists public.lead_followup_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_lead_followup_records_touch_updated_at on public.lead_followup_records;
create trigger trg_lead_followup_records_touch_updated_at
before update on public.lead_followup_records
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Time tracking
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

create index if not exists time_tracking_sessions_user_status_idx
  on public.time_tracking_sessions (user_id, session_status, started_at desc);

create index if not exists time_tracking_sessions_project_idx
  on public.time_tracking_sessions (project_id, started_at desc);

create index if not exists time_tracking_sessions_lead_idx
  on public.time_tracking_sessions (lead_id);

drop trigger if exists trg_time_tracking_sessions_touch_updated_at on public.time_tracking_sessions;
create trigger trg_time_tracking_sessions_touch_updated_at
before update on public.time_tracking_sessions
for each row execute function public.touch_updated_at();

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  session_id text,
  log_date date not null default current_date,
  hours numeric(10,2) not null default 0,
  duration_minutes integer not null default 0,
  start_time timestamptz,
  end_time timestamptz,
  is_manual boolean not null default false,
  approval_status text not null default 'pending',
  work_type text,
  manual_leads_count integer not null default 0,
  description text,
  status text not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  timer_type text not null default 'sales',
  lead_source text,
  source_platform text,
  source_platform_other text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_time_logs_touch_updated_at on public.time_logs;
create trigger trg_time_logs_touch_updated_at
before update on public.time_logs
for each row execute function public.touch_updated_at();

create index if not exists time_logs_created_by_idx
  on public.time_logs (created_by);

create index if not exists time_logs_updated_by_idx
  on public.time_logs (updated_by);

create index if not exists time_logs_timer_type_idx
  on public.time_logs (timer_type);

create index if not exists time_logs_lead_source_idx
  on public.time_logs (lead_source);

create index if not exists time_logs_lead_id_idx
  on public.time_logs (lead_id);

create index if not exists time_logs_session_id_idx
  on public.time_logs (session_id);

create index if not exists time_logs_source_platform_idx
  on public.time_logs (source_platform);

create index if not exists time_logs_work_type_idx
  on public.time_logs (work_type);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  address text,
  status text not null default 'active',
  notes text,
  total_revenue numeric(14,2) not null default 0,
  last_payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clients_touch_updated_at on public.clients;
create trigger trg_clients_touch_updated_at
before update on public.clients
for each row execute function public.touch_updated_at();

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric(14,2) not null default 0,
  currency text not null default 'USD',
  expense_date date not null default current_date,
  payment_method text not null default 'bank_transfer',
  payment_method_other text,
  project_id uuid references public.projects(id) on delete set null,
  receipt_url text,
  approved_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_expenses_touch_updated_at on public.expenses;
create trigger trg_expenses_touch_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

create index if not exists expenses_project_date_idx
  on public.expenses (project_id, expense_date desc);

create index if not exists expenses_created_by_idx
  on public.expenses (created_by);

create index if not exists expenses_category_idx
  on public.expenses (category);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  amount numeric(14,2) not null default 0,
  currency text not null default 'USD',
  payment_date date not null default current_date,
  payment_method text not null default 'bank_transfer',
  payment_method_other text,
  status text not null default 'completed',
  description text,
  project_id uuid references public.projects(id) on delete set null,
  received_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  invoice_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payments_touch_updated_at on public.payments;
create trigger trg_payments_touch_updated_at
before update on public.payments
for each row execute function public.touch_updated_at();

create index if not exists payments_project_date_idx
  on public.payments (project_id, payment_date desc);

create index if not exists payments_created_by_idx
  on public.payments (created_by);

create index if not exists payments_status_idx
  on public.payments (status);

create table if not exists public.founders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  equity_percentage numeric(8,2) not null default 0,
  vested_percentage numeric(8,2) not null default 0,
  join_date date,
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_founders_touch_updated_at on public.founders;
create trigger trg_founders_touch_updated_at
before update on public.founders
for each row execute function public.touch_updated_at();

create table if not exists public.finance_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_finance_settings_touch_updated_at on public.finance_settings;
create trigger trg_finance_settings_touch_updated_at
before update on public.finance_settings
for each row execute function public.touch_updated_at();

create table if not exists public.system_currencies (
  id uuid primary key default gen_random_uuid(),
  code varchar(10) not null unique,
  symbol varchar(10) not null,
  name varchar(100) not null,
  created_at timestamptz not null default now()
);

insert into public.system_currencies (code, symbol, name)
values
  ('USD', '$', 'US Dollar'),
  ('EUR', 'EUR', 'Euro'),
  ('GBP', 'GBP', 'British Pound'),
  ('PKR', 'Rs', 'Pakistani Rupee')
on conflict (code) do nothing;

create table if not exists public.salary_runs (
  id uuid primary key default gen_random_uuid(),
  salary_month date not null,
  currency text not null default 'USD',
  total_salary numeric(14,2) not null default 0,
  future_fund_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  founder_profit numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_salary_runs_touch_updated_at on public.salary_runs;
create trigger trg_salary_runs_touch_updated_at
before update on public.salary_runs
for each row execute function public.touch_updated_at();

create table if not exists public.salary_entries (
  id uuid primary key default gen_random_uuid(),
  salary_run_id uuid not null references public.salary_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  months_count integer not null default 1,
  monthly_salary numeric(14,2) not null default 0,
  total_salary numeric(14,2) not null default 0,
  auto_calculated boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_salary_entries_touch_updated_at on public.salary_entries;
create trigger trg_salary_entries_touch_updated_at
before update on public.salary_entries
for each row execute function public.touch_updated_at();

alter table public.expenses
  add column if not exists currency text not null default 'USD',
  add column if not exists payment_method_other text,
  add column if not exists receipt_url text,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.payments
  add column if not exists currency text not null default 'USD',
  add column if not exists payment_method_other text,
  add column if not exists status text not null default 'completed',
  add column if not exists description text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists received_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists commission_amount numeric(14,2) not null default 0,
  add column if not exists invoice_id text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.salary_runs
  add column if not exists currency text not null default 'USD',
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.salary_entries
  add column if not exists salary_run_id uuid references public.salary_runs(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists months_count integer not null default 1,
  add column if not exists monthly_salary numeric(14,2) not null default 0,
  add column if not exists total_salary numeric(14,2) not null default 0,
  add column if not exists auto_calculated boolean not null default true,
  add column if not exists notes text;

create table if not exists public.project_taxes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  rate numeric(8,2),
  amount numeric(14,2),
  currency text not null default 'USD',
  status text not null default 'active',
  effective_from date,
  effective_to date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_taxes_touch_updated_at on public.project_taxes;
create trigger trg_project_taxes_touch_updated_at
before update on public.project_taxes
for each row execute function public.touch_updated_at();

create table if not exists public.project_commissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  rate numeric(8,2),
  amount numeric(14,2),
  currency text not null default 'USD',
  status text not null default 'active',
  effective_from date,
  effective_to date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_commissions_touch_updated_at on public.project_commissions;
create trigger trg_project_commissions_touch_updated_at
before update on public.project_commissions
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Mail
-- ---------------------------------------------------------------------------

create table if not exists public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_mail_threads_touch_updated_at on public.mail_threads;
create trigger trg_mail_threads_touch_updated_at
before update on public.mail_threads
for each row execute function public.touch_updated_at();

create table if not exists public.mails (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  sender_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mail_recipients (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid not null references public.mails(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  is_read boolean not null default false,
  is_deleted boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mail_id, recipient_id)
);

create table if not exists public.mail_attachments (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid not null references public.mails(id) on delete cascade,
  original_name text,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Project permissions helpers
-- ---------------------------------------------------------------------------

insert into public.project_permissions (key, name, description)
values
  ('projects.view', 'projects.view', 'View the project overview and details'),
  ('projects.manage', 'projects.manage', 'Manage project settings and lifecycle'),
  ('members.view', 'members.view', 'View project members'),
  ('members.manage', 'members.manage', 'Add, update, and remove project members'),
  ('tasks.view', 'tasks.view', 'View project tasks'),
  ('tasks.create', 'tasks.create', 'Create project tasks'),
  ('tasks.update', 'tasks.update', 'Edit project tasks'),
  ('tasks.delete', 'tasks.delete', 'Delete project tasks'),
  ('tasks.manage', 'tasks.manage', 'Manage all task actions'),
  ('files.view', 'files.view', 'View project files'),
  ('files.upload', 'files.upload', 'Upload project files'),
  ('files.delete', 'files.delete', 'Delete project files'),
  ('files.manage', 'files.manage', 'Manage all file actions'),
  ('project.roles.manage', 'project.roles.manage', 'Create and manage project roles')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true;

create or replace function public.normalize_project_role_permissions_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.permissions := (
    select coalesce(jsonb_agg(distinct permission_key order by permission_key), '[]'::jsonb)
    from (
      select pp.key as permission_key
      from jsonb_array_elements_text(coalesce(new.permissions, '[]'::jsonb)) as input(key)
      join public.project_permissions pp on pp.key = trim(input.key)
      where pp.is_active = true
    ) filtered
  );
  return new;
end;
$$;

drop trigger if exists trg_normalize_project_role_permissions on public.project_roles;
create trigger trg_normalize_project_role_permissions
before insert or update on public.project_roles
for each row
execute function public.normalize_project_role_permissions_v2();

create or replace function public.can_manage_project_roles_v2(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_role_name text;
  v_permissions jsonb;
begin
  if v_user_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.roles r on p.role_id = r.id
    where p.id = v_user_id
      and lower(replace(r.name, '_', ' ')) like '%admin%'
  ) then
    return true;
  end if;

  select lower(coalesce(pm.role, '')), pr.permissions
    into v_role_name, v_permissions
  from public.project_members pm
  left join public.project_roles pr
    on pr.project_id = pm.project_id
   and lower(pr.name) = lower(coalesce(pm.role, ''))
  where pm.project_id = p_project_id
    and pm.user_id = v_user_id
  limit 1;

  if v_role_name is null or v_role_name = '' then
    return false;
  end if;

  return exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_permissions, '[]'::jsonb)) as perm(permission_key)
    where lower(trim(permission_key)) = 'project.roles.manage'
  );
end;
$$;

create or replace function public.get_project_roles_secure_v2(p_project_id uuid)
returns setof public.project_roles
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.project_roles
  where project_id = p_project_id
  order by created_at asc;
end;
$$;

create or replace function public.get_project_permissions_secure_v2(p_project_id uuid)
returns setof public.project_permissions
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.project_permissions
  where is_active = true
  order by name asc;
end;
$$;

create or replace function public.create_project_role_secure_v2(p_project_id uuid, p_role jsonb)
returns setof public.project_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.project_roles;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  insert into public.project_roles (
    project_id,
    name,
    description,
    permissions,
    created_by
  )
  values (
    p_project_id,
    coalesce(nullif(trim(p_role->>'name'), ''), 'untitled'),
    nullif(trim(p_role->>'description'), ''),
    coalesce((p_role->'permissions'), '[]'::jsonb),
    v_user_id
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.update_project_role_secure_v2(p_role_id uuid, p_patch jsonb)
returns setof public.project_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.project_roles;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  update public.project_roles
  set
    name = coalesce(nullif(trim(p_patch->>'name'), ''), name),
    description = coalesce(nullif(trim(p_patch->>'description'), ''), description),
    permissions = coalesce((p_patch->'permissions'), permissions),
    updated_at = now()
  where id = p_role_id
  returning * into v_result;

  if not found then
    raise exception 'Project role not found' using errcode = 'P0002';
  end if;

  return next v_result;
end;
$$;

create or replace function public.delete_project_role_secure_v2(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_roles where id = p_role_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Default project role seeds
-- ---------------------------------------------------------------------------

with default_roles as (
  select * from (values
    ('owner', 'Full control of project settings and members', '["projects.manage","members.manage","tasks.manage","files.manage","project.roles.manage"]'::jsonb),
    ('manager', 'Can manage tasks and project members', '["projects.view","members.manage","tasks.manage","files.view"]'::jsonb),
    ('lead', 'Can oversee a workstream inside the project', '["projects.view","tasks.view","tasks.update"]'::jsonb),
    ('member', 'Can work on tasks and collaborate', '["projects.view","tasks.view"]'::jsonb),
    ('viewer', 'Read-only access to the project', '["projects.view"]'::jsonb)
  ) as t(name, description, permissions)
)
insert into public.project_roles (project_id, name, description, permissions, created_by)
select
  p.id,
  dr.name,
  dr.description,
  dr.permissions,
  p.created_by
from public.projects p
cross join default_roles dr
on conflict (project_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- Core role / permission seeds
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, module, description)
values
  ('dashboard.view', 'dashboard.view', 'dashboard', 'Access dashboard shell'),
  ('dashboard.stats.view', 'dashboard.stats.view', 'dashboard', 'View admin dashboard stats'),
  ('dashboard.project_progress', 'dashboard.project_progress', 'dashboard', 'View admin project progress widgets'),
  ('dashboard.team_performance', 'dashboard.team_performance', 'dashboard', 'View admin team performance widgets'),
  ('dashboard.task_charts', 'dashboard.task_charts', 'dashboard', 'View admin task charts'),
  ('dashboard.activity_logs', 'dashboard.activity_logs', 'dashboard', 'View admin dashboard activity widgets'),
  ('dashboard.projects.view', 'dashboard.projects.view', 'dashboard', 'View admin project snapshot widgets'),
  ('dashboard.leads.view', 'dashboard.leads.view', 'dashboard', 'View admin lead snapshot widgets'),
  ('dashboard.finance.view', 'dashboard.finance.view', 'dashboard', 'View admin finance snapshot widgets'),
  ('sales.view', 'sales.view', 'sales', 'View sales workspace'),
  ('sales.view.own', 'sales.view.own', 'sales', 'View own sales records'),
  ('sales.view.team', 'sales.view.team', 'sales', 'View team sales records'),
  ('sales.view.all', 'sales.view.all', 'sales', 'View all sales records'),
  ('sales.dashboard.view', 'sales.dashboard.view', 'sales', 'View sales dashboard'),
  ('projects.view', 'projects.view', 'projects', 'View assigned projects'),
  ('projects.view.own', 'projects.view.own', 'projects', 'View own projects'),
  ('projects.view.team', 'projects.view.team', 'projects', 'View team projects'),
  ('projects.view.all', 'projects.view.all', 'projects', 'View all projects'),
  ('projects.create', 'projects.create', 'projects', 'Create projects'),
  ('projects.update', 'projects.update', 'projects', 'Edit projects'),
  ('projects.delete', 'projects.delete', 'projects', 'Delete projects'),
  ('project.roles.manage', 'project.roles.manage', 'projects', 'Manage project roles and project permissions'),
  ('tasks.view', 'tasks.view', 'tasks', 'View assigned tasks'),
  ('tasks.view.own', 'tasks.view.own', 'tasks', 'View own tasks'),
  ('tasks.view.team', 'tasks.view.team', 'tasks', 'View team tasks'),
  ('tasks.view.all', 'tasks.view.all', 'tasks', 'View all tasks'),
  ('tasks.create', 'tasks.create', 'tasks', 'Create tasks'),
  ('tasks.update', 'tasks.update', 'tasks', 'Edit tasks'),
  ('tasks.delete', 'tasks.delete', 'tasks', 'Delete tasks'),
  ('tasks.assign', 'tasks.assign', 'tasks', 'Assign tasks'),
  ('tasks.update_status', 'tasks.update_status', 'tasks', 'Update task status'),
  ('tasks.update_priority', 'tasks.update_priority', 'tasks', 'Update task priority'),
  ('comments.create', 'comments.create', 'comments', 'Add task comments'),
  ('comments.delete', 'comments.delete', 'comments', 'Delete task comments'),
  ('files.upload', 'files.upload', 'files', 'Upload files'),
  ('files.delete', 'files.delete', 'files', 'Delete files'),
  ('mails.view', 'mails.view', 'mails', 'View own mails'),
  ('mails.view.all', 'mails.view.all', 'mails', 'View all mails'),
  ('mails.send', 'mails.send', 'mails', 'Send mails'),
  ('mails.reply', 'mails.reply', 'mails', 'Reply to mails'),
  ('mails.delete', 'mails.delete', 'mails', 'Delete mails'),
  ('mails.manage', 'mails.manage', 'mails', 'Manage mail settings and records'),
  ('mail_threads.view', 'mail_threads.view', 'mails', 'View mail threads'),
  ('mail_threads.create', 'mail_threads.create', 'mails', 'Create mail threads'),
  ('calendar.view', 'calendar.view', 'calendar', 'View own calendar'),
  ('calendar.view.all', 'calendar.view.all', 'calendar', 'View all calendars'),
  ('calendar.project.view', 'calendar.project.view', 'calendar', 'View project calendar'),
  ('calendar.manage', 'calendar.manage', 'calendar', 'Manage calendar events'),
  ('finance.view', 'finance.view', 'finance', 'View finance module'),
  ('finance.view.own', 'finance.view.own', 'finance', 'View own finance data'),
  ('finance.view.team', 'finance.view.team', 'finance', 'View team finance data'),
  ('finance.view.all', 'finance.view.all', 'finance', 'View all finance data'),
  ('finance.payments.view', 'finance.payments.view', 'finance', 'View payments'),
  ('finance.payments.manage', 'finance.payments.manage', 'finance', 'Manage payments'),
  ('finance.expenses.view', 'finance.expenses.view', 'finance', 'View expenses'),
  ('finance.expenses.manage', 'finance.expenses.manage', 'finance', 'Manage expenses'),
  ('finance.clients.view', 'finance.clients.view', 'finance', 'View finance clients'),
  ('finance.clients.manage', 'finance.clients.manage', 'finance', 'Manage finance clients'),
  ('finance.founders.view', 'finance.founders.view', 'finance', 'View founders finance'),
  ('finance.founders.manage', 'finance.founders.manage', 'finance', 'Manage founders finance'),
  ('finance.salaries.view', 'finance.salaries.view', 'finance', 'View salary records'),
  ('finance.salaries.manage', 'finance.salaries.manage', 'finance', 'Manage salary records'),
  ('finance.taxes.view', 'finance.taxes.view', 'finance', 'View project taxes'),
  ('finance.taxes.manage', 'finance.taxes.manage', 'finance', 'Manage project taxes'),
  ('finance.commissions.view', 'finance.commissions.view', 'finance', 'View commissions'),
  ('finance.commissions.manage', 'finance.commissions.manage', 'finance', 'Manage commissions'),
  ('finance.settings.manage', 'finance.settings.manage', 'finance', 'Manage finance settings'),
  ('time.view', 'time.view', 'time', 'View time tracking'),
  ('time.view.own', 'time.view.own', 'time', 'View own time logs'),
  ('time.view.team', 'time.view.team', 'time', 'View team time logs'),
  ('time.view.all', 'time.view.all', 'time', 'View all time logs'),
  ('time.create', 'time.create', 'time', 'Create time entries'),
  ('time.update', 'time.update', 'time', 'Update time entries'),
  ('time.delete', 'time.delete', 'time', 'Delete time entries'),
  ('time.approve', 'time.approve', 'time', 'Approve or reject time entries'),
  ('time.manage', 'time.manage', 'time', 'Manage all time entries'),
  ('time.sessions.manage', 'time.sessions.manage', 'time', 'Manage time tracking sessions'),
  ('leads.view', 'leads.view', 'leads', 'View leads CRM'),
  ('leads.view.own', 'leads.view.own', 'leads', 'View own leads'),
  ('leads.view.team', 'leads.view.team', 'leads', 'View team leads'),
  ('leads.view.all', 'leads.view.all', 'leads', 'View all users leads'),
  ('leads.detail.view', 'leads.detail.view', 'leads', 'View detailed lead CRM data'),
  ('leads.create', 'leads.create', 'leads', 'Create leads'),
  ('leads.update', 'leads.update', 'leads', 'Update leads'),
  ('leads.delete', 'leads.delete', 'leads', 'Delete leads'),
  ('leads.import', 'leads.import', 'leads', 'Import leads'),
  ('leads.followups.view', 'leads.followups.view', 'leads', 'View flexible follow-up sheet'),
  ('leads.followups.create', 'leads.followups.create', 'leads', 'Create follow-up rows'),
  ('leads.followups.update', 'leads.followups.update', 'leads', 'Edit follow-up rows'),
  ('leads.followups.delete', 'leads.followups.delete', 'leads', 'Delete follow-up rows'),
  ('leads.taxonomies.manage', 'leads.taxonomies.manage', 'leads', 'Manage lead niches and services'),
  ('users.view', 'users.view', 'users', 'View users'),
  ('users.view.own', 'users.view.own', 'users', 'View own profile'),
  ('users.view.all', 'users.view.all', 'users', 'View all users'),
  ('users.create', 'users.create', 'users', 'Create users'),
  ('users.update', 'users.update', 'users', 'Edit users'),
  ('users.delete', 'users.delete', 'users', 'Delete users'),
  ('roles.view', 'roles.view', 'roles', 'View roles'),
  ('roles.manage', 'roles.manage', 'roles', 'Manage roles'),
  ('permissions.manage', 'permissions.manage', 'permissions', 'Manage permissions'),
  ('reports.view', 'reports.view', 'reports', 'View reports'),
  ('members.view', 'members.view', 'members', 'View project members'),
  ('members.create', 'members.create', 'members', 'Add project members'),
  ('members.update', 'members.update', 'members', 'Update project members'),
  ('members.delete', 'members.delete', 'members', 'Remove project members'),
  ('notifications.view', 'notifications.view', 'notifications', 'View notifications'),
  ('notifications.view.own', 'notifications.view.own', 'notifications', 'View own notifications'),
  ('notifications.view.all', 'notifications.view.all', 'notifications', 'View all notifications'),
  ('activity_logs.view', 'activity_logs.view', 'activity_logs', 'View activity logs'),
  ('activity_logs.dashboard', 'activity_logs.dashboard', 'activity_logs', 'View dashboard activity logs')
on conflict (key) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description;

insert into public.roles (name, description)
values
  ('Super Admin', 'Full system access'),
  ('Admin', 'Administrative access'),
  ('Manager', 'Project and team management'),
  ('Developer', 'Execution and time tracking'),
  ('QA Viewer', 'Quality assurance and read-only review'),
  ('Client', 'Restricted client portal access')
on conflict (name) do update
set description = excluded.description;

with all_permission_ids as (
  select id, key from public.permissions
),
role_targets as (
  select r.id as role_id, r.name as role_name
  from public.roles r
),
role_permissions_seed as (
  select role_name, permission_key
  from (
    values
      ('Super Admin', 'ALL'),
      ('Admin', 'ALL'),
      ('Manager', 'dashboard.view'),
      ('Manager', 'projects.view'),
      ('Manager', 'projects.create'),
      ('Manager', 'projects.update'),
      ('Manager', 'tasks.view'),
      ('Manager', 'tasks.create'),
      ('Manager', 'tasks.update'),
      ('Manager', 'tasks.delete'),
      ('Manager', 'tasks.assign'),
      ('Manager', 'comments.create'),
      ('Manager', 'comments.delete'),
      ('Manager', 'members.view'),
      ('Manager', 'members.create'),
      ('Manager', 'members.update'),
      ('Manager', 'leads.view'),
      ('Manager', 'leads.create'),
      ('Manager', 'leads.update'),
      ('Manager', 'leads.delete'),
      ('Manager', 'leads.followups.view'),
      ('Manager', 'leads.followups.create'),
      ('Manager', 'leads.followups.update'),
      ('Manager', 'leads.followups.delete'),
      ('Manager', 'leads.taxonomies.manage'),
      ('Manager', 'time.view'),
      ('Manager', 'time.create'),
      ('Manager', 'time.update'),
      ('Manager', 'time.delete'),
      ('Manager', 'time.sessions.manage'),
      ('Manager', 'finance.view'),
      ('Manager', 'finance.payments.view'),
      ('Manager', 'finance.expenses.view'),
      ('Manager', 'finance.clients.view'),
      ('Manager', 'finance.founders.view'),
      ('Manager', 'finance.salaries.view'),
      ('Manager', 'finance.taxes.view'),
      ('Manager', 'finance.commissions.view'),
      ('Developer', 'projects.view'),
      ('Developer', 'tasks.view'),
      ('Developer', 'comments.create'),
      ('Developer', 'time.view'),
      ('Developer', 'time.create'),
      ('Developer', 'time.update'),
      ('Developer', 'time.delete'),
      ('Developer', 'notifications.view'),
      ('QA Viewer', 'projects.view'),
      ('QA Viewer', 'tasks.view'),
      ('QA Viewer', 'reports.view'),
      ('QA Viewer', 'notifications.view'),
      ('Client', 'projects.view'),
      ('Client', 'tasks.view'),
      ('Client', 'mails.view'),
      ('Client', 'notifications.view')
  ) as t(role_name, permission_key)
)
insert into public.role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from role_permissions_seed s
join public.roles r on r.name = s.role_name
join public.permissions p on p.key = s.permission_key
where s.permission_key <> 'ALL'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.name in ('Super Admin', 'Admin')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Secure RPCs used by the frontend
-- ---------------------------------------------------------------------------

create or replace function public.create_project_secure_v2(p_project jsonb)
returns setof public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.projects;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  insert into public.projects (
    name,
    description,
    priority,
    status,
    progress,
    start_date,
    end_date,
    created_by
  )
  values (
    coalesce(nullif(trim(p_project->>'name'), ''), 'Untitled Project'),
    nullif(trim(p_project->>'description'), ''),
    coalesce(nullif(trim(p_project->>'priority'), ''), 'medium'),
    coalesce(nullif(trim(p_project->>'status'), ''), 'planning'),
    coalesce((p_project->>'progress')::numeric, 0),
    nullif(trim(p_project->>'start_date'), '')::date,
    nullif(trim(p_project->>'end_date'), '')::date,
    v_user_id
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.update_project_secure_v2(p_project_id uuid, p_patch jsonb)
returns setof public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.projects;
begin
  update public.projects
  set
    name = coalesce(nullif(trim(p_patch->>'name'), ''), name),
    description = coalesce(nullif(trim(p_patch->>'description'), ''), description),
    priority = coalesce(nullif(trim(p_patch->>'priority'), ''), priority),
    status = coalesce(nullif(trim(p_patch->>'status'), ''), status),
    progress = coalesce((p_patch->>'progress')::numeric, progress),
    start_date = coalesce(nullif(trim(p_patch->>'start_date'), '')::date, start_date),
    end_date = coalesce(nullif(trim(p_patch->>'end_date'), '')::date, end_date),
    updated_at = now()
  where id = p_project_id
  returning * into v_result;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  return next v_result;
end;
$$;

create or replace function public.delete_project_secure_v2(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_members where project_id = p_project_id;
  delete from public.task_comments where task_id in (select id from public.tasks where project_id = p_project_id);
  delete from public.tasks where project_id = p_project_id;
  delete from public.project_taxes where project_id = p_project_id;
  delete from public.project_commissions where project_id = p_project_id;
  delete from public.projects where id = p_project_id;
end;
$$;

create or replace function public.assign_project_member_secure_v2(
  p_project_id uuid,
  p_user_id uuid,
  p_role text
)
returns setof public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.project_members;
begin
  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, p_user_id, coalesce(nullif(trim(p_role), ''), 'member'))
  on conflict (project_id, user_id)
  do update set role = excluded.role
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.create_task_secure_v2(p_task jsonb)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.tasks;
begin
  insert into public.tasks (
    project_id,
    title,
    description,
    status,
    priority,
    assignee_id,
    reporter_id,
    due_date,
    estimated_hours,
    actual_hours
  )
  values (
    nullif(trim(p_task->>'project_id'), '')::uuid,
    coalesce(nullif(trim(p_task->>'title'), ''), 'Untitled Task'),
    nullif(trim(p_task->>'description'), ''),
    coalesce(nullif(trim(p_task->>'status'), ''), 'todo'),
    coalesce(nullif(trim(p_task->>'priority'), ''), 'medium'),
    nullif(trim(p_task->>'assignee_id'), '')::uuid,
    nullif(trim(p_task->>'reporter_id'), '')::uuid,
    nullif(trim(p_task->>'due_date'), '')::date,
    nullif(trim(p_task->>'estimated_hours'), '')::numeric,
    nullif(trim(p_task->>'actual_hours'), '')::numeric
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.update_task_secure_v2(p_task_id uuid, p_patch jsonb)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.tasks;
begin
  update public.tasks
  set
    title = coalesce(nullif(trim(p_patch->>'title'), ''), title),
    description = coalesce(nullif(trim(p_patch->>'description'), ''), description),
    status = coalesce(nullif(trim(p_patch->>'status'), ''), status),
    priority = coalesce(nullif(trim(p_patch->>'priority'), ''), priority),
    assignee_id = coalesce(nullif(trim(p_patch->>'assignee_id'), '')::uuid, assignee_id),
    reporter_id = coalesce(nullif(trim(p_patch->>'reporter_id'), '')::uuid, reporter_id),
    due_date = coalesce(nullif(trim(p_patch->>'due_date'), '')::date, due_date),
    estimated_hours = coalesce(nullif(trim(p_patch->>'estimated_hours'), '')::numeric, estimated_hours),
    actual_hours = coalesce(nullif(trim(p_patch->>'actual_hours'), '')::numeric, actual_hours),
    completed_at = case
      when coalesce(nullif(trim(p_patch->>'status'), ''), status) in ('done', 'completed')
        then coalesce(completed_at, now())
      else completed_at
    end,
    updated_at = now()
  where id = p_task_id
  returning * into v_result;

  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  return next v_result;
end;
$$;

create or replace function public.delete_task_secure_v2(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tasks where id = p_task_id;
end;
$$;

create or replace function public.increment_task_comments_count_v2(task_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set comments_count = coalesce(comments_count, 0) + 1,
      updated_at = now()
  where id = task_id_input;
end;
$$;

create or replace function public.decrement_task_comments_count_v2(task_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set comments_count = greatest(coalesce(comments_count, 0) - 1, 0),
      updated_at = now()
  where id = task_id_input;
end;
$$;

create or replace function public.create_lead_secure_v2(p_lead jsonb)
returns setof public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.leads;
begin
  insert into public.leads (
    name, email, phone, company, designation, website,
    linkedin_url, facebook_url, instagram_url, x_url,
    services_offered, status, pipeline_stage, source, priority,
    lead_score, budget, expected_close_date, outreach_status,
    outreach_channel, first_contacted_at, last_reachout_at,
    followup_sent_at, followup_notes, close_value, assigned_to,
    project_id, notes, metadata, created_by, completed, converted_at,
    completed_at, lost_reason, next_followup_at, last_contacted_at
  )
  values (
    coalesce(nullif(trim(p_lead->>'name'), ''), 'Untitled Lead'),
    nullif(trim(p_lead->>'email'), ''),
    nullif(trim(p_lead->>'phone'), ''),
    nullif(trim(p_lead->>'company'), ''),
    nullif(trim(p_lead->>'designation'), ''),
    nullif(trim(p_lead->>'website'), ''),
    nullif(trim(p_lead->>'linkedin_url'), ''),
    nullif(trim(p_lead->>'facebook_url'), ''),
    nullif(trim(p_lead->>'instagram_url'), ''),
    nullif(trim(p_lead->>'x_url'), ''),
    nullif(trim(p_lead->>'services_offered'), ''),
    coalesce(nullif(trim(p_lead->>'status'), ''), 'new'),
    coalesce(nullif(trim(p_lead->>'pipeline_stage'), ''), 'new'),
    coalesce(nullif(trim(p_lead->>'source'), ''), 'manual'),
    coalesce(nullif(trim(p_lead->>'priority'), ''), 'medium'),
    coalesce((p_lead->>'lead_score')::numeric, 0),
    nullif(trim(p_lead->>'budget'), '')::numeric,
    nullif(trim(p_lead->>'expected_close_date'), '')::date,
    coalesce(nullif(trim(p_lead->>'outreach_status'), ''), 'not_contacted'),
    nullif(trim(p_lead->>'outreach_channel'), ''),
    nullif(trim(p_lead->>'first_contacted_at'), '')::timestamptz,
    nullif(trim(p_lead->>'last_reachout_at'), '')::timestamptz,
    nullif(trim(p_lead->>'followup_sent_at'), '')::timestamptz,
    nullif(trim(p_lead->>'followup_notes'), ''),
    nullif(trim(p_lead->>'close_value'), '')::numeric,
    nullif(trim(p_lead->>'assigned_to'), '')::uuid,
    nullif(trim(p_lead->>'project_id'), '')::uuid,
    nullif(trim(p_lead->>'notes'), ''),
    coalesce((p_lead->'metadata'), '{}'::jsonb),
    coalesce(nullif(trim(p_lead->>'created_by'), '')::uuid, auth.uid()),
    coalesce((p_lead->>'completed')::boolean, false),
    nullif(trim(p_lead->>'converted_at'), '')::timestamptz,
    nullif(trim(p_lead->>'completed_at'), '')::timestamptz,
    nullif(trim(p_lead->>'lost_reason'), ''),
    nullif(trim(p_lead->>'next_followup_at'), '')::timestamptz,
    nullif(trim(p_lead->>'last_contacted_at'), '')::timestamptz
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.update_lead_secure_v2(p_lead_id uuid, p_patch jsonb)
returns setof public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.leads;
begin
  update public.leads
  set
    name = coalesce(nullif(trim(p_patch->>'name'), ''), name),
    email = coalesce(nullif(trim(p_patch->>'email'), ''), email),
    phone = coalesce(nullif(trim(p_patch->>'phone'), ''), phone),
    company = coalesce(nullif(trim(p_patch->>'company'), ''), company),
    designation = coalesce(nullif(trim(p_patch->>'designation'), ''), designation),
    website = coalesce(nullif(trim(p_patch->>'website'), ''), website),
    linkedin_url = coalesce(nullif(trim(p_patch->>'linkedin_url'), ''), linkedin_url),
    facebook_url = coalesce(nullif(trim(p_patch->>'facebook_url'), ''), facebook_url),
    instagram_url = coalesce(nullif(trim(p_patch->>'instagram_url'), ''), instagram_url),
    x_url = coalesce(nullif(trim(p_patch->>'x_url'), ''), x_url),
    services_offered = coalesce(nullif(trim(p_patch->>'services_offered'), ''), services_offered),
    status = coalesce(nullif(trim(p_patch->>'status'), ''), status),
    pipeline_stage = coalesce(nullif(trim(p_patch->>'pipeline_stage'), ''), pipeline_stage),
    source = coalesce(nullif(trim(p_patch->>'source'), ''), source),
    priority = coalesce(nullif(trim(p_patch->>'priority'), ''), priority),
    lead_score = coalesce((p_patch->>'lead_score')::numeric, lead_score),
    budget = coalesce((p_patch->>'budget')::numeric, budget),
    expected_close_date = coalesce(nullif(trim(p_patch->>'expected_close_date'), '')::date, expected_close_date),
    outreach_status = coalesce(nullif(trim(p_patch->>'outreach_status'), ''), outreach_status),
    outreach_channel = coalesce(nullif(trim(p_patch->>'outreach_channel'), ''), outreach_channel),
    first_contacted_at = coalesce(nullif(trim(p_patch->>'first_contacted_at'), '')::timestamptz, first_contacted_at),
    last_reachout_at = coalesce(nullif(trim(p_patch->>'last_reachout_at'), '')::timestamptz, last_reachout_at),
    followup_sent_at = coalesce(nullif(trim(p_patch->>'followup_sent_at'), '')::timestamptz, followup_sent_at),
    followup_notes = coalesce(nullif(trim(p_patch->>'followup_notes'), ''), followup_notes),
    close_value = coalesce((p_patch->>'close_value')::numeric, close_value),
    assigned_to = coalesce(nullif(trim(p_patch->>'assigned_to'), '')::uuid, assigned_to),
    project_id = coalesce(nullif(trim(p_patch->>'project_id'), '')::uuid, project_id),
    notes = coalesce(nullif(trim(p_patch->>'notes'), ''), notes),
    metadata = coalesce((p_patch->'metadata'), metadata),
    completed = coalesce((p_patch->>'completed')::boolean, completed),
    converted_at = coalesce(nullif(trim(p_patch->>'converted_at'), '')::timestamptz, converted_at),
    completed_at = coalesce(nullif(trim(p_patch->>'completed_at'), '')::timestamptz, completed_at),
    lost_reason = coalesce(nullif(trim(p_patch->>'lost_reason'), ''), lost_reason),
    next_followup_at = coalesce(nullif(trim(p_patch->>'next_followup_at'), '')::timestamptz, next_followup_at),
    last_contacted_at = coalesce(nullif(trim(p_patch->>'last_contacted_at'), '')::timestamptz, last_contacted_at),
    updated_at = now()
  where id = p_lead_id
  returning * into v_result;

  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  return next v_result;
end;
$$;

create or replace function public.delete_lead_secure_v2(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.leads where id = p_lead_id;
end;
$$;

create or replace function public.create_time_log_secure_v2(p_time_log jsonb)
returns setof public.time_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.time_logs;
begin
  insert into public.time_logs (
    user_id, project_id, task_id, lead_id, session_id,
    log_date, hours, duration_minutes, start_time, end_time,
    is_manual, approval_status, work_type, manual_leads_count,
    description, status, created_by, updated_by, timer_type,
    lead_source, source_platform, source_platform_other
  )
  values (
    coalesce(nullif(trim(p_time_log->>'user_id'), '')::uuid, auth.uid()),
    nullif(trim(p_time_log->>'project_id'), '')::uuid,
    nullif(trim(p_time_log->>'task_id'), '')::uuid,
    nullif(trim(p_time_log->>'lead_id'), '')::uuid,
    nullif(trim(p_time_log->>'session_id'), ''),
    coalesce(nullif(trim(p_time_log->>'log_date'), '')::date, current_date),
    coalesce((p_time_log->>'hours')::numeric, 0),
    coalesce((p_time_log->>'duration_minutes')::integer, 0),
    nullif(trim(p_time_log->>'start_time'), '')::timestamptz,
    nullif(trim(p_time_log->>'end_time'), '')::timestamptz,
    coalesce((p_time_log->>'is_manual')::boolean, false),
    coalesce(nullif(trim(p_time_log->>'approval_status'), ''), 'pending'),
    nullif(trim(p_time_log->>'work_type'), ''),
    coalesce((p_time_log->>'manual_leads_count')::integer, 0),
    nullif(trim(p_time_log->>'description'), ''),
    coalesce(nullif(trim(p_time_log->>'status'), ''), 'pending'),
    coalesce(nullif(trim(p_time_log->>'created_by'), '')::uuid, auth.uid()),
    coalesce(nullif(trim(p_time_log->>'updated_by'), '')::uuid, auth.uid()),
    coalesce(nullif(trim(p_time_log->>'timer_type'), ''), 'sales'),
    nullif(trim(p_time_log->>'lead_source'), ''),
    nullif(trim(p_time_log->>'source_platform'), ''),
    nullif(trim(p_time_log->>'source_platform_other'), '')
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.delete_time_entry_secure_v2(p_time_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.time_logs where id = p_time_log_id;
end;
$$;

create or replace function public.create_time_tracking_session_secure_v2(p_session jsonb)
returns setof public.time_tracking_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.time_tracking_sessions;
begin
  insert into public.time_tracking_sessions (
    user_id, project_id, task_id, lead_id, session_status, entry_mode,
    source_platform, source_platform_other, lead_generation_target,
    manual_leads_count, notes, started_at, stopped_at
  )
  values (
    coalesce(nullif(trim(p_session->>'user_id'), '')::uuid, auth.uid()),
    nullif(trim(p_session->>'project_id'), '')::uuid,
    nullif(trim(p_session->>'task_id'), '')::uuid,
    nullif(trim(p_session->>'lead_id'), '')::uuid,
    coalesce(nullif(trim(p_session->>'session_status'), ''), 'running'),
    coalesce(nullif(trim(p_session->>'entry_mode'), ''), 'timer'),
    nullif(trim(p_session->>'source_platform'), ''),
    nullif(trim(p_session->>'source_platform_other'), ''),
    coalesce((p_session->>'lead_generation_target')::integer, 0),
    coalesce((p_session->>'manual_leads_count')::integer, 0),
    nullif(trim(p_session->>'notes'), ''),
    coalesce(nullif(trim(p_session->>'started_at'), '')::timestamptz, now()),
    nullif(trim(p_session->>'stopped_at'), '')::timestamptz
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.link_lead_to_time_session_secure_v2(p_session_id text, p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.time_tracking_sessions
  set lead_id = p_lead_id,
      updated_at = now()
  where id = p_session_id;
end;
$$;

create or replace function public.refresh_time_tracking_session_summary_v2(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.time_tracking_sessions
  set updated_at = now()
  where id = p_session_id;
end;
$$;

create or replace function public.create_finance_expense_secure_v2(p_expense jsonb)
returns setof public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.expenses;
begin
  insert into public.expenses (
    category, description, amount, currency, expense_date,
    payment_method, payment_method_other, project_id, receipt_url, created_by
  )
  values (
    coalesce(nullif(trim(p_expense->>'category'), ''), 'General'),
    nullif(trim(p_expense->>'description'), ''),
    coalesce((p_expense->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_expense->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_expense->>'expense_date'), '')::date, current_date),
    coalesce(nullif(trim(p_expense->>'payment_method'), ''), 'bank_transfer'),
    nullif(trim(p_expense->>'payment_method_other'), ''),
    nullif(trim(p_expense->>'project_id'), '')::uuid,
    nullif(trim(p_expense->>'receipt_url'), ''),
    auth.uid()
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.delete_finance_expense_secure_v2(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.expenses where id = p_expense_id;
end;
$$;

create or replace function public.create_finance_payment_secure_v2(p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
begin
  insert into public.payments (
    client_name, amount, currency, base_currency, base_amount, payment_date, payment_method,
    payment_method_other, status, description, project_id,
    received_amount, tax_amount, commission_amount, transaction_fee_amount, product_cost_amount, invoice_id, created_by
  )
  values (
    coalesce(nullif(trim(p_payment->>'client_name'), ''), 'Client'),
    coalesce((p_payment->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_payment->>'base_currency'), ''), 'USD'),
    coalesce((p_payment->>'base_amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, current_date),
    coalesce(nullif(trim(p_payment->>'payment_method'), ''), 'bank_transfer'),
    nullif(trim(p_payment->>'payment_method_other'), ''),
    coalesce(nullif(trim(p_payment->>'status'), ''), 'completed'),
    nullif(trim(p_payment->>'description'), ''),
    nullif(trim(p_payment->>'project_id'), '')::uuid,
    coalesce((p_payment->>'received_amount')::numeric, 0),
    coalesce((p_payment->>'tax_amount')::numeric, 0),
    coalesce((p_payment->>'commission_amount')::numeric, 0),
    coalesce((p_payment->>'transaction_fee_amount')::numeric, 0),
    coalesce((p_payment->>'product_cost_amount')::numeric, 0),
    nullif(trim(p_payment->>'invoice_id'), ''),
    auth.uid()
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.delete_finance_payment_secure_v2(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.payments where id = p_payment_id;
end;
$$;

create or replace function public.update_finance_payment_secure_v2(p_payment_id uuid, p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
begin
  update public.payments
  set
    client_name = coalesce(nullif(trim(p_payment->>'client_name'), ''), client_name),
    amount = coalesce((p_payment->>'amount')::numeric, amount),
    currency = coalesce(nullif(trim(p_payment->>'currency'), ''), currency),
    base_currency = coalesce(nullif(trim(p_payment->>'base_currency'), ''), base_currency),
    base_amount = coalesce((p_payment->>'base_amount')::numeric, base_amount),
    payment_date = coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, payment_date),
    payment_method = coalesce(nullif(trim(p_payment->>'payment_method'), ''), payment_method),
    payment_method_other = nullif(trim(p_payment->>'payment_method_other'), ''),
    status = coalesce(nullif(trim(p_payment->>'status'), ''), status),
    description = nullif(trim(p_payment->>'description'), ''),
    project_id = nullif(trim(p_payment->>'project_id'), '')::uuid,
    received_amount = coalesce((p_payment->>'received_amount')::numeric, received_amount),
    tax_amount = coalesce((p_payment->>'tax_amount')::numeric, tax_amount),
    commission_amount = coalesce((p_payment->>'commission_amount')::numeric, commission_amount),
    transaction_fee_amount = coalesce((p_payment->>'transaction_fee_amount')::numeric, transaction_fee_amount),
    product_cost_amount = coalesce((p_payment->>'product_cost_amount')::numeric, product_cost_amount),
    invoice_id = nullif(trim(p_payment->>'invoice_id'), ''),
    updated_at = now()
  where id = p_payment_id
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.create_finance_expense_secure(p_expense jsonb)
returns setof public.expenses
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.create_finance_expense_secure_v2(p_expense);
end;
$$;

create or replace function public.delete_finance_expense_secure(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.delete_finance_expense_secure_v2(p_expense_id);
end;
$$;

create or replace function public.create_finance_payment_secure(p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.create_finance_payment_secure_v2(p_payment);
end;
$$;

create or replace function public.delete_finance_payment_secure(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.delete_finance_payment_secure_v2(p_payment_id);
end;
$$;

alter table if exists public.roles disable row level security;
alter table if exists public.permissions disable row level security;
alter table if exists public.role_permissions disable row level security;
alter table if exists public.profiles disable row level security;
alter table if exists public.projects disable row level security;
alter table if exists public.project_members disable row level security;
alter table if exists public.tasks disable row level security;
alter table if exists public.task_comments disable row level security;
alter table if exists public.project_roles disable row level security;
alter table if exists public.project_permissions disable row level security;
alter table if exists public.files disable row level security;
alter table if exists public.activity_logs disable row level security;
alter table if exists public.notifications disable row level security;
alter table if exists public.lead_taxonomies disable row level security;
alter table if exists public.lead_tags disable row level security;
alter table if exists public.leads disable row level security;
alter table if exists public.lead_contacts disable row level security;
alter table if exists public.lead_activities disable row level security;
alter table if exists public.lead_notes disable row level security;
alter table if exists public.lead_followups disable row level security;
alter table if exists public.lead_tag_links disable row level security;
alter table if exists public.lead_followup_records disable row level security;
alter table if exists public.time_tracking_sessions disable row level security;
alter table if exists public.time_logs disable row level security;
alter table if exists public.clients disable row level security;
alter table if exists public.expenses disable row level security;
alter table if exists public.payments disable row level security;
alter table if exists public.founders disable row level security;
alter table if exists public.finance_settings disable row level security;
alter table if exists public.system_currencies disable row level security;
alter table if exists public.salary_runs disable row level security;
alter table if exists public.salary_entries disable row level security;
alter table if exists public.project_taxes disable row level security;
alter table if exists public.project_commissions disable row level security;
alter table if exists public.mail_threads disable row level security;
alter table if exists public.mails disable row level security;
alter table if exists public.mail_recipients disable row level security;
alter table if exists public.mail_attachments disable row level security;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
