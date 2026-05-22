begin;

-- Keep dashboard analytics widgets admin-only.
-- Non-admin users still keep dashboard shell access and their own lead data.
with dashboard_permission_keys as (
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
    'dashboard.view.online_users'
  ]) as key
),
admin_roles as (
  select id
  from roles
  where lower(replace(name, '_', ' ')) like '%admin%'
)
delete from role_permissions rp
using roles r, permissions p, dashboard_permission_keys dpk
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.key = dpk.key
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
  'dashboard.view.online_users'
)
where lower(replace(r.name, '_', ' ')) like '%admin%'
  and not exists (
    select 1
    from role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

commit;
