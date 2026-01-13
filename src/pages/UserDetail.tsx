import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Clock,
  Shield,
  Edit,
  Trash2,
  FolderKanban,
  CheckSquare,
  Activity,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { User, Project, Task, ActivityLog } from '@/types';

const UserDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  const canEdit = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  useEffect(() => {
    if (id) {
      fetchUserData();
    }
  }, [id]);

  const fetchUserData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [userRes, projectsRes, tasksRes] = await Promise.all([
        api.getUser(id).catch(() => null),
        api.getUserProjects(id).catch(() => ({ data: [] })),
        api.getUserTasks(id).catch(() => ({ data: [] })),
      ]);

      if (userRes) {
        setUser((userRes as any).data || userRes);
      }
      
      const projectsData = (projectsRes as any)?.data || projectsRes || [];
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      
      const tasksData = (tasksRes as any)?.data || tasksRes || [];
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!id) return;
    
    try {
      await api.deleteUser(id);
      toast({
        title: 'Success',
        description: 'User deleted successfully.',
      });
      navigate('/users');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading user profile..." />;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </button>
        <EmptyState
          icon={UserIcon}
          title="User not found"
          description="The user you're looking for doesn't exist or you don't have access to view them."
          action={{ label: 'Go to Users', onClick: () => navigate('/users') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </button>

      {/* User Header */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-card">
        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.avatar ? `${IMAGE_BASE_URL}${user.avatar}` : ''} />
            <AvatarFallback className="text-xl">{user.name?.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{user.name}</h1>
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status={user.status} />
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {user.role?.name || 'No Role'}
              </Badge>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Last login: {user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy HH:mm') : 'Never'}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => navigate(`/users/${id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Info */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-card">
              <h3 className="font-semibold mb-4">User Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="text-sm font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm font-medium">{user.role?.name || 'No Role'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={user.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">
                    {user.created_at ? format(new Date(user.created_at), 'MMM dd, yyyy') : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-card">
              <h3 className="font-semibold mb-4">Permissions</h3>
              {user.permissions && user.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.permissions.map((permission, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No permissions assigned.</p>
              )}
            </div>

            {/* Stats */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-card">
              <h3 className="font-semibold mb-4">Activity Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-accent">{projects.length}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-accent">{tasks.length}</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-accent">
                    {tasks.filter(t => t.status === 'done').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-accent">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="mt-6">
          <div className="bg-card rounded-lg border border-border shadow-card">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Assigned Projects ({projects.length})</h3>
            </div>
            
            {projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects assigned"
                description="This user is not assigned to any projects yet."
              />
            ) : (
              <div className="divide-y divide-border">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={project.status} />
                        <PriorityBadge priority={project.priority} />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {project.progress || 0}% complete
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-6">
          <div className="bg-card rounded-lg border border-border shadow-card">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Assigned Tasks ({tasks.length})</h3>
            </div>
            
            {tasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="No tasks assigned"
                description="This user doesn't have any tasks assigned yet."
              />
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        {task.project?.name && (
                          <span className="text-xs text-muted-foreground">
                            in {task.project.name}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.due_date && (
                      <span className="text-sm text-muted-foreground">
                        Due {format(new Date(task.due_date), 'MMM dd')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserDetail;
