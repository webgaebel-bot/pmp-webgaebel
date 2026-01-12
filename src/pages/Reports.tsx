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
import api from '@/services/api';
import type { ProjectProgress, TeamPerformance, TaskSummary } from '@/types';

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

const mockProjectProgress: ProjectProgress[] = [
  { project_id: '1', project_name: 'E-commerce', progress: 75, status: 'in_progress', tasks_completed: 45, tasks_total: 60 },
  { project_id: '2', project_name: 'Mobile App', progress: 45, status: 'in_progress', tasks_completed: 18, tasks_total: 40 },
  { project_id: '3', project_name: 'API Gateway', progress: 90, status: 'in_progress', tasks_completed: 27, tasks_total: 30 },
  { project_id: '4', project_name: 'Dashboard', progress: 30, status: 'planning', tasks_completed: 6, tasks_total: 20 },
  { project_id: '5', project_name: 'Analytics', progress: 60, status: 'in_progress', tasks_completed: 12, tasks_total: 20 },
];

const mockTeamPerformance: TeamPerformance[] = [
  { user_id: '1', user_name: 'Sarah J.', tasks_completed: 24, tasks_assigned: 28, completion_rate: 86 },
  { user_id: '2', user_name: 'Mike C.', tasks_completed: 18, tasks_assigned: 22, completion_rate: 82 },
  { user_id: '3', user_name: 'Emily D.', tasks_completed: 21, tasks_assigned: 25, completion_rate: 84 },
  { user_id: '4', user_name: 'James W.', tasks_completed: 15, tasks_assigned: 20, completion_rate: 75 },
  { user_id: '5', user_name: 'Lisa M.', tasks_completed: 19, tasks_assigned: 23, completion_rate: 83 },
];

const mockTaskSummary: TaskSummary[] = [
  { status: 'Done', count: 89, percentage: 57 },
  { status: 'In Progress', count: 32, percentage: 21 },
  { status: 'To Do', count: 27, percentage: 17 },
  { status: 'Blocked', count: 8, percentage: 5 },
];

const monthlyData = [
  { month: 'Jan', tasks: 45, hours: 320 },
  { month: 'Feb', tasks: 52, hours: 380 },
  { month: 'Mar', tasks: 61, hours: 420 },
  { month: 'Apr', tasks: 58, hours: 395 },
  { month: 'May', tasks: 72, hours: 480 },
  { month: 'Jun', tasks: 89, hours: 520 },
];

const Reports: React.FC = () => {
  const { hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [progressRes, performanceRes, summaryRes] = await Promise.all([
          api.getProjectProgress().catch(() => ({ data: mockProjectProgress })),
          api.getTeamPerformance().catch(() => ({ data: mockTeamPerformance })),
          api.getTaskSummary().catch(() => ({ data: mockTaskSummary })),
        ]);
        setProjectProgress((progressRes as any).data || mockProjectProgress);
        setTeamPerformance((performanceRes as any).data || mockTeamPerformance);
        setTaskSummary((summaryRes as any).data || mockTaskSummary);
      } catch (error) {
        setProjectProgress(mockProjectProgress);
        setTeamPerformance(mockTeamPerformance);
        setTaskSummary(mockTaskSummary);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

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

        {/* Task Distribution */}
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
                <div key={item.status} className="flex items-center justify-between">
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
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-6">Monthly Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                  dataKey="tasks"
                  stroke="hsl(162, 63%, 41%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(162, 63%, 41%)' }}
                  name="Tasks Completed"
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="hsl(199, 89%, 48%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(199, 89%, 48%)' }}
                  name="Hours Logged"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Performance */}
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-accent">156</p>
          <p className="text-sm text-muted-foreground mt-1">Total Tasks</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-success">89</p>
          <p className="text-sm text-muted-foreground mt-1">Completed</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-info">1,240</p>
          <p className="text-sm text-muted-foreground mt-1">Hours Logged</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-warning">57%</p>
          <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
