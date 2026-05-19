import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FOLLOWUP_TYPES, type LeadFollowup, type ScheduleLeadFollowupPayload } from '@/types/leads';

interface FollowupSchedulerProps {
  followups: LeadFollowup[];
  onSchedule?: (payload: ScheduleLeadFollowupPayload) => void;
  onComplete?: (followupId: string, notes?: string) => void;
  loading?: boolean;
}

export function FollowupScheduler({ followups, onSchedule, onComplete, loading }: FollowupSchedulerProps) {
  const [form, setForm] = useState<ScheduleLeadFollowupPayload>({
    followup_type: 'call',
    scheduled_at: '',
    notes: '',
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.scheduled_at) return;
    if (!onSchedule) return;
    onSchedule(form);
    setForm({ followup_type: 'call', scheduled_at: '', notes: '' });
  };

  return (
    <div className="space-y-5">
      {onSchedule ? (
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Follow-up Type</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={form.followup_type}
              onChange={(e) => setForm((current) => ({ ...current, followup_type: e.target.value as ScheduleLeadFollowupPayload['followup_type'] }))}
            >
              {FOLLOWUP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Date & Time</Label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((current) => ({ ...current, scheduled_at: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea rows={3} value={form.notes ?? ''} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value || undefined }))} />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Scheduling...' : '+ Schedule Follow-up'}
        </Button>
      </form>
      ) : null}

      <div className="space-y-3">
        {followups.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No follow-ups scheduled yet.</div>
        ) : (
          followups.map((followup) => (
            <div key={followup.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium capitalize">{followup.followup_type.replace('_', ' ')}</p>
                  <p className="text-sm text-muted-foreground">{new Date(followup.scheduled_at).toLocaleString()}</p>
                  {followup.notes ? <p className="mt-2 text-sm">{followup.notes}</p> : null}
                </div>
                {!followup.completed && onComplete ? (
                  <Button variant="outline" onClick={() => onComplete(followup.id, followup.notes)}>
                    Complete
                  </Button>
                ) : (
                  <span className="text-sm font-medium text-emerald-600">Completed</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
