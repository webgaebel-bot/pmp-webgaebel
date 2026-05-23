import type { Permission, Role, User } from '@/types';

export type PermissionDefinition = Omit<Permission, 'id'> & {
  description: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'dashboard.view', name: 'dashboard.view', module: 'dashboard', description: 'Access dashboard shell' },
  { key: 'dashboard.stats.view', name: 'dashboard.stats.view', module: 'dashboard', description: 'View admin dashboard stats' },
  { key: 'dashboard.project_progress', name: 'dashboard.project_progress', module: 'dashboard', description: 'View admin project progress widgets' },
  { key: 'dashboard.team_performance', name: 'dashboard.team_performance', module: 'dashboard', description: 'View admin team performance widgets' },
  { key: 'dashboard.task_charts', name: 'dashboard.task_charts', module: 'dashboard', description: 'View admin task charts' },
  { key: 'dashboard.activity_logs', name: 'dashboard.activity_logs', module: 'dashboard', description: 'View admin dashboard activity widgets' },
  { key: 'dashboard.projects.view', name: 'dashboard.projects.view', module: 'dashboard', description: 'View admin project snapshot widgets' },
  { key: 'dashboard.leads.view', name: 'dashboard.leads.view', module: 'dashboard', description: 'View admin lead snapshot widgets' },
  { key: 'dashboard.finance.view', name: 'dashboard.finance.view', module: 'dashboard', description: 'View admin finance snapshot widgets' },
  { key: 'sales.view', name: 'sales.view', module: 'sales', description: 'View sales workspace' },
  { key: 'sales.view.own', name: 'sales.view.own', module: 'sales', description: 'View own sales records' },
  { key: 'sales.view.team', name: 'sales.view.team', module: 'sales', description: 'View team sales records' },
  { key: 'sales.view.all', name: 'sales.view.all', module: 'sales', description: 'View all sales records' },
  { key: 'sales.dashboard.view', name: 'sales.dashboard.view', module: 'sales', description: 'View sales dashboard' },
  { key: 'dashboard.view.total_projects', name: 'dashboard.view.total_projects', module: 'dashboard', description: 'View total projects stat' },
  { key: 'dashboard.view.tasks', name: 'dashboard.view.tasks', module: 'dashboard', description: 'View total tasks stat' },
  { key: 'dashboard.view.overdue', name: 'dashboard.view.overdue', module: 'dashboard', description: 'View overdue tasks stat' },
  { key: 'dashboard.view.team', name: 'dashboard.view.team', module: 'dashboard', description: 'View team members stat' },
  { key: 'dashboard.view.online_users', name: 'dashboard.view.online_users', module: 'dashboard', description: 'View online users stat' },
  { key: 'projects.view', name: 'projects.view', module: 'projects', description: 'View assigned projects' },
  { key: 'projects.view.own', name: 'projects.view.own', module: 'projects', description: 'View own projects' },
  { key: 'projects.view.team', name: 'projects.view.team', module: 'projects', description: 'View team projects' },
  { key: 'projects.view.all', name: 'projects.view.all', module: 'projects', description: 'View all projects' },
  { key: 'projects.create', name: 'projects.create', module: 'projects', description: 'Create projects' },
  { key: 'projects.update', name: 'projects.update', module: 'projects', description: 'Edit projects' },
  { key: 'projects.delete', name: 'projects.delete', module: 'projects', description: 'Delete projects' },
  { key: 'project.roles.manage', name: 'project.roles.manage', module: 'projects', description: 'Manage project roles and project permissions' },
  { key: 'tasks.view', name: 'tasks.view', module: 'tasks', description: 'View assigned tasks' },
  { key: 'tasks.view.own', name: 'tasks.view.own', module: 'tasks', description: 'View own tasks' },
  { key: 'tasks.view.team', name: 'tasks.view.team', module: 'tasks', description: 'View team tasks' },
  { key: 'tasks.view.all', name: 'tasks.view.all', module: 'tasks', description: 'View all tasks' },
  { key: 'tasks.create', name: 'tasks.create', module: 'tasks', description: 'Create tasks' },
  { key: 'tasks.update', name: 'tasks.update', module: 'tasks', description: 'Edit tasks' },
  { key: 'tasks.delete', name: 'tasks.delete', module: 'tasks', description: 'Delete tasks' },
  { key: 'tasks.assign', name: 'tasks.assign', module: 'tasks', description: 'Assign tasks' },
  { key: 'tasks.update_status', name: 'tasks.update_status', module: 'tasks', description: 'Update task status' },
  { key: 'tasks.update_priority', name: 'tasks.update_priority', module: 'tasks', description: 'Update task priority' },
  { key: 'comments.create', name: 'comments.create', module: 'comments', description: 'Add task comments' },
  { key: 'comments.delete', name: 'comments.delete', module: 'comments', description: 'Delete task comments' },
  { key: 'files.upload', name: 'files.upload', module: 'files', description: 'Upload files' },
  { key: 'files.delete', name: 'files.delete', module: 'files', description: 'Delete files' },
  { key: 'mails.view', name: 'mails.view', module: 'mails', description: 'View own mails' },
  { key: 'mails.view.all', name: 'mails.view.all', module: 'mails', description: 'View all mails' },
  { key: 'mails.send', name: 'mails.send', module: 'mails', description: 'Send mails' },
  { key: 'mails.reply', name: 'mails.reply', module: 'mails', description: 'Reply to mails' },
  { key: 'mails.delete', name: 'mails.delete', module: 'mails', description: 'Delete mails' },
  { key: 'mails.manage', name: 'mails.manage', module: 'mails', description: 'Manage mail settings and records' },
  { key: 'mail_threads.view', name: 'mail_threads.view', module: 'mails', description: 'View mail threads' },
  { key: 'mail_threads.create', name: 'mail_threads.create', module: 'mails', description: 'Create mail threads' },
  { key: 'calendar.view', name: 'calendar.view', module: 'calendar', description: 'View own calendar' },
  { key: 'calendar.view.all', name: 'calendar.view.all', module: 'calendar', description: 'View all calendars' },
  { key: 'calendar.project.view', name: 'calendar.project.view', module: 'calendar', description: 'View project calendar' },
  { key: 'calendar.manage', name: 'calendar.manage', module: 'calendar', description: 'Manage calendar events' },
  { key: 'finance.view', name: 'finance.view', module: 'finance', description: 'View finance module' },
  { key: 'finance.view.own', name: 'finance.view.own', module: 'finance', description: 'View own finance data' },
  { key: 'finance.view.team', name: 'finance.view.team', module: 'finance', description: 'View team finance data' },
  { key: 'finance.view.all', name: 'finance.view.all', module: 'finance', description: 'View all finance data' },
  { key: 'finance.payments.view', name: 'finance.payments.view', module: 'finance', description: 'View payments' },
  { key: 'finance.payments.manage', name: 'finance.payments.manage', module: 'finance', description: 'Manage payments' },
  { key: 'finance.expenses.view', name: 'finance.expenses.view', module: 'finance', description: 'View expenses' },
  { key: 'finance.expenses.manage', name: 'finance.expenses.manage', module: 'finance', description: 'Manage expenses' },
  { key: 'finance.clients.view', name: 'finance.clients.view', module: 'finance', description: 'View finance clients' },
  { key: 'finance.clients.manage', name: 'finance.clients.manage', module: 'finance', description: 'Manage finance clients' },
  { key: 'finance.founders.view', name: 'finance.founders.view', module: 'finance', description: 'View founders finance' },
  { key: 'finance.founders.manage', name: 'finance.founders.manage', module: 'finance', description: 'Manage founders finance' },
  { key: 'finance.salaries.view', name: 'finance.salaries.view', module: 'finance', description: 'View salary records' },
  { key: 'finance.salaries.manage', name: 'finance.salaries.manage', module: 'finance', description: 'Manage salary records' },
  { key: 'finance.taxes.view', name: 'finance.taxes.view', module: 'finance', description: 'View project taxes' },
  { key: 'finance.taxes.manage', name: 'finance.taxes.manage', module: 'finance', description: 'Manage project taxes' },
  { key: 'finance.commissions.view', name: 'finance.commissions.view', module: 'finance', description: 'View commissions' },
  { key: 'finance.commissions.manage', name: 'finance.commissions.manage', module: 'finance', description: 'Manage commissions' },
  { key: 'finance.settings.manage', name: 'finance.settings.manage', module: 'finance', description: 'Manage finance settings' },
  { key: 'time.view', name: 'time.view', module: 'time', description: 'View time tracking' },
  { key: 'time.view.own', name: 'time.view.own', module: 'time', description: 'View own time logs' },
  { key: 'time.view.team', name: 'time.view.team', module: 'time', description: 'View team time logs' },
  { key: 'time.view.all', name: 'time.view.all', module: 'time', description: 'View all time logs' },
  { key: 'time.create', name: 'time.create', module: 'time', description: 'Create time entries' },
  { key: 'time.update', name: 'time.update', module: 'time', description: 'Update time entries' },
  { key: 'time.delete', name: 'time.delete', module: 'time', description: 'Delete time entries' },
  { key: 'time.approve', name: 'time.approve', module: 'time', description: 'Approve or reject time entries' },
  { key: 'time.manage', name: 'time.manage', module: 'time', description: 'Manage all time entries' },
  { key: 'time.sessions.manage', name: 'time.sessions.manage', module: 'time', description: 'Manage time tracking sessions' },
  { key: 'leads.view', name: 'leads.view', module: 'leads', description: 'View leads CRM' },
  { key: 'leads.view.own', name: 'leads.view.own', module: 'leads', description: 'View own leads' },
  { key: 'leads.view.team', name: 'leads.view.team', module: 'leads', description: 'View team leads' },
  { key: 'leads.view.all', name: 'leads.view.all', module: 'leads', description: 'View all users leads' },
  { key: 'leads.detail.view', name: 'leads.detail.view', module: 'leads', description: 'View detailed lead CRM data' },
  { key: 'leads.create', name: 'leads.create', module: 'leads', description: 'Create leads' },
  { key: 'leads.update', name: 'leads.update', module: 'leads', description: 'Update leads' },
  { key: 'leads.delete', name: 'leads.delete', module: 'leads', description: 'Delete leads' },
  { key: 'leads.import', name: 'leads.import', module: 'leads', description: 'Import leads' },
  { key: 'leads.followups.view', name: 'leads.followups.view', module: 'leads', description: 'View flexible follow-up sheet' },
  { key: 'leads.followups.create', name: 'leads.followups.create', module: 'leads', description: 'Create follow-up rows' },
  { key: 'leads.followups.update', name: 'leads.followups.update', module: 'leads', description: 'Edit follow-up rows' },
  { key: 'leads.followups.delete', name: 'leads.followups.delete', module: 'leads', description: 'Delete follow-up rows' },
  { key: 'users.view', name: 'users.view', module: 'users', description: 'View users' },
  { key: 'users.view.own', name: 'users.view.own', module: 'users', description: 'View own profile' },
  { key: 'users.view.all', name: 'users.view.all', module: 'users', description: 'View all users' },
  { key: 'users.create', name: 'users.create', module: 'users', description: 'Create users' },
  { key: 'users.update', name: 'users.update', module: 'users', description: 'Edit users' },
  { key: 'users.delete', name: 'users.delete', module: 'users', description: 'Delete users' },
  { key: 'roles.view', name: 'roles.view', module: 'roles', description: 'View roles' },
  { key: 'roles.manage', name: 'roles.manage', module: 'roles', description: 'Manage roles' },
  { key: 'permissions.manage', name: 'permissions.manage', module: 'permissions', description: 'Manage permissions' },
  { key: 'reports.view', name: 'reports.view', module: 'reports', description: 'View reports' },
  { key: 'members.view', name: 'members.view', module: 'members', description: 'View project members' },
  { key: 'members.create', name: 'members.create', module: 'members', description: 'Add project members' },
  { key: 'members.update', name: 'members.update', module: 'members', description: 'Update project members' },
  { key: 'members.delete', name: 'members.delete', module: 'members', description: 'Remove project members' },
  { key: 'notifications.view', name: 'notifications.view', module: 'notifications', description: 'View notifications' },
  { key: 'notifications.view.own', name: 'notifications.view.own', module: 'notifications', description: 'View own notifications' },
  { key: 'notifications.view.all', name: 'notifications.view.all', module: 'notifications', description: 'View all notifications' },
  { key: 'activity_logs.view', name: 'activity_logs.view', module: 'activity_logs', description: 'View activity logs' },
  { key: 'activity_logs.dashboard', name: 'activity_logs.dashboard', module: 'activity_logs', description: 'View dashboard activity logs' },
  { key: 'time.sessions.manage', name: 'time.sessions.manage', module: 'time', description: 'Manage time tracking sessions' },
  { key: 'leads.taxonomies.manage', name: 'leads.taxonomies.manage', module: 'leads', description: 'Manage lead niches and services' },
];

