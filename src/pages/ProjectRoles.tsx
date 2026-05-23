import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { ModuleEmptyState, ModuleLoadingState } from '@/components/common/ModuleState';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import type { ProjectRole } from '@/types';
import { PROJECT_PERMISSION_DEFINITIONS } from '@/lib/projectPermissions';

const DEFAULT_ROLES = [
  { name: 'owner', description: 'Full control of project settings and members', permissions: ['projects.manage', 'members.manage', 'tasks.manage'] },
  { name: 'manager', description: 'Can manage tasks and project members', permissions: ['projects.view', 'members.manage', 'tasks.manage'] },
  { name: 'lead', description: 'Can oversee a workstream inside the project', permissions: ['projects.view', 'tasks.view', 'tasks.update'] },
  { name: 'member', description: 'Can work on tasks and collaborate', permissions: ['projects.view', 'tasks.view'] },
  { name: 'viewer', description: 'Read-only access to the project', permissions: ['projects.view'] },
];

const FALLBACK_ROLE_ORDER = DEFAULT_ROLES.map((role) => role.name);

const ProjectRoles: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const permission = usePermission();
  const queryClient = useQueryClient();

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSaving, setIsSaving] = useState(false);

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);

  const canCreateMembers = permission.canCreateMembers() || permission.canAddProjectMembers();
  const canUpdateMembers = permission.canUpdateMembers() || permission.canUpdateProjectMembers();
  const canDeleteMembers = permission.canDeleteMembers() || permission.canRemoveProjectMembers();

  const { data: projectResponse, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: rolesResponse } = useQuery({
    queryKey: ['project-roles', id],
    queryFn: () => api.getProjectRoles(id!),
    enabled: !!id,
  });

  const { data: projectPermissionsResponse } = useQuery({
    queryKey: ['project-permissions', id],
    queryFn: () => api.getProjectPermissions(id!),
    enabled: !!id,
  });

  const project = projectResponse?.data;
  const members = project?.project_members || [];
  const users = usersResponse?.data || [];
  const roles = useMemo<ProjectRole[]>(() => {
    const fetched = rolesResponse?.data || [];
    const normalized = Array.isArray(fetched) && fetched.length
      ? fetched
      : DEFAULT_ROLES.map((role, index) => ({
          id: `default-${index}`,
          project_id: id || '',
          name: role.name,
          description: role.description,
          permissions: role.permissions,
        }));
    return [...normalized].sort((left, right) => {
      const leftIndex = FALLBACK_ROLE_ORDER.indexOf(String(left.name || '').toLowerCase());
      const rightIndex = FALLBACK_ROLE_ORDER.indexOf(String(right.name || '').toLowerCase());
      if (leftIndex === -1 && rightIndex === -1) return String(left.name).localeCompare(String(right.name));
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  }, [rolesResponse?.data, id]);
  const isFallbackRole = (role: ProjectRole) => String(role.id || '').startsWith('default-');
  const isFallbackRoleId = (value?: string | null) => String(value || '').startsWith('default-');
  const projectPermissions = useMemo(() => {
    const fetched = projectPermissionsResponse?.data || [];
    return Array.isArray(fetched) && fetched.length ? fetched : PROJECT_PERMISSION_DEFINITIONS;
  }, [projectPermissionsResponse?.data]);

  const currentMember = useMemo(
    () =>
      members.find(
        (member: any) =>
          String(member.user_id || member.user?.id || '').toLowerCase() === String(user?.id || '').toLowerCase()
      ),
    [members, user?.id]
  );

  const currentProjectRole = useMemo(
    () =>
      roles.find((role) => String(role.name || '').toLowerCase() === String(currentMember?.project_role || currentMember?.role || '').toLowerCase()),
    [currentMember, roles]
  );

  const canManageProjectRoles =
    permission.isAdmin() ||
    Boolean(currentProjectRole?.permissions?.includes('project.roles.manage')) ||
    Boolean(currentProjectRole?.permissions?.includes('projects.manage'));

  const permissionLookup = useMemo(() => {
    const map = new Map<string, string>();
    projectPermissions.forEach((permission: any) => {
      map.set(String(permission.key), String(permission.name || permission.key));
    });
    return map;
  }, [projectPermissions]);

  const roleDescriptions: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    DEFAULT_ROLES.forEach((role) => {
      map[role.name] = role.description;
    });
    roles.forEach((role) => {
      if (role.description) map[role.name] = role.description;
    });
    return map;
  }, [roles]);

  const availableUsers = users.filter(
    (u: any) => !members.some((m: any) => String(m.user_id) === String(u.id))
  );

  const handleDialogChange = (open: boolean) => {
    setIsAddMemberOpen(open);
    if (!open) {
      setEditingMemberId(null);
      setSelectedUserId('');
      const defaultRole = roles.find((role) => String(role.name || '').toLowerCase() === 'member')?.name || roles[0]?.name || 'member';
      setSelectedRole(defaultRole);
    }
  };

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (editingMemberId) {
        return api.put(`/projects/${id}/members/${editingMemberId}`, {
          project_role: selectedRole,
        });
      }
      return api.addProjectMember(id!, selectedUserId, selectedRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      handleDialogChange(false);
      toast.success(editingMemberId ? 'Member role updated' : 'Member added successfully');
    },
    onError: (error: any) => {
      toast.error(error?.message || (editingMemberId ? 'Failed to update member role' : 'Failed to add member'));
    },
  });

  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: newRoleName,
        description: newRoleDescription,
        permissions: newRolePermissions,
      };

      if (editingRoleId) {
        return api.updateProjectRole(editingRoleId, payload);
      }

      return api.createProjectRole(id!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-roles', id] });
      setIsCreateRoleOpen(false);
      setEditingRoleId(null);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePermissions([]);
      toast.success(editingRoleId ? 'Project role updated' : 'Project role created');
    },
    onError: (error: any) => {
      toast.error(error?.message || (editingRoleId ? 'Failed to update project role' : 'Failed to create project role'));
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => api.deleteProjectRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-roles', id] });
      toast.success('Project role deleted');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete project role');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => api.removeProjectMember(id!, memberUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Member removed from project');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to remove member');
    },
  });

  const handleAddMember = async () => {
    if (!selectedUserId && !editingMemberId) {
      toast.error('Please select a user');
      return;
    }
    if (!selectedRole.trim()) {
      toast.error('Please select a role');
      return;
    }
    setIsSaving(true);
    try {
      await addMemberMutation.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRole = (member: any) => {
    setEditingMemberId(member.id);
    setSelectedRole(String(member.project_role || 'member'));
    setIsAddMemberOpen(true);
  };

  const handleRemoveMember = (member: any, memberName: string) => {
    const memberUserId = member?.user_id || member?.user?.id || member?.id;
    if (!memberUserId) {
      toast.error('Unable to identify this member.');
      return;
    }
    Swal.fire({
      title: 'Remove Member?',
      text: `Remove "${memberName}" from this project?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, remove them!',
    }).then((result) => {
      if (result.isConfirmed) {
        removeMemberMutation.mutate(String(memberUserId));
      }
    });
  };

  const handleSaveRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }
    if (!newRolePermissions.length) {
      toast.error('Please select at least one permission');
      return;
    }
    if (editingRoleId && isFallbackRoleId(editingRoleId)) {
      toast.error('Built-in fallback roles cannot be updated.');
      return;
    }
    await saveRoleMutation.mutateAsync();
  };

  const handleCreateRoleDialogChange = (open: boolean) => {
    setIsCreateRoleOpen(open);
    if (!open) {
      setEditingRoleId(null);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePermissions([]);
    }
  };

  const openCreateRoleDialog = () => {
    setEditingRoleId(null);
    setNewRoleName('');
    setNewRoleDescription('');
    setNewRolePermissions([]);
    setIsCreateRoleOpen(true);
  };

  const openEditRoleDialog = (role: ProjectRole) => {
    if (isFallbackRole(role)) {
      toast.error('Built-in fallback roles can only be viewed, not edited.');
      return;
    }
    setEditingRoleId(role.id);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description || '');
    setNewRolePermissions(Array.isArray(role.permissions) ? [...role.permissions] : []);
    setIsCreateRoleOpen(true);
  };

  const handleDeleteRole = (role: ProjectRole) => {
    if (isFallbackRole(role)) {
      toast.error('Built-in fallback roles cannot be deleted.');
      return;
    }
    Swal.fire({
      title: 'Delete role?',
      text: `Delete "${role.name}" from this project?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteRoleMutation.mutate(role.id);
      }
    });
  };

  if (projectLoading) {
    return <ModuleLoadingState title="Loading project" description="Fetching project details..." />;
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <ModuleEmptyState title="Project not found" description="The project you're looking for doesn't exist." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
          <h1 className="text-2xl font-bold">{project.name} - Team Roles</h1>
          <p className="text-sm text-muted-foreground">Manage team member roles and project permissions</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageProjectRoles && (
            <Dialog open={isCreateRoleOpen} onOpenChange={handleCreateRoleDialogChange}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openCreateRoleDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingRoleId ? 'Edit Project Role' : 'Create Project Role'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Role Name</Label>
                    <Input
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g. QA Lead"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={newRoleDescription}
                      onChange={(e) => setNewRoleDescription(e.target.value)}
                      placeholder="What can this role do?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="grid gap-2 rounded-lg border border-border p-3 max-h-72 overflow-auto">
                      {projectPermissions.map((permission: any) => {
                        const checked = newRolePermissions.includes(permission.key);
                        return (
                          <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/60">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-border text-primary"
                              checked={checked}
                              onChange={(event) => {
                                setNewRolePermissions((current) =>
                                  event.target.checked
                                    ? [...current, permission.key]
                                    : current.filter((item) => item !== permission.key)
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{permission.name}</div>
                              <div className="text-xs text-muted-foreground">{permission.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleCreateRoleDialogChange(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-accent hover:bg-accent/90" onClick={handleSaveRole} disabled={saveRoleMutation.isPending}>
                    {saveRoleMutation.isPending ? (editingRoleId ? 'Saving...' : 'Creating...') : (editingRoleId ? 'Update Role' : 'Create Role')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {(canCreateMembers || canUpdateMembers) && (
            <Dialog open={isAddMemberOpen} onOpenChange={handleDialogChange}>
              {canCreateMembers && (
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingMemberId ? 'Update Member Role' : 'Add Team Member'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {!editingMemberId && (
                    <div className="space-y-2">
                      <Label>Select User</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((member: any) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} ({member.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            <div className="flex flex-col">
                              <span className="capitalize">{role.name}</span>
                              <span className="text-xs text-muted-foreground">{role.description || roleDescriptions[role.name] || 'Project role'}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground capitalize">{selectedRole}:</strong> {roleDescriptions[selectedRole] || 'Project role'}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleDialogChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-accent hover:bg-accent/90"
                    onClick={handleAddMember}
                    disabled={isSaving || (!editingMemberId && !selectedUserId)}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingMemberId ? 'Update Role' : 'Add Member'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {roles.map((role) => {
          const count = members.filter((member: any) => String(member.project_role || 'member').toLowerCase() === String(role.name).toLowerCase()).length;
          return (
            <Card key={role.id} className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{count}</p>
                  <p className="text-sm capitalize text-muted-foreground">{role.name}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Roles & Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Members</TableHead>
                  {canManageProjectRoles && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => {
                  const count = members.filter(
                    (member: any) =>
                      String(member.project_role || 'member').toLowerCase() === String(role.name).toLowerCase()
                  ).length;

                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium capitalize">{role.name}</TableCell>
                      <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                        {role.description || roleDescriptions[role.name] || 'Project role'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {(role.permissions || []).length > 0 ? (
                            role.permissions.map((permissionKey) => (
                              <Badge key={permissionKey} variant="secondary" className="whitespace-nowrap">
                                {permissionLookup.get(permissionKey) || permissionKey}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No permissions</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{count} member{count === 1 ? '' : 's'}</Badge>
                      </TableCell>
                      {canManageProjectRoles && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditRoleDialog(role)} disabled={isFallbackRole(role)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteRole(role)} disabled={isFallbackRole(role)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <ModuleEmptyState title="No team members" description="Add members to your project to get started." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.user?.name || 'Unknown'}</TableCell>
                      <TableCell>{member.user?.email || '-'}</TableCell>
                      <TableCell>
                        <Badge className="capitalize">
                          {member.project_role || 'Member'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {member.user?.status || 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canUpdateMembers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(member)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteMembers && member.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member, member.user?.name || 'Member')}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="border-l-4 border-primary pl-4 py-2">
                <h4 className="font-semibold capitalize">{role.name}</h4>
                <p className="text-sm text-muted-foreground">{role.description || roleDescriptions[role.name] || 'Project role'}</p>
                {!!role.permissions?.length && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Permissions: {role.permissions.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectRoles;
