import React from 'react';
import { CheckCircle2, Circle, Columns3, ShieldCheck, TableProperties } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const steps = [
  {
    title: 'Open Leads',
    text: 'Go to Leads and use the Leads tab for the editable sheet.',
    icon: TableProperties,
  },
  {
    title: 'Add Or Edit Rows',
    text: 'Click any cell, enter one or multiple values, then save the row.',
    icon: CheckCircle2,
  },
  {
    title: 'Add Columns',
    text: 'Use Add Column for custom fields. New columns stay available on your browser.',
    icon: Columns3,
  },
  {
    title: 'Manage Follow-ups',
    text: 'Use the Follow-ups tab for client outreach, email dates, replies, notes and custom columns.',
    icon: Circle,
  },
  {
    title: 'Admin Access',
    text: 'Admins and users with all-leads access can select a user and view that user’s leads or follow-ups.',
    icon: ShieldCheck,
  },
];

const Guidance: React.FC = () => (
  <div className="space-y-6">
    <div className="rounded-lg border bg-card p-6">
      <Badge variant="outline">Guidance</Badge>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Lead and follow-up workflow</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        A quick stepper for using the flexible sheet-style CRM module. This page is available to every logged-in user.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative grid grid-cols-[44px_1fr] gap-4 pb-8 last:pb-0">
                {index < steps.length - 1 ? <div className="absolute left-[21px] top-10 h-full w-px bg-border" /> : null}
                <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border bg-background">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <h2 className="font-semibold">{step.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default Guidance;
