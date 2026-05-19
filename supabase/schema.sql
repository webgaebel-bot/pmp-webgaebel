create extension if not exists "pgcrypto";

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  module text not null,
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
  role_id uuid references public.roles(id) on delete set null,
  name text,
  email text not null unique,
  avatar_url text,
  profile_image text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'planning',
  priority text not null default 'medium',
  progress integer not null default 0,
  start_date date,
  end_date date,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  constraint project_members_project_id_fkey
    foreign key (project_id) references public.projects(id) on delete cascade,
  constraint project_members_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint project_members_unique unique (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  assignee_id uuid,
  reporter_id uuid not null,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date date,
  estimated_hours numeric(10,2),
  actual_hours numeric(10,2),
  comments_count integer not null default 0,
  attachments_count integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_project_id_fkey
    foreign key (project_id) references public.projects(id) on delete cascade,
  constraint tasks_assignee_id_fkey
    foreign key (assignee_id) references public.profiles(id) on delete set null,
  constraint tasks_reporter_id_fkey
    foreign key (reporter_id) references public.profiles(id) on delete restrict
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  parent_id uuid,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_comments_task_id_fkey
    foreign key (task_id) references public.tasks(id) on delete cascade,
  constraint task_comments_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint task_comments_parent_id_fkey
    foreign key (parent_id) references public.task_comments(id) on delete cascade
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_name text,
  created_at timestamptz not null default now(),
  constraint activity_logs_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  related_type text not null check (related_type in ('project', 'task', 'comment', 'lead', 'mail')),
  related_id uuid not null,
  file_url text not null,
  file_name text,
  file_path text,
  file_size bigint,
  file_type text,
  description text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text,
  message text,
  type text,
  entity_type text,
  entity_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company text,
  address text,
  status text not null default 'active' check (status in ('active', 'inactive', 'lead')),
  notes text,
  total_revenue numeric(12,2) not null default 0,
  last_payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_email_unique_ci on public.clients (lower(email));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  amount numeric(12,2) not null default 0,
  payment_date date not null,
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'credit_card', 'paypal', 'cash', 'check')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'refunded')),
  description text,
  project_id uuid references public.projects(id) on delete set null,
  invoice_id text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('salary', 'software', 'marketing', 'office', 'travel', 'equipment', 'other')),
  description text not null,
  amount numeric(12,2) not null default 0,
  expense_date date not null,
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'credit_card', 'cash', 'check')),
  receipt_url text,
  approved_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  equity_percentage numeric(5,2) not null default 0,
  vested_percentage numeric(5,2) not null default 0,
  join_date date not null,
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  log_date date not null,
  hours numeric(5,2) not null default 0,
  minutes integer generated always as ((hours * 60)::integer) stored,
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_logs_user_date_idx on public.time_logs (user_id, log_date);
create index if not exists time_logs_lead_id_idx on public.time_logs (lead_id);

