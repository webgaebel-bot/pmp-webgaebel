import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  MessageSquare,
  FileText,
  Upload,
  Download,
  Send,
  Loader2,
  CheckSquare,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { Task, TaskComment, FileAttachment } from '@/types';

const TaskDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const canEdit = hasPermission('tasks.edit');
  const canDelete = hasPermission('tasks.delete');
  const canComment = hasPermission('comments.create');
  const canDeleteComment = hasPermission('comments.delete');
  const canUploadFiles = hasPermission('files.upload');
  const canDeleteFiles = hasPermission('files.delete');

  useEffect(() => {
    if (id) {
      fetchTaskData();
    }
  }, [id]);

  const fetchTaskData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [taskRes, commentsRes, filesRes] = await Promise.all([
        api.getTask(id).catch(() => null),
        api.getTaskComments(id).catch(() => ({ data: [] })),
        api.getFiles(id).catch(() => ({ data: [] })),
      ]);

      if (taskRes) {
        setTask((taskRes as any).data || taskRes);
      }
      
      const commentsData = (commentsRes as any)?.data || commentsRes || [];
      setComments(Array.isArray(commentsData) ? commentsData : []);
      
      const filesData = (filesRes as any)?.data || filesRes || [];
      setFiles(Array.isArray(filesData) ? filesData : []);
    } catch (error) {
      console.error('Failed to fetch task data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load task details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !task) return;
    
    try {
      await api.updateTaskStatus(id, newStatus);
      setTask({ ...task, status: newStatus as Task['status'] });
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

  const handlePriorityChange = async (newPriority: string) => {
    if (!id || !task) return;
    
    try {
      await api.updateTaskPriority(id, newPriority);
      setTask({ ...task, priority: newPriority as Task['priority'] });
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

  const handleDeleteTask = async () => {
    if (!id) return;
    
    try {
      await api.deleteTask(id);
      toast({
        title: 'Success',
        description: 'Task deleted successfully.',
      });
      navigate('/tasks');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete task.',
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim()) return;
    
    setIsSubmittingComment(true);
    try {
      await api.addTaskComment(id, newComment.trim());
      setNewComment('');
      // Refresh comments
      const commentsRes = await api.getTaskComments(id);
      const commentsData = (commentsRes as any)?.data || commentsRes || [];
      setComments(Array.isArray(commentsData) ? commentsData : []);
      toast({
        title: 'Success',
        description: 'Comment added successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add comment.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteTaskComment(commentId);
      setComments(comments.filter(c => c.id !== commentId));
      toast({
        title: 'Success',
        description: 'Comment deleted successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comment.',
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
    formData.append('related_type', 'task');

    try {
      await api.uploadFile(formData);
      toast({
        title: 'Success',
        description: 'File uploaded successfully.',
      });
      // Refresh files
      const filesRes = await api.getFiles(id);
      const filesData = (filesRes as any)?.data || filesRes || [];
      setFiles(Array.isArray(filesData) ? filesData : []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file.',
        variant: 'destructive',
      });
    }
  };

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
        description: error.message || 'Failed to delete file.',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
        onClick={() => navigate('/tasks')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tasks
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Header */}
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-2xl font-bold">{task.title}</h1>
              {(canEdit || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem onClick={() => navigate(`/tasks/${id}/edit`)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={handleDeleteTask}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-3 mb-6">
              {canEdit ? (
                <>
                  <Select value={task.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-auto">
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
                  <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="w-auto">
                      <PriorityBadge priority={task.priority} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">Description</h2>
              <p className="text-foreground whitespace-pre-wrap">
                {task.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Comments ({comments.length})</h3>
            </div>

            <div className="divide-y divide-border">
              {comments.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.user?.avatar ? `${IMAGE_BASE_URL}${comment.user.avatar}` : ''} />
                        <AvatarFallback>{comment.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{comment.user?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </div>
                          {canDeleteComment && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {canComment && (
              <div className="p-4 border-t border-border">
                <div className="flex gap-3">
                  <Textarea
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="min-h-[80px] resize-none"
                  />
                </div>
                <div className="flex justify-end mt-3">
                  <Button
                    className="bg-accent hover:bg-accent/90"
                    onClick={handleAddComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Post Comment
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Files Section */}
          <div className="bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Attachments ({files.length})</h3>
              </div>
              {canUploadFiles && (
                <div>
                  <input
                    type="file"
                    id="task-file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById('task-file-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                </div>
              )}
            </div>

            {files.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No attachments yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
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
                      {canDeleteFiles && (
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Details */}
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="font-semibold mb-4">Details</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Project</p>
                <p className="text-sm font-medium">
                  {task.project?.name || 'No project'}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due Date
                </p>
                <p className="text-sm font-medium">
                  {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'Not set'}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Assigned To
                </p>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={task.assignee.avatar ? `${IMAGE_BASE_URL}${task.assignee.avatar}` : ''} />
                      <AvatarFallback>{task.assignee.name?.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{task.assignee.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-2">Reporter</p>
                {task.reporter ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={task.reporter.avatar ? `${IMAGE_BASE_URL}${task.reporter.avatar}` : ''} />
                      <AvatarFallback>{task.reporter.name?.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{task.reporter.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unknown</p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <p className="text-sm">
                  {task.created_at ? format(new Date(task.created_at), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Updated</p>
                <p className="text-sm">
                  {task.updated_at ? format(new Date(task.updated_at), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Time Tracking */}
          {(task.estimated_hours || task.actual_hours) && (
            <div className="bg-card rounded-lg border border-border p-6 shadow-card">
              <h3 className="font-semibold mb-4">Time Tracking</h3>
              <div className="space-y-3">
                {task.estimated_hours && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Estimated</span>
                    <span className="text-sm font-medium">{task.estimated_hours}h</span>
                  </div>
                )}
                {task.actual_hours && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Actual</span>
                    <span className="text-sm font-medium">{task.actual_hours}h</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
