import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Wallet, PlusCircle, Receipt, Users, Settings, LayoutGrid } from 'lucide-react';
import { api } from '@/services/api';
import { usePermission } from '@/hooks/usePermission';
import { ModuleEmptyState, ModuleErrorState, ModuleLoadingState } from '@/components/common/ModuleState';
import { calculateFinanceSummary, formatMoney } from '@/lib/financeEngine';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const FinanceDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  const navigate = useNavigate();
  const permission = usePermission();

  const {
    data: statsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['finance-stats', timeRange],
    queryFn: async () => {
      const response = await api.get(`/finance/stats?range=${timeRange}`);
      return response;
    },
  });
  const stats = statsResponse?.data;

  const { data: currentSettingsResponse } = useQuery({
    queryKey: ['finance-settings'],
    queryFn: async () => api.get('/finance/settings'),
  });

  const currentSettings = currentSettingsResponse?.data || {};

  const { data: chartDataResponse } = useQuery({
    queryKey: ['finance-chart', timeRange],
    queryFn: async () => {
      const response = await api.get(`/finance/chart?range=${timeRange}`);
      return response;
    },
  });
  const chartData = chartDataResponse?.data?.data || [];
  const distributionData = stats?.data?.distribution || [];
  const distributionColors = ['#0f766e', '#2563eb', '#f59e0b', '#7c3aed'];
  const currencyCode = stats?.data?.currency || 'USD';
  const financeSummary = calculateFinanceSummary({
    revenue: Number(stats?.data?.revenue || 0),
    expenses: Number(stats?.data?.expenses || 0),
    salaries: Number(stats?.data?.salaries || 0),
    taxes: Number(stats?.data?.taxes || 0),
    commissions: Number(stats?.data?.commissions || 0),
    futureFundRate: Number(stats?.data?.futureFundRate || 10),
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: stats?.data?.revenue || 0,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Total Expenses',
      value: stats?.data?.expenses || 0,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Net Profit',
      value: stats?.data?.netProfit || 0,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Outstanding',
      value: stats?.data?.outstanding || 0,
      icon: Wallet,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  const quickActions = [
    {
      title: 'Add Payment',
      description: 'Create a new incoming payment record.',
      icon: PlusCircle,
      onClick: () => navigate('/finance/payments?create=1'),
    },
    {
      title: 'Add Expense',
      description: 'Log a new company expense quickly.',
      icon: Receipt,
      onClick: () => navigate('/finance/expenses?create=1'),
    },
    {
      title: 'Add Client',
      description: 'Create a client before attaching work or revenue.',
      icon: Users,
      onClick: () => navigate('/finance/clients?create=1'),
    },
    {
      title: 'Salary Management',
      description: 'Open the salary module for employee payroll records.',
      icon: Wallet,
      onClick: () => navigate('/salary'),
    },
    {
      title: 'Add Founder',
      description: 'Update founder ownership and finance distribution.',
      icon: Settings,
      onClick: () => navigate('/finance/founders?create=1'),
    },
    {
      title: 'Taxes & Commissions',
      description: 'Open the dedicated records page for taxes and commissions.',
      icon: LayoutGrid,
      onClick: () => navigate('/finance/records'),
    },
  ].filter((action) => {
    if (action.title === 'Add Payment') return permission.canAny(['finance.payments.manage', 'finance.settings.manage', 'finance.view.all']);
    if (action.title === 'Add Expense') return permission.canAny(['finance.expenses.manage', 'finance.settings.manage', 'finance.view.all']);
    if (action.title === 'Add Client') return permission.canAny(['finance.clients.manage', 'finance.settings.manage', 'finance.view.all']);
    if (action.title === 'Salary Management') return permission.canAny(['finance.salaries.manage', 'finance.settings.manage', 'finance.view.all']);
    if (action.title === 'Add Founder') return permission.canAny(['finance.founders.manage', 'finance.settings.manage', 'finance.view.all']);
    if (action.title === 'Taxes & Commissions') return permission.canAny(['finance.taxes.view', 'finance.commissions.view', 'finance.settings.manage', 'finance.view.all']);
    return true;
  });

  if (isLoading) {
    return <ModuleLoadingState title="Loading finance dashboard" description="Fetching revenue, profit, and liability summaries." />;
  }

  if (isError) {
    return (
      <ModuleErrorState
        title="Finance dashboard unavailable"
        description={error instanceof Error ? error.message : 'Unable to fetch finance data right now.'}
        onAction={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Finance Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['month', 'quarter', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
            <Button variant="outline" onClick={() => navigate('/finance/records')}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Taxes & Commissions
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatMoney(stat.value, currencyCode)}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { title: 'Gross Profit', value: financeSummary.grossProfit },
          { title: 'Future Fund', value: financeSummary.futureFund },
          { title: 'Founder Profit', value: financeSummary.founderProfit },
          { title: 'Liabilities', value: financeSummary.liabilities },
          { title: 'Net Profit', value: financeSummary.netProfit },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
              <p className="mt-2 text-2xl font-semibold">{formatMoney(item.value, currencyCode)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Finance Actions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add payments, expenses, clients and founders records from here.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/finance/settings')}>
              Finance Settings
            </Button>
          </CardHeader>
          <CardContent>
            {quickActions.length === 0 ? (
              <ModuleEmptyState
                title="No finance actions available"
                description="Your role currently has read-only access to finance data."
              />
            ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={action.onClick}
                  className="rounded-xl border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-sm"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <action.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{action.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
                </button>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2FA7A3" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2FA7A3" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5BC0BE" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5BC0BE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2FA7A3"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#5BC0BE"
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#0f766e" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {distributionData.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distributionData} dataKey="amount" nameKey="label" innerRadius={60} outerRadius={90} paddingAngle={3} label={(entry) => `${entry.percentage}%`} labelLine={false}>
                        {distributionData.map((_: any, index: number) => (
                          <Cell key={index} fill={distributionColors[index % distributionColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              {distributionData.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: distributionColors[index % distributionColors.length] }} />{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                  </div>
                  <p className="text-base font-semibold">{formatMoney(item.amount, currencyCode)}</p>
                </div>
              ))}
              {!distributionData.length && (
                <div className="text-center py-8 text-muted-foreground">
                  No distribution data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed border-border/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Detailed Records</CardTitle>
            <p className="text-sm text-muted-foreground">
              Open the dedicated records page for project taxes and outsider commissions.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/finance/records')}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Open Records
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