create table if not exists public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.mails (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  thread_id uuid references public.mail_threads(id) on delete cascade,
  sender_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mail_recipients (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid not null references public.mails(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists mail_recipients_unique on public.mail_recipients (mail_id, recipient_id);

create table if not exists public.mail_attachments (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid not null references public.mails(id) on delete cascade,
  original_name text,
  file_name text,
  file_path text,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  job_title text,
  designation varchar(255),
  website text,
  linkedin_url text,
  facebook_url text,
  instagram_url text,
  x_url text,
  services_offered text,
  industry text,
  country text,
  city text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost')),
  source text not null default 'manual' check (source in ('manual', 'facebook', 'instagram', 'x', 'website', 'referral', 'social', 'cold_call', 'email_campaign', 'whatsapp', 'linkedin', 'other')),
  pipeline_stage text not null default 'new' check (pipeline_stage in ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost', 'inbox', 'discovery', 'proposal')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  value numeric(12,2) not null default 0,
  score integer not null default 0 check (score between 0 and 100),
  lead_score integer default 0 check (lead_score >= 0 and lead_score <= 100),
  budget numeric(15, 2),
  expected_close_date date,
  lost_reason text,
  outreach_status text not null default 'not_contacted' check (outreach_status in ('not_contacted', 'contacted', 'followup_sent', 'replied', 'qualified', 'closed', 'lost')),
  outreach_channel text check (outreach_channel in ('email', 'phone', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'x', 'website', 'other')),
  first_contacted_at timestamptz,
  last_reachout_at timestamptz,
  followup_sent_at timestamptz,
  followup_notes text,
  close_value numeric(12,2),
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  completed boolean not null default false,
  converted_at timestamptz,
  completed_at timestamptz,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  duplicate_of uuid references public.leads(id) on delete set null,
  source_details jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_pipeline_stage_idx on public.leads (pipeline_stage);
create unique index if not exists leads_email_unique_ci on public.leads (lower(trim(email)));
create unique index if not exists leads_phone_unique_digits on public.leads ((regexp_replace(coalesce(phone, ''), '\D', '', 'g'))) where coalesce(phone, '') <> '';

create table if not exists public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#64748b',
  created_at timestamptz not null default now()
);

create table if not exists public.lead_tag_links (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.lead_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null check (activity_type in ('created', 'updated', 'status_changed', 'note_added', 'call', 'email', 'meeting', 'follow_up_scheduled', 'converted', 'lost')),
  summary text not null,
  details text,
  activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  note text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'missed', 'cancelled')),
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists lead_followup_records_owner_id_idx on public.lead_followup_records(owner_id);
create index if not exists lead_followup_records_data_gin_idx on public.lead_followup_records using gin(data);

alter table public.leads add column if not exists source varchar(50) default 'manual';
alter table public.leads add column if not exists lead_score integer default 0 check (lead_score >= 0 and lead_score <= 100);
alter table public.leads add column if not exists designation varchar(255);
alter table public.leads add column if not exists budget numeric(15, 2);
alter table public.leads add column if not exists expected_close_date date;
alter table public.leads add column if not exists lost_reason text;
alter table public.leads add column if not exists last_contacted_at timestamptz;
alter table public.leads add column if not exists next_followup_at timestamptz;
alter table public.leads alter column email drop not null;
alter table public.leads add column if not exists linkedin_url text;
alter table public.leads add column if not exists facebook_url text;
alter table public.leads add column if not exists instagram_url text;
alter table public.leads add column if not exists x_url text;
alter table public.leads add column if not exists services_offered text;
alter table public.leads add column if not exists outreach_status text default 'not_contacted';
alter table public.leads add column if not exists outreach_channel text;
alter table public.leads add column if not exists first_contacted_at timestamptz;
alter table public.leads add column if not exists last_reachout_at timestamptz;
alter table public.leads add column if not exists followup_sent_at timestamptz;
alter table public.leads add column if not exists followup_notes text;
alter table public.leads add column if not exists close_value numeric(12,2);
alter table public.leads add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.time_logs add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('manual', 'facebook', 'instagram', 'x', 'website', 'referral', 'social', 'cold_call', 'email_campaign', 'whatsapp', 'linkedin', 'other'));

alter table public.leads drop constraint if exists leads_pipeline_stage_check;
alter table public.leads add constraint leads_pipeline_stage_check
  check (pipeline_stage in ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost', 'inbox', 'discovery', 'proposal'));

alter table public.leads drop constraint if exists leads_outreach_status_check;
alter table public.leads add constraint leads_outreach_status_check
  check (outreach_status in ('not_contacted', 'contacted', 'followup_sent', 'replied', 'qualified', 'closed', 'lost'));

alter table public.leads drop constraint if exists leads_outreach_channel_check;
alter table public.leads add constraint leads_outreach_channel_check
  check (outreach_channel is null or outreach_channel in ('email', 'phone', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'x', 'website', 'other'));

create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  name varchar(255) not null,
  email varchar(255),
  phone varchar(50),
  is_primary boolean default false,
  role varchar(100),
  created_at timestamptz default now()
);

create index if not exists idx_lead_contacts_lead_id on public.lead_contacts(lead_id);

alter table public.lead_activities add column if not exists description text;
alter table public.lead_activities add column if not exists duration_minutes integer;
alter table public.lead_activities add column if not exists outcome varchar(100);
alter table public.lead_activities add column if not exists created_by uuid references public.profiles(id);

alter table public.lead_activities drop constraint if exists lead_activities_activity_type_check;
alter table public.lead_activities add constraint lead_activities_activity_type_check
  check (activity_type in ('created', 'updated', 'status_changed', 'note_added', 'call', 'email', 'meeting', 'follow_up_scheduled', 'converted', 'lost', 'note', 'whatsapp', 'status_change', 'followup', 'document'));

alter table public.lead_notes add column if not exists content text;

alter table public.lead_followups add column if not exists followup_type varchar(50) default 'call';
alter table public.lead_followups add column if not exists reminder_sent boolean default false;
alter table public.lead_followups add column if not exists notes text;
alter table public.lead_followups add column if not exists scheduled_at timestamptz;
alter table public.lead_followups add column if not exists completed boolean default false;
alter table public.lead_followup_records add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
alter table public.lead_followup_records add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.lead_followup_records add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.lead_followup_records add column if not exists status text;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists task_comments_set_updated_at on public.task_comments;
create trigger task_comments_set_updated_at
before update on public.task_comments
for each row
execute function public.set_updated_at();

drop trigger if exists finance_settings_set_updated_at on public.finance_settings;
create trigger finance_settings_set_updated_at
before update on public.finance_settings
for each row
execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

drop trigger if exists founders_set_updated_at on public.founders;
create trigger founders_set_updated_at
before update on public.founders
for each row
execute function public.set_updated_at();

drop trigger if exists time_logs_set_updated_at on public.time_logs;
create trigger time_logs_set_updated_at
before update on public.time_logs
for each row
execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

drop trigger if exists lead_notes_set_updated_at on public.lead_notes;
create trigger lead_notes_set_updated_at
before update on public.lead_notes
for each row
execute function public.set_updated_at();

drop trigger if exists lead_followups_set_updated_at on public.lead_followups;
create trigger lead_followups_set_updated_at
before update on public.lead_followups
for each row
execute function public.set_updated_at();

create or replace function public.normalize_lead_fields()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));

  if new.phone is not null then
    new.phone := nullif(regexp_replace(new.phone, '\D', '', 'g'), '');
  end if;

  if new.status = 'converted' then
    new.completed := true;
    if new.converted_at is null then
      new.converted_at := now();
    end if;
    if new.completed_at is null then
      new.completed_at := now();
    end if;
    new.pipeline_stage := 'won';
  elsif new.status = 'lost' then
    new.completed := true;
    if new.completed_at is null then
      new.completed_at := now();
    end if;
    new.pipeline_stage := 'lost';
  else
    new.completed := false;
    new.completed_at := null;
    if new.status = 'qualified' then
      new.pipeline_stage := 'qualified';
    elsif new.status = 'proposal' then
      new.pipeline_stage := 'proposal_sent';
    elsif new.status = 'negotiation' then
      new.pipeline_stage := 'negotiation';
    elsif new.status = 'contacted' then
      new.pipeline_stage := 'contacted';
    else
      new.pipeline_stage := 'new';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_normalize_fields on public.leads;
