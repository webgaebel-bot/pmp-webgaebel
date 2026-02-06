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

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

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

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const promises: Promise<any>[] = [];

        // Dashboard stats
        if (permission.canViewDashboardStats()) {
          promises.push(api.getDashboard());
        } else {
          promises.push(Promise.resolve({ data: null }));
        }

        // Project progress
        if (permission.canViewProjectProgress()) {
          promises.push(api.getProjectProgressReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Team performance
        if (permission.canViewTeamPerformance()) {
          promises.push(api.getTeamPerformanceReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Task distribution
        if (permission.canViewTaskCharts()) {
          promises.push(api.getTaskDistributionReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Task activity
        if (permission.canViewTaskCharts()) {
          promises.push(api.getTaskActivityReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Activity logs
        if (permission.canViewActivityLogsDashboard()) {
          promises.push(api.getActivityLogs({ limit: '5' }));
        } else {
          promises.push(Promise.resolve([]));
        }

        const [dashboardRes, progressRes, performanceRes, distributionRes, activityRes, logsRes] = await Promise.all(promises);

        // Map dashboard stats
        const dashboardData = (dashboardRes as any).data;
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
        const progressData = (progressRes as any).data || [];
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
        const performanceData = (performanceRes as any).data || [];
        const mappedPerformance = performanceData.map((t: any) => ({
          user_id: String(t.id),
          user_name: t.name,
          tasks_completed: parseInt(t.completed_tasks || '0'),
          tasks_assigned: parseInt(t.total_tasks || '0'),
          completion_rate: parseInt(t.completion_rate || '0'),
        }));
        setTeamPerformance(mappedPerformance);

        // Map task distribution
        const distributionData = (distributionRes as any).data || [];
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
        const activityData = (activityRes as any).data || [];
        const mappedActivity = activityData.map((a: any) => ({
          name: a.month || 'Unknown',
          created: parseInt(a.created || '0'),
          completed: parseInt(a.completed || '0'),
        }));
        setTaskActivityData(mappedActivity);

        // Map activity logs
        const logsData = Array.isArray(logsRes) ? logsRes : (logsRes as any).data || [];
        const mappedLogs = logsData.map((log: any) => ({
          id: log.id,
          action: log.action || 'Unknown',
          entity_type: log.entity_type,
          entity_name: log.entity_type,
          created_at: log.created_at,
          user: {
            name: log.user_name || 'Unknown User',
          },
        }));
        setActivityLogs(mappedLogs);
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

  // Check if stats data is available
  if (!stats) {
    return (
      <EmptyState
        title="No Data Available"
        description="Unable to load dashboard statistics at this time."
        action={{ label: 'Refresh', onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}`}
        description="Here's what's happening with your projects today."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {permission.canViewTotalProjects() && (
          <StatsCard
            title="Total Projects"
            value={stats.total_projects}
            icon={FolderKanban}
            variant="accent"
            description={`${stats.active_projects} active`}
          />
        )}
        {permission.canViewTotalTasks() && (
          <StatsCard
            title="Total Tasks"
            value={stats.total_tasks}
            icon={CheckSquare}
            variant="info"
            trend={{ value: 12, isPositive: true }}
            description="this month"
          />
        )}
        {permission.canViewOverdueTasks() && (
          <StatsCard
            title="Overdue Tasks"
            value={stats.overdue_tasks}
            icon={AlertCircle}
            variant="warning"
            description="needs attention"
          />
        )}
        {permission.canViewTeamMembers() && permission.canViewOnlineUsers() && (
          <StatsCard
            title="Team Members"
            value={stats.total_users}
            icon={Users}
            variant="success"
            description={`${stats.active_users} online`}
          />
        )}
      </div>

      {/* Calendar Section */}
      <div>
        <Calendar />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Activity Chart */}
        {taskActivityData.length > 0 && (
          <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Task Activity</h3>
                <p className="text-sm text-muted-foreground">Tasks completed vs created</p>
              </div>
              {permission.canViewReports() && (
                <Link to="/reports">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={taskActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="1"
                    stroke="hsl(162, 63%, 41%)"
                    fill="hsl(162, 63%, 41%, 0.2)"
                    name="Completed"
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    stackId="2"
                    stroke="hsl(199, 89%, 48%)"
                    fill="hsl(199, 89%, 48%, 0.2)"
                    name="Created"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Task Distribution Pie */}
        {taskSummary.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-4">Task Distribution</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskSummary}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
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
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {taskSummary.map((item, index) => (
                <div key={`task-${item.status}-${index}`} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm capitalize text-muted-foreground">
                    {item.status.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium ml-auto">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row */}
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
                    <AvatarImage src={member.user_avatar ? `${IMAGE_BASE_URL}${member.user_avatar}` : undefined} />
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

      {/* Activity Logs Section */}
      {permission.canViewActivityLogsDashboard() && activityLogs.length > 0 && (
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
                    {log.entity_type}: <span className="font-medium">{log.entity_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
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
