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
  X,
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import type { Role, Permission } from '@/types';

// Mock data
const mockRoles: Role[] = [
  { id: '1', name: 'Super Admin', description: 'Full access to all system features', permissions: [] },
  { id: '2', name: 'Admin', description: 'Administrative access with some restrictions', permissions: [] },
  { id: '3', name: 'Project Manager', description: 'Can manage projects and team members', permissions: [] },
  { id: '4', name: 'Team Member', description: 'Standard team member access', permissions: [] },
  { id: '5', name: 'Viewer', description: 'Read-only access to projects', permissions: [] },
];

const mockPermissions: Permission[] = [
  { id: '1', name: 'View Projects', key: 'projects.view', module: 'Projects' },
  { id: '2', name: 'Create Projects', key: 'projects.create', module: 'Projects' },
  { id: '3', name: 'Edit Projects', key: 'projects.edit', module: 'Projects' },
  { id: '4', name: 'Delete Projects', key: 'projects.delete', module: 'Projects' },
  { id: '5', name: 'View Tasks', key: 'tasks.view', module: 'Tasks' },
  { id: '6', name: 'Create Tasks', key: 'tasks.create', module: 'Tasks' },
  { id: '7', name: 'Edit Tasks', key: 'tasks.edit', module: 'Tasks' },
  { id: '8', name: 'Delete Tasks', key: 'tasks.delete', module: 'Tasks' },
  { id: '9', name: 'View Users', key: 'users.view', module: 'Users' },
  { id: '10', name: 'Create Users', key: 'users.create', module: 'Users' },
  { id: '11', name: 'Edit Users', key: 'users.edit', module: 'Users' },
  { id: '12', name: 'Delete Users', key: 'users.delete', module: 'Users' },
  { id: '13', name: 'View Roles', key: 'roles.view', module: 'Roles' },
  { id: '14', name: 'Manage Roles', key: 'roles.manage', module: 'Roles' },
  { id: '15', name: 'View Reports', key: 'reports.view', module: 'Reports' },
  { id: '16', name: 'View Activity', key: 'activity.view', module: 'Activity' },
  { id: '17', name: 'View Dashboard', key: 'dashboard.view', module: 'Dashboard' },
];

const Roles: React.FC = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>(mockPermissions);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
  });

  const canManage = hasPermission('roles.manage');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [rolesRes, permissionsRes] = await Promise.all([
          api.getRoles().catch(() => ({ data: mockRoles })),
          api.getPermissions().catch(() => ({ data: mockPermissions })),
        ]);
        setRoles((rolesRes as any).data || mockRoles);
        setPermissions((permissionsRes as any).data || mockPermissions);
      } catch (error) {
        setRoles(mockRoles);
        setPermissions(mockPermissions);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleCreateRole = async () => {
    try {
      await api.createRole(newRole);
      toast({
        title: 'Success',
        description: 'Role created successfully.',
      });
      setIsCreateDialogOpen(false);
      setNewRole({ name: '', description: '' });
      const response: any = await api.getRoles();
      setRoles(response.data || mockRoles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create role.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      await api.deleteRole(id);
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

  const handleOpenPermissions = (role: Role) => {
    setSelectedRole(role);
    setSelectedPermissions(role.permissions?.map(p => p.id) || []);
    setIsPermissionDialogOpen(true);
  };

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    
    try {
      await api.assignPermissions(selectedRole.id, selectedPermissions);
      toast({
        title: 'Success',
        description: 'Permissions updated successfully.',
      });
      setIsPermissionDialogOpen(false);
      // Refresh roles
      const response: any = await api.getRoles();
      setRoles(response.data || mockRoles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update permissions.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading roles..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage user roles and their permissions"
        breadcrumbs={[{ label: 'Roles' }]}
        actions={
          canManage && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Roles Grid */}
      {filteredRoles.length === 0 ? (
        <EmptyState
          title="No roles found"
          description="Create your first role to get started."
          action={canManage ? { label: 'Create Role', onClick: () => setIsCreateDialogOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="bg-card rounded-lg border border-border p-5 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Shield className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{role.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {role.permissions?.length || 0} permissions
                    </p>
                  </div>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenPermissions(role)}>
                        <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem>
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

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {role.description || 'No description provided'}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>0 users</span>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-accent"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} className="bg-accent hover:bg-accent/90">
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions - {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <div key={module}>
                <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                  {module}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modulePermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleTogglePermission(permission.id)}
                    >
                      <Checkbox
                        checked={selectedPermissions.includes(permission.id)}
                        onCheckedChange={() => handleTogglePermission(permission.id)}
                        className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                      />
                      <div>
                        <p className="font-medium text-sm">{permission.name}</p>
                        <p className="text-xs text-muted-foreground">{permission.key}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} className="bg-accent hover:bg-accent/90">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Roles;
