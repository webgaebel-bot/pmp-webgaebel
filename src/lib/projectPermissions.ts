export type ProjectPermissionKey =
  | 'projects.view'
  | 'projects.manage'
  | 'members.view'
  | 'members.manage'
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.update'
  | 'tasks.delete'
  | 'tasks.manage'
  | 'files.view'
  | 'files.upload'
  | 'files.delete'
  | 'files.manage'
  | 'project.roles.manage';

export interface ProjectPermissionDefinition {
  key: ProjectPermissionKey;
  name: string;
  description: string;
}

export const PROJECT_PERMISSION_DEFINITIONS: ProjectPermissionDefinition[] = [
  { key: 'projects.view', name: 'projects.view', description: 'View the project overview and details' },
  { key: 'projects.manage', name: 'projects.manage', description: 'Manage project settings and lifecycle' },
  { key: 'members.view', name: 'members.view', description: 'View project members' },
  { key: 'members.manage', name: 'members.manage', description: 'Add, update, and remove project members' },
  { key: 'tasks.view', name: 'tasks.view', description: 'View project tasks' },
  { key: 'tasks.create', name: 'tasks.create', description: 'Create project tasks' },
  { key: 'tasks.update', name: 'tasks.update', description: 'Edit project tasks' },
  { key: 'tasks.delete', name: 'tasks.delete', description: 'Delete project tasks' },
  { key: 'tasks.manage', name: 'tasks.manage', description: 'Manage all task actions' },
  { key: 'files.view', name: 'files.view', description: 'View project files' },
  { key: 'files.upload', name: 'files.upload', description: 'Upload project files' },
  { key: 'files.delete', name: 'files.delete', description: 'Delete project files' },
  { key: 'files.manage', name: 'files.manage', description: 'Manage all file actions' },
  { key: 'project.roles.manage', name: 'project.roles.manage', description: 'Create and manage project roles' },
];

export const PROJECT_PERMISSION_KEYS = PROJECT_PERMISSION_DEFINITIONS.map((permission) => permission.key);

export const PROJECT_PERMISSION_IMPLIED: Partial<Record<ProjectPermissionKey, ProjectPermissionKey[]>> = {
  'projects.manage': ['projects.view', 'members.manage', 'tasks.manage', 'files.manage', 'project.roles.manage'],
  'members.manage': ['members.view'],
  'tasks.manage': ['tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete'],
  'files.manage': ['files.view', 'files.upload', 'files.delete'],
  'project.roles.manage': ['projects.view'],
  'tasks.create': ['tasks.view'],
  'tasks.update': ['tasks.view'],
  'tasks.delete': ['tasks.view'],
  'files.upload': ['files.view'],
  'files.delete': ['files.view'],
};

export const sanitizeProjectPermissions = (permissions: unknown): ProjectPermissionKey[] => {
  const allowed = new Set(PROJECT_PERMISSION_KEYS);
  const flattened = Array.isArray(permissions) ? permissions : [];
  const sanitized = new Set<ProjectPermissionKey>();

  flattened.forEach((permission) => {
    const normalized = String(permission || '').trim() as ProjectPermissionKey;
    if (!allowed.has(normalized)) return;
    sanitized.add(normalized);
    (PROJECT_PERMISSION_IMPLIED[normalized] || []).forEach((implied) => sanitized.add(implied));
  });

  return Array.from(sanitized);
};

export const getProjectPermissionDefinition = (key: string) =>
  PROJECT_PERMISSION_DEFINITIONS.find((permission) => permission.key === key);
