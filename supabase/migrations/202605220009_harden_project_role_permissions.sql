begin;

create or replace function public.can_manage_project_roles(p_project_id uuid, p_user_id uuid default auth.uid())
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

drop policy if exists "Project roles editable by project members or admins" on public.project_roles;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_roles'
      and policyname = 'Project roles editable by project role permission'
  ) then
    create policy "Project roles editable by project role permission"
      on public.project_roles
      for all
      to authenticated
      using (
        public.can_manage_project_roles(project_roles.project_id)
      )
      with check (
        public.can_manage_project_roles(project_roles.project_id)
      );
  end if;
end $$;

create or replace function public.create_project_role_secure(p_project_id uuid, p_role jsonb)
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

  if not public.can_manage_project_roles(p_project_id, v_user_id) then
    raise exception 'You do not have permission to create project roles.' using errcode = '42501';
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

create or replace function public.update_project_role_secure(p_role_id uuid, p_patch jsonb)
returns setof public.project_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_result public.project_roles;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  select project_id into v_project_id
  from public.project_roles
  where id = p_role_id;

  if v_project_id is null then
    raise exception 'Project role not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_project_roles(v_project_id, v_user_id) then
    raise exception 'You do not have permission to update project roles.' using errcode = '42501';
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

create or replace function public.delete_project_role_secure(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  select project_id into v_project_id
  from public.project_roles
  where id = p_role_id;

  if v_project_id is null then
    raise exception 'Project role not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_project_roles(v_project_id, v_user_id) then
    raise exception 'You do not have permission to delete project roles.' using errcode = '42501';
  end if;

  delete from public.project_roles where id = p_role_id;
end;
$$;

commit;
