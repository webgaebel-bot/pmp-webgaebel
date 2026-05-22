begin;

create or replace function public.create_project_secure(p_project jsonb)
returns setof projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result projects;
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

  insert into public.project_roles (project_id, name, description, permissions, created_by)
  select
    v_result.id,
    dr.name,
    dr.description,
    dr.permissions,
    v_user_id
  from (
    values
      ('owner', 'Full control of project settings and members', '["projects.manage","members.manage","tasks.manage"]'::jsonb),
      ('manager', 'Can manage tasks and project members', '["projects.view","members.manage","tasks.manage"]'::jsonb),
      ('lead', 'Can oversee a workstream inside the project', '["projects.view","tasks.view","tasks.update"]'::jsonb),
      ('member', 'Can work on tasks and collaborate', '["projects.view","tasks.view"]'::jsonb),
      ('viewer', 'Read-only access to the project', '["projects.view"]'::jsonb)
  ) as dr(name, description, permissions)
  on conflict (project_id, name) do nothing;

  insert into public.project_members (
    project_id,
    user_id,
    role
  )
  select
    v_result.id,
    v_user_id,
    'owner'
  where not exists (
    select 1
    from public.project_members pm
    where pm.project_id = v_result.id
      and pm.user_id = v_user_id
  );

  return next v_result;
end;
$$;

create or replace function public.update_project_secure(p_project_id uuid, p_patch jsonb)
returns setof projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result projects;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

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

create or replace function public.delete_project_secure(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  delete from public.project_members where project_id = p_project_id;
  delete from public.task_comments where task_id in (select id from public.tasks where project_id = p_project_id);
  delete from public.tasks where project_id = p_project_id;
  delete from public.project_taxes where project_id = p_project_id;
  delete from public.project_commissions where project_id = p_project_id;
  delete from public.projects where id = p_project_id;
end;
$$;

commit;
