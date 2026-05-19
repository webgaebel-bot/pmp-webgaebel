import React, { useMemo } from 'react';
import { Bar, BarChart, Cell, Funnel, FunnelChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Lead, LeadStats } from '@/types/leads';

interface LeadsAnalyticsProps {
  stats?: LeadStats;
  leads: Lead[];
}

const chartColors = ['#0f766e', '#0369a1', '#7c3aed', '#ea580c', '#16a34a', '#dc2626', '#475569'];

export function LeadsAnalytics({ stats, leads }: LeadsAnalyticsProps) {
  const topTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    leads.forEach((lead) => {
      (lead.lead_tags || []).forEach((tag) => {
        tagMap.set(tag.tag_name, (tagMap.get(tag.tag_name) || 0) + 1);
      });
    });
    return [...tagMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [leads]);

  const sourceData = Object.entries(stats?.by_source || {}).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(stats?.by_priority || {}).map(([name, value]) => ({ name, value }));
  const pipelineData = Object.entries(stats?.by_pipeline_stage || {}).map(([name, value]) => ({ name, value }));
  const conversionData = (stats?.monthly_trend || []).map((item) => ({
    month: item.month,
    conversion: item.count ? Number(((item.converted / item.count) * 100).toFixed(1)) : 0,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Pipeline Funnel</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={pipelineData} isAnimationActive />
            </FunnelChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Source Breakdown</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" outerRadius={90} label>
                {sourceData.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Monthly Leads</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.monthly_trend || []}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conversion Rate Trend</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={conversionData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="conversion" stroke="#ea580c" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Priority Distribution</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={90} label>
                {priorityData.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top Tags</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {topTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags available yet.</p>
            ) : (
              topTags.map(([tag, count], index) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full px-4 py-2 font-medium text-white"
                  style={{ backgroundColor: chartColors[index % chartColors.length], fontSize: `${0.85 + count * 0.05}rem` }}
                >
                  {tag} ({count})
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
