begin;

-- Keep dashboard analytics and sales dashboard access limited to admin-like roles.
-- This complements the frontend guards so the database role assignments cannot leak the dashboard UI.
with restricted_permission_keys as (
  select unnest(array[
    'dashboard.stats.view',
    'dashboard.project_progress',
    'dashboard.team_performance',
    'dashboard.task_charts',
    'dashboard.activity_logs',
    'dashboard.projects.view',
    'dashboard.leads.view',
    'dashboard.finance.view',
    'dashboard.view.total_projects',
    'dashboard.view.tasks',
    'dashboard.view.overdue',
    'dashboard.view.team',
    'dashboard.view.online_users',
    'sales.dashboard.view'
  ]) as key
),
admin_roles as (
  select id
  from roles
  where lower(replace(name, '_', ' ')) like '%admin%'
)
delete from role_permissions rp
using roles r, permissions p, restricted_permission_keys rpk
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.key = rpk.key
  and lower(replace(r.name, '_', ' ')) not like '%admin%';

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.key in (
  'dashboard.stats.view',
  'dashboard.project_progress',
  'dashboard.team_performance',
  'dashboard.task_charts',
  'dashboard.activity_logs',
  'dashboard.projects.view',
  'dashboard.leads.view',
  'dashboard.finance.view',
  'dashboard.view.total_projects',
  'dashboard.view.tasks',
  'dashboard.view.overdue',
  'dashboard.view.team',
  'dashboard.view.online_users',
  'sales.dashboard.view'
)
where lower(replace(r.name, '_', ' ')) like '%admin%'
  and not exists (
    select 1
    from role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

commit;
