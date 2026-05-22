begin;

-- Backfill missing project owners from project members so existing cards do not show "Unassigned".
with inferred_owners as (
  select distinct on (pm.project_id)
    pm.project_id,
    pm.user_id
  from public.project_members pm
  order by
    pm.project_id,
    case lower(coalesce(pm.role, 'member'))
      when 'owner' then 0
      when 'manager' then 1
      when 'lead' then 2
      when 'member' then 3
      else 4
    end,
    pm.joined_at asc nulls last,
    pm.id asc
)
update public.projects p
set created_by = io.user_id
from inferred_owners io
where p.id = io.project_id
  and p.created_by is null;

-- Ensure the creator is present as a project owner member for older projects.
insert into public.project_members (project_id, user_id, role)
select
  p.id,
  p.created_by,
  'owner'
from public.projects p
where p.created_by is not null
  and not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p.id
      and pm.user_id = p.created_by
  );

commit;
