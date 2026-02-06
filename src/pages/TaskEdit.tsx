import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import type { Task, User } from '@/types';
import { cn } from '@/lib/utils';
import { CalendarIcon, CheckSquare } from 'lucide-react';

const TaskEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState('');

  const canEdit = hasPermission('tasks.update');

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const [taskRes, usersRes] = await Promise.all([
        api.getTask(id).catch(() => null),
        api.getUsers().catch(() => ({ data: [] })),
      ]);

      const taskData = (taskRes as any)?.data?.task || (taskRes as any)?.data || taskRes;
      const projectData = (taskRes as any)?.data?.project;
      
      if (taskData) {
        setTask({
          ...taskData,
          project: projectData,
        });
        setTitle(taskData.title || '');
        setDescription(taskData.description || '');
        setStatus((taskData.status || 'todo').toLowerCase());
        setPriority((taskData.priority || 'medium').toLowerCase());
        setDueDate(taskData.due_date ? new Date(taskData.due_date) : undefined);
        setAssigneeId(taskData.assigned_to?.toString() || '');
      }

      const usersData = (usersRes as any)?.data || usersRes || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error('Failed to fetch task:', error);
      toast({
        title: 'Error',
        description: 'Failed to load task details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        status: status.toLowerCase(),
        priority: priority.toLowerCase(),
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      };

      // Only include assigned_to if it's set
      if (assigneeId) {
        payload.assigned_to = assigneeId;
      }

      await api.updateTask(id, payload);

      toast({
        title: 'Success',
        description: 'Task updated successfully.',
      });

      navigate(`/tasks/${id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={CheckSquare}
          title="Access Denied"
          description="You don't have permission to edit tasks."
          action={{ label: 'Go to Tasks', onClick: () => navigate('/tasks') }}
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingPage text="Loading task..." />;
  }

  if (!task) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tasks
        </button>
        <EmptyState
          icon={CheckSquare}
          title="Task not found"
          description="The task you're looking for doesn't exist or you don't have access to it."
          action={{ label: 'Go to Tasks', onClick: () => navigate('/tasks') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/tasks/${id}`)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Task
      </button>

      <PageHeader
        title="Edit Task"
        description={`Editing: ${task.title}`}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-lg border border-border p-6 shadow-card space-y-6">
          {/* Project (Read-only) */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Project</Label>
            <Input
              value={task.project?.name || 'No project'}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={4}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Assignee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignee">Assigned To</Label>
              <Select value={assigneeId || "unassigned"} onValueChange={(val) => setAssigneeId(val === "unassigned" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter(user => user.id).map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/tasks/${id}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-accent hover:bg-accent/90"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TaskEdit;
