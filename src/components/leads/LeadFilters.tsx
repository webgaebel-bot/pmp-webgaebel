import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LEAD_PRIORITIES, LEAD_SOURCES, PIPELINE_STAGES, type LeadFilters as LeadFiltersType } from '@/types/leads';

interface LeadFiltersProps {
  value: LeadFiltersType;
  onChange: (next: LeadFiltersType) => void;
  assignedUsers: Array<{ id: string; name: string }>;
  availableTags: string[];
  nicheOptions: string[];
  serviceOptions: string[];
}

function toggleValue<T extends string>(current: T[] | undefined, value: T) {
  const list = current || [];
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function LeadFilters({ value, onChange, assignedUsers, availableTags, nicheOptions, serviceOptions }: LeadFiltersProps) {
  return (
    <Card className="border-slate-200/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['new', 'contacted', 'qualified', 'converted', 'lost'].map((status) => (
              <label key={status} className="flex items-center gap-2">
                <Checkbox checked={value.status?.includes(status)} onCheckedChange={() => onChange({ ...value, status: toggleValue(value.status, status) })} />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Pipeline Stage</Label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {PIPELINE_STAGES.map((stage) => (
              <label key={stage} className="flex items-center gap-2">
                <Checkbox
                  checked={value.pipeline_stage?.includes(stage)}
                  onCheckedChange={() => onChange({ ...value, pipeline_stage: toggleValue(value.pipeline_stage, stage) })}
                />
                <span className="capitalize">{stage.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Source</Label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {LEAD_SOURCES.map((source) => (
              <label key={source} className="flex items-center gap-2">
                <Checkbox checked={value.source?.includes(source)} onCheckedChange={() => onChange({ ...value, source: toggleValue(value.source, source) })} />
                <span className="capitalize">{source.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Niche</Label>
          <div className="max-h-40 space-y-2 overflow-auto text-sm">
            {nicheOptions.length ? nicheOptions.map((niche) => (
              <label key={niche} className="flex items-center gap-2">
                <Checkbox
                  checked={value.designation?.includes(niche)}
                  onCheckedChange={() => onChange({ ...value, designation: toggleValue(value.designation, niche) })}
                />
                <span>{niche}</span>
              </label>
            )) : <p className="text-xs text-muted-foreground">No niches available.</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Service</Label>
          <div className="max-h-40 space-y-2 overflow-auto text-sm">
            {serviceOptions.length ? serviceOptions.map((service) => (
              <label key={service} className="flex items-center gap-2">
                <Checkbox
                  checked={value.services_offered?.includes(service)}
                  onCheckedChange={() => onChange({ ...value, services_offered: toggleValue(value.services_offered, service) })}
                />
                <span>{service}</span>
              </label>
            )) : <p className="text-xs text-muted-foreground">No services available.</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {LEAD_PRIORITIES.map((priority) => (
              <label key={priority} className="flex items-center gap-2">
                <Checkbox
                  checked={value.priority?.includes(priority)}
                  onCheckedChange={() => onChange({ ...value, priority: toggleValue(value.priority, priority) })}
                />
                <span className="capitalize">{priority}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Assigned To</Label>
          <div className="max-h-32 space-y-2 overflow-auto text-sm">
            {assignedUsers.map((user) => (
              <label key={user.id} className="flex items-center gap-2">
                <Checkbox
                  checked={value.assigned_to?.includes(user.id)}
                  onCheckedChange={() => onChange({ ...value, assigned_to: toggleValue(value.assigned_to, user.id) })}
                />
                <span>{user.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Score Min</Label>
            <Input type="number" min="0" max="100" value={value.score_min ?? ''} onChange={(e) => onChange({ ...value, score_min: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="space-y-2">
            <Label>Score Max</Label>
            <Input type="number" min="0" max="100" value={value.score_max ?? ''} onChange={(e) => onChange({ ...value, score_max: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="space-y-2">
            <Label>Budget Min</Label>
            <Input type="number" min="0" value={value.budget_min ?? ''} onChange={(e) => onChange({ ...value, budget_min: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="space-y-2">
            <Label>Budget Max</Label>
            <Input type="number" min="0" value={value.budget_max ?? ''} onChange={(e) => onChange({ ...value, budget_max: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Date From</Label>
            <Input type="date" value={value.date_from ?? ''} onChange={(e) => onChange({ ...value, date_from: e.target.value || undefined })} />
          </div>
          <div className="space-y-2">
            <Label>Date To</Label>
            <Input type="date" value={value.date_to ?? ''} onChange={(e) => onChange({ ...value, date_to: e.target.value || undefined })} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Has Follow-up Due</Label>
            <Switch checked={Boolean(value.has_followup_due)} onCheckedChange={(checked) => onChange({ ...value, has_followup_due: checked || undefined })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Overdue Only</Label>
            <Switch checked={Boolean(value.overdue_only)} onCheckedChange={(checked) => onChange({ ...value, overdue_only: checked || undefined })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const active = value.tags?.includes(tag);
              return (
                <Button key={tag} variant={active ? 'default' : 'outline'} size="sm" onClick={() => onChange({ ...value, tags: toggleValue(value.tags, tag) })}>
                  {tag}
                </Button>
              );
            })}
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() =>
            onChange({
              search: value.search,
            })
          }
        >
          Reset All
        </Button>
      </CardContent>
    </Card>
  );
}
