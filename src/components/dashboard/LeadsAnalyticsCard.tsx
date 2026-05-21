import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import api from '@/services/api';

type LeadSourceStat = {
  source: string;
  count: number;
};

const LeadsAnalyticsCard: React.FC = () => {
  const [stats, setStats] = useState<LeadSourceStat[]>([]);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [newLeads, setNewLeads] = useState<number>(0);
  const [conversionRate, setConversionRate] = useState<number>(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        // Assuming the backend provides a /leads/stats endpoint returning { total, new_this_week, conversion_rate, by_source: [{ source, count }] }
        const res = await api.getLeadStats();
        const data = res.data;
        setTotalLeads(data.total || 0);
        setNewLeads(data.new_this_month || data.new_this_week || 0);
        setConversionRate(data.conversion_rate || 0);
        setStats(data.by_source || []);
      } catch (e) {
        console.error('Failed to load leads analytics', e);
      }
    };
    fetch();
  }, []);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border border-border rounded-3xl p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">Leads Analytics</h3>
        <Link to="/leads">
          <Button variant="ghost" size="sm" className="text-accent">
            View All <span className="ml-1">→</span>
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="text-3xl font-bold text-foreground">{totalLeads}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">New This Month</p>
          <p className="text-3xl font-bold text-foreground">{newLeads}</p>
        </div>
        <div className="col-span-2">
          <p className="text-sm text-muted-foreground">Conversion Rate</p>
          <p className="text-2xl font-medium text-foreground">{conversionRate}%</p>
        </div>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} layout="vertical" margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="source" type="category" width={100} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(214, 85%, 45%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default LeadsAnalyticsCard;
