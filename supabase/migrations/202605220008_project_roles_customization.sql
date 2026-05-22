begin;

create table if not exists public.project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_roles_project_name_unique_idx
  on public.project_roles (project_id, name);

alter table public.project_roles enable row level security;

create table if not exists public.project_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.project_permissions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_permissions'
      and policyname = 'Project permissions readable by authenticated users'
  ) then
    create policy "Project permissions readable by authenticated users"
      on public.project_permissions
      for select
      to authenticated
      using (true);
  end if;
end $$;

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

create or replace function public.normalize_project_role_permissions()
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
execute function public.normalize_project_role_permissions();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_roles'
      and policyname = 'Project roles visible to project members or admins'
  ) then
    create policy "Project roles visible to project members or admins"
      on public.project_roles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.project_members pm
          where pm.project_id = project_roles.project_id
            and pm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          join public.roles r on p.role_id = r.id
          where p.id = auth.uid()
            and lower(replace(r.name, '_', ' ')) like '%admin%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_roles'
      and policyname = 'Project roles editable by project members or admins'
  ) then
    create policy "Project roles editable by project members or admins"
      on public.project_roles
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.project_members pm
          where pm.project_id = project_roles.project_id
            and pm.user_id = auth.uid()
            and lower(coalesce(pm.role, '')) in ('owner', 'manager')
        )
        or exists (
          select 1
          from public.profiles p
          join public.roles r on p.role_id = r.id
          where p.id = auth.uid()
            and lower(replace(r.name, '_', ' ')) like '%admin%'
        )
      )
      with check (
        exists (
          select 1
          from public.project_members pm
          where pm.project_id = project_roles.project_id
            and pm.user_id = auth.uid()
            and lower(coalesce(pm.role, '')) in ('owner', 'manager')
        )
        or exists (
          select 1
          from public.profiles p
          join public.roles r on p.role_id = r.id
          where p.id = auth.uid()
            and lower(replace(r.name, '_', ' ')) like '%admin%'
        )
      );
  end if;
end $$;

create or replace function public.get_project_roles_secure(p_project_id uuid)
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

create or replace function public.get_project_permissions_secure(p_project_id uuid)
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

create or replace function public.delete_project_role_secure(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_roles where id = p_role_id;
end;
$$;

with default_roles as (
  select * from (values
    ('owner', 'Full control of project settings and members', '["projects.manage","members.manage","tasks.manage"]'::jsonb),
    ('manager', 'Can manage tasks and project members', '["projects.view","members.manage","tasks.manage"]'::jsonb),
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

commit;
