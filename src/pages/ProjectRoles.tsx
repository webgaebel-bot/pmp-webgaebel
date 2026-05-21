import React, { useState } from 'react';
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

const ProjectRoles: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSaving, setIsSaving] = useState(false);

  const projectRoles = ['owner', 'manager', 'lead', 'member', 'viewer'];
  const roleDescriptions: Record<string, string> = {
    owner: 'Full control, can manage team and settings',
    manager: 'Can assign tasks and manage team',
    lead: 'Can oversee specific work areas',
    member: 'Can work on tasks and view project',
    viewer: 'Read-only access to project',
  };

  const { data: projectResponse, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const project = projectResponse?.data;
  const members = project?.project_members || [];
  const users = usersResponse?.data || [];

  const availableUsers = users.filter(
    (u: any) => !members.some((m: any) => m.user_id === u.id)
  );

  const handleDialogChange = (open: boolean) => {
    setIsAddMemberOpen(open);
    if (!open) {
      setEditingMemberId(null);
      setSelectedUserId('');
      setSelectedRole('member');
    }
  };

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (editingMemberId) {
        // Update role for existing member
        return api.put(`/projects/${id}/members/${editingMemberId}`, {
          project_role: selectedRole,
        });
      }
      // Add new member
      return api.addProjectMember(id!, selectedUserId, selectedRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      handleDialogChange(false);
      toast.success(editingMemberId ? 'Member role updated' : 'Member added successfully');
    },
    onError: () => {
      toast.error(editingMemberId ? 'Failed to update member role' : 'Failed to add member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return api.delete(`/projects/${id}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Member removed from project');
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
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
    setSelectedRole(member.project_role || 'member');
    setIsAddMemberOpen(true);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Swal.fire({
      title: 'Remove Member?',
      text: `Remove "${memberName}" from this project?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, remove them!'
    }).then((result) => {
      if (result.isConfirmed) {
        removeMemberMutation.mutate(memberId);
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
          <p className="text-sm text-muted-foreground">Manage team member roles and permissions</p>
        </div>
        <Dialog open={isAddMemberOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingMemberId ? 'Update Member Role' : 'Add Team Member'}
              </DialogTitle>
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
                      {availableUsers.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
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
                    {projectRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex flex-col">
                          <span className="capitalize">{role}</span>
                          <span className="text-xs text-muted-foreground">{roleDescriptions[role]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedRole === 'member' ? 'Member:' : `${selectedRole}:`}</strong> {roleDescriptions[selectedRole]}
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
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {projectRoles.map((role) => {
          const count = members.filter((m: any) => (m.project_role || 'member') === role).length;
          return (
            <Card key={role} className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{count}</p>
                  <p className="text-sm capitalize text-muted-foreground">{role}s</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRole(member)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {member.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id, member.user?.name || 'Member')}
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
            {projectRoles.map((role) => (
              <div key={role} className="border-l-4 border-primary pl-4 py-2">
                <h4 className="font-semibold capitalize">{role}</h4>
                <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectRoles;
