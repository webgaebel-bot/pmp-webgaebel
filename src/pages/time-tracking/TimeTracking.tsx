import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Square, Search, Download, Trash2, TimerReset, FolderKanban } from 'lucide-react';
import { api } from '@/services/api';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const TimeTracking: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [formData, setFormData] = useState({
    project_id: '',
    task_id: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    manual_hours: '',
    manual_minutes: '0',
  });

  const { data: timeLogsResponse, isLoading } = useQuery({
    queryKey: ['time-logs'],
    queryFn: async () => api.get('/time-logs'),
  });
  const timeLogs = timeLogsResponse?.data || [];

  const { data: projectsResponse } = useQuery({
    queryKey: ['projects-minimal'],
    queryFn: async () => api.getMinimalProjects(),
  });
  const projects = projectsResponse?.data || [];

  const { data: tasksResponse } = useQuery({
    queryKey: ['time-project-tasks', formData.project_id],
    queryFn: async () => (formData.project_id ? api.getTasksByProjectId(formData.project_id) : { data: [] }),
  });
  const tasks = tasksResponse?.data || [];
  const roleName = user?.role?.name?.toLowerCase().replace(/_/g, ' ') || '';
  const isAdminViewerOnly = roleName.includes('admin');

  const { data: timeStatsResponse } = useQuery({
    queryKey: ['time-stats'],
    queryFn: async () => api.get('/time-logs/stats'),
  });
  const timeStats = timeStatsResponse?.data || {};

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isTracking) {
      interval = setInterval(() => setCurrentTime((prev) => prev + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => api.createTimeLog(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      queryClient.invalidateQueries({ queryKey: ['time-stats'] });
      toast.success('Time log saved successfully');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to save time log'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/time-logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      queryClient.invalidateQueries({ queryKey: ['time-stats'] });
      toast.success('Time log deleted successfully');
    },
    onError: () => toast.error('Failed to delete time log'),
  });

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredLogs = useMemo(() => {
    return (timeLogs || []).filter((log: any) =>
      log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.task_title?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [timeLogs, search]);

  const totalHours = filteredLogs.reduce((acc: number, log: any) => acc + Number(log.hours || 0), 0);
  const todaysHours = timeStats?.todays_hours || 0;
  const weeklyHours = timeStats?.weekly_hours || totalHours;
  const productivity = timeStats?.productivity_percentage || 0;
  const weeklyChange = timeStats?.weekly_change_percentage || 0;

  const resetEntryForm = () => {
    setFormData((current) => ({
      ...current,
      task_id: '',
      description: '',
      manual_hours: '',
      manual_minutes: '0',
    }));
    setCurrentTime(0);
    setIsTracking(false);
  };

  const handleStartTracking = () => {
    if (!formData.project_id) {
      toast.error('Please select a project before starting the timer');
      return;
    }
    setCurrentTime(0);
    setIsTracking(true);
  };

  const handleStopTracking = () => {
    if (currentTime <= 0) {
      toast.error('No tracked time to save');
      setIsTracking(false);
      return;
    }

    createMutation.mutate({
      project_id: formData.project_id || null,
      task_id: formData.task_id || null,
      date: formData.date,
      hours: (currentTime / 3600).toFixed(2),
      minutes: Math.floor((currentTime % 3600) / 60),
      description: formData.description,
    });
    resetEntryForm();
  };

  const handleManualSave = () => {
    if (!formData.project_id) {
      toast.error('Please select a project');
      return;
    }
    if (!formData.manual_hours && !formData.manual_minutes) {
      toast.error('Add hours or minutes before saving');
      return;
    }

    createMutation.mutate({
      project_id: formData.project_id || null,
      task_id: formData.task_id || null,
      date: formData.date,
      hours: formData.manual_hours || 0,
      minutes: formData.manual_minutes || 0,
      description: formData.description,
    });
    resetEntryForm();
  };

  const handleDelete = (id: string, projectName: string) => {
    if (confirm(`Delete time log for "${projectName || 'selected entry'}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = () => {
    const header = ['User', 'Project', 'Task', 'Date', 'Hours', 'Status', 'Description'];
    const rows = filteredLogs.map((log: any) => [
      log.user_name || '',
      log.project_name || '',
      log.task_title || '',
      log.date || '',
      log.hours || '',
      log.status || '',
      (log.description || '').replace(/,/g, ' '),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `time-logs-${formData.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Run a live timer, log manual work, and keep project-task time entries in one professional workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={resetEntryForm}>
            <TimerReset className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(todaysHours).toFixed(1)}h</div>
            <p className="mt-1 text-xs text-muted-foreground">Target: 8 focused hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(weeklyHours).toFixed(1)}h</div>
            <p className={`mt-1 text-xs ${weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {weeklyChange >= 0 ? '+' : ''}{Number(weeklyChange).toFixed(1)}% from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productivity</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(productivity).toFixed(1)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Approved time versus total logged effort</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Active Timer & Manual Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border bg-muted/20 p-5 text-center">
              <div className="text-sm text-muted-foreground">Current Session</div>
              <div className="mt-2 text-4xl font-bold tracking-tight">{formatTime(currentTime)}</div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="project_id">Project</Label>
                <select
                  id="project_id"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, task_id: '' })}
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Select project</option>
                  {projects.map((project: any) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="task_id">Task</Label>
                <select
                  id="task_id"
                  value={formData.task_id}
                  onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Select task</option>
                  {tasks.map((task: any) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="log-date">Date</Label>
                <Input id="log-date" type="date" className="mt-2" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="manual-hours">Manual Hours</Label>
                <Input id="manual-hours" type="number" step="0.25" className="mt-2" value={formData.manual_hours} onChange={(e) => setFormData({ ...formData, manual_hours: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="manual-minutes">Manual Minutes</Label>
                <Input id="manual-minutes" type="number" min="0" max="59" className="mt-2" value={formData.manual_minutes} onChange={(e) => setFormData({ ...formData, manual_minutes: e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Work Description</Label>
              <Textarea
                id="description"
                rows={4}
                className="mt-2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What did you work on? Mention deliverables, blockers, or outcome."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {!isAdminViewerOnly && !isTracking ? (
                <Button onClick={handleStartTracking} disabled={createMutation.isPending}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Timer
                </Button>
              ) : !isAdminViewerOnly && isTracking ? (
                <Button className="bg-red-500 hover:bg-red-600" onClick={handleStopTracking} disabled={createMutation.isPending}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop & Save
                </Button>
              ) : null}
              {!isAdminViewerOnly ? (
                <Button variant="outline" onClick={handleManualSave} disabled={createMutation.isPending}>
                  Save Manual Entry
                </Button>
              ) : (
                <Badge variant="outline">Admin view only</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>Logged Time</CardTitle>
              <Badge variant="secondary">{filteredLogs.length} entries</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by user, project, or task" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">Loading time logs...</TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No time logs found.</TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        <TableCell>{log.project_name || '-'}</TableCell>
                        <TableCell>{log.task_title || '-'}</TableCell>
                        <TableCell>{log.date ? format(new Date(log.date), 'PPP') : '-'}</TableCell>
                        <TableCell>{Number(log.hours || 0).toFixed(2)}h</TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'approved' ? 'default' : log.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(log.id, log.project_name || log.user_name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimeTracking;
