import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AddLeadActivityPayload, LeadActivity } from '@/types/leads';

interface ActivityTimelineProps {
  activities: LeadActivity[];
  onAdd?: (payload: AddLeadActivityPayload) => void;
  loading?: boolean;
}

const activityIcons: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  whatsapp: 'WhatsApp',
  note: 'Note',
  status_change: 'Status',
  followup: 'Follow-up',
  document: 'Document',
};

export function ActivityTimeline({ activities, onAdd, loading }: ActivityTimelineProps) {
  const [form, setForm] = useState<AddLeadActivityPayload>({ activity_type: 'note', description: '' });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.description.trim()) return;
    if (!onAdd) return;
    onAdd(form);
    setForm({ activity_type: 'note', description: '' });
  };

  return (
    <div className="space-y-5">
      {onAdd ? (
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={form.activity_type}
              onChange={(e) => setForm((current) => ({ ...current, activity_type: e.target.value as AddLeadActivityPayload['activity_type'] }))}
            >
              {Object.keys(activityIcons).map((type) => (
                <option key={type} value={type}>
                  {activityIcons[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Duration (min)</Label>
            <Input type="number" value={form.duration_minutes ?? ''} onChange={(e) => setForm((current) => ({ ...current, duration_minutes: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Input value={form.outcome ?? ''} onChange={(e) => setForm((current) => ({ ...current, outcome: e.target.value || undefined }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
        </div>
        <Button type="submit" isLoading={loading} loadingText="Saving...">
          + Add Activity
        </Button>
      </form>
      ) : null}

      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No activities logged yet.</div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{activityIcons[activity.activity_type] || 'Activity'}</p>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleString()}</p>
              </div>
              {(activity.duration_minutes || activity.outcome) && (
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  {activity.duration_minutes ? <span>{activity.duration_minutes} min</span> : null}
                  {activity.outcome ? <span>{activity.outcome}</span> : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
