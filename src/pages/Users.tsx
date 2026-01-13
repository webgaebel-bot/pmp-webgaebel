import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Mail,
  Clock,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { User, Role } from '@/types';

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    role: { id: '1', name: 'Super Admin', permissions: [] },
    status: 'active',
    last_login: '2024-03-15T10:30:00',
    created_at: '2023-06-10',
    permissions: ['projects.view', 'projects.create', 'tasks.view', 'users.view'],
  },
  {
    id: '2',
    name: 'Mike Chen',
    email: 'mike@example.com',
    role: { id: '2', name: 'Project Manager', permissions: [] },
    status: 'active',
    last_login: '2024-03-15T09:15:00',
    created_at: '2023-08-22',
    permissions: ['projects.view', 'projects.create', 'tasks.view'],
  },
  {
    id: '3',
    name: 'Emily Davis',
    email: 'emily@example.com',
    role: { id: '3', name: 'Team Member', permissions: [] },
    status: 'active',
    last_login: '2024-03-14T16:45:00',
    created_at: '2023-10-05',
    permissions: ['projects.view', 'tasks.view'],
  },
  {
    id: '4',
    name: 'James Wilson',
    email: 'james@example.com',
    role: { id: '3', name: 'Team Member', permissions: [] },
    status: 'inactive',
    last_login: '2024-02-28T11:20:00',
    created_at: '2024-01-15',
    permissions: ['projects.view', 'tasks.view'],
  },
];

const mockRoles: Role[] = [
  { id: '1', name: 'Super Admin', permissions: [] },
  { id: '2', name: 'Admin', permissions: [] },
  { id: '3', name: 'Project Manager', permissions: [] },
  { id: '4', name: 'Team Member', permissions: [] },
  { id: '5', name: 'Viewer', permissions: [] },
];

const Users: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const permission = usePermission();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role_id: '',
    status: 'active',
  });

  const canViewUsers = permission.canViewUsers();
  const canCreate = permission.canCreateUser();
  const canEdit = permission.canEditUser();
  const canDelete = permission.canDeleteUser();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [usersRes, rolesRes] = await Promise.all([
          api.getUsers().catch(() => ({ data: mockUsers })),
          api.getRoles().catch(() => ({ data: mockRoles })),
        ]);
        setUsers((usersRes as any).data || mockUsers);
        setRoles((rolesRes as any).data || mockRoles);
      } catch (error) {
        setUsers(mockUsers);
        setRoles(mockRoles);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (id && users.length > 0) {
      const user = users.find(u => u.id === id);
      setSelectedUser(user || null);
    }
  }, [id, users]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || 
      (typeof user.role === 'string' ? user.role === roleFilter : user.role?.id === roleFilter);
    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const getRoleDisplay = (user: User): string => {
    if (typeof user.role === 'string') {
      return user.role.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
    }
    return user.role?.name || 'No Role';
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.updateUser(userId, { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus as 'active' | 'inactive' } : u));
      toast({
        title: 'Status Updated',
        description: `User status changed to ${newStatus}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    try {
      await api.deleteUser(String(userToDelete.id));
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast({
        title: 'Success',
        description: 'User deleted successfully.',
      });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      await api.createUser(newUser);
      toast({
        title: 'Success',
        description: 'User created successfully.',
      });
      setIsCreateDialogOpen(false);
      setNewUser({ name: '', email: '', password: '', role_id: '', status: 'active' });
      // Refresh users
      const response: any = await api.getUsers();
      setUsers(response.data || mockUsers);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading users..." />;
  }

  // Check if user has permission to view users
  if (!canViewUsers) {
    return (
      <EmptyState
        title="Access Denied"
        description="You don't have permission to view users."
        action={{ label: 'Go Back', onClick: () => navigate(-1) }}
      />
    );
  }

  // Show detail view if id parameter exists
  if (id && selectedUser) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </button>

        <div className="bg-card rounded-lg border border-border p-8 shadow-card">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={selectedUser.avatar ? `${IMAGE_BASE_URL}${selectedUser.avatar}` : ''} />
              <AvatarFallback className="text-xl">{selectedUser.name?.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{selectedUser.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <StatusBadge status={selectedUser.status} />
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                {getRoleDisplay(selectedUser)}
                </Badge>
              </div>

              {canEdit && (
                <Button className="bg-accent hover:bg-accent/90">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit User
                </Button>
              )}
            </div>

            {canDelete && (
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 pt-8 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </p>
              <p className="text-sm font-medium">{selectedUser.email}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Last Login
              </p>
              <p className="text-sm font-medium">
                {(selectedUser as any).last_login_at ? format(new Date((selectedUser as any).last_login_at), 'MMM dd, yyyy HH:mm') : 'Never'}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Member Since</p>
              <p className="text-sm font-medium">
                {selectedUser.created_at ? format(new Date(selectedUser.created_at), 'MMM dd, yyyy') : 'Unknown'}
              </p>
            </div>
          </div>

          {selectedUser.permissions && selectedUser.permissions.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">Permissions</h3>
              <div className="flex flex-wrap gap-2">
                {selectedUser.permissions.map((permission, idx) => (
                  <Badge key={idx} variant="outline">{permission}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their roles"
        breadcrumbs={[{ label: 'Users' }]}
        actions={
          canCreate && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={(value) => {
          setRoleFilter(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Add your first team member to get started."
          action={canCreate ? { label: 'Add User', onClick: () => setIsCreateDialogOpen(true) } : undefined}
        />
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar ? `${IMAGE_BASE_URL}${user.avatar}` : undefined} />
                        <AvatarFallback className="bg-accent/20 text-accent">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge variant="secondary" className="font-normal">
                      <Shield className="mr-1 h-3 w-3" />
                      {getRoleDisplay(user)}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={user.status} />
                      {canEdit && (
                        <Switch
                          checked={user.status === 'active'}
                          onCheckedChange={() => handleStatusToggle(user.id, user.status)}
                          className="data-[state=checked]:bg-accent"
                        />
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {(user as any).last_login_at
                        ? format(new Date((user as any).last_login_at), 'MMM dd, yyyy HH:mm')
                        : 'Never'}
                    </div>
                  </td>
                  <td>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </span>
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                          <Eye className="mr-2 h-4 w-4" /> View Profile
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => navigate(`/users/${user.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => openDeleteModal(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredUsers.length > itemsPerPage && (
        <div className="flex items-center justify-between bg-card rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  className={currentPage === page ? "bg-accent hover:bg-accent/90" : ""}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={newUser.role_id}
                onValueChange={(value) => setNewUser({ ...newUser, role_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} className="bg-accent hover:bg-accent/90">
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        isDeleting={isDeleting}
        title="Delete User"
        description="This action cannot be undone. All user data will be permanently removed."
        itemName={userToDelete?.name}
      />
    </div>
  );
};

export default Users;
