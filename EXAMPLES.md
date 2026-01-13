# Common Implementation Examples

## Example 1: Project Card with Actions

```tsx
import { usePermission } from '@/hooks/usePermission';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();
  const permission = usePermission();

  return (
    <div className="border rounded-lg p-4">
      <h3>{project.name}</h3>
      <p className="text-sm text-gray-600">{project.description}</p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Always show view option */}
          <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>

          {/* Show edit only if user has permission */}
          {permission.canEditProject() && (
            <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Project
            </DropdownMenuItem>
          )}

          {/* Show delete only if user has permission */}
          {permission.canDeleteProject() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(project.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

## Example 2: Task Status Change Component

```tsx
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

interface TaskStatusChangeProps {
  taskId: string;
  currentStatus: string;
  onStatusChange: (status: string) => Promise<void>;
}

export function TaskStatusChange({
  taskId,
  currentStatus,
  onStatusChange,
}: TaskStatusChangeProps) {
  const permission = usePermission();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (!permission.canUpdateTaskStatus()) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to change task status.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      toast({
        title: 'Success',
        description: 'Task status updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task status.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Select 
      value={currentStatus} 
      onValueChange={handleStatusChange}
      disabled={!permission.canUpdateTaskStatus() || isUpdating}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">To Do</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="review">Review</SelectItem>
        <SelectItem value="done">Done</SelectItem>
        <SelectItem value="blocked">Blocked</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

## Example 3: User Management Section

```tsx
import { usePermission } from '@/hooks/usePermission';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { EmptyState } from '@/components/common/EmptyState';

interface UserManagementProps {
  users: User[];
  onCreateUser: () => void;
  onEditUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

export function UserManagement({
  users,
  onCreateUser,
  onEditUser,
  onDeleteUser,
}: UserManagementProps) {
  const permission = usePermission();

  // If user can't even view users, show access denied
  if (!permission.canViewUsers()) {
    return (
      <EmptyState
        title="Access Denied"
        description="You do not have permission to view users."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Only show create button if user has permission */}
      {permission.canCreateUser() && (
        <Button onClick={onCreateUser} className="mb-4">
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      )}

      {users.length === 0 ? (
        <EmptyState
          title="No users"
          description="No users have been created yet."
          action={permission.canCreateUser() ? { label: 'Create User', onClick: onCreateUser } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h4 className="font-medium">{user.name}</h4>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>

              <div className="flex gap-2">
                {/* Show edit button */}
                {permission.canEditUser() && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onEditUser(user.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}

                {/* Show delete button */}
                {permission.canDeleteUser() && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Are you sure?')) {
                        onDeleteUser(user.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Example 4: Comment Section with Permissions

```tsx
import { usePermission } from '@/hooks/usePermission';
import { Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface CommentSectionProps {
  comments: TaskComment[];
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
}

export function CommentSection({
  comments,
  onAddComment,
  onDeleteComment,
  onEditComment,
}: CommentSectionProps) {
  const permission = usePermission();
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleAddComment = async () => {
    if (!permission.canCreateComment()) {
      alert('You do not have permission to create comments.');
      return;
    }

    await onAddComment(newComment);
    setNewComment('');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Comments</h3>

      {/* Comment input - only if user can create comments */}
      {permission.canCreateComment() && (
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
          />
          <Button 
            onClick={handleAddComment}
            disabled={!newComment.trim()}
          >
            Add Comment
          </Button>
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="border rounded p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium">{comment.user?.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Action buttons - only show if user has permission */}
              <div className="flex gap-1">
                {permission.canEditComment() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditContent(comment.content);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}

                {permission.canDeleteComment() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteComment(comment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Comment content */}
            {editingId === comment.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onEditComment(comment.id, editContent);
                      setEditingId(null);
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p>{comment.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 5: Dashboard with Multiple Permission Guards

```tsx
import { usePermission } from '@/hooks/usePermission';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { EmptyState } from '@/components/common/EmptyState';

export function Dashboard() {
  const permission = usePermission();

  // Check main dashboard permission
  if (!permission.canViewDashboard()) {
    return (
      <EmptyState
        title="Access Denied"
        description="You do not have access to the dashboard."
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>

      {/* Projects section - only if user can view projects */}
      <PermissionGuard permission="projects.view">
        <section>
          <h2>Projects</h2>
          <ProjectsOverview />
        </section>
      </PermissionGuard>

      {/* Tasks section - only if user can view tasks */}
      <PermissionGuard permission="tasks.view">
        <section>
          <h2>Tasks</h2>
          <TasksOverview />
        </section>
      </PermissionGuard>

      {/* User management - only if user can view AND create users */}
      <PermissionGuard 
        permission={['users.view', 'users.create']}
        requireAll={true}
      >
        <section>
          <h2>User Management</h2>
          <UserManagementOverview />
        </section>
      </PermissionGuard>

      {/* Reports - only if user can generate reports */}
      <PermissionGuard permission="reports.generate">
        <section>
          <h2>Reports</h2>
          <ReportsSection />
        </section>
      </PermissionGuard>

      {/* Admin section - super admin only */}
      {permission.isSuperAdmin() && (
        <section>
          <h2>Admin Controls</h2>
          <AdminSection />
        </section>
      )}
    </div>
  );
}
```

## Example 6: Conditional Navigation

```tsx
import { usePermission } from '@/hooks/usePermission';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ProjectActions({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const permission = usePermission();

  return (
    <div className="flex gap-2">
      {/* Navigate to view - always available */}
      <Button 
        onClick={() => navigate(`/projects/${projectId}`)}
        variant="outline"
      >
        View
      </Button>

      {/* Navigate to edit - only if user has permission */}
      {permission.canEditProject() && (
        <Button 
          onClick={() => navigate(`/projects/${projectId}/edit`)}
          variant="outline"
        >
          Edit
        </Button>
      )}

      {/* Navigate to settings - only if user can manage members */}
      {permission.canManageProjectMembers() && (
        <Button 
          onClick={() => navigate(`/projects/${projectId}/members`)}
          variant="outline"
        >
          Manage Members
        </Button>
      )}

      {/* Delete button - with confirmation */}
      {permission.canDeleteProject() && (
        <Button 
          onClick={() => {
            if (window.confirm('Delete this project?')) {
              // Handle delete
            }
          }}
          variant="destructive"
        >
          Delete
        </Button>
      )}
    </div>
  );
}
```

## Example 7: Form with Conditional Fields

```tsx
import { usePermission } from '@/hooks/usePermission';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: any) => Promise<void>;
}

export function ProjectForm({ project, onSubmit }: ProjectFormProps) {
  const permission = usePermission();
  const [formData, setFormData] = useState(project || {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Always check permission before submitting
    if (project && !permission.canEditProject()) {
      alert('You do not have permission to edit projects.');
      return;
    }
    
    if (!project && !permission.canCreateProject()) {
      alert('You do not have permission to create projects.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      {/* Only show priority field if user can manage advanced settings */}
      {permission.canManageProjectMembers() && (
        <div>
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            value={formData.priority || 'medium'}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      )}

      <Button 
        type="submit" 
        disabled={isSubmitting || (!project && !permission.canCreateProject()) || (project && !permission.canEditProject())}
      >
        {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
      </Button>
    </form>
  );
}
```

## Tips & Best Practices

1. **Always check permission at form start** - Don't let user fill form if they can't submit
2. **Disable buttons** - Use `disabled` attribute instead of removing buttons for better UX
3. **Show error messages** - Use toast notifications to explain permission denials
4. **Check on submit** - Verify permission again before API call
5. **Trust backend** - Backend should also validate permissions
6. **Guard navigation** - Prevent users from navigating to edit pages they can't edit
7. **Group related permissions** - Show/hide entire sections based on permission groups
8. **Provide fallback UI** - Show helpful messages when access is denied
