import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  CheckSquare,
  Users,
  AlertCircle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { StatsCard } from '@/components/common/StatsCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import Calendar from '@/components/common/Calendar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { DashboardStats, ProjectProgress, TeamPerformance, TaskSummary } from '@/types';
import { formatMoney } from '@/lib/financeEngine';
import { resolveImageUrl } from '@/lib/media';
import LeadsAnalyticsCard from '@/components/dashboard/LeadsAnalyticsCard';

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

interface LeadOwnershipRow {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  leads_count: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const permission = usePermission();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary[]>([]);
  const [taskActivityData, setTaskActivityData] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [leadStats, setLeadStats] = useState<any | null>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [leadOwnership, setLeadOwnership] = useState<LeadOwnershipRow[]>([]);
  const [financeStats, setFinanceStats] = useState<any | null>(null);
  const canViewAdminDashboardSections = permission.isAdmin();
  const statsUnavailable = canViewAdminDashboardSections && !stats;
  const isSalesDashboard = permission.canViewSalesDashboard();
  const dashboardStats = stats ?? {
    total_projects: 0,
    active_projects: 0,
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    overdue_tasks: 0,
    total_users: 0,
    active_users: 0,
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const promises: Promise<any>[] = [];

        // Dashboard stats
        if (canViewAdminDashboardSections) {
          promises.push(api.getDashboard());
        } else {
          promises.push(Promise.resolve({ data: null }));
        }

        // Project progress
        if (canViewAdminDashboardSections) {
          promises.push(api.getProjectProgressReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Team performance
        if (canViewAdminDashboardSections) {
          promises.push(api.getTeamPerformanceReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Task distribution
        if (canViewAdminDashboardSections) {
          promises.push(api.getTaskDistributionReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Task activity
        if (canViewAdminDashboardSections) {
          promises.push(api.getTaskActivityReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Activity logs
        if (canViewAdminDashboardSections) {
          promises.push(api.getActivityLogs({ limit: '5' }));
        } else {
          promises.push(Promise.resolve([]));
        }

        if (permission.canViewLeads()) {
          promises.push(api.getLeadStats());
          promises.push(api.getLeads({ page: 1, pageSize: 4 }));
          promises.push(canViewAdminDashboardSections ? api.getLeadOwnershipReport() : Promise.resolve({ data: [] }));
        } else {
          promises.push(Promise.resolve({ data: null }));
          promises.push(Promise.resolve({ data: [] }));
          promises.push(Promise.resolve({ data: [] }));
        }

        if (canViewAdminDashboardSections) {
          promises.push(api.get('/finance/stats?range=month'));
        } else {
          promises.push(Promise.resolve({ data: null }));
        }

        const [
          dashboardRes,
          progressRes,
          performanceRes,
          distributionRes,
          activityRes,
          logsRes,
          leadStatsRes,
          recentLeadsRes,
          leadOwnershipRes,
          financeStatsRes,
        ] = await Promise.allSettled(promises);

        // Map dashboard stats
        const dashboardData = dashboardRes.status === 'fulfilled' ? (dashboardRes.value as any).data : null;
        if (dashboardData) {
          const mappedStats: DashboardStats = {
            total_projects: dashboardData.projects?.total || 0,
            active_projects: parseInt(dashboardData.projects?.active || '0'),
            total_tasks: dashboardData.tasks?.total || 0,
            completed_tasks: 0,
            pending_tasks: 0,
            overdue_tasks: dashboardData.overdueTasks || 0,
            total_users: dashboardData.teamMembers?.total || 0,
            active_users: parseInt(dashboardData.teamMembers?.online || '0'),
          };
          setStats(mappedStats);
        } else {
          setStats(null);
        }

        // Map project progress
        const progressData = progressRes.status === 'fulfilled' ? (progressRes.value as any).data || [] : [];
        const mappedProgress = progressData.map((p: any) => ({
          project_id: String(p.id),
          project_name: p.name,
          progress: parseInt(p.progress || '0'),
          status: p.status || 'planning',
          tasks_completed: parseInt(p.completed_tasks || '0'),
          tasks_total: parseInt(p.total_tasks || '0'),
        }));
        setProjectProgress(mappedProgress);

        // Map team performance
        const performanceData = performanceRes.status === 'fulfilled' ? (performanceRes.value as any).data || [] : [];
        const mappedPerformance = performanceData.map((t: any) => ({
          user_id: String(t.id),
          user_name: t.name,
          tasks_completed: parseInt(t.completed_tasks || '0'),
          tasks_assigned: parseInt(t.total_tasks || '0'),
          completion_rate: parseInt(t.completion_rate || '0'),
        }));
        setTeamPerformance(mappedPerformance);

        // Map task distribution
        const distributionData = distributionRes.status === 'fulfilled' ? (distributionRes.value as any).data || [] : [];
        const mappedDistribution = distributionData.map((d: any) => ({
          status: d.status || 'unknown',
          count: parseInt(d.count || '0'),
          percentage: 0,
        }));
        
        // Calculate percentages
        const totalCount = mappedDistribution.reduce((sum, d) => sum + d.count, 0);
        const finalDistribution = mappedDistribution.map(d => ({
          ...d,
          percentage: totalCount > 0 ? Math.round((d.count / totalCount) * 100) : 0,
        }));
        setTaskSummary(finalDistribution);

        // Map task activity
        const activityData = activityRes.status === 'fulfilled' ? (activityRes.value as any).data || [] : [];
        const mappedActivity = activityData.map((a: any) => ({
          name: a.month || 'Unknown',
          created: parseInt(a.created || '0'),
          completed: parseInt(a.completed || '0'),
        }));
        setTaskActivityData(mappedActivity);

        // Map activity logs
        const logsData = logsRes.status === 'fulfilled'
          ? (Array.isArray(logsRes.value) ? logsRes.value : (logsRes.value as any).data || [])
          : [];
        const mappedLogs = logsData.map((log: any) => ({
          id: log.id,
          action: log.action || 'Unknown',
          entity_type: log.entity_type,
          entity_name: log.entity_name || log.entity_type,
          entity_label: log.entity_label || log.entity_type,
          details: log.details || '',
          summary: log.summary || '',
          created_at: log.created_at,
          user: {
            name: log.user_name || 'Unknown User',
          },
        }));
        setActivityLogs(mappedLogs);

        setLeadStats(leadStatsRes.status === 'fulfilled' ? (leadStatsRes.value as any)?.data || null : null);
        setRecentLeads(
          (recentLeadsRes.status === 'fulfilled'
            ? ((recentLeadsRes.value as any)?.data?.data || (recentLeadsRes.value as any)?.data || [])
            : []) as any[]
        );
        setLeadOwnership(
          (leadOwnershipRes.status === 'fulfilled'
            ? ((leadOwnershipRes.value as any)?.data || [])
            : []) as LeadOwnershipRow[]
        );
        setFinanceStats(financeStatsRes.status === 'fulfilled' ? (financeStatsRes.value as any)?.data?.data || null : null);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (permission.canViewDashboard()) {
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return <LoadingPage text="Loading dashboard..." />;
  }

  // Check if user has permission to view dashboard
  if (!permission.canViewDashboard()) {
    return (
      <EmptyState
        title="Access Denied"
        description="You don't have permission to view the dashboard."
        action={{ label: 'Go Back', onClick: () => window.history.back() }}
      />
    );
  }

  const quickLinks = [
    {
      title: 'Projects',
      path: '/projects',
      description: 'Open the project workspace and status board.',
      icon: FolderKanban,
      visible: permission.canViewProjects(),
    },
    {
      title: 'Tasks',
      path: '/tasks',
      description: 'Review current tasks and deadlines.',
      icon: CheckSquare,
      visible: permission.canViewTasks(),
    },
    {
      title: 'Calendar',
      path: '/calendar',
      description: 'View the project calendar and schedule.',
      icon: TrendingUp,
      visible: permission.canAny(['calendar.view', 'calendar.view.all', 'calendar.project.view']),
    },
    {
      title: 'Finance',
      path: '/finance',
      description: 'Open the finance dashboard for revenue data.',
      icon: Users,
      visible: permission.can('finance.view'),
    },
    {
      title: 'Leads',
      path: '/leads',
      description: 'Manage leads, follow-ups, and sales pipeline updates.',
      icon: Users,
      visible: permission.canViewLeads(),
    },
    {
      title: 'Time Tracking',
      path: '/time-tracking',
      description: 'Start timer sessions and track lead activity.',
      icon: TrendingUp,
      visible: permission.can('time.view'),
    },
  ].filter((link) => link.visible);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}`}
        description="Here's what's happening with your projects today."
      />

      {statsUnavailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Dashboard statistics could not be loaded right now, but the rest of the workspace is still available.
        </div>
      ) : null}

      {isSalesDashboard ? (
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-cyan-50 p-6 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-background dark:to-cyan-950/20">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                Sales workspace
              </p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">Sales dashboard snapshot</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Lead owners can track their leads, follow-ups, and conversion flow here without project noise.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total leads</p>
                <p className="mt-1 text-2xl font-bold">{leadStats?.total || 0}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">New this month</p>
                <p className="mt-1 text-2xl font-bold">{leadStats?.new_this_month || leadStats?.new_this_week || 0}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversion</p>
                <p className="mt-1 text-2xl font-bold">{leadStats?.conversion_rate || 0}%</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canViewAdminDashboardSections && leadOwnership.length > 0 ? (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Lead Ownership</p>
              <h3 className="text-xl font-semibold">Who has the most leads</h3>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              {leadOwnership.map((member, index) => (
                <div key={member.user_id} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <span className="w-6 text-sm font-semibold text-muted-foreground">{index + 1}</span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={resolveImageUrl(member.user_avatar)} />
                    <AvatarFallback className="bg-emerald-500/10 text-emerald-600">
                      {member.user_name ? member.user_name.split(' ').map((part) => part[0]).join('').slice(0, 2) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.user_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.user_email || 'No email'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">{member.leads_count}</p>
                    <p className="text-xs text-muted-foreground">leads</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Top performer</p>
              {leadOwnership[0] ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={resolveImageUrl(leadOwnership[0].user_avatar)} />
                      <AvatarFallback className="bg-emerald-500/10 text-emerald-600">
                        {leadOwnership[0].user_name ? leadOwnership[0].user_name.split(' ').map((part) => part[0]).join('').slice(0, 2) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{leadOwnership[0].user_name}</p>
                      <p className="text-sm text-muted-foreground">{leadOwnership[0].leads_count} leads assigned</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-background">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total visible owners</p>
                    <p className="mt-1 text-3xl font-black">{leadOwnership.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-background">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total leads tracked</p>
                    <p className="mt-1 text-3xl font-black">
                      {leadOwnership.reduce((sum, member) => sum + Number(member.leads_count || 0), 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  No lead ownership data found yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {quickLinks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.title}
                to={link.path}
                className="rounded-3xl border border-border bg-card p-5 transition hover:border-primary hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{link.title}</p>
                    <p className="mt-2 text-sm text-foreground">{link.description}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {canViewAdminDashboardSections && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project Snapshot</p>
                <h3 className="text-xl font-semibold">Projects overview</h3>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <FolderKanban className="h-5 w-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total projects</p>
                <p className="mt-2 text-2xl font-bold">{dashboardStats.total_projects}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active projects</p>
                <p className="mt-2 text-2xl font-bold">{dashboardStats.active_projects}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total tasks</p>
                <p className="mt-2 text-2xl font-bold">{dashboardStats.total_tasks}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue tasks</p>
                <p className="mt-2 text-2xl font-bold">{dashboardStats.overdue_tasks}</p>
              </div>
            </div>
            {projectProgress.length > 0 ? (
              <div className="mt-5 space-y-3">
                {projectProgress.slice(0, 3).map((project) => (
                  <div key={project.project_id} className="rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.project_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.tasks_completed}/{project.tasks_total} tasks
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{project.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                Project snapshot will appear here once project data loads.
              </div>
            )}
          </div>
        )}

        {permission.canViewLeads() && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lead Snapshot</p>
                <h3 className="text-xl font-semibold">Assigned leads</h3>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total leads</p>
                <p className="mt-2 text-2xl font-bold">{leadStats?.total || 0}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">New this month</p>
                <p className="mt-2 text-2xl font-bold">{leadStats?.new_this_month || leadStats?.new_this_week || 0}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversion rate</p>
                <p className="mt-2 text-2xl font-bold">{leadStats?.conversion_rate || 0}%</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Average score</p>
                <p className="mt-2 text-2xl font-bold">{Math.round(leadStats?.avg_score || 0)}</p>
              </div>
            </div>
            {recentLeads.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentLeads.map((lead: any) => (
                  <div key={lead.id} className="rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{lead.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.company || lead.created_by_name || lead.assigned_to_name || 'Lead record'}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                        {String(lead.pipeline_stage || lead.status || 'new').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                Recent assigned leads will appear here once lead data loads.
              </div>
            )}
          </div>
        )}

        {canViewAdminDashboardSections && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Finance Snapshot</p>
                <h3 className="text-xl font-semibold">Revenue and liability</h3>
              </div>
              <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
                <p className="mt-2 text-xl font-bold">{formatMoney(financeStats?.revenue || 0, 'USD')}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
                <p className="mt-2 text-xl font-bold">{formatMoney(financeStats?.expenses || 0, 'USD')}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Net profit</p>
                <p className="mt-2 text-xl font-bold">{formatMoney(financeStats?.netProfit || 0, 'USD')}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-xl font-bold">{formatMoney(financeStats?.outstanding || 0, 'USD')}</p>
              </div>
            </div>
            {Array.isArray(financeStats?.distribution) && financeStats.distribution.length > 0 ? (
              <div className="mt-5 space-y-3">
                {financeStats.distribution.slice(0, 3).map((item: any) => (
                  <div key={item.label} className="rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.percentage}% allocation</p>
                      </div>
                      <p className="text-sm font-semibold">{formatMoney(item.amount || 0, 'USD')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                Finance breakdown will appear here once finance data loads.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Premium Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {canViewAdminDashboardSections && permission.canViewTotalProjects() && (
          <div className="group relative overflow-hidden rounded-3xl p-6 shadow-sm border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <FolderKanban className="h-24 w-24 text-primary" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Projects</span>
                <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                  <FolderKanban className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-black tracking-tight text-foreground">{dashboardStats.total_projects}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-full">
                    <TrendingUp className="mr-1 h-3 w-3" /> {dashboardStats.active_projects} active
                  </span>
                  <span className="text-xs text-muted-foreground">currently</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {canViewAdminDashboardSections && permission.canViewTotalTasks() && (
          <div className="group relative overflow-hidden rounded-3xl p-6 shadow-sm border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <CheckSquare className="h-24 w-24 text-blue-500" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Tasks</span>
                <div className="rounded-full bg-blue-500/10 p-2.5 text-blue-500">
                  <CheckSquare className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-black tracking-tight text-foreground">{dashboardStats.total_tasks}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center text-xs font-semibold text-blue-600 bg-blue-500/10 px-2 py-1 rounded-full">
                    +12%
                  </span>
                  <span className="text-xs text-muted-foreground">this month</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {canViewAdminDashboardSections && permission.canViewOverdueTasks() && (
          <div className="group relative overflow-hidden rounded-3xl p-6 shadow-sm border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <AlertCircle className="h-24 w-24 text-rose-500" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overdue Tasks</span>
                <div className="rounded-full bg-rose-500/10 p-2.5 text-rose-500">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-black tracking-tight text-foreground">{dashboardStats.overdue_tasks}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center text-xs font-semibold text-rose-600 bg-rose-500/10 px-2 py-1 rounded-full">
                    Needs Attention
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {canViewAdminDashboardSections && permission.canViewTeamMembers() && permission.canViewOnlineUsers() && (
          <div className="group relative overflow-hidden rounded-3xl p-6 shadow-sm border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <Users className="h-24 w-24 text-amber-500" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Members</span>
                <div className="rounded-full bg-amber-500/10 p-2.5 text-amber-500">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-black tracking-tight text-foreground">{dashboardStats.total_users}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full">
                    {stats.active_users} online
                  </span>
                  <span className="text-xs text-muted-foreground">across workspaces</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leads Analytics Card */}
      {permission.canViewLeads() && <LeadsAnalyticsCard />}

      {/* Calendar Section */}
      {permission.canAny(['calendar.view', 'calendar.view.all', 'calendar.project.view']) ? (
      <div>
        <Calendar />
      </div>
      ) : null}

      {/* Charts Row */}
      {canViewAdminDashboardSections ? (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Task Activity</h3>
              <p className="text-sm text-muted-foreground">Tasks completed vs created over time</p>
            </div>
            {permission.canViewReports() && (
              <Link to="/reports">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
            )}
          </div>
          {taskActivityData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={taskActivityData}>
                  <defs>
                    <linearGradient id="taskCreatedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="taskCompletedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(162, 63%, 41%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(162, 63%, 41%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(162, 63%, 41%)"
                    fill="url(#taskCompletedFill)"
                    name="Completed"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    stroke="hsl(199, 89%, 48%)"
                    fill="url(#taskCreatedFill)"
                    name="Created"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">
              Task activity graph will appear once work logs are available.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Task Distribution</h3>
          <p className="mb-4 text-sm text-muted-foreground">Pipeline load across statuses</p>
          {taskSummary.length > 0 ? (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskSummary}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {taskSummary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {taskSummary.map((item, index) => (
                  <div key={`task-${item.status}-${index}`} className="flex items-center gap-2 rounded-2xl bg-muted/30 px-3 py-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm capitalize text-muted-foreground">
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="ml-auto text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">
              Task distribution will show up after tasks are created.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm xl:col-span-3">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Team Throughput</h3>
              <p className="text-sm text-muted-foreground">Completed vs assigned tasks by team member</p>
            </div>
            {permission.canViewReports() && (
              <Link to="/reports">
                <Button variant="outline" size="sm">
                  View Report
                </Button>
              </Link>
            )}
          </div>
          {teamPerformance.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamPerformance.slice(0, 6)} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="user_name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} interval={0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="tasks_completed" name="Completed" fill="hsl(162, 63%, 41%)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="tasks_assigned" name="Assigned" fill="hsl(199, 89%, 48%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">
              Team performance graph will appear once tasks are assigned.
            </div>
          )}
        </div>
      </div>
      ) : null}

      {/* Bottom Row */}
      {canViewAdminDashboardSections ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress */}
        {projectProgress.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Project Progress</h3>
              <Link to="/projects">
                <Button variant="ghost" size="sm" className="text-accent">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-5">
              {projectProgress.slice(0, 4).map((project) => (
                <div key={project.project_id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{project.project_name}</span>
                      <StatusBadge status={project.status} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {project.tasks_completed}/{project.tasks_total} tasks
                    </span>
                  </div>
                  <ProgressBar value={project.progress} showLabel />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Performance */}
        {teamPerformance.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Team Performance</h3>
              {permission.canViewReports() && (
                <Link to="/reports">
                  <Button variant="ghost" size="sm" className="text-accent">
                    View Report <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
            <div className="space-y-4">
              {teamPerformance.slice(0, 4).map((member, index) => (
                <div key={member.user_id} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground w-4">
                    {index + 1}
                  </span>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={resolveImageUrl(member.user_avatar)} />
                    <AvatarFallback className="bg-accent/20 text-accent text-sm">
                      {member.user_name ? member.user_name.split(' ').map(n => n[0]).join('') : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.user_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.tasks_completed} tasks completed
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent">
                      {member.completion_rate}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      ) : null}

      {/* Activity Logs Section */}
      {canViewAdminDashboardSections && activityLogs.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link to="/activity" className="text-sm text-accent hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {activityLogs.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-0">
                <div className="mt-1">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {log.user?.name || 'Unknown User'} {log.action}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {log.summary || `${log.action || 'Action'} ${log.entity_label || log.entity_type}`.trim()}
                  </p>
                  {log.details && log.details !== log.summary && (
                    <p className="mt-1 text-xs text-muted-foreground">{log.details}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
