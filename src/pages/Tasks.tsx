import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Edit,
  Trash2,
  Eye,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { Task, User } from '@/types';

const statusIcons = {
  todo: Clock,
  in_progress: AlertCircle,
  review: Eye,
  done: CheckCircle2,
  blocked: XCircle,
};

const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(location.pathname === '/tasks/my' ? 'my' : 'all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    project_id: '',
  });

  const canCreate = hasPermission('tasks.create');
  const canEdit = hasPermission('tasks.edit');
  const canDelete = hasPermission('tasks.delete');
  const canAssign = hasPermission('tasks.assign');

  useEffect(() => {
    // Update active tab based on URL
    setActiveTab(location.pathname === '/tasks/my' ? 'my' : 'all');
  }, [location.pathname]);

  useEffect(() => {
    fetchTasks();
  }, [activeTab]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response: any = activeTab === 'my'
        ? await api.getMyTasks()
        : await api.getTasks();
      
      const tasksData = response?.data || response || [];
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response: any = await api.getUsers();
      const usersData = response?.data || response || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(value === 'my' ? '/tasks/my' : '/tasks');
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t));
      toast({
        title: 'Status Updated',
        description: `Task status changed to ${newStatus.replace('_', ' ')}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    try {
      await api.updateTaskPriority(taskId, newPriority);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, priority: newPriority as Task['priority'] } : t));
      toast({
        title: 'Priority Updated',
        description: `Task priority changed to ${newPriority}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update priority.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks(tasks.filter(t => t.id !== id));
      toast({
        title: 'Success',
        description: 'Task deleted successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete task.',
        variant: 'destructive',
      });
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
    
    setIsSaving(true);
    try {
      await api.createTask(newTask);
      toast({
        title: 'Success',
        description: 'Task created successfully.',
      });
      setIsCreateDialogOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', project_id: '' });
      fetchTasks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAssignDialog = async (task: Task) => {
    setSelectedTask(task);
    setSelectedUserId(task.assignee?.id || '');
    await fetchUsers();
    setIsAssignDialogOpen(true);
  };

  const handleAssignTask = async () => {
    if (!selectedTask || !selectedUserId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a user to assign.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      await api.assignTask(selectedTask.id, selectedUserId);
      const assignedUser = users.find(u => u.id === selectedUserId);
      setTasks(tasks.map(t => 
        t.id === selectedTask.id 
          ? { ...t, assignee: assignedUser } 
          : t
      ));
      toast({
        title: 'Success',
        description: 'Task assigned successfully.',
      });
      setIsAssignDialogOpen(false);
      setSelectedTask(null);
      setSelectedUserId('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign task.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading tasks..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeTab === 'my' ? 'My Tasks' : 'All Tasks'}
        description="View and manage project tasks"
        breadcrumbs={[{ label: 'Tasks' }]}
        actions={
          canCreate && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          )
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="my">My Tasks</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
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
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
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

      {/* Tasks Table */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description={
            tasks.length === 0 
              ? activeTab === 'my' 
                ? "You don't have any tasks assigned yet."
                : "No tasks have been created yet."
              : "No tasks match your search criteria."
          }
          action={canCreate && tasks.length === 0 ? { label: 'Create Task', onClick: () => setIsCreateDialogOpen(true) } : undefined}
        />
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due Date</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const StatusIcon = statusIcons[task.status] || Clock;
                return (
                  <tr key={task.id} className="group">
                    <td>
                      <Checkbox
                        checked={task.status === 'done'}
                        onCheckedChange={() => handleStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
                        className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                        disabled={!canEdit}
                      />
                    </td>
                    <td>
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${
                          task.status === 'done' ? 'text-success' :
                          task.status === 'blocked' ? 'text-destructive' :
                          task.status === 'in_progress' ? 'text-info' :
                          task.status === 'review' ? 'text-warning' :
                          'text-muted-foreground'
                        }`} />
                        <div>
                          <p className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {(task.comments_count || 0) > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageSquare className="h-3 w-3" />
                                {task.comments_count}
                              </span>
                            )}
                            {(task.attachments_count || 0) > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Paperclip className="h-3 w-3" />
                                {task.attachments_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-muted-foreground">
                        {task.project?.name || '-'}
                      </span>
                    </td>
                    <td>
                      <Select
                        value={task.status}
                        onValueChange={(value) => handleStatusChange(task.id, value)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <StatusBadge status={task.status} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <Select
                        value={task.priority}
                        onValueChange={(value) => handlePriorityChange(task.id, value)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <PriorityBadge priority={task.priority} showIcon={false} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={task.assignee?.avatar ? `${IMAGE_BASE_URL}${task.assignee.avatar}` : undefined} />
                          <AvatarFallback className="bg-accent/20 text-accent text-xs">
                            {task.assignee?.name?.split(' ').map(n => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{task.assignee?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-muted-foreground">
                        {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : '-'}
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
                          <DropdownMenuItem onClick={() => navigate(`/tasks/${task.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          {canAssign && (
                            <DropdownMenuItem onClick={() => handleOpenAssignDialog(task)}>
                              <UserPlus className="mr-2 h-4 w-4" /> Assign
                            </DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => navigate(`/tasks/${task.id}/edit`)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} className="bg-accent hover:bg-accent/90" disabled={isSaving}>
              {isSaving ? (
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

      {/* Assign Task Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Select a team member to assign this task to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>Task</Label>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTask?.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask?.project?.name || 'No project'}
                </p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label htmlFor="assign-user">Assign to <span className="text-destructive">*</span></Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar ? `${IMAGE_BASE_URL}${user.avatar}` : undefined} />
                          <AvatarFallback className="text-xs">
                            {user.name?.split(' ').map(n => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span>{user.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleAssignTask} className="bg-accent hover:bg-accent/90" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
