-- PMP access-control/schema sync
-- Run this in Supabase SQL editor after the main schema is deployed.

-- 1) Schema drift fixes used by the current frontend.
alter table public.time_logs
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists time_logs_lead_id_idx on public.time_logs (lead_id);

alter table public.lead_followup_records
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists status text;

create index if not exists lead_followup_records_owner_id_idx on public.lead_followup_records(owner_id);
create index if not exists lead_followup_records_data_gin_idx on public.lead_followup_records using gin(data);

-- 2) Permission catalog sync.
insert into public.permissions (key, name, module, description)
values
  ('mails.view', 'mails.view', 'mails', 'View own mails'),
  ('mails.view.all', 'mails.view.all', 'mails', 'View all mails'),
  ('mails.send', 'mails.send', 'mails', 'Send mails'),
  ('mails.reply', 'mails.reply', 'mails', 'Reply to mails'),
  ('mails.delete', 'mails.delete', 'mails', 'Delete mails'),
  ('mails.manage', 'mails.manage', 'mails', 'Manage mail settings and records'),
  ('mail_threads.view', 'mail_threads.view', 'mails', 'View mail threads'),
  ('mail_threads.create', 'mail_threads.create', 'mails', 'Create mail threads'),
  ('leads.view.all', 'leads.view.all', 'leads', 'View all users leads')
on conflict (key) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description;

-- All-mail permission must live only with Admin and Super Admin.
delete from public.role_permissions rp
using public.permissions p, public.roles r
where rp.permission_id = p.id
  and rp.role_id = r.id
  and p.key = 'mails.view.all'
  and lower(replace(r.name, '_', ' ')) not in ('admin', 'super admin', 'superadmin');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where p.key = 'mails.view.all'
  and lower(replace(r.name, '_', ' ')) in ('admin', 'super admin', 'superadmin')
on conflict do nothing;

-- 3) Helper functions for RLS.
create or replace function public.current_role_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select lower(replace(coalesce(r.name, ''), '_', ' '))
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create or replace function public.current_user_has_permission(permission_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.permissions pe on pe.id = rp.permission_id
    where pr.id = auth.uid()
      and pe.key = permission_key
  )
$$;

create or replace function public.current_user_can_view_all_mails()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role_name() in ('admin', 'super admin', 'superadmin'), false)
    or public.current_user_has_permission('mails.view.all')
$$;

create or replace function public.current_user_can_view_all_leads()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role_name() in ('super admin', 'superadmin'), false)
    or public.current_user_has_permission('leads.view.all')
$$;

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.current_user_can_view_all_mails() to authenticated;
grant execute on function public.current_user_can_view_all_leads() to authenticated;

-- Mail access helpers keep RLS policies from recursively querying each other.
create or replace function public.current_user_sent_mail(mail_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.mails m
    where m.id = mail_id_input
      and m.sender_id = auth.uid()
  )
$$;

create or replace function public.current_user_received_mail(mail_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.mail_recipients mr
    where mr.mail_id = mail_id_input
      and mr.recipient_id = auth.uid()
  )
$$;

create or replace function public.current_user_can_access_mail(mail_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_can_view_all_mails()
    or public.current_user_sent_mail(mail_id_input)
    or public.current_user_received_mail(mail_id_input)
$$;

create or replace function public.current_user_can_access_mail_thread(thread_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_can_view_all_mails()
    or exists (
      select 1
      from public.mail_threads mt
      where mt.id = thread_id_input
        and mt.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.mails m
      where m.thread_id = thread_id_input
        and (
          m.sender_id = auth.uid()
          or exists (
            select 1
            from public.mail_recipients mr
            where mr.mail_id = m.id
              and mr.recipient_id = auth.uid()
          )
        )
    )
$$;

grant execute on function public.current_user_sent_mail(uuid) to authenticated;
grant execute on function public.current_user_received_mail(uuid) to authenticated;
grant execute on function public.current_user_can_access_mail(uuid) to authenticated;
grant execute on function public.current_user_can_access_mail_thread(uuid) to authenticated;

-- 4) Role permission RLS:
--    - every authenticated user can read permissions for their own role so route guards work
--    - only authorized admins can change role permissions
drop policy if exists "authenticated role_permissions access" on public.role_permissions;
drop policy if exists "role_permissions manage access" on public.role_permissions;
drop policy if exists "role_permissions own role read" on public.role_permissions;
create policy "role_permissions own role read"
on public.role_permissions
for select
to authenticated
using (
  public.current_role_name() in ('super admin', 'superadmin')
  or public.current_user_has_permission('roles.manage')
  or public.current_user_has_permission('permissions.manage')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id = role_permissions.role_id
  )
);

