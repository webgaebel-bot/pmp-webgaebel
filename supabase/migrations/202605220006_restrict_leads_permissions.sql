begin;

-- Remove lead-related access from roles that are not explicitly sales/lead/admin roles.
-- This keeps developer and unrelated system roles from inheriting lead visibility.
with lead_permission_keys as (
  select unnest(array[
    'leads.view',
    'leads.view.own',
    'leads.view.team',
    'leads.view.all',
    'leads.detail.view',
    'leads.create',
    'leads.update',
    'leads.delete',
    'leads.import',
    'leads.followups.view',
    'leads.followups.create',
    'leads.followups.update',
    'leads.followups.delete',
    'leads.taxonomies.manage'
  ]) as key
)
delete from role_permissions rp
using roles r, permissions p, lead_permission_keys lpk
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.key = lpk.key
  and lower(replace(r.name, '_', ' ')) not like '%admin%'
  and lower(replace(r.name, '_', ' ')) not like '%sales%'
  and lower(replace(r.name, '_', ' ')) not like '%lead%';

commit;
