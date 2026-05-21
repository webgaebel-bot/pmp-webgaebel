import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FolderKanban,
  LayoutDashboard,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermission } from '@/hooks/usePermission';

type GuideStep = {
  title: string;
  summary: string;
  route: string;
  icon: React.ElementType;
  permissions: string[];
  bullets: string[];
};

const steps: GuideStep[] = [
  {
    title: 'System Overview',
    summary: 'Start here to understand the portal layout, the navigation model, and which modules are shared across teams.',
    route: '/dashboard',
    icon: LayoutDashboard,
    permissions: ['dashboard.view'],
    bullets: ['Use the dashboard for a bird’s-eye view.', 'Quick links open the main workspaces.', 'Role-based cards appear only when permissions allow.'],
  },
  {
    title: 'Projects',
    summary: 'Manage project creation, members, progress, and project-specific reporting from one place.',
    route: '/projects',
    icon: FolderKanban,
    permissions: ['projects.view'],
    bullets: ['Track ownership and progress.', 'Use project members and roles carefully.', 'Project dashboards should stay clean and current.'],
  },
  {
    title: 'Tasks',
    summary: 'Task workflows control delivery. Assign, update priority, move status, and monitor blockers.',
    route: '/tasks',
    icon: CheckCircle2,
    permissions: ['tasks.view'],
    bullets: ['Every task should have an owner.', 'Use status updates to keep the board accurate.', 'Overdue tasks should be monitored daily.'],
  },
  {
    title: 'Leads & Sales',
    summary: 'Lead ownership is strict: users see their own records unless they have explicit view-all access.',
    route: '/leads',
    icon: Target,
    permissions: ['leads.view'],
    bullets: ['Create, assign, and update leads from the CRM sheet.', 'Only view-all users can see everyone’s leads.', 'Niches, services, and statuses can repeat across rows.'],
  },
  {
    title: 'Finance',
    summary: 'Revenue, expenses, payroll, clients, founders, taxes, and commissions live under the finance workspace.',
    route: '/finance',
    icon: DollarSign,
    permissions: ['finance.view'],
    bullets: ['Use finance dashboards for summaries.', 'Use records pages for detailed tax and commission management.', 'Only users with finance permissions should access write actions.'],
  },
  {
    title: 'Time Tracking',
    summary: 'Track work sessions, sales activity, and manual logs without breaking project or lead flows.',
    route: '/time-tracking',
    icon: Clock,
    permissions: ['time.view'],
    bullets: ['Start and stop timers from the same workspace.', 'Sales sessions can be separate from project sessions.', 'Missing schema pieces now have app-level fallbacks.'],
  },
  {
    title: 'Users, Roles, Permissions',
    summary: 'Admin users should verify access rules first, then assign role-based permissions carefully.',
    route: '/roles',
    icon: ShieldCheck,
    permissions: ['roles.view', 'users.view'],
    bullets: ['Keep role grants strict and deliberate.', 'Use the permissions page to audit access.', 'Super Admin should retain full access, but still be reviewed.'],
  },
  {
    title: 'Operations & Reporting',
    summary: 'Use reports, activity logs, settings, and notifications to audit the whole system.',
    route: '/reports',
    icon: BarChart3,
    permissions: ['reports.view', 'activity_logs.view'],
    bullets: ['Review logs for sensitive changes.', 'Reports should guide decisions, not replace data checks.', 'Settings are the last stop before production changes.'],
  },
];

const highlights = [
  { label: 'Admin scope', value: 'Global control' },
  { label: 'Lead visibility', value: 'Own / Team / All' },
  { label: 'Finance scope', value: 'Read / Manage / Audit' },
  { label: 'System mode', value: 'Strict RBAC' },
];

const SystemGuide: React.FC = () => {
  const permission = usePermission();
  const isElevated = permission.isSuperAdmin() || permission.isAdmin();
  const [activeStep, setActiveStep] = useState(0);

  if (!isElevated) {
    return (
      <div className="space-y-6">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This global guide is available only to Super Admin and Admin users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStep = steps[activeStep];
  const CurrentIcon = currentStep.icon;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-gradient-to-r from-slate-950 via-cyan-900 to-emerald-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="bg-white/15 text-white hover:bg-white/20">System Guide</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Global guide for Super Admin and Admin</h1>
            <p className="text-sm text-white/80">
              This stepper covers the full portal: dashboard, projects, tasks, leads, finance, time tracking, users, roles, and reporting.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Guide Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const active = index === activeStep;
              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                    active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/70 hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{step.title}</p>
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CurrentIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{currentStep.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">Step {activeStep + 1} of {steps.length}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
                  disabled={activeStep === 0}
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setActiveStep((current) => Math.min(steps.length - 1, current + 1))}
                  disabled={activeStep === steps.length - 1}
                >
                  Next
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">{currentStep.summary}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {currentStep.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm text-foreground">{bullet}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentStep.permissions.map((item) => (
                  <Badge key={item} variant="secondary" className="rounded-full">
                    {item}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={currentStep.route}>
                    Open module
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="border-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{step.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">{step.route}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{step.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {step.permissions.slice(0, 2).map((perm) => (
                        <Badge key={perm} variant="outline">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemGuide;
