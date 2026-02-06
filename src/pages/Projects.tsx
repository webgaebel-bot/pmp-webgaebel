import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Users,
  Edit,
  Trash2,
  Eye,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import { initSocket, onProjectAssignment } from '@/services/socket';
import type { Project } from '@/types';

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const permission = usePermission();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    priority: 'medium',
    start_date: '',
    end_date: '',
  });

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canViewProjects = permission.canViewProjects();
  const canCreate = permission.canCreateProject();
  const canEdit = permission.canEditProject();
  const canDelete = permission.canDeleteProject();

  // Check if user has permission to view projects
  if (!canViewProjects) {
    return (
      <EmptyState
        title="Access Denied"
        description="You don't have permission to view projects."
        action={{ label: 'Go Back', onClick: () => navigate(-1) }}
      />
    );
  }

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const response: any = await api.getProjects();
      const projectsData = response?.data || response || [];
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (id && projects.length > 0) {
      const project = projects.find(p => p.id === id);
      setSelectedProject(project || null);
    }
  }, [id, projects]);

  useEffect(() => {
    initSocket();
    const unsub = onProjectAssignment(() => {
      fetchProjects();
    });
    return () => {
      unsub();
    };
  }, [fetchProjects]);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Project name is required.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      await api.createProject(newProject);
      toast({
        title: 'Success',
        description: 'Project created successfully.',
      });
      setIsCreateDialogOpen(false);
      setNewProject({ name: '', description: '', priority: 'medium', start_date: '', end_date: '' });
      fetchProjects();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
      toast({
        title: 'Success',
        description: 'Project deleted successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete project.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading projects..." />;
  }

  // Show detail view if id parameter exists
  if (id && selectedProject) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="bg-card rounded-lg border border-border p-8 shadow-card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">{selectedProject.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={selectedProject.status} />
                <PriorityBadge priority={selectedProject.priority} />
              </div>
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/projects/${selectedProject.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteProject(selectedProject.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Description</h2>
              <p className="text-foreground whitespace-pre-wrap">
                {selectedProject.description || 'No description provided'}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Progress</h3>
                <ProgressBar value={selectedProject.progress || 0} />
                <p className="text-xs text-muted-foreground mt-1">{selectedProject.progress || 0}% complete</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">
                    {selectedProject.start_date ? format(new Date(selectedProject.start_date), 'MMM dd, yyyy') : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-medium">
                    {selectedProject.end_date ? format(new Date(selectedProject.end_date), 'MMM dd, yyyy') : 'Not set'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Project Owner
                </h3>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedProject.owner?.avatar ? `${IMAGE_BASE_URL}${selectedProject.owner.avatar}` : undefined} />
                    <AvatarFallback className="bg-accent/20 text-accent text-sm">{getInitials(selectedProject.created_by_name || selectedProject.owner?.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedProject.created_by_name || selectedProject.owner?.name || 'Unassigned'}</p>
                    <p className="text-xs text-muted-foreground">{selectedProject.created_by_name ? `Created by ${selectedProject.created_by_name}` : (selectedProject.owner?.email || '')}</p>
                    <p className="text-xs text-muted-foreground">Members: {selectedProject.member_count ?? selectedProject.members?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage and track all your projects"
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          canCreate && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description={
            projects.length === 0 
              ? "No projects have been created yet."
              : "No projects match your search criteria."
          }
          action={canCreate && projects.length === 0 ? { label: 'Create Project', onClick: () => setIsCreateDialogOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-card rounded-lg border border-border p-5 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/edit`); }}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <StatusBadge status={project.status} />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium">{project.progress || 0}%</span>
                </div>
                <ProgressBar value={project.progress || 0} size="sm" />
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {project.end_date ? format(new Date(project.end_date), 'MMM dd') : 'No deadline'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{project.task_count || 0} tasks</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={project.owner?.avatar ? `${IMAGE_BASE_URL}${project.owner.avatar}` : undefined} />
                  <AvatarFallback className="bg-accent/20 text-accent text-xs">{getInitials(project.created_by_name || project.owner?.name)}</AvatarFallback>
                </Avatar>
                <div className="ml-2">
                  <div className="text-sm font-medium">{project.created_by_name || project.owner?.name || 'Unassigned'}</div>
                  <div className="text-xs text-muted-foreground">Members: {project.member_count ?? project.members?.length ?? 0}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to track and manage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={newProject.priority}
                onValueChange={(value) => setNewProject({ ...newProject, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={newProject.start_date}
                  onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={newProject.end_date}
                  onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} className="bg-accent hover:bg-accent/90" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
