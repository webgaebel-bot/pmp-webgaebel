import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingPage } from '@/components/common/LoadingSpinner';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import type { Project } from '@/types';

const ProjectEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planning' as const,
    priority: 'medium' as const,
    start_date: '',
    end_date: '',
    progress: 0,
  });

  const canEdit = hasPermission('projects.update');

  useEffect(() => {
    if (!id) {
      navigate('/projects');
      return;
    }

    if (!canEdit) {
      navigate('/unauthorized');
      return;
    }

    fetchProject();
  }, [id, canEdit]);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const response: any = await api.getProject(id!);
      const projectData = response?.data || response;
      setProject(projectData);
      setFormData({
        name: projectData.name || '',
        description: projectData.description || '',
        status: projectData.status || 'planning',
        priority: projectData.priority || 'medium',
        start_date: projectData.start_date ? format(parseISO(projectData.start_date), 'yyyy-MM-dd') : '',
        end_date: projectData.end_date ? format(parseISO(projectData.end_date), 'yyyy-MM-dd') : '',
        progress: projectData.progress || 0,
      });
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project details.',
        variant: 'destructive',
      });
      navigate('/projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'progress' ? Math.min(100, Math.max(0, Number(value))) : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Project name is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.updateProject(id!, {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date,
        end_date: formData.end_date,
        progress: formData.progress,
      });

      toast({
        title: 'Success',
        description: 'Project updated successfully.',
      });

      navigate(`/projects/${id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update project.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading project..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate(`/projects/${id}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </button>
      </div>

      <PageHeader
        title="Edit Project"
        description={`Editing: ${project?.name || 'Project'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Project Details', href: `/projects/${id}` },
          { label: 'Edit' },
        ]}
      />

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Update project details and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Project Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter project name"
              className="text-base"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter project description"
              rows={5}
            />
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
                <SelectTrigger id="priority">
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
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="progress">Progress (%)</Label>
              <span className="text-sm font-medium text-muted-foreground">{formData.progress}%</span>
            </div>
            <Input
              id="progress"
              name="progress"
              type="number"
              min="0"
              max="100"
              value={formData.progress}
              onChange={handleInputChange}
              placeholder="0-100"
            />
            <div className="w-full bg-secondary rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${formData.progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/projects/${id}`)}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-accent hover:bg-accent/90 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ProjectEdit;