const PERMISSION_ALIASES: Record<string, string[]> = {
  'users.update': ['users.edit'],
  'activity_logs.view': ['activity.view'],
  'projects.update': ['project.update'],
  'mails.view.all': ['view_all_mails'],
  'projects.view': ['projects.view.own'],
  'tasks.view': ['tasks.view.own'],
  'time.view': ['time.view.own'],
  'leads.view': ['leads.view.own'],
  'users.view': ['users.view.own'],
  'notifications.view': ['notifications.view.own'],
  'finance.view': ['finance.view.own'],
};

const IMPLIED_PERMISSIONS: Record<string, string[]> = {
  'roles.manage': ['roles.view'],
  'permissions.manage': ['roles.view'],
  'mails.manage': ['mails.view', 'mail_threads.view'],
  'calendar.manage': ['calendar.view'],
  'finance.payments.manage': ['finance.view', 'finance.payments.view'],
  'finance.expenses.manage': ['finance.view', 'finance.expenses.view'],
  'finance.clients.manage': ['finance.view', 'finance.clients.view'],
  'finance.founders.manage': ['finance.view', 'finance.founders.view'],
  'finance.salaries.manage': ['finance.view', 'finance.salaries.view'],
  'finance.taxes.manage': ['finance.view', 'finance.taxes.view'],
  'finance.commissions.manage': ['finance.view', 'finance.commissions.view'],
  'finance.settings.manage': ['finance.view'],
  'finance.view.all': ['finance.view.team', 'finance.view.own'],
  'finance.view.team': ['finance.view.own'],
  'time.create': ['time.view'],
  'time.update': ['time.view'],
  'time.delete': ['time.view'],
  'time.approve': ['time.view'],
  'time.sessions.manage': ['time.view'],
  'time.manage': ['time.view', 'time.create', 'time.update', 'time.delete', 'time.approve', 'time.sessions.manage'],
  'time.view.all': ['time.view.team', 'time.view.own'],
  'time.view.team': ['time.view.own'],
  'projects.create': ['projects.view'],
  'projects.update': ['projects.view'],
  'projects.delete': ['projects.view'],
  'project.roles.manage': ['projects.view'],
  'projects.view.all': ['projects.view.team', 'projects.view.own'],
  'projects.view.team': ['projects.view.own'],
  'tasks.create': ['tasks.view'],
  'tasks.update': ['tasks.view'],
  'tasks.delete': ['tasks.view'],
  'tasks.assign': ['tasks.view'],
  'tasks.view.all': ['tasks.view.team', 'tasks.view.own'],
  'tasks.view.team': ['tasks.view.own'],
  'leads.create': ['leads.view'],
  'leads.update': ['leads.view'],
  'leads.delete': ['leads.view'],
  'leads.import': ['leads.view'],
  'leads.taxonomies.manage': ['leads.view'],
  'leads.view.all': ['leads.view.team', 'leads.view.own'],
  'leads.view.team': ['leads.view.own'],
  'sales.view.all': ['sales.view.team', 'sales.view.own'],
  'sales.view.team': ['sales.view.own'],
  'notifications.view.all': ['notifications.view.own'],
};

