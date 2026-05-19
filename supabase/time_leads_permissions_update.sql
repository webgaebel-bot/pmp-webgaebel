-- Time tracking + leads permission sync
-- Run this in the Supabase SQL editor after the main schema/access-control scripts.

-- 1) Make sure current frontend columns/indexes exist.
alter table public.time_logs
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists time_logs_user_date_idx on public.time_logs (user_id, log_date);
create index if not exists time_logs_lead_id_idx on public.time_logs (lead_id);

-- 2) Permission catalog verification.
insert into public.permissions (key, name, module, description)
values
  ('time.view', 'time.view', 'time', 'View own time tracking'),
  ('time.view.all', 'time.view.all', 'time', 'View all users time tracking'),
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
  ('leads.followups.delete', 'leads.followups.delete', 'leads', 'Delete follow-up rows')
on conflict (key) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description;

-- 3) Helper functions used by RLS. Safe to re-run.
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

create or replace function public.current_user_can_view_all_time()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role_name() in ('admin', 'super admin', 'superadmin'), false)
    or public.current_user_has_permission('time.view.all')
    or public.current_user_has_permission('time.manage')
    or public.current_user_has_permission('time.approve')
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
grant execute on function public.current_user_can_view_all_time() to authenticated;
grant execute on function public.current_user_can_view_all_leads() to authenticated;

-- 4) Give Admin/Super Admin full time visibility/management.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where lower(replace(r.name, '_', ' ')) in ('admin', 'super admin', 'superadmin')
  and p.key in ('time.view', 'time.view.all', 'time.create', 'time.update', 'time.delete', 'time.approve', 'time.manage', 'leads.detail.view', 'leads.view.all')
on conflict do nothing;

-- 5) Scope time log data: users can manage their own rows; Admin/Super Admin/time managers can see all.
alter table public.time_logs enable row level security;

drop policy if exists "authenticated time_logs access" on public.time_logs;
drop policy if exists "time_logs scoped select" on public.time_logs;
create policy "time_logs scoped select"
on public.time_logs
for select
to authenticated
using (
  public.current_user_can_view_all_time()
  or user_id = auth.uid()
);

drop policy if exists "time_logs scoped insert" on public.time_logs;
create policy "time_logs scoped insert"
on public.time_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.current_user_has_permission('time.create')
);

drop policy if exists "time_logs scoped update" on public.time_logs;
create policy "time_logs scoped update"
on public.time_logs
for update
to authenticated
using (
  public.current_user_can_view_all_time()
  or user_id = auth.uid()
)
with check (
  public.current_user_can_view_all_time()
  or user_id = auth.uid()
);

drop policy if exists "time_logs scoped delete" on public.time_logs;
create policy "time_logs scoped delete"
on public.time_logs
for delete
to authenticated
using (
  public.current_user_can_view_all_time()
  or (
    user_id = auth.uid()
    and public.current_user_has_permission('time.delete')
  )
);

-- 6) Keep lead activity/notification noise out going forward.
-- The frontend no longer writes lead create/update activity or notifications.
-- This cleanup is optional; uncomment if you want to remove old lead create/update activity rows.
-- delete from public.activity_logs
-- where entity_type = 'lead'
--   and action in ('CREATE', 'UPDATE');
