import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Download, Filter, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { EmptyState } from '@/components/common/EmptyState';
import api from '@/services/api';
import type { ProjectProgress, TeamPerformance, TaskSummary } from '@/types';

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

const Reports: React.FC = () => {
  const { hasPermission } = useAuth();
  const permission = usePermission();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary[]>([]);
  const [taskActivityData, setTaskActivityData] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const promises: Promise<any>[] = [];

        // Dashboard stats
        if (permission.canViewReports()) {
          promises.push(api.getDashboard());
        } else {
          promises.push(Promise.resolve({ data: null }));
        }

        // Project progress
        if (permission.canViewReports()) {
          promises.push(api.getProjectProgressReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Team performance
        if (permission.canViewReports()) {
          promises.push(api.getTeamPerformanceReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Task distribution
        if (permission.canViewReports()) {
          promises.push(api.getTaskDistributionReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Task activity
        if (permission.canViewReports()) {
          promises.push(api.getTaskActivityReport());
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        const [statsRes, progressRes, performanceRes, distributionRes, activityRes] = await Promise.all(promises);

        // Map dashboard stats
        const dashboardData = (statsRes as any).data;
        if (dashboardData) {
          const mappedStats: any = {
            total_projects: dashboardData.projects?.total || 0,
            active_projects: parseInt(dashboardData.projects?.active || '0'),
            total_tasks: dashboardData.tasks?.total || 0,
            completed_tasks: 0,
            overdue_tasks: dashboardData.overdueTasks || 0,
            total_users: dashboardData.teamMembers?.total || 0,
          };
          setDashboardStats(mappedStats);
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
      } catch (error) {
        console.error('Error fetching reports data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Check permission
  if (!permission.canViewReports()) {
    return (
      <EmptyState
        title="Access Denied"
        description="You don't have permission to view reports."
        action={{ label: 'Go Back', onClick: () => window.history.back() }}
      />
    );
  }

  if (isLoading) {
    return <LoadingPage text="Loading reports..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="View detailed project and team analytics"
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 90 days</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress */}
        {projectProgress.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Project Progress</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectProgress} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    dataKey="project_name"
                    type="category"
                    width={100}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Progress']}
                  />
                  <Bar dataKey="progress" fill="hsl(162, 63%, 41%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Task Distribution */}
        {taskSummary.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Task Distribution</h3>
            <div className="h-72 flex items-center">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={taskSummary}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="status"
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
              <div className="w-1/2 space-y-4">
                {taskSummary.map((item, index) => (
                  <div key={`status-${item.status}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{item.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{item.count}</span>
                      <span className="text-xs text-muted-foreground ml-2">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Activity Trend */}
        {taskActivityData.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Task Activity Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={taskActivityData}>
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
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(162, 63%, 41%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(162, 63%, 41%)' }}
                    name="Tasks Completed"
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="hsl(199, 89%, 48%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(199, 89%, 48%)' }}
                    name="Tasks Created"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Team Performance */}
        {teamPerformance.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Team Performance</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="user_name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="tasks_completed" fill="hsl(162, 63%, 41%)" name="Completed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tasks_assigned" fill="hsl(199, 89%, 48%)" name="Assigned" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
            <p className="text-3xl font-bold text-accent">{dashboardStats.total_tasks || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Tasks</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
            <p className="text-3xl font-bold text-success">{dashboardStats.completed_tasks || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Completed</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
            <p className="text-3xl font-bold text-info">{dashboardStats.total_projects || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Projects</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
            <p className="text-3xl font-bold text-warning">
              {dashboardStats.total_tasks > 0 
                ? Math.round((dashboardStats.completed_tasks / dashboardStats.total_tasks) * 100) 
                : 0}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
