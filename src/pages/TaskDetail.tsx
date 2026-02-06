import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Reply, 
  ArrowLeft, 
  CheckSquare, 
  MoreVertical, 
  Edit, 
  Trash2, 
  MessageSquare, 
  Send, 
  Loader2, 
  FileText, 
  Upload, 
  Eye, 
  Download, 
  ImageIcon,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { ImagePreviewModal } from '@/components/common/ImagePreviewModal';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const canEdit = hasPermission('tasks.update');
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
        // Handle nested response structure
        const taskData = (taskRes as any)?.data?.task || (taskRes as any)?.data || taskRes;
        const projectData = (taskRes as any)?.data?.project;
        
        setTask({
          ...taskData,
          project: projectData,
          // Normalize status and priority to lowercase
          status: (taskData.status || 'todo').toLowerCase() as any,
          priority: (taskData.priority || 'medium').toLowerCase() as any,
        });
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
      await api.updateTaskStatus(id, newStatus.toLowerCase());
      setTask({ ...task, status: newStatus.toLowerCase() as Task['status'] });
      toast({
        title: 'Status Updated',
        description: `Task status changed to ${newStatus.replace(/_/g, ' ')}.`,
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
      await api.updateTaskPriority(id, newPriority.toLowerCase());
      setTask({ ...task, priority: newPriority.toLowerCase() as Task['priority'] });
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
      // Scroll to new comment
      setTimeout(scrollToBottom, 100);
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

  const handleAddReply = async (parentCommentId: string) => {
    if (!id || !replyText.trim()) return;
    
    setIsSubmittingComment(true);
    try {
      await api.addTaskComment(id, replyText.trim(), parentCommentId);
      setReplyText('');
      setReplyingToCommentId(null);
      // Refresh comments
      const commentsRes = await api.getTaskComments(id);
      const commentsData = (commentsRes as any)?.data || commentsRes || [];
      setComments(Array.isArray(commentsData) ? commentsData : []);
      toast({
        title: 'Success',
        description: 'Reply added successfully.',
      });
      // Scroll to new reply
      setTimeout(scrollToBottom, 100);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add reply.',
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

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  const handleDownload = async (file: FileAttachment) => {
    try {
      const fileData = file as any;
      const url = fileData.file_url || fileData.url || '';
      const fileUrl = url.startsWith('http') ? url : `${IMAGE_BASE_URL}${url}`;
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download file.',
        variant: 'destructive',
      });
    }
  };

  const handlePreviewImage = (file: FileAttachment) => {
    const fileUrl = file as any;
    const url = fileUrl.file_url || fileUrl.url || fileUrl.path || '';
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${IMAGE_BASE_URL}${url}`;
    setPreviewImage({ url: fullUrl, name: file.name });
  };

  // Scroll to bottom when new comment is added
  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get replies for a comment
  const getReplies = (parentId: string) => {
    return comments.filter(c => (c as any).parent_id === parentId);
  };

  // Get only top-level comments (no parent_id)
  const getTopLevelComments = () => {
    return comments.filter(c => !(c as any).parent_id);
  };

  if (isLoading) {
    return <LoadingPage text="Loading task..." />;
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6">
      <button
        onClick={() => navigate('/tasks')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tasks
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Task Header */}
          <div className="bg-card rounded-xl border border-border p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-6">
              <h1 className="text-3xl font-bold text-foreground leading-tight">{task.title}</h1>
              {(canEdit || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="hover:bg-muted">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {canEdit && (
                      <DropdownMenuItem onClick={() => navigate(`/tasks/${id}/edit`)} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" /> Edit Task
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={handleDeleteTask}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Task
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-8">
              {canEdit ? (
                <>
                  <Select value={task.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-auto border-0 bg-transparent hover:bg-muted/50">
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
                    <SelectTrigger className="w-auto border-0 bg-transparent hover:bg-muted/50">
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
              <h2 className="text-lg font-semibold text-muted-foreground mb-3">Description</h2>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {task.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-card rounded-xl border border-border shadow-lg">
            <div className="flex items-center gap-3 p-6 border-b border-border bg-muted/30">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h3 className="font-bold text-lg">Comments ({comments.length})</h3>
            </div>

            <ScrollArea className="w-full h-96">
              <div className="divide-y divide-border/50">
                {comments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    No comments yet. Be the first to comment!
                  </div>
                ) : (
                  getTopLevelComments().map((comment) => (
                    <div key={comment.id} className="hover:bg-muted/20 transition-colors">
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10 ring-2 ring-muted">
                            <AvatarImage src={comment.user?.avatar ? `${IMAGE_BASE_URL}${comment.user.avatar}` : ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {(comment.user?.name || comment.user_name || '?')?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                                                <span className="font-medium text-sm">{comment.user?.name || comment.user_name || 'Unknown'}</span>
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
                            <p className="text-sm mt-1 whitespace-pre-wrap">{(comment as any).comment || comment.content || ''}</p>
                            
                            {/* Reply Button */}
                            {canComment && (
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-muted-foreground hover:text-accent"
                                  onClick={() => setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id)}
                                >
                                  <Reply className="h-3 w-3 mr-1" />
                                  Reply
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reply Form */}
                      {replyingToCommentId === comment.id && canComment && (
                        <div className="pl-4 pr-4 pb-4 pt-2 bg-muted/30 border-t border-border">
                          <div className="ml-11 space-y-3">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply..."
                              className="min-h-[60px] resize-none text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReplyingToCommentId(null);
                                  setReplyText('');
                                }}
                                disabled={isSubmittingComment}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="bg-accent hover:bg-accent/90"
                                onClick={() => handleAddReply(comment.id)}
                                disabled={isSubmittingComment || !replyText.trim()}
                              >
                                {isSubmittingComment ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="mr-2 h-3 w-3" />
                                )}
                                Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Replies (nested) */}
                      {getReplies(comment.id).length > 0 && (
                        <div className="bg-muted/20">
                          {getReplies(comment.id).map((reply) => (
                            <div key={reply.id} className="p-4 border-t border-border/50 ml-11">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={reply.user?.avatar ? `${IMAGE_BASE_URL}${reply.user.avatar}` : ''} />
                                  <AvatarFallback>{(reply.user?.name || reply.user_name || '?')?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-xs sm:text-sm">{reply.user?.name || reply.user_name || 'Unknown'}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(reply.created_at), 'MMM dd, yyyy HH:mm')}
                                      </span>
                                    </div>
                                    {canDeleteComment && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteComment(reply.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm mt-1 whitespace-pre-wrap">{(reply as any).comment || reply.content || ''}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>
            </ScrollArea>

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

        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Task Details */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Details
            </h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Project
                </p>
                <p className="text-sm font-medium">
                  {(task as any).project_name || task.project?.name || 'No project'}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </p>
                <p className="text-sm font-medium">
                  {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'Not set'}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assigned To
                </p>
                {(task as any).assigned_user ? (
                  <p className="text-sm font-medium">{(task as any).assigned_user}</p>
                ) : task.assignee ? (
                  <div className="flex items-center gap-3">
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
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Created
                </p>
                <p className="text-sm font-medium">
                  {task.created_at ? format(new Date(task.created_at), 'MMM dd, yyyy') : 'Not specified'}
                </p>
              </div>
            </div>
          </div>

          {/* Time Tracking */}
          {(task.estimated_hours || task.actual_hours) && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Time Tracking
              </h3>
              <div className="space-y-4">
                {task.estimated_hours && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated</span>
                    <span className="text-sm font-medium bg-muted px-2 py-1 rounded">{task.estimated_hours}h</span>
                  </div>
                )}
                {task.actual_hours && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Actual</span>
                    <span className="text-sm font-medium bg-muted px-2 py-1 rounded">{task.actual_hours}h</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Files Section */}
          <div className="bg-card rounded-xl border border-border shadow-lg">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <h3 className="font-bold text-lg">Attachments ({files.length})</h3>
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
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                No attachments yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        {isImageFile(file.name) ? (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • {format(new Date(file.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isImageFile(file.name) && (
                        <Button variant="ghost" size="icon" onClick={() => handlePreviewImage(file)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(file)} title="Download">
                        <Download className="h-4 w-4" />
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
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || ''}
        imageName={previewImage?.name}
        onDownload={() => {
          if (previewImage?.name) {
            // Find the file object and download it
            const file = files.find(f => f.name === previewImage.name);
            if (file) handleDownload(file);
          }
        }}
      />
    </div>
  );
};

export default TaskDetail;