const normalizeKey = (permission: string) => permission.trim().toLowerCase();

const aliasToCanonical = Object.entries(PERMISSION_ALIASES).reduce<Record<string, string>>(
  (acc, [canonical, aliases]) => {
    acc[normalizeKey(canonical)] = normalizeKey(canonical);
    aliases.forEach((alias) => {
      acc[normalizeKey(alias)] = normalizeKey(canonical);
    });
    return acc;
  },
  {}
);

export const normalizePermissionKey = (permission: string) =>
  aliasToCanonical[normalizeKey(permission)] || normalizeKey(permission);

export const getPermissionAliases = (permission: string): string[] => {
  const canonical = normalizePermissionKey(permission);
  return [canonical, ...(PERMISSION_ALIASES[canonical] || []).map(normalizeKey)];
};

export const expandPermissions = (permissions: string[] = []): string[] => {
  const expanded = new Set<string>();

  permissions.filter(Boolean).forEach((permission) => {
    const canonical = normalizePermissionKey(permission);
    expanded.add(canonical);
    getPermissionAliases(canonical).forEach((alias) => expanded.add(alias));
    (IMPLIED_PERMISSIONS[canonical] || []).forEach((implied) => {
      getPermissionAliases(implied).forEach((key) => expanded.add(key));
    });

    if (canonical.endsWith('.view.all')) {
      expanded.add(canonical.replace(/\.view\.all$/, '.view'));
    }
  });

  return Array.from(expanded);
};

