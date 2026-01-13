import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  Shield,
  Check,
  CheckSquare,
  Square,
  Minus,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import type { Role, Permission } from '@/types';

// Module icons mapping
const moduleIcons: Record<string, React.ElementType> = {
  Dashboard: Shield,
  Projects: Shield,
  Tasks: Shield,
  Users: Users,
  Roles: Shield,
  Reports: Shield,
  Files: Shield,
  Comments: Shield,
  Activity: Shield,
};

const Roles: React.FC = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
  });
  const [editRole, setEditRole] = useState({
    name: '',
    description: '',
  });

  const canManage = hasPermission('roles.manage');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        api.getRoles(),
        api.getPermissions(),
      ]);
      
      const rolesData = (rolesRes as any)?.data || rolesRes || [];
      const permissionsData = (permissionsRes as any)?.data || permissionsRes || [];
      
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setPermissions(Array.isArray(permissionsData) ? permissionsData : []);
    } catch (error) {
      console.error('Failed to fetch roles/permissions:', error);
      setRoles([]);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const module = permission.module || 'Other';
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Role name is required.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      await api.createRole(newRole);
      toast({
        title: 'Success',
        description: 'Role created successfully.',
      });
      setIsCreateDialogOpen(false);
      setNewRole({ name: '', description: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create role.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRole = async () => {
    if (!selectedRole || !editRole.name.trim()) return;
    
    setIsSaving(true);
    try {
      await api.updateRole(String(selectedRole.id), editRole);
      toast({
        title: 'Success',
        description: 'Role updated successfully.',
      });
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (id: string | number) => {
    try {
      await api.deleteRole(String(id));
      setRoles(roles.filter(r => r.id !== id));
      toast({
        title: 'Success',
        description: 'Role deleted successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenPermissions = async (role: Role) => {
    setSelectedRole(role);
    setIsPermissionDialogOpen(true);
    setSelectedPermissions([]);
    
    // Try to fetch role's assigned permissions
    try {
      const response: any = await api.getRolePermissions(String(role.id));
      // Handle the API response format: { success, role_id, permissions: [...] }
      const assignedPermissions = response?.permissions || response?.data || response || [];
      const permissionIds = Array.isArray(assignedPermissions) 
        ? assignedPermissions.map((p: Permission | string | number) => {
            if (typeof p === 'string' || typeof p === 'number') return p;
            return p.id;
          })
        : [];
      setSelectedPermissions(permissionIds);
    } catch {
      // Fallback to role's existing permissions
      setSelectedPermissions(role.permissions?.map(p => p.id) || []);
    }
  };

  const handleOpenEdit = (role: Role) => {
    setSelectedRole(role);
    setEditRole({
      name: role.name,
      description: role.description || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleToggleModule = (modulePermissions: Permission[]) => {
    const modulePermissionIds = modulePermissions.map(p => p.id);
    const allSelected = modulePermissionIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      // Deselect all permissions in this module
      setSelectedPermissions(prev => prev.filter(id => !modulePermissionIds.includes(id)));
    } else {
      // Select all permissions in this module
      setSelectedPermissions(prev => [...new Set([...prev, ...modulePermissionIds])]);
    }
  };

  const getModuleSelectionState = (modulePermissions: Permission[]): 'all' | 'none' | 'partial' => {
    const modulePermissionIds = modulePermissions.map(p => p.id);
    const selectedCount = modulePermissionIds.filter(id => selectedPermissions.includes(id)).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === modulePermissionIds.length) return 'all';
    return 'partial';
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    
    setIsSaving(true);
    try {
      await api.assignPermissions(String(selectedRole.id), selectedPermissions);
      toast({
        title: 'Success',
        description: 'Permissions updated successfully.',
      });
      setIsPermissionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading roles..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage user roles and their permissions"
        breadcrumbs={[{ label: 'Roles' }]}
        actions={
          canManage && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Add Role</span>
              <span className="xs:hidden">Add Role</span>
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      {/* Roles Grid */}
      {filteredRoles.length === 0 ? (
        <EmptyState
          title="No roles found"
          description={roles.length === 0 ? "No roles have been created yet." : "No roles match your search criteria."}
          action={canManage && roles.length === 0 ? { label: 'Create Role', onClick: () => setIsCreateDialogOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="bg-card rounded-lg border border-border p-4 sm:p-5 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-accent/10 flex-shrink-0">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm sm:text-base truncate">{role.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {role.permission_count || role.permissions?.length || 0} permissions
                    </p>
                  </div>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenPermissions(role)}>
                        <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEdit(role)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteRole(role.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
                {role.description || 'No description provided'}
              </p>

              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border">
                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>0 users</span>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-accent h-8 text-xs sm:text-sm"
                    onClick={() => handleOpenPermissions(role)}
                  >
                    Manage
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a new role to assign permissions to users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name <span className="text-destructive">*</span></Label>
              <Input
                id="role-name"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="Enter role name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Enter role description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreateRole} className="bg-accent hover:bg-accent/90 w-full sm:w-auto" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the role name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role-name">Role Name <span className="text-destructive">*</span></Label>
              <Input
                id="edit-role-name"
                value={editRole.name}
                onChange={(e) => setEditRole({ ...editRole, name: e.target.value })}
                placeholder="Enter role name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role-description">Description</Label>
              <Textarea
                id="edit-role-description"
                value={editRole.description}
                onChange={(e) => setEditRole({ ...editRole, description: e.target.value })}
                placeholder="Enter role description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleEditRole} className="bg-accent hover:bg-accent/90 w-full sm:w-auto" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Matrix Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
              <span className="truncate">Manage Permissions - {selectedRole?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Select the permissions for this role. Changes will apply to all users with this role.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 pr-2">
            {Object.keys(groupedPermissions).length === 0 ? (
              <EmptyState
                title="No permissions available"
                description="No permissions have been configured in the system."
              />
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {Object.entries(groupedPermissions).map(([module, modulePermissions]) => {
                  const selectionState = getModuleSelectionState(modulePermissions);
                  const selectedCount = modulePermissions.filter(p => selectedPermissions.includes(p.id)).length;
                  const ModuleIcon = moduleIcons[module] || Shield;
                  
                  return (
                    <div key={module} className="border border-border rounded-lg overflow-hidden">
                      {/* Module Header */}
                      <div
                        className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={() => handleToggleModule(modulePermissions)}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-accent/10 flex-shrink-0">
                            <ModuleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{module}</h4>
                            <p className="text-xs text-muted-foreground">
                              {selectedCount} of {modulePermissions.length} selected
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs hidden xs:inline-flex">
                            {selectedCount} / {modulePermissions.length}
                          </Badge>
                          <div className="w-5 h-5 flex items-center justify-center">
                            {selectionState === 'all' ? (
                              <CheckSquare className="h-5 w-5 text-accent" />
                            ) : selectionState === 'partial' ? (
                              <div className="h-5 w-5 border-2 border-accent rounded flex items-center justify-center">
                                <Minus className="h-3 w-3 text-accent" />
                              </div>
                            ) : (
                              <Square className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Permission Items */}
                      <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
                        {modulePermissions.map((permission) => (
                          <div
                            key={permission.id}
                            className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all cursor-pointer ${
                              selectedPermissions.includes(permission.id)
                                ? 'border-accent bg-accent/5'
                                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                            }`}
                            onClick={() => handleTogglePermission(permission.id)}
                          >
                            <Checkbox
                              checked={selectedPermissions.includes(permission.id)}
                              onCheckedChange={() => handleTogglePermission(permission.id)}
                              className="data-[state=checked]:bg-accent data-[state=checked]:border-accent flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">{permission.name}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {permission.key}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {selectedPermissions.length} of {permissions.length} permissions selected
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)} disabled={isSaving} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button onClick={handleSavePermissions} className="bg-accent hover:bg-accent/90 flex-1 sm:flex-none" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="hidden xs:inline">Saving...</span>
                      <span className="xs:hidden">Save</span>
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      <span className="hidden xs:inline">Save Changes</span>
                      <span className="xs:hidden">Save</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Roles;