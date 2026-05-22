import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, BriefcaseBusiness, Clock, Download, Eye, FolderKanban, Pause, Play, Search, Square, Target, TimerReset, Trash2, Users } from 'lucide-react';
import { api } from '@/services/api';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/contexts/AuthContext';
import { DynamicSelect, type DynamicOption } from '@/components/common/DynamicSelect';
import { ModuleEmptyState, ModuleLoadingState } from '@/components/common/ModuleState';
import Swal from 'sweetalert2';
import {
  clearTimerSnapshot,
  formatDurationHms,
  formatHoursAsHms,
  getRunningElapsed,
  readTimerSnapshot,
  type TimerSnapshot,
  type TrackingMode,
  writeTimerSnapshot,
} from '@/lib/timeTrackingTimer';

const SALES_SESSION_PREFIX = '[Sales Session]';
const SALES_WORK_TYPES = ['Lead Extraction', 'Follow-up', 'Calling', 'Qualification', 'Research'];
const DEFAULT_SOURCES: DynamicOption[] = [
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Google', label: 'Google' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Other', label: 'Other' },
];
const selectClassName = 'mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20';

const TimeTracking: React.FC = () => {
  const permission = usePermission();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [timerStartedAtMs, setTimerStartedAtMs] = useState<number | null>(null);
  const [elapsedBeforePause, setElapsedBeforePause] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedTimeLog, setSelectedTimeLog] = useState<any | null>(null);
  const roleName = String(user?.role?.name || '').toLowerCase();
  const isSalesUser =
    permission.canAny(['sales.view', 'sales.dashboard.view']) ||
    roleName.includes('sales') ||
    roleName.includes('selles') ||
    permission.can('leads.view');
  const canViewTeamTime =
    permission.isAdmin() ||
    permission.canAny(['time.manage', 'time.approve']) ||
    roleName.includes('team lead') ||
    roleName.includes('lead') ||
    roleName.includes('manager');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(isSalesUser ? 'sales' : 'project');
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [formData, setFormData] = useState({
    project_id: '',
    task_id: '',
    lead_id: '',
    work_type: 'Lead Extraction',
    source: 'LinkedIn',
    source_other: '',
    manual_leads_count: '',
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
  const visibleTimeLogs = useMemo(() => {
    if (permission.isAdmin() || canViewTeamTime) {
      return timeLogs;
    }
    return timeLogs.filter((log: any) => String(log.user_id || '') === String(user?.id || ''));
  }, [canViewTeamTime, permission, timeLogs, user?.id]);

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

  const { data: leadsResponse } = useQuery({
    queryKey: ['time-leads-minimal'],
    queryFn: async () => api.getLeads({ page: 1, pageSize: 1000 }),
  });
  const leads = leadsResponse?.data || [];

  const canCreateTime = permission.can('time.create');
  const canDeleteTime = permission.can('time.delete');
  const canManageTime = permission.canAny(['time.manage', 'time.approve']);

  const { data: timeStatsResponse } = useQuery({
    queryKey: ['time-stats'],
    queryFn: async () => api.get('/time-logs/stats'),
  });
  const timeStats = timeStatsResponse?.data || {};

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isTracking && !isPaused) {
      setCurrentTime(getRunningElapsed(timerStartedAtMs, elapsedBeforePause));
      interval = setInterval(() => {
        setCurrentTime(getRunningElapsed(timerStartedAtMs, elapsedBeforePause));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [elapsedBeforePause, isPaused, isTracking, timerStartedAtMs]);

  useEffect(() => {
    try {
      const snapshot = readTimerSnapshot();
      if (!snapshot?.isTracking) return;

      const restoredTime = snapshot.isPaused
        ? Number(snapshot.currentTime || snapshot.elapsedBeforePause || 0)
        : getRunningElapsed(snapshot.timerStartedAtMs || null, Number(snapshot.elapsedBeforePause || 0));

      setTrackingMode(snapshot.trackingMode || (isSalesUser ? 'sales' : 'project'));
      if (snapshot.formData) {
        setFormData((current) => ({ ...current, ...snapshot.formData }));
      }
      setIsTracking(true);
      setIsPaused(Boolean(snapshot.isPaused));
      setCurrentTime(restoredTime);
      setSessionStartedAt(snapshot.sessionStartedAt || null);
      setTimerStartedAtMs(snapshot.timerStartedAtMs || null);
      setElapsedBeforePause(Number(snapshot.elapsedBeforePause || 0));
      setActiveSessionId(snapshot.activeSessionId || null);
    } catch {
      clearTimerSnapshot();
    }
  }, [isSalesUser]);

  useEffect(() => {
    if (!isTracking) {
      clearTimerSnapshot();
      return;
    }

    const snapshot: TimerSnapshot = {
      isTracking,
      isPaused,
      currentTime,
      sessionStartedAt,
      timerStartedAtMs,
      elapsedBeforePause,
      activeSessionId,
      trackingMode,
      formData,
    };
    writeTimerSnapshot(snapshot);
  }, [currentTime, elapsedBeforePause, formData, isPaused, isTracking, sessionStartedAt, timerStartedAtMs, trackingMode, activeSessionId]);

  useEffect(() => {
    if (isSalesUser && trackingMode === 'project' && !isTracking) {
      setTrackingMode('sales');
    }
  }, [isSalesUser, isTracking, trackingMode]);

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

  const formatTime = formatDurationHms;

  const parseSalesDescription = (description?: string | null) => {
    const text = String(description || '');
    if (!text.includes(SALES_SESSION_PREFIX)) {
      return {
        isSalesSession: false,
        workType: '',
        source: '',
        leadsCount: 0,
        note: text,
      };
    }

    const getValue = (label: string) => {
      const match = text.match(new RegExp(`${label}:\\s*([^|\\n]+)`, 'i'));
      return match?.[1]?.trim() || '';
    };

    return {
      isSalesSession: true,
      workType: getValue('Work Type'),
      source: getValue('Source'),
      leadsCount: Number(getValue('Leads Created') || 0),
      note: text.split('Note:')[1]?.trim() || '',
    };
  };

  const buildSalesDescription = (leadsCount: number, startedAt?: string | null, endedAt?: string | null) => {
    const parts = [
      SALES_SESSION_PREFIX,
      `Work Type: ${formData.work_type}`,
      `Source: ${formData.source === 'Other' ? formData.source_other || formData.source : formData.source}`,
      `Leads Created: ${leadsCount}`,
    ];

    if (startedAt) parts.push(`Started: ${startedAt}`);
    if (endedAt) parts.push(`Ended: ${endedAt}`);
    if (formData.description.trim()) parts.push(`Note: ${formData.description.trim()}`);

    return parts.join(' | ');
  };

  const getSalesDetail = (description?: string | null) => {
    const text = String(description || '');
    const getValue = (label: string) => {
      const match = text.match(new RegExp(`${label}:\\s*([^|\\n]+)`, 'i'));
      return match?.[1]?.trim() || '';
    };
    const formatDateTime = (value: string) => {
      if (!value) return '-';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : format(date, 'PP p');
    };

    return {
      isSalesSession: text.includes(SALES_SESSION_PREFIX),
      workType: getValue('Work Type') || '-',
      source: getValue('Source') || '-',
      leadsCreated: getValue('Leads Created') || '0',
      started: formatDateTime(getValue('Started')),
      ended: formatDateTime(getValue('Ended')),
      note: text.split('Note:')[1]?.trim() || '',
    };
  };

  const countLeadsCreatedInSession = (startedAt: string, endedAt: string) => {
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(endedAt).getTime();
    return leads.filter((lead: any) => {
      const createdMs = lead.created_at ? new Date(lead.created_at).getTime() : 0;
      const createdBy = String(lead.created_by || '');
      const belongsToUser = !lead.created_by || createdBy === String(user?.id || '');
      return belongsToUser && createdMs >= startMs && createdMs <= endMs;
    }).length;
  };

  const countLeadsCreatedFresh = async (startedAt: string, endedAt: string) => {
    const response = await api.getLeads({
      page: 1,
      pageSize: 1000,
      date_from: startedAt,
      date_to: endedAt,
    });
    const freshLeads = response?.data || [];
    return freshLeads.filter((lead: any) => String(lead.created_by || '') === String(user?.id || '')).length;
  };

  const modeLogs = useMemo(() => {
    return (visibleTimeLogs || []).filter((log: any) => {
      const salesMeta = parseSalesDescription(log.description);
      const isSalesLog = salesMeta.isSalesSession || Boolean(log.lead_id || log.lead_name || log.lead_company);
      const matchesMode = trackingMode === 'sales' ? isSalesLog : !isSalesLog;
      const matchesUser = selectedUserId === 'all' || String(log.user_id || '') === selectedUserId;
      return matchesMode && matchesUser;
    });
  }, [selectedUserId, trackingMode, visibleTimeLogs]);

  const filteredLogs = useMemo(() => {
    const term = search.toLowerCase();
    return modeLogs.filter((log: any) =>
      parseSalesDescription(log.description).workType.toLowerCase().includes(term) ||
      parseSalesDescription(log.description).source.toLowerCase().includes(term) ||
      log.user_name?.toLowerCase().includes(term) ||
      log.project_name?.toLowerCase().includes(term) ||
      log.task_title?.toLowerCase().includes(term) ||
      log.lead_name?.toLowerCase().includes(term) ||
      log.lead_company?.toLowerCase().includes(term)
    );
  }, [modeLogs, search]);

  const visibleUsers = useMemo(() => {
    const usersById = new Map<string, string>();
    (visibleTimeLogs || []).forEach((log: any) => {
      if (log.user_id && log.user_name) usersById.set(String(log.user_id), log.user_name);
    });
    return Array.from(usersById.entries()).map(([id, name]) => ({ id, name }));
  }, [visibleTimeLogs]);

  const totalHours = filteredLogs.reduce((acc: number, log: any) => acc + Number(log.hours || 0), 0);
  const todaysHours = timeStats?.todays_hours || 0;
  const weeklyHours = timeStats?.weekly_hours || totalHours;
  const productivity = timeStats?.productivity_percentage || 0;
  const weeklyChange = timeStats?.weekly_change_percentage || 0;
  const selectedDateLogs = modeLogs.filter((log: any) => log.date === formData.date);
  const selectedDateHours = selectedDateLogs.reduce((acc: number, log: any) => acc + Number(log.hours || 0), 0);
  const salesLeadsWorked = selectedDateLogs.reduce((sum: number, log: any) => {
    const salesMeta = parseSalesDescription(log.description);
    if (salesMeta.isSalesSession) return sum + salesMeta.leadsCount;
    return sum + (log.lead_id || log.lead_name || log.lead_company ? 1 : 0);
  }, 0);
  const averageTimePerLead = salesLeadsWorked > 0 ? selectedDateHours / salesLeadsWorked : 0;
  const leadsPerHour = selectedDateHours > 0 ? salesLeadsWorked / selectedDateHours : 0;
  const tableColumnCount = trackingMode === 'sales'
    ? (canViewTeamTime || canDeleteTime || canManageTime ? 9 : 8)
    : (canViewTeamTime || canDeleteTime || canManageTime ? 7 : 6);

  const resetEntryForm = () => {
    setFormData((current) => ({
      ...current,
      task_id: '',
      lead_id: '',
      source_other: '',
      manual_leads_count: '',
      description: '',
      manual_hours: '',
      manual_minutes: '0',
    }));
    setCurrentTime(0);
    setIsTracking(false);
    setIsPaused(false);
    setSessionStartedAt(null);
    setTimerStartedAtMs(null);
    setElapsedBeforePause(0);
    setActiveSessionId(null);
    clearTimerSnapshot();
  };

  const handleModeChange = (value: string) => {
    if (!value) return;
    setTrackingMode(value as TrackingMode);
    setIsTracking(false);
    setIsPaused(false);
    setCurrentTime(0);
    setTimerStartedAtMs(null);
    setElapsedBeforePause(0);
    setActiveSessionId(null);
    clearTimerSnapshot();
    setFormData((current) => ({
      ...current,
      project_id: '',
      task_id: '',
      lead_id: '',
      source_other: '',
      manual_leads_count: '',
      description: '',
      manual_hours: '',
      manual_minutes: '0',
    }));
  };

  const handleStartTracking = async () => {
    if (!canCreateTime) return;
    if (trackingMode === 'project' && !formData.project_id) {
      toast.error('Please select a project before starting the timer');
      return;
    }

    try {
      const response = await api.post('/time-logs/session/start', {
        project_id: trackingMode === 'project' ? formData.project_id || null : null,
        task_id: trackingMode === 'project' ? formData.task_id || null : null,
        source_platform: trackingMode === 'sales' ? (formData.source === 'Other' ? formData.source_other || 'Other' : formData.source) : undefined,
      });
      setActiveSessionId(response.data?.id || null);

      setCurrentTime(0);
      setSessionStartedAt(new Date().toISOString());
      setTimerStartedAtMs(Date.now());
      setElapsedBeforePause(0);
      setIsPaused(false);
      setIsTracking(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start timer session on the server');
    }
  };

  const handlePauseTracking = () => {
    if (!canCreateTime || !isTracking) return;
    const elapsed = getRunningElapsed(timerStartedAtMs, elapsedBeforePause);
    setCurrentTime(elapsed);
    setElapsedBeforePause(elapsed);
    setTimerStartedAtMs(null);
    setIsPaused(true);
  };

  const handleResumeTracking = () => {
    if (!canCreateTime || !isTracking) return;
    setTimerStartedAtMs(Date.now());
    setIsPaused(false);
  };

  const handleStopTracking = async () => {
    if (!canCreateTime) return;
    const finalCurrentTime = isPaused ? currentTime : getRunningElapsed(timerStartedAtMs, elapsedBeforePause);
    if (finalCurrentTime <= 0) {
      toast.error('No tracked time to save');
      setIsTracking(false);
      return;
    }

    const stoppedAt = new Date().toISOString();
    const leadsCreated = trackingMode === 'sales' && sessionStartedAt
      ? await countLeadsCreatedFresh(sessionStartedAt, stoppedAt).catch(() => countLeadsCreatedInSession(sessionStartedAt, stoppedAt))
      : 0;

    if (activeSessionId) {
      try {
        await api.post('/time-logs/session/stop', {
          session_id: activeSessionId,
          task_id: trackingMode === 'project' ? formData.task_id || null : null,
          project_id: trackingMode === 'project' ? formData.project_id || null : null,
          notes: trackingMode === 'sales'
            ? buildSalesDescription(leadsCreated, sessionStartedAt, stoppedAt)
            : formData.description,
        });
      } catch (err: any) {
        // Warning if session fails to stop, but continue saving time log
      }
    }

    createMutation.mutate({
      project_id: trackingMode === 'project' ? formData.project_id || null : null,
      task_id: trackingMode === 'project' ? formData.task_id || null : null,
      date: formData.date,
      hours: (finalCurrentTime / 3600).toFixed(2),
      source_platform: trackingMode === 'sales' ? (formData.source === 'Other' ? formData.source_other || 'Other' : formData.source) : undefined,
      work_type: trackingMode === 'sales' ? formData.work_type : undefined,
      manual_leads_count: trackingMode === 'sales' ? leadsCreated : 0,
      description: trackingMode === 'sales'
        ? buildSalesDescription(leadsCreated, sessionStartedAt, stoppedAt)
        : formData.description,
    });
    resetEntryForm();
  };

  const handleManualSave = () => {
    if (!canCreateTime) return;
    if (trackingMode === 'project' && !formData.project_id) {
      toast.error('Please select a project');
      return;
    }
    const manualHours = Number(formData.manual_hours || 0) + Number(formData.manual_minutes || 0) / 60;
    if (manualHours <= 0) {
      toast.error('Add hours or minutes before saving');
      return;
    }
    const manualLeadsCount = Math.max(0, Number(formData.manual_leads_count || 0));

    createMutation.mutate({
      project_id: trackingMode === 'project' ? formData.project_id || null : null,
      task_id: trackingMode === 'project' ? formData.task_id || null : null,
      date: formData.date,
      hours: manualHours.toFixed(2),
      source_platform: trackingMode === 'sales' ? (formData.source === 'Other' ? formData.source_other || 'Other' : formData.source) : undefined,
      work_type: trackingMode === 'sales' ? formData.work_type : undefined,
      manual_leads_count: trackingMode === 'sales' ? manualLeadsCount : 0,
      description: trackingMode === 'sales'
        ? buildSalesDescription(manualLeadsCount)
        : formData.description,
    });
    resetEntryForm();
  };

  const handleDelete = (id: string, projectName: string) => {
    if (!canDeleteTime && !canManageTime) return;
    Swal.fire({
      title: 'Delete Time Log?',
      text: `Are you sure you want to delete time log for "${projectName || 'selected entry'}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const handleExport = () => {
    const header = trackingMode === 'sales'
      ? ['User', 'Work Type', 'Source', 'Date', 'Hours', 'Leads Created', 'Leads/Hour', 'Status', 'Description']
      : ['User', 'Project', 'Task', 'Date', 'Hours', 'Status', 'Description'];
    const rows = filteredLogs.map((log: any) => {
      if (trackingMode === 'sales') {
        const salesMeta = parseSalesDescription(log.description);
        const hours = Number(log.hours || 0);
        const leadCount = salesMeta.isSalesSession ? salesMeta.leadsCount : log.lead_id ? 1 : 0;
        return [
          log.user_name || '',
          salesMeta.workType || 'Lead Work',
          salesMeta.source || '-',
          log.date || '',
          log.hours || '',
          leadCount,
          hours > 0 ? (leadCount / hours).toFixed(2) : '0.00',
          log.status || '',
          (salesMeta.note || log.description || '').replace(/,/g, ' '),
        ];
      }

      return [
        log.user_name || '',
        log.project_name || '',
        log.task_title || '',
        log.date || '',
        log.hours || '',
        log.status || '',
        (log.description || '').replace(/,/g, ' '),
      ];
    });
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
            {trackingMode === 'sales'
              ? 'Track lead work by date and see how much time the sales team spends per lead.'
              : 'Run a live timer, log manual work, and keep project-task time entries in one workspace.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <ToggleGroup type="single" value={trackingMode} onValueChange={handleModeChange} className="grid grid-cols-2 rounded-md border bg-background p-1 sm:flex">
            <ToggleGroupItem value="project" aria-label="Project work mode" className="gap-2 px-3 text-sm">
              <BriefcaseBusiness className="h-4 w-4" />
              Project Work
            </ToggleGroupItem>
            <ToggleGroupItem value="sales" aria-label="Sales leads mode" className="gap-2 px-3 text-sm">
              <Target className="h-4 w-4" />
              Sales Leads
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canCreateTime ? (
            <Button variant="outline" onClick={resetEntryForm}>
              <TimerReset className="mr-2 h-4 w-4" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {canViewTeamTime && visibleUsers.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Team View</p>
              <p className="text-xs text-muted-foreground">Filter logs and daily metrics by team member.</p>
            </div>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className={`${selectClassName} mt-0 md:w-72`}
            >
              <option value="all">All team members</option>
              {visibleUsers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {trackingMode === 'sales' ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Date Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedDateHours.toFixed(1)}h</div>
            <p className="mt-1 text-xs text-muted-foreground">{format(new Date(formData.date), 'PPP')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Worked</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesLeadsWorked}</div>
            <p className="mt-1 text-xs text-muted-foreground">Leads created during sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time / Lead</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageTimePerLead.toFixed(2)}h</div>
            <p className="mt-1 text-xs text-muted-foreground">Total time divided by leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads / Hour</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsPerHour.toFixed(2)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Lead output rate for selected date</p>
          </CardContent>
        </Card>
      </div>
      ) : (
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
      )}

      <div className="space-y-6">
        {canCreateTime ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{trackingMode === 'sales' ? 'Lead Extraction Session' : 'Active Timer & Manual Entry'}</CardTitle>
            <Badge variant="outline" className="w-fit capitalize">{trackingMode === 'sales' ? 'Sales mode' : 'Project mode'}</Badge>
          </CardHeader>
          <CardContent className="space-y-5 overflow-visible">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px,1fr]">
              <div className="rounded-md border bg-muted/20 p-5 text-center">
                <div className="text-sm text-muted-foreground">{trackingMode === 'sales' ? 'Sales Session Timer' : 'Current Session'}</div>
                <div className="mt-2 font-mono text-4xl font-bold tracking-tight">{formatTime(currentTime)}</div>
                {trackingMode === 'sales' && isTracking && sessionStartedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isPaused ? 'Paused' : `Counting leads created after ${format(new Date(sessionStartedAt), 'p')}`}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{trackingMode === 'sales' ? 'Start before filling leads in the sheet.' : 'Select project, then start timer.'}</p>
                )}
              </div>

              <div className="space-y-5">
                <div className={`grid grid-cols-1 gap-4 ${trackingMode === 'sales' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {trackingMode === 'project' ? (
                  <>
                  <div>
                    <Label htmlFor="project_id">Project</Label>
                    <select
                      id="project_id"
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value, task_id: '' })}
                      className={selectClassName}
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
                      className={selectClassName}
                    >
                      <option value="">Select task</option>
                      {tasks.map((task: any) => (
                        <option key={task.id} value={task.id}>{task.title}</option>
                      ))}
                    </select>
                  </div>
                  </>
                  ) : (
                  <>
                  <div>
                    <Label htmlFor="work_type">Work Type</Label>
                    <select
                      id="work_type"
                      value={formData.work_type}
                      onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                      className={selectClassName}
                    >
                      {SALES_WORK_TYPES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <DynamicSelect
                      label="Source / Platform"
                      value={formData.source}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                      options={DEFAULT_SOURCES}
                      helperText="Use a predefined source or choose Other to enter a custom channel."
                    />
                  </div>
                  {formData.source === 'Other' ? (
                    <div>
                      <Label htmlFor="source_other">Custom Source / Platform</Label>
                      <Input
                        id="source_other"
                        className="mt-2"
                        value={formData.source_other}
                        onChange={(e) => setFormData({ ...formData, source_other: e.target.value })}
                        placeholder="Enter source/platform"
                      />
                    </div>
                  ) : null}
                  <div>
                    <Label htmlFor="log-date">Date</Label>
                    <Input id="log-date" type="date" className="mt-2" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                  </>
                  )}
                </div>

                {trackingMode === 'project' ? (
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
                ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="manual-hours">Manual Hours</Label>
                    <Input id="manual-hours" type="number" step="0.25" className="mt-2" value={formData.manual_hours} onChange={(e) => setFormData({ ...formData, manual_hours: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="manual-minutes">Manual Minutes</Label>
                    <Input id="manual-minutes" type="number" min="0" max="59" className="mt-2" value={formData.manual_minutes} onChange={(e) => setFormData({ ...formData, manual_minutes: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="manual-leads">Manual Leads</Label>
                    <Input
                      id="manual-leads"
                      type="number"
                      min="0"
                      className="mt-2"
                      value={formData.manual_leads_count}
                      onChange={(e) => setFormData({ ...formData, manual_leads_count: e.target.value })}
                    />
                  </div>
                </div>
                )}

                <div>
                  <Label htmlFor="description">Work Description</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    className="mt-2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={trackingMode === 'sales' ? 'Optional note for this lead extraction session.' : 'What did you work on? Mention deliverables, blockers, or outcome.'}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {!isTracking ? (
                    <Button onClick={handleStartTracking} disabled={createMutation.isPending} className="sm:w-auto">
                      <Play className="mr-2 h-4 w-4" />
                      {trackingMode === 'sales' ? 'Start Lead Session' : 'Start Timer'}
                    </Button>
                  ) : (
                    <>
                      {isPaused ? (
                        <Button onClick={handleResumeTracking} disabled={createMutation.isPending} className="sm:w-auto">
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={handlePauseTracking} disabled={createMutation.isPending} className="sm:w-auto">
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                      )}
                      <Button className="bg-red-500 hover:bg-red-600 sm:w-auto" onClick={handleStopTracking} disabled={createMutation.isPending}>
                        <Square className="mr-2 h-4 w-4" />
                        {trackingMode === 'sales' ? 'Stop Session & Save' : 'Stop & Save'}
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={handleManualSave} disabled={createMutation.isPending} className="sm:w-auto">
                    Save Manual Entry
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        ) : null}

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>{trackingMode === 'sales' ? 'Sales Sessions' : 'Project Time'}</CardTitle>
              <Badge variant="secondary">{filteredLogs.length} entries</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={trackingMode === 'sales' ? 'Search by user, work type, or source' : 'Search by user, project, or task'}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ModuleLoadingState
                title="Loading time logs"
                description="Syncing timer sessions and manual entries."
              />
            ) : filteredLogs.length === 0 ? (
              <ModuleEmptyState
                title="No time logs found"
                description="Try adjusting the filters or start a new timer session."
              />
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    {trackingMode === 'sales' ? (
                      <>
                        <TableHead>Work Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Leads</TableHead>
                        <TableHead>Leads/Hour</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Project</TableHead>
                        <TableHead>Task</TableHead>
                      </>
                    )}
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    {(canViewTeamTime || canDeleteTime || canManageTime) ? <TableHead>Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        {trackingMode === 'sales' ? (
                          (() => {
                            const salesMeta = parseSalesDescription(log.description);
                            const hours = Number(log.hours || 0);
                            const leadCount = salesMeta.isSalesSession ? salesMeta.leadsCount : log.lead_id ? 1 : 0;
                            return (
                              <>
                                <TableCell>{salesMeta.workType || 'Lead Work'}</TableCell>
                                <TableCell>{salesMeta.source || '-'}</TableCell>
                                <TableCell>{leadCount}</TableCell>
                                <TableCell>{hours > 0 ? (leadCount / hours).toFixed(2) : '0.00'}</TableCell>
                              </>
                            );
                          })()
                        ) : (
                          <>
                            <TableCell>{log.project_name || '-'}</TableCell>
                            <TableCell>{log.task_title || '-'}</TableCell>
                          </>
                        )}
                        <TableCell>{log.date ? format(new Date(log.date), 'PPP') : '-'}</TableCell>
                        <TableCell>{formatHoursAsHms(log.hours)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={log.status === 'approved' ? 'default' : log.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {log.status}
                            </Badge>
                            {log.is_manual ? (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                                Manual
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        {(canViewTeamTime || canDeleteTime || canManageTime) ? (
                          <TableCell>
                            <div className="flex gap-1">
                              {canViewTeamTime ? (
                                <Button variant="ghost" size="icon" onClick={() => setSelectedTimeLog(log)} aria-label="View time details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {(canDeleteTime || canManageTime) ? (
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(log.id, log.project_name || log.user_name)} aria-label="Delete time log">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedTimeLog)} onOpenChange={(open) => !open && setSelectedTimeLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time Log Details</DialogTitle>
          </DialogHeader>
          {selectedTimeLog ? (
            (() => {
              const salesDetail = getSalesDetail(selectedTimeLog.description);
              return (
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">User</p>
                <p className="font-medium">{selectedTimeLog.user_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-mono text-lg font-semibold">{formatHoursAsHms(selectedTimeLog.hours)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{selectedTimeLog.date ? format(new Date(selectedTimeLog.date), 'PPP') : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedTimeLog.status === 'approved' ? 'default' : selectedTimeLog.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {selectedTimeLog.status}
                  </Badge>
                  {selectedTimeLog.is_manual ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                      Manual Entry
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="font-medium">{selectedTimeLog.project_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Task</p>
                <p className="font-medium">{selectedTimeLog.task_title || '-'}</p>
              </div>
              {salesDetail.isSalesSession ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Work Type</p>
                    <p className="font-medium">{salesDetail.workType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium">{salesDetail.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Leads Created</p>
                    <p className="font-medium">{salesDetail.leadsCreated}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="font-medium">{salesDetail.started}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ended</p>
                    <p className="font-medium">{salesDetail.ended}</p>
                  </div>
                  {salesDetail.note ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Note</p>
                      <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3">{salesDetail.note}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3">{selectedTimeLog.description || '-'}</p>
                </div>
              )}
            </div>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeTracking;
