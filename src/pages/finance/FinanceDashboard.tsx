import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Wallet, PlusCircle, Receipt, Users, Settings, LayoutGrid, PiggyBank, Building2 } from 'lucide-react';
import { api } from '@/services/api';
import { usePermission } from '@/hooks/usePermission';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { ModuleEmptyState, ModuleErrorState, ModuleLoadingState } from '@/components/common/ModuleState';
import { formatMoney } from '@/lib/financeEngine';
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
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const navigate = useNavigate();
  const permission = usePermission();
  const queryClient = useQueryClient();
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const availableMonths = useMemo(() => {
    const months: Array<{ value: string; label: string }> = [];
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const now = new Date();

    for (let index = 0; index < 24; index += 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      months.push({
        value: date.toISOString().slice(0, 7),
        label: formatter.format(date),
      });
    }

    return months;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();
    const channel = (supabase as any)
      .channel('finance-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        queryClient.invalidateQueries(['finance-stats']);
        queryClient.invalidateQueries(['finance-chart']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        queryClient.invalidateQueries(['finance-stats']);
        queryClient.invalidateQueries(['finance-chart']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_runs' }, () => {
        queryClient.invalidateQueries(['finance-stats']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commission_records' }, () => {
        queryClient.invalidateQueries(['finance-stats']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'future_fund_transactions' }, () => {
        queryClient.invalidateQueries(['finance-stats']);
      })
      .subscribe();

    setIsLiveConnected(true);

    return () => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    };
  }, [queryClient]);

  const {
    data: statsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['finance-stats', timeRange, currencyFilter, selectedMonth],
    queryFn: async () => {
      const currencyQuery = currencyFilter && currencyFilter !== 'all' ? `&currency=${currencyFilter}` : '';
      const monthQuery = timeRange === 'month' && selectedMonth ? `&month=${selectedMonth}` : '';
      const response = await api.get(`/finance/stats?range=${timeRange}${currencyQuery}${monthQuery}`);
      return response;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });
  const stats = statsResponse?.data;

  const { data: currentSettingsResponse } = useQuery({
    queryKey: ['finance-settings'],
    queryFn: async () => api.get('/finance/settings'),
  });

  const currentSettings = currentSettingsResponse?.data || {};

  const { data: foundersResponse } = useQuery({
    queryKey: ['finance-founders'],
    queryFn: async () => api.get('/finance/founders'),
  });
  const founders = foundersResponse?.data || [];

  const { data: chartDataResponse } = useQuery({
    queryKey: ['finance-chart', timeRange, currencyFilter, selectedMonth],
    queryFn: async () => {
      const currencyQuery = currencyFilter && currencyFilter !== 'all' ? `&currency=${currencyFilter}` : '';
      const monthQuery = timeRange === 'month' && selectedMonth ? `&month=${selectedMonth}` : '';
      const response = await api.get(`/finance/chart?range=${timeRange}${currencyQuery}${monthQuery}`);
      return response;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });
  const chartData = chartDataResponse?.data?.data || [];
  const distributionData = stats?.data?.distribution || [];
  const distributionColors = ['#0f766e', '#2563eb', '#f59e0b', '#7c3aed'];
  const currencyCode = stats?.data?.currency || currentSettings.base_currency || 'USD';
  const futureFundCurrent = Number(stats?.data?.futureFund || 0);
  const founderProfitGross = Number(stats?.data?.founderProfit || 0);
  const companySavingsRate = 10;
  const companySavings = Math.max(founderProfitGross, 0) * (companySavingsRate / 100);
  const totalFounderEquity = founders.reduce((sum: number, founder: any) => sum + Number(founder.equity_percentage || 0), 0);
  const normalizedFounderEquity = totalFounderEquity > 0 ? totalFounderEquity : 100;
  const founderPayoutRows = founders
    .map((founder: any) => {
      const equity = Number(founder.equity_percentage || 0);
      const share = normalizedFounderEquity > 0 ? equity / normalizedFounderEquity : 0;
      const grossShare = founderProfitGross > 0 ? founderProfitGross * share : 0;
      const savings = grossShare * (companySavingsRate / 100);
      const netShare = Math.max(grossShare - savings, 0);
      return {
        id: founder.id,
        name: founder.name || 'Founder',
        equity,
        share,
        grossShare,
        savings,
        netShare,
      };
    })
    .filter((row: any) => row.grossShare > 0 || row.netShare > 0 || row.equity > 0);
  const founderCompanySavingsTotal = founderPayoutRows.reduce((sum: number, row: any) => sum + row.savings, 0);
  const companySavingsTotal = founderCompanySavingsTotal || companySavings;
  const reserveAllocationTotal = futureFundCurrent + companySavingsTotal;

  const statCards = [
    {
      title: 'Total Income',
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

  const deductionCards = [
    { title: 'Taxes', value: stats?.data?.taxes || 0 },
    { title: 'Commissions', value: stats?.data?.commissions || 0 },
    { title: 'Transaction Fees', value: stats?.data?.transactionFees || 0 },
    { title: 'Salaries', value: stats?.data?.salaries || 0 },
  ];

  const profitCards = [
      { title: 'Gross Profit', value: stats?.data?.grossProfit || 0 },
      { title: 'Product Costs', value: stats?.data?.productCosts || 0 },
      { title: 'Company Savings + Future Fund', value: reserveAllocationTotal, icon: PiggyBank, highlight: true },
    ];
  const chartDistributionData = distributionData.filter((item: any) => Number(item.amount || 0) > 0 && item.label !== 'Founder Equity Allocated');
  const chartDistributionTotal = chartDistributionData.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const getDistributionPercent = (amount: number) => (chartDistributionTotal > 0 ? (Number(amount || 0) / chartDistributionTotal) * 100 : 0);

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
      title: 'Payment Accounts',
      description: 'Manage the bank or wallet accounts that receive client payments.',
      icon: Building2,
      onClick: () => navigate('/finance/accounts'),
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
    if (action.title === 'Payment Accounts') return permission.canAny(['finance.payments.view', 'finance.payments.manage', 'finance.settings.manage', 'finance.view.all']);
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
            <p className="text-sm text-muted-foreground">
              Base currency: {currencyCode}. All figures are computed from payments, expenses, salaries, and finance settings.
            </p>
            <p className="text-sm text-muted-foreground">
              Currency filter: {currencyFilter === 'all' ? 'All currencies' : currencyFilter}.
            </p>
            {timeRange === 'month' ? (
              <p className="text-sm text-muted-foreground">
                Month snapshot: {availableMonths.find((month) => month.value === selectedMonth)?.label || selectedMonth}.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Live dashboard updates {isLiveConnected ? 'enabled' : 'pending'}{isLiveConnected ? ' — changes are pushed automatically' : ''}.
            </p>
          </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label htmlFor="currency-filter" className="text-sm font-medium text-muted-foreground">
            Currency
          </label>
          <select
            id="currency-filter"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {['all', 'USD', 'PKR', 'EUR', 'GBP', 'AED'].map((currency) => (
              <option key={currency} value={currency}>
                {currency === 'all' ? 'All currencies' : currency}
              </option>
            ))}
          </select>
            {(['all', 'month', 'quarter', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              >
                {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
            {timeRange === 'month' ? (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            ) : null}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {deductionCards.map((item) => (
          <Card key={item.title}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
              <p className="mt-2 text-2xl font-semibold">{formatMoney(item.value, currencyCode)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {profitCards.map((item) => (
            <Card key={item.title} className={item.highlight ? 'border-emerald-200 bg-emerald-50/40' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
                  {'icon' in item && item.icon ? <item.icon className="h-4 w-4 text-emerald-600" /> : null}
                </div>
                <p className="mt-2 text-2xl font-semibold">{formatMoney(item.value, currencyCode)}</p>
                {'highlight' in item && item.highlight ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>Company savings: {formatMoney(companySavingsTotal, currencyCode)}</p>
                    <p>Future fund: {formatMoney(futureFundCurrent, currencyCode)}</p>
                    <p>Positive value means reserve. Negative value means the business is still in shortfall.</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Liabilities</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(stats?.data?.liabilities || 0, currencyCode)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net Profit</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(stats?.data?.netProfit || 0, currencyCode)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Founder Payout Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each founder receives their equity share from founder profit, then 10% company savings is deducted from that share.
          </p>
        </CardHeader>
        <CardContent>
          {founderPayoutRows.length > 0 ? (
            <div className="space-y-3">
              {founderPayoutRows.map((founder: any) => (
                <div key={founder.id} className="rounded-xl border bg-background p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{founder.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {founder.share > 0 ? `${(founder.share * 100).toFixed(2)}% share` : 'No equity configured'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm md:grid-cols-3 md:gap-6">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Gross</p>
                        <p className="font-medium">{formatMoney(founder.grossShare, currencyCode)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Savings 10%</p>
                        <p className="font-medium text-amber-600">-{formatMoney(founder.savings, currencyCode)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Net</p>
                        <p className="font-semibold text-emerald-700">{formatMoney(founder.netShare, currencyCode)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">Company Savings</p>
                    <p className="text-sm text-muted-foreground">
                      10% deducted from each founder share. Total savings: {formatMoney(founderCompanySavingsTotal || companySavings, currencyCode)}.
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatMoney(founderCompanySavingsTotal || companySavings, currencyCode)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ModuleEmptyState
              title="No founders configured"
              description="Add founders first so the dashboard can show per-founder payout and company savings."
            />
          )}
        </CardContent>
      </Card>

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
              {chartDistributionData.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartDistributionData}
                        dataKey="amount"
                        nameKey="label"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        label={({ value }: any) => `${getDistributionPercent(value).toFixed(1)}%`}
                        labelLine={false}
                      >
                        {chartDistributionData.map((_: any, index: number) => (
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
              {chartDistributionData.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: distributionColors[index % distributionColors.length] }} />{item.label}</p>
                    <p className="text-xs text-muted-foreground">{getDistributionPercent(item.amount).toFixed(1)}%</p>
                  </div>
                  <p className="text-base font-semibold">{formatMoney(item.amount, currencyCode)}</p>
                </div>
              ))}
              {!chartDistributionData.length && (
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/finance/accounts')}>
              <Building2 className="mr-2 h-4 w-4" />
              Open Accounts
            </Button>
            <Button variant="outline" onClick={() => navigate('/finance/records')}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Open Records
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