create trigger leads_normalize_fields
before insert or update on public.leads
for each row
execute function public.normalize_lead_fields();

create or replace function public.prevent_duplicate_leads()
returns trigger
language plpgsql
as $$
declare
  duplicate_lead_id uuid;
begin
  select l.id
    into duplicate_lead_id
  from public.leads l
  where l.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and (
      lower(trim(l.email)) = lower(trim(new.email))
      or (
        coalesce(regexp_replace(l.phone, '\D', '', 'g'), '') <> ''
        and coalesce(regexp_replace(new.phone, '\D', '', 'g'), '') <> ''
        and regexp_replace(l.phone, '\D', '', 'g') = regexp_replace(new.phone, '\D', '', 'g')
      )
    )
  limit 1;

  if duplicate_lead_id is not null then
    raise exception 'A lead with the same email or phone already exists.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_prevent_duplicates on public.leads;
create trigger leads_prevent_duplicates
before insert or update on public.leads
for each row
execute function public.prevent_duplicate_leads();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id
  from public.roles
  where lower(name) = 'viewer'
  limit 1;

  insert into public.profiles (id, email, name, role_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    default_role_id
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.increment_task_comments_count(task_id_input uuid)
returns void
language sql
security definer
as $$
  update public.tasks
  set comments_count = comments_count + 1
  where id = task_id_input;
$$;

create or replace function public.decrement_task_comments_count(task_id_input uuid)
returns void
language sql
security definer
as $$
  update public.tasks
  set comments_count = greatest(comments_count - 1, 0)
  where id = task_id_input;
$$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.finance_settings enable row level security;
alter table public.clients enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.founders enable row level security;
alter table public.time_logs enable row level security;
alter table public.mail_threads enable row level security;
alter table public.mails enable row level security;
alter table public.mail_recipients enable row level security;
alter table public.mail_attachments enable row level security;
alter table public.leads enable row level security;
alter table public.lead_tags enable row level security;
alter table public.lead_tag_links enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_followups enable row level security;
alter table public.lead_contacts enable row level security;
alter table public.lead_followup_records enable row level security;

drop policy if exists "authenticated roles access" on public.roles;
create policy "authenticated roles access"
on public.roles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated permissions access" on public.permissions;
create policy "authenticated permissions access"
on public.permissions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated role_permissions access" on public.role_permissions;
create policy "authenticated role_permissions access"
on public.role_permissions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated profiles access" on public.profiles;
create policy "authenticated profiles access"
on public.profiles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated projects access" on public.projects;
create policy "authenticated projects access"
on public.projects
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated project_members access" on public.project_members;
create policy "authenticated project_members access"
on public.project_members
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated tasks access" on public.tasks;
create policy "authenticated tasks access"
on public.tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated task_comments access" on public.task_comments;
create policy "authenticated task_comments access"
on public.task_comments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated activity_logs access" on public.activity_logs;
create policy "authenticated activity_logs access"
on public.activity_logs
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated files access" on public.files;
create policy "authenticated files access"
on public.files
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated notifications access" on public.notifications;
create policy "authenticated notifications access"
on public.notifications
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated finance_settings access" on public.finance_settings;
create policy "authenticated finance_settings access"
on public.finance_settings
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated clients access" on public.clients;
create policy "authenticated clients access"
on public.clients
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated payments access" on public.payments;
create policy "authenticated payments access"
on public.payments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated expenses access" on public.expenses;
create policy "authenticated expenses access"
on public.expenses
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated founders access" on public.founders;
create policy "authenticated founders access"
on public.founders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated time_logs access" on public.time_logs;
create policy "authenticated time_logs access"
on public.time_logs
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated mail_threads access" on public.mail_threads;
create policy "authenticated mail_threads access"
on public.mail_threads
for all
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "authenticated mails access" on public.mails;
drop policy if exists "authenticated mails insert" on public.mails;
drop policy if exists "authenticated mails update" on public.mails;

create policy "authenticated mails access"
on public.mails
for select
to authenticated
using (
  sender_id = auth.uid()
  or exists (
    select 1 from public.mail_recipients
    where mail_id = public.mails.id
    and recipient_id = auth.uid()
    and is_deleted = false
  )
);

create policy "authenticated mails insert"
on public.mails
for insert
to authenticated
with check (sender_id = auth.uid());

create policy "authenticated mails update"
on public.mails
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

drop policy if exists "authenticated mail_recipients access" on public.mail_recipients;
create policy "authenticated mail_recipients access"
on public.mail_recipients
for all
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "authenticated mail_attachments access" on public.mail_attachments;
create policy "authenticated mail_attachments access"
on public.mail_attachments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated leads access" on public.leads;
create policy "authenticated leads access"
on public.leads
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated lead_tags access" on public.lead_tags;
create policy "authenticated lead_tags access"
on public.lead_tags
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated lead_tag_links access" on public.lead_tag_links;
create policy "authenticated lead_tag_links access"
on public.lead_tag_links
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated lead_activities access" on public.lead_activities;
create policy "authenticated lead_activities access"
on public.lead_activities
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated lead_notes access" on public.lead_notes;
create policy "authenticated lead_notes access"
on public.lead_notes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated lead_followups access" on public.lead_followups;
create policy "authenticated lead_followups access"
on public.lead_followups
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated lead_followup_records access" on public.lead_followup_records;
create policy "authenticated lead_followup_records access"
on public.lead_followup_records
for all
to authenticated
using (true)
with check (owner_id = auth.uid());

drop policy if exists "authenticated lead_contacts access" on public.lead_contacts;
create policy "authenticated lead_contacts access"
on public.lead_contacts
for all
to authenticated
using (true)
with check (true);

insert into public.roles (name, description)
values
  ('Super Admin', 'Full access across the portal'),
  ('Admin', 'Administrative access for operations'),
  ('Project Manager', 'Manages projects and team execution'),
  ('Team Lead', 'Leads delivery teams and operations'),
  ('Developer', 'Works on assigned tasks and technical delivery'),
  ('QA', 'Quality assurance and testing role'),
  ('Client', 'Client access to relevant records'),
  ('Team Member', 'Works on assigned tasks'),
  ('Viewer', 'Read-only access')
on conflict (name) do nothing;

insert into public.permissions (key, name, module, description)
values
  ('dashboard.view', 'dashboard.view', 'dashboard', 'Access dashboard shell'),
  ('dashboard.stats.view', 'dashboard.stats.view', 'dashboard', 'View dashboard stats'),
  ('dashboard.project_progress', 'dashboard.project_progress', 'dashboard', 'View project progress widgets'),
  ('dashboard.team_performance', 'dashboard.team_performance', 'dashboard', 'View team performance widgets'),
  ('dashboard.task_charts', 'dashboard.task_charts', 'dashboard', 'View task charts'),
  ('dashboard.activity_logs', 'dashboard.activity_logs', 'dashboard', 'View dashboard activity widgets'),
  ('dashboard.view.total_projects', 'dashboard.view.total_projects', 'dashboard', 'View total projects stat'),
  ('dashboard.view.tasks', 'dashboard.view.tasks', 'dashboard', 'View total tasks stat'),
  ('dashboard.view.overdue', 'dashboard.view.overdue', 'dashboard', 'View overdue tasks stat'),
  ('dashboard.view.team', 'dashboard.view.team', 'dashboard', 'View team members stat'),
  ('dashboard.view.online_users', 'dashboard.view.online_users', 'dashboard', 'View online users stat'),
  ('projects.view', 'projects.view', 'projects', 'View projects'),
  ('projects.view.all', 'projects.view.all', 'projects', 'View all projects'),
  ('projects.create', 'projects.create', 'projects', 'Create projects'),
  ('projects.update', 'projects.update', 'projects', 'Edit projects'),
  ('projects.delete', 'projects.delete', 'projects', 'Delete projects'),
  ('tasks.view', 'tasks.view', 'tasks', 'View tasks'),
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
  ('finance.payments.view', 'finance.payments.view', 'finance', 'View payments'),
  ('finance.payments.manage', 'finance.payments.manage', 'finance', 'Manage payments'),
  ('finance.expenses.view', 'finance.expenses.view', 'finance', 'View expenses'),
  ('finance.expenses.manage', 'finance.expenses.manage', 'finance', 'Manage expenses'),
  ('finance.clients.view', 'finance.clients.view', 'finance', 'View finance clients'),
  ('finance.clients.manage', 'finance.clients.manage', 'finance', 'Manage finance clients'),
  ('finance.founders.view', 'finance.founders.view', 'finance', 'View founders finance'),
  ('finance.founders.manage', 'finance.founders.manage', 'finance', 'Manage founders finance'),
  ('finance.settings.manage', 'finance.settings.manage', 'finance', 'Manage finance settings'),
  ('time.view', 'time.view', 'time', 'View time tracking'),
  ('time.create', 'time.create', 'time', 'Create time entries'),
  ('time.update', 'time.update', 'time', 'Update time entries'),
  ('time.delete', 'time.delete', 'time', 'Delete time entries'),
  ('time.approve', 'time.approve', 'time', 'Approve or reject time entries'),
  ('time.manage', 'time.manage', 'time', 'Manage all time entries'),
  ('leads.view', 'leads.view', 'leads', 'View leads CRM'),
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
  ('users.view', 'users.view', 'users', 'View users'),
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
  ('activity_logs.view', 'activity_logs.view', 'activity_logs', 'View activity logs'),
  ('activity_logs.dashboard', 'activity_logs.dashboard', 'activity_logs', 'View dashboard activity logs')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where lower(r.name) = 'super admin'
on conflict do nothing;

insert into public.finance_settings (setting_key, setting_value)
values
  ('future_fund_percentage', '20'),
  ('commission_percentage', '15'),
  ('tax_rate', '30'),
  ('currency', 'USD'),
  ('enable_auto_calculation', 'true')
on conflict (setting_key) do nothing;

insert into public.lead_tags (name, color)
values
  ('hot', '#ef4444'),
  ('warm', '#f59e0b'),
  ('cold', '#64748b'),
  ('enterprise', '#0f766e'),
  ('follow-up', '#2563eb')
on conflict (name) do nothing;
