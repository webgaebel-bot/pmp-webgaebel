import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  Users,
  FolderKanban,
  FileText,
  Plus,
  Download,
  Upload,
  Loader2,
  UserMinus,
  Mail,
  Eye,
  ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { ImagePreviewModal } from '@/components/common/ImagePreviewModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import PaymentPlanModal from '@/components/finance/PaymentPlanModal';
import InstallmentsList from '@/components/finance/InstallmentsList';
import { initSocket, onProjectAssignment } from '@/services/socket';
import type { Project, ProjectMember, ProjectRole, Task, FileAttachment, User } from '@/types';

const FALLBACK_PROJECT_ROLES = [
  { name: 'owner', description: 'Full control of project settings and members' },
  { name: 'manager', description: 'Can manage tasks and project members' },
  { name: 'lead', description: 'Can oversee a workstream inside the project' },
  { name: 'member', description: 'Can work on tasks and collaborate' },
  { name: 'viewer', description: 'Read-only access to the project' },
];

const ProjectDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const permission = usePermission();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Add member dialog
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSaving, setIsSaving] = useState(false);

  // Create task dialog
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    project_id: '',
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [isPaymentPlanOpen, setIsPaymentPlanOpen] = useState(false);

  const canEdit = permission.canEditProject();
  const canDelete = permission.canDeleteProject();
  const canUploadFiles = permission.canUploadFiles();
  const canCreateMembers = permission.canCreateMembers() || permission.canAddProjectMembers();
  const canUpdateMembers = permission.canUpdateMembers() || permission.canUpdateProjectMembers();
  const canDeleteMembers = permission.canDeleteMembers() || permission.canRemoveProjectMembers();
  const currentMember = useMemo(
    () =>
      members.find(
        (member) =>
          String(member.user_id || member.user?.id || '').toLowerCase() === String(user?.id || '').toLowerCase()
      ),
    [members, user?.id]
  );
  const currentProjectRole = useMemo(
    () =>
      projectRoles.find(
        (role) =>
          String(role.name || '').toLowerCase() ===
          String(currentMember?.project_role || currentMember?.role || '').toLowerCase()
      ),
    [currentMember, projectRoles]
  );
  const canManageProjectRoles =
    permission.isAdmin() ||
    Boolean(currentProjectRole?.permissions?.includes('project.roles.manage')) ||
    Boolean(currentProjectRole?.permissions?.includes('projects.manage'));
  const canCreateTask = permission.canCreateTask();

  const fetchProjectData = useCallback(async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [projectRes, membersRes, rolesRes, tasksRes, filesRes] = await Promise.allSettled([
        api.getProject(id),
        api.getProjectMembers(id),
        api.getProjectRoles(id),
        api.getTasksByProjectId(id),
        api.getFiles(id),
      ]);

      // Handle project response
      if (projectRes.status === 'fulfilled') {
        setProject((projectRes.value as any)?.data);
      } else {
        console.error('Failed to fetch project:', projectRes.reason);
      }
      
      // Handle members response
      if (membersRes.status === 'fulfilled') {
        const membersData = (membersRes.value as any)?.data || [];
        setMembers(Array.isArray(membersData) ? membersData : []);
      } else {
        console.error('Failed to fetch members:', membersRes.reason);
        setMembers([]);
      }

      if (rolesRes.status === 'fulfilled') {
        const rolesData = (rolesRes.value as any)?.data || [];
        setProjectRoles(Array.isArray(rolesData) ? rolesData : []);
      } else {
        console.error('Failed to fetch project roles:', rolesRes.reason);
        setProjectRoles([]);
      }
      
      // Handle tasks response
      if (tasksRes.status === 'fulfilled') {
        const tasksData = (tasksRes.value as any)?.data || [];
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } else {
        console.error('Failed to fetch tasks:', tasksRes.reason);
        setTasks([]);
      }
      
      // Handle files response
      if (filesRes.status === 'fulfilled') {
        const filesData = (filesRes.value as any)?.data || [];
        setFiles(Array.isArray(filesData) ? filesData : []);
      } else {
        console.error('Failed to fetch files:', filesRes.reason);
        setFiles([]);
      }
    } catch (error) {
      console.error('Failed to fetch project data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id, fetchProjectData]);

  useEffect(() => {
    if (!projectRoles.length) return;
    const selectedExists = projectRoles.some(
      (role) => String(role.name || '').toLowerCase() === String(selectedRole || '').toLowerCase()
    );
    if (!selectedExists) {
      setSelectedRole(
        projectRoles.find((role) => String(role.name || '').toLowerCase() === 'member')?.name ||
          projectRoles[0]?.name ||
          'member'
      );
    }
  }, [projectRoles, selectedRole]);

  useEffect(() => {
    if (!id) return;
    initSocket();
    const unsub = onProjectAssignment((payload?: any) => {
      // If event has project_id, only refresh for this project
      const payloadProjectId =
        payload?.project_id ?? payload?.projectId ?? payload?.id;
      if (payloadProjectId && String(payloadProjectId) !== String(id)) return;
      fetchProjectData();
    });
    return () => {
      unsub();
    };
  }, [id, fetchProjectData]);

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      const usersData = (response as any)?.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.getProjects();
      const projectsData = (response as any)?.data || [];
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Task title is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Validation Error',
        description: 'Your session is missing. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!newTask.project_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select a project.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsTaskSaving(true);
    try {
      await api.createTask({
        ...newTask,
        reporter_id: user.id,
      });
      toast({
        title: 'Success',
        description: 'Task created successfully.',
      });
      setIsCreateTaskDialogOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', project_id: '' });
      // Refresh tasks
      if (id) {
        const tasksRes = await api.getTasks({ project_id: id });
        const tasksData = (tasksRes as any)?.data || [];
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task.',
        variant: 'destructive',
      });
    } finally {
      setIsTaskSaving(false);
    }
  };

  const handleOpenCreateTaskDialog = async () => {
    await fetchProjects();
    // Pre-select current project
    if (id) {
      setNewTask(prev => ({ ...prev, project_id: id }));
    }
    setIsCreateTaskDialogOpen(true);
  };

  const handleAddMember = async () => {
    if (!id || !selectedUserId) return;
    
    setIsSaving(true);
    try {
      await api.addProjectMember(id, selectedUserId, selectedRole);
      toast({
        title: 'Success',
        description: 'Member added successfully.',
      });
      setIsAddMemberOpen(false);
      setSelectedUserId('');
      setSelectedRole('member');
      // Refresh members
      const membersRes = await api.getProjectMembers(id);
      const membersData = (membersRes as any)?.data || [];
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to add member.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id || !userId) return;
    
    try {
      await api.removeProjectMember(id, userId);
      setMembers(members.filter(m => m.user?.id !== userId && m.id !== userId));
      toast({
        title: 'Success',
        description: 'Member removed successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to remove member.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    
    try {
      await api.deleteProject(id);
      toast({
        title: 'Success',
        description: 'Project deleted successfully.',
      });
      navigate('/projects');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to delete project.',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('related_id', id);
    formData.append('related_type', 'project');

    try {
      await api.uploadFile(formData);
      toast({
        title: 'Success',
        description: 'File uploaded successfully.',
      });
      // Refresh files
      const filesRes = await api.getFiles(id);
      const filesData = (filesRes as any)?.data || [];
      setFiles(Array.isArray(filesData) ? filesData : []);
      
      // Reset file input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to upload file.',
        variant: 'destructive',
      });
    }
  };

  const openPaymentPlanModal = () => setIsPaymentPlanOpen(true);
  const closePaymentPlanModal = () => setIsPaymentPlanOpen(false);

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      setFiles(files.filter(f => f.id !== fileId));
      toast({
        title: 'Success',
        description: 'File deleted successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to delete file.',
        variant: 'destructive',
      });
    }
  };

  const openAddMemberDialog = async () => {
    await fetchUsers();
    setIsAddMemberOpen(true);
  };

  const downloadDescriptionAsDocx = () => {
    const element = document.createElement('a');
    const projectName = project?.name || 'Project';
    const description = project?.description || 'No description provided';
    
    // Create a simple HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${projectName}</title>
        </head>
        <body>
          <h1>${projectName}</h1>
          <p>${description.replace(/\n/g, '</p><p>')}</p>
        </body>
      </html>
    `;
    
    // Convert HTML to DOCX-like format (using a simple binary approach)
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    element.href = url;
    element.download = `${projectName.replace(/\s+/g, '_')}_description.doc`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <LoadingPage text="Loading project..." />;
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="The project you're looking for doesn't exist or you don't have access to it."
          action={{ label: 'Go to Projects', onClick: () => navigate('/projects') }}
        />
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext ? imageExtensions.includes(ext) : false;
  };

  const handlePreviewImage = (file: FileAttachment) => {
    const imageUrl = `${IMAGE_BASE_URL}${file.url}`;
    setPreviewImage({ url: imageUrl, name: file.name });
  };

  const completedTasks = tasks.filter((task) => ['done', 'completed', 'complete'].includes(String(task.status || '').toLowerCase())).length;
  const liveProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : Number(project.progress || 0);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/projects')}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Header */}
      <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-background via-card to-cyan-50/50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Project detail</p>
            <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{project.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {project.status && <StatusBadge status={project.status} />}
              <PriorityBadge priority={project.priority || 'medium'} />
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                {completedTasks}/{tasks.length} tasks complete
              </span>
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                {project.member_count || members.length || 0} members
              </span>
            </div>
          </div>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full border border-border bg-background/80 hover:bg-background">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => navigate(`/projects/${id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={handleDeleteProject}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress</p>
            <p className="mt-2 text-2xl font-bold">{liveProgress}%</p>
            <p className="mt-1 text-xs text-muted-foreground">From {completedTasks} completed tasks</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasks</p>
            <p className="mt-2 text-2xl font-bold">{tasks.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tracked in this project</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Members</p>
            <p className="mt-2 text-2xl font-bold">{project.member_count || members.length || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Working on the project</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Deadline</p>
            <p className="mt-2 text-2xl font-bold">{project.end_date ? format(new Date(project.end_date), 'MMM dd') : 'Open'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Target delivery</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Finance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadDescriptionAsDocx}
                  className="h-8 rounded-full text-xs"
                >
                  <Download className="mr-2 h-3 w-3" />
                  Download
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {project.description || 'No description provided'}
              </p>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Progress</h3>
                <ProgressBar value={liveProgress} />
                <p className="mt-2 text-xs text-muted-foreground">{liveProgress}% complete from {completedTasks}/{tasks.length} tasks</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Members</p>
                  <p className="mt-2 text-sm font-semibold">{project.member_count || members.length || 0}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
                  <p className="mt-2 text-sm font-semibold capitalize">{project.priority || 'Not set'}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Start Date</p>
                  <p className="mt-2 text-sm font-semibold">
                    {project.start_date ? format(new Date(project.start_date), 'MMM dd, yyyy') : 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">End Date</p>
                  <p className="mt-2 text-sm font-semibold">
                    {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                  <p className="mt-2 text-sm font-semibold">
                    {project.created_at ? format(new Date(project.created_at), 'MMM dd, yyyy') : 'Unknown'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-2 text-sm font-semibold capitalize">{project.status || 'Not set'}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Project Creator
                </h3>
                {project.created_by_name ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                      <span className="text-sm font-semibold">{project.created_by_name?.split(' ').map(n => n[0]).join('').toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium">{project.created_by_name}</p>
                      <p className="text-xs text-muted-foreground">Project creator</p>
                    </div>
                  </div>
                ) : project.owner ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={project.owner?.avatar ? `${IMAGE_BASE_URL}${project.owner.avatar}` : ''} />
                      <AvatarFallback>{project.owner?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{project.owner?.name}</p>
                      <p className="text-xs text-muted-foreground">{project.owner?.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No creator assigned</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 p-4">
              <h3 className="font-semibold">Project Members ({members.length})</h3>
              <div className="flex gap-2">
                {canManageProjectRoles && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/projects/${id}/roles`)}
                  >
                    Manage Roles
                  </Button>
                )}
                {canCreateMembers && (
                  <Button size="sm" className="bg-accent hover:bg-accent/90" onClick={openAddMemberDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                )}
              </div>
            </div>
            
            {members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members yet"
                description="Add team members to collaborate on this project."
                action={canCreateMembers ? { label: 'Add Member', onClick: openAddMemberDialog } : undefined}
              />
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user?.avatar ? `${IMAGE_BASE_URL}${member.user.avatar}` : ''} />
                        <AvatarFallback>{(member.user?.name || member.name || '?')?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user?.name || member.name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {member.user?.email || member.email || 'No email'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="capitalize">{member.project_role || member.role || 'Member'}</Badge>
                      {canDeleteMembers && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(member.user_id || member.user?.id || '')}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 p-4">
              <h3 className="font-semibold">Project Tasks ({tasks.length})</h3>
              {canCreateTask && (
                <Button 
                  onClick={handleOpenCreateTaskDialog}
                  size="sm"
                  className="bg-accent hover:bg-accent/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              )}
            </div>
            
            {tasks.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No tasks yet"
                description="Tasks related to this project will appear here."
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

                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {(task.assigned_user || task.assignee) && (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold">
                            {(task.assigned_user || task.assignee?.name || '?')?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </div>
                          <span className="text-sm text-muted-foreground hidden sm:inline">{task.assigned_user || task.assignee?.name}</span>
                        </div>
                      )}
                      {task.due_date && (
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(task.due_date), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 p-4">
              <h3 className="font-semibold">Project Files ({files.length})</h3>
              {canUploadFiles && (
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    size="sm"
                    className="bg-accent hover:bg-accent/90"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </Button>
                </div>
              )}
            </div>
            
            {files.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No files yet"
                description="Upload files to share with your team."
                action={canUploadFiles ? { label: 'Upload File', onClick: () => document.getElementById('file-upload')?.click() } : undefined}
              />
            ) : (
              <div className="divide-y divide-border">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)} • {format(new Date(file.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={file.url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {permission.canDeleteFiles() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFile(file.id)}
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
        </TabsContent>
        {/* Finance Tab */}
        <TabsContent value="finance" className="mt-6">
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Finance</h3>
              <div className="flex gap-2">
                <Button size="sm" className="bg-accent hover:bg-accent/90" onClick={openPaymentPlanModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Payment Plan
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => navigate(`/finance/expenses?project_id=${id}&project_name=${encodeURIComponent(project?.name || '')}`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Project Expenses
                </Button>
              </div>
            </div>
            {isPaymentPlanOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={closePaymentPlanModal} />
                <div className="relative z-10">
                  <PaymentPlanModal projectId={id || ''} onClose={closePaymentPlanModal} onCreated={fetchProjectData} />
                </div>
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project Member</DialogTitle>
            <DialogDescription>
              Select a user to add to this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projectRoles.length ? projectRoles : FALLBACK_PROJECT_ROLES).map((role: any) => (
                      <SelectItem key={String(role.id || role.name)} value={String(role.name)}>
                        <div className="flex flex-col">
                          <span className="capitalize">{role.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {role.description || 'Project role'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground capitalize">{selectedRole}:</strong>{' '}
                  {(
                    projectRoles.find((role) => String(role.name).toLowerCase() === String(selectedRole).toLowerCase())?.description ||
                    FALLBACK_PROJECT_ROLES.find((role) => String(role.name).toLowerCase() === String(selectedRole).toLowerCase())?.description ||
                    'Project role'
                  )}
                </p>
              </div>
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={handleAddMember}
              disabled={isSaving || !selectedUserId}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-project">Project <span className="text-destructive">*</span></Label>
              <Select value={newTask.project_id} onValueChange={(value) => setNewTask({ ...newTask, project_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={String(proj.id)}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
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
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTaskDialogOpen(false)} disabled={isTaskSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} className="bg-accent hover:bg-accent/90" disabled={isTaskSaving}>
              {isTaskSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
