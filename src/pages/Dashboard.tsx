import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  CheckSquare,
  Users,
  AlertCircle,
  Clock,
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
} from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { StatsCard } from '@/components/common/StatsCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { DashboardStats, ProjectProgress, TeamPerformance, TaskSummary } from '@/types';

// Mock data for demo
const mockDashboardData: DashboardStats = {
  total_projects: 24,
  active_projects: 12,
  total_tasks: 156,
  completed_tasks: 89,
  pending_tasks: 45,
  overdue_tasks: 8,
  total_users: 32,
  active_users: 28,
};

const mockProjectProgress: ProjectProgress[] = [
  { project_id: '1', project_name: 'E-commerce Platform', progress: 75, status: 'in_progress', tasks_completed: 45, tasks_total: 60 },
  { project_id: '2', project_name: 'Mobile App v2', progress: 45, status: 'in_progress', tasks_completed: 18, tasks_total: 40 },
  { project_id: '3', project_name: 'API Gateway', progress: 90, status: 'in_progress', tasks_completed: 27, tasks_total: 30 },
  { project_id: '4', project_name: 'Dashboard Redesign', progress: 30, status: 'planning', tasks_completed: 6, tasks_total: 20 },
];

const mockTeamPerformance: TeamPerformance[] = [
  { user_id: '1', user_name: 'Sarah Johnson', tasks_completed: 24, tasks_assigned: 28, completion_rate: 86 },
  { user_id: '2', user_name: 'Mike Chen', tasks_completed: 18, tasks_assigned: 22, completion_rate: 82 },
  { user_id: '3', user_name: 'Emily Davis', tasks_completed: 21, tasks_assigned: 25, completion_rate: 84 },
  { user_id: '4', user_name: 'James Wilson', tasks_completed: 15, tasks_assigned: 20, completion_rate: 75 },
];

const mockTaskSummary: TaskSummary[] = [
  { status: 'done', count: 89, percentage: 57 },
  { status: 'in_progress', count: 32, percentage: 21 },
  { status: 'todo', count: 27, percentage: 17 },
  { status: 'blocked', count: 8, percentage: 5 },
];

const taskTrendData = [
  { name: 'Jan', completed: 45, created: 52 },
  { name: 'Feb', completed: 52, created: 48 },
  { name: 'Mar', completed: 61, created: 55 },
  { name: 'Apr', completed: 58, created: 62 },
  { name: 'May', completed: 72, created: 68 },
  { name: 'Jun', completed: 89, created: 75 },
];

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(mockDashboardData);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>(mockProjectProgress);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>(mockTeamPerformance);
  const [taskSummary, setTaskSummary] = useState<TaskSummary[]>(mockTaskSummary);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [dashboardRes, progressRes, performanceRes, summaryRes] = await Promise.all([
          api.getDashboard().catch(() => ({ data: mockDashboardData })),
          api.getProjectProgress().catch(() => ({ data: mockProjectProgress })),
          api.getTeamPerformance().catch(() => ({ data: mockTeamPerformance })),
          api.getTaskSummary().catch(() => ({ data: mockTaskSummary })),
        ]);

        setStats((dashboardRes as any).data || mockDashboardData);
        setProjectProgress((progressRes as any).data || mockProjectProgress);
        setTeamPerformance((performanceRes as any).data || mockTeamPerformance);
        setTaskSummary((summaryRes as any).data || mockTaskSummary);
      } catch (error) {
        // Use mock data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <LoadingPage text="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}`}
        description="Here's what's happening with your projects today."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Projects"
          value={stats.total_projects}
          icon={FolderKanban}
          variant="accent"
          description={`${stats.active_projects} active`}
        />
        <StatsCard
          title="Total Tasks"
          value={stats.total_tasks}
          icon={CheckSquare}
          variant="info"
          trend={{ value: 12, isPositive: true }}
          description="this month"
        />
        <StatsCard
          title="Overdue Tasks"
          value={stats.overdue_tasks}
          icon={AlertCircle}
          variant="warning"
          description="needs attention"
        />
        <StatsCard
          title="Team Members"
          value={stats.total_users}
          icon={Users}
          variant="success"
          description={`${stats.active_users} online`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Trend Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Task Activity</h3>
              <p className="text-sm text-muted-foreground">Tasks completed vs created</p>
            </div>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={taskTrendData}>
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

        {/* Task Summary Pie */}
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
              <div key={item.status} className="flex items-center gap-2">
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
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress */}
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

        {/* Team Performance */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Team Performance</h3>
            <Link to="/reports">
              <Button variant="ghost" size="sm" className="text-accent">
                View Report <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
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
                    {member.user_name.split(' ').map(n => n[0]).join('')}
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
      </div>
    </div>
  );
};

export default Dashboard;
