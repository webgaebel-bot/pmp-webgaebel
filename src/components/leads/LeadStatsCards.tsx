import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { LeadStats } from '@/types/leads';

interface LeadStatsCardsProps {
  stats?: LeadStats;
}

export function LeadStatsCards({ stats }: LeadStatsCardsProps) {
  const cards = [
    { label: 'Total Leads', value: stats?.total ?? 0, helper: 'All captured leads' },
    { label: 'This Month New', value: stats?.new_this_month ?? 0, helper: 'Fresh opportunities' },
    { label: 'Conversion Rate', value: `${(stats?.conversion_rate ?? 0).toFixed(1)}%`, helper: 'Won vs total leads' },
    { label: 'Avg Lead Score', value: `${Math.round(stats?.avg_score ?? 0)}/100`, helper: 'Average qualification score' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-slate-200/70 bg-white/70 backdrop-blur">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
