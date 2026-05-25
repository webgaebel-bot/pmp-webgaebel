import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CreateFlexibleFollowupPayload } from '@/types/leads';

interface FollowupFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateFlexibleFollowupPayload) => void;
  loading?: boolean;
}

const defaultForm = {
  client_name: '',
  company: '',
  email_address: '',
  industry_niche: '',
  problem_identified: '',
  email_sent_date: '',
  subject_line: '',
  follow_up_1: '',
  follow_up_2: '',
  follow_up_3: '',
  breakup_email: '',
  businemail: '',
  email_opened: '',
  replied: '',
  status: 'active',
  notes: '',
};

export function FollowupFormModal({ open, onOpenChange, onSubmit, loading }: FollowupFormModalProps) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (open) return;
    setForm(defaultForm);
  }, [open]);

  const setField = (field: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const values = Object.entries(form).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value.trim()) acc[key] = value.trim();
      return acc;
    }, {});

    onSubmit({
      data: values,
      status: form.status.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Follow-up</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Follow-up Info</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={form.company} onChange={(e) => setField('company', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={form.email_address} onChange={(e) => setField('email_address', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Industry / Niche</Label>
                <Input value={form.industry_niche} onChange={(e) => setField('industry_niche', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Problem Identified</Label>
                <Textarea rows={3} value={form.problem_identified} onChange={(e) => setField('problem_identified', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email Sent Date</Label>
                <Input type="datetime-local" value={form.email_sent_date} onChange={(e) => setField('email_sent_date', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input value={form.subject_line} onChange={(e) => setField('subject_line', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Email Sequence</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Follow-Up 1</Label>
                <Textarea rows={3} value={form.follow_up_1} onChange={(e) => setField('follow_up_1', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Follow-Up 2</Label>
                <Textarea rows={3} value={form.follow_up_2} onChange={(e) => setField('follow_up_2', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Follow-Up 3</Label>
                <Textarea rows={3} value={form.follow_up_3} onChange={(e) => setField('follow_up_3', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Breakup Email</Label>
                <Textarea rows={3} value={form.breakup_email} onChange={(e) => setField('breakup_email', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>BusinEmail</Label>
                <Textarea rows={3} value={form.businemail} onChange={(e) => setField('businemail', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tracking</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email Opened?</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.email_opened} onChange={(e) => setField('email_opened', e.target.value)}>
                  <option value="">Not selected</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Replied?</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.replied} onChange={(e) => setField('replied', e.target.value)}>
                  <option value="">Not selected</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="pending">pending</option>
                  <option value="complete">complete</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={4} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={loading} loadingText="Saving...">
              Create Follow-up
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
