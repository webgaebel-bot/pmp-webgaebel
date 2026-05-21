import { ApiError } from '@/services/api';
import { expandPermissions, isSuperAdminRole, normalizeRoleName } from '@/lib/permissions';

export type AccessScope = 'own' | 'team' | 'project' | 'all';
export type AccessModule = 'projects' | 'tasks' | 'leads' | 'time' | 'notifications' | 'users' | 'finance';

export type AccessContext = {
  profile: {
    id: string;
    role_id?: string | null;
    [key: string]: any;
  };
  role?: { name?: string | null } | null;
  permissions: string[];
};

const hasPermission = (context: AccessContext, permission: string): boolean => {
  const normalized = permission.trim().toLowerCase();
  return expandPermissions(context.permissions).includes(normalized);
};

export const normalizeScope = (scope?: string | null): AccessScope => {
  const normalized = String(scope || 'own').trim().toLowerCase();
  if (['all', 'team', 'project', 'own'].includes(normalized)) {
    return normalized as AccessScope;
  }
  return 'own';
};

export const evaluateRole = (context: AccessContext): { isAdmin: boolean; isSuperAdmin: boolean; roleName: string } => {
  const roleName = normalizeRoleName(context.role as any);
  const isSuperAdmin = isSuperAdminRole(context.role as any);
  const permissions = expandPermissions(context.permissions);
  const isAdmin = isSuperAdmin || permissions.includes('roles.manage') || permissions.includes('permissions.manage');
  return { isAdmin, isSuperAdmin, roleName };
};

export const resolveScope = (context: AccessContext, module: AccessModule): AccessScope => {
  const permissions = expandPermissions(context.permissions);
  const role = evaluateRole(context);

  const allPermissionMap: Record<AccessModule, string> = {
    projects: 'projects.view.all',
    tasks: 'tasks.view.all',
    leads: 'leads.view.all',
    time: 'time.view.all',
    notifications: 'notifications.view.all',
    users: 'users.view.all',
    finance: 'finance.view.all',
  };

  const teamPermissionMap: Record<AccessModule, string> = {
    projects: 'projects.view.team',
    tasks: 'tasks.view.team',
    leads: 'leads.view.team',
    time: 'time.view.team',
    notifications: 'notifications.view.all',
    users: 'users.view.all',
    finance: 'finance.view.team',
  };

  if (role.isAdmin || permissions.includes(allPermissionMap[module])) return 'all';
  if (permissions.includes(teamPermissionMap[module])) return 'team';
  return 'own';
};

export const requirePermission = (context: AccessContext, permission: string, message = 'You do not have permission to perform this action.') => {
  if (!hasPermission(context, permission) && !evaluateRole(context).isAdmin) {
    throw new ApiError(message, 403, 'PERMISSION_DENIED');
  }
};

export const requireOwnership = (ownerId: string | null | undefined, actorId: string, message = 'You do not have access to this resource.') => {
  if (!ownerId || String(ownerId) !== String(actorId)) {
    throw new ApiError(message, 403, 'OWNERSHIP_DENIED');
  }
};

export const requireProjectMembership = (projectId: string | null | undefined, accessibleProjectIds: string[], message = 'You do not have access to this project.') => {
  if (!projectId || !accessibleProjectIds.includes(String(projectId))) {
    throw new ApiError(message, 403, 'PROJECT_ACCESS_DENIED');
  }
};

export const requireScope = (
  actualScope: AccessScope,
  allowedScopes: AccessScope[],
  message = 'You do not have permission to access this scope.'
) => {
  if (!allowedScopes.includes(actualScope)) {
    throw new ApiError(message, 403, 'SCOPE_DENIED');
  }
};

export const isScopeAllowed = (actualScope: AccessScope, targetScope: AccessScope) => {
  const rank: Record<AccessScope, number> = {
    own: 0,
    project: 1,
    team: 2,
    all: 3,
  };

  return rank[actualScope] >= rank[targetScope];
};

export const clampPageSize = (pageSize?: number, fallback = 25, max = 100) => {
  const value = Number(pageSize || fallback);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
};

export const clampPage = (page?: number) => {
  const value = Number(page || 1);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
};

export const paginate = <T>(items: T[], page = 1, pageSize = 25) => {
  const safePage = clampPage(page);
  const safePageSize = clampPageSize(pageSize);
  const start = (safePage - 1) * safePageSize;
  return {
    data: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
  };
};

export const toOffset = (page: number, pageSize: number) => (clampPage(page) - 1) * clampPageSize(pageSize);