drop policy if exists "role_permissions manage write" on public.role_permissions;
create policy "role_permissions manage write"
on public.role_permissions
for all
to authenticated
using (
  public.current_role_name() in ('super admin', 'superadmin')
  or public.current_user_has_permission('roles.manage')
  or public.current_user_has_permission('permissions.manage')
)
with check (
  public.current_role_name() in ('super admin', 'superadmin')
  or public.current_user_has_permission('roles.manage')
  or public.current_user_has_permission('permissions.manage')
);

drop policy if exists "authenticated permissions access" on public.permissions;
drop policy if exists "permissions authenticated read" on public.permissions;
create policy "permissions authenticated read"
on public.permissions
for select
to authenticated
using (true);

drop policy if exists "permissions manage write" on public.permissions;
create policy "permissions manage write"
on public.permissions
for all
to authenticated
using (
  public.current_role_name() in ('super admin', 'superadmin')
  or public.current_user_has_permission('permissions.manage')
)
with check (
  public.current_role_name() in ('super admin', 'superadmin')
  or public.current_user_has_permission('permissions.manage')
);

-- 5) Tighten mail RLS. Users see their own inbox/sent; Admin/Super Admin/all-mail permission sees all.
drop policy if exists "authenticated mail_threads access" on public.mail_threads;
drop policy if exists "mail_threads scoped access" on public.mail_threads;
create policy "mail_threads scoped access"
on public.mail_threads
for all
to authenticated
using (public.current_user_can_access_mail_thread(id))
with check (
  public.current_user_can_view_all_mails()
  or created_by = auth.uid()
);

drop policy if exists "authenticated mails access" on public.mails;
drop policy if exists "mails scoped access" on public.mails;
create policy "mails scoped access"
on public.mails
for all
to authenticated
using (public.current_user_can_access_mail(id))
with check (
  public.current_user_can_view_all_mails()
  or sender_id = auth.uid()
);

drop policy if exists "authenticated mail_recipients access" on public.mail_recipients;
drop policy if exists "mail_recipients scoped access" on public.mail_recipients;
create policy "mail_recipients scoped access"
on public.mail_recipients
for all
to authenticated
using (
  public.current_user_can_view_all_mails()
  or recipient_id = auth.uid()
  or public.current_user_sent_mail(mail_id)
)
with check (
  public.current_user_can_view_all_mails()
  or recipient_id = auth.uid()
  or public.current_user_sent_mail(mail_id)
);

drop policy if exists "authenticated mail_attachments access" on public.mail_attachments;
drop policy if exists "mail_attachments scoped access" on public.mail_attachments;
create policy "mail_attachments scoped access"
on public.mail_attachments
for all
to authenticated
using (public.current_user_can_access_mail(mail_id))
with check (
  public.current_user_can_view_all_mails()
  or public.current_user_sent_mail(mail_id)
);

-- 6) Tighten leads and flexible follow-up RLS.
drop policy if exists "authenticated leads access" on public.leads;
drop policy if exists "leads scoped access" on public.leads;
create policy "leads scoped access"
on public.leads
for all
to authenticated
using (
  public.current_user_can_view_all_leads()
  or created_by = auth.uid()
  or assigned_to = auth.uid()
)
with check (
  public.current_user_can_view_all_leads()
  or created_by = auth.uid()
  or assigned_to = auth.uid()
);

drop policy if exists "authenticated lead_followup_records access" on public.lead_followup_records;
drop policy if exists "lead_followup_records scoped access" on public.lead_followup_records;
create policy "lead_followup_records scoped access"
on public.lead_followup_records
for all
to authenticated
using (
  public.current_user_can_view_all_leads()
  or owner_id = auth.uid()
)
with check (
  public.current_user_can_view_all_leads()
  or owner_id = auth.uid()
);
