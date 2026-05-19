-- Fix: users get Access Denied because role_permissions RLS blocks reading their own role permissions.
-- Run this in Supabase SQL editor, then refresh/re-login in the app.

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

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;

drop policy if exists "authenticated role_permissions access" on public.role_permissions;
drop policy if exists "role_permissions manage access" on public.role_permissions;
drop policy if exists "role_permissions own role read" on public.role_permissions;
drop policy if exists "role_permissions manage write" on public.role_permissions;

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
drop policy if exists "permissions manage write" on public.permissions;

create policy "permissions authenticated read"
on public.permissions
for select
to authenticated
using (true);

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