export const normalizeRoleName = (role?: Role | null) =>
  String(role?.name || '').trim().toLowerCase().replace(/_/g, ' ');

export const isSuperAdminRole = (role?: Role | null) => {
  const roleName = normalizeRoleName(role);
  return roleName === 'super admin' || roleName === 'superadmin';
};

export const userHasPermission = (user: Pick<User, 'role' | 'permissions'> | null | undefined, permission: string): boolean => {
  if (!user || !permission) return false;
  if (isSuperAdminRole(user.role)) return true;

  const permissions = new Set(expandPermissions(user.permissions || []));
  return getPermissionAliases(permission).some((key) => permissions.has(key));
};

export const userHasAnyPermission = (user: Pick<User, 'role' | 'permissions'> | null | undefined, permissions: string[]): boolean =>
  permissions.some((permission) => userHasPermission(user, permission));

export const userHasAllPermissions = (user: Pick<User, 'role' | 'permissions'> | null | undefined, permissions: string[]): boolean =>
  permissions.every((permission) => userHasPermission(user, permission));

export const getDefaultLandingPath = (user: Pick<User, 'role' | 'permissions'> | null | undefined): string => {
  if (isSuperAdminRole(user?.role)) return '/dashboard';

  const routes = [
    { path: '/dashboard', permissions: ['dashboard.view', 'sales.dashboard.view'] },
    { path: '/sales-dashboard', permissions: ['sales.dashboard.view', 'sales.view'] },
    { path: '/projects', permissions: ['projects.view'] },
    { path: '/tasks', permissions: ['tasks.view'] },
    { path: '/mails', permissions: ['mails.view', 'mail_threads.view'] },
    { path: '/calendar', permissions: ['calendar.view'] },
    { path: '/finance', permissions: ['finance.view'] },
    { path: '/time-tracking', permissions: ['time.view'] },
    { path: '/leads', permissions: ['leads.view'] },
    { path: '/users', permissions: ['users.view'] },
    { path: '/notifications', permissions: ['notifications.view'] },
  ];

  for (const route of routes) {
    if (userHasAnyPermission(user, route.permissions)) {
      return route.path;
    }
  }

  return '/contact-admin';
};
