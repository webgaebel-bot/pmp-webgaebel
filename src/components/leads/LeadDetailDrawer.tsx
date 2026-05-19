import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/usePermission';
import type { Lead } from '@/types/leads';
import { LeadScoreBadge } from './LeadScoreBadge';
import { ActivityTimeline } from './ActivityTimeline';
import { FollowupScheduler } from './FollowupScheduler';

interface LeadDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead;
  loading?: boolean;
  onDelete: (leadId: string) => void;
  onAddActivity: (leadId: string, payload: { activity_type: any; description: string; duration_minutes?: number; outcome?: string }) => void;
  onAddNote: (leadId: string, content: string) => void;
  onScheduleFollowup: (leadId: string, payload: { followup_type: any; scheduled_at: string; notes?: string }) => void;
  onCompleteFollowup: (followupId: string, notes?: string) => void;
  onAddTag: (leadId: string, tag: string) => void;
  onRemoveTag: (leadId: string, tag: string) => void;
}

function LeadDetailInner({
  lead,
  loading,
  onDelete,
  onAddActivity,
  onAddNote,
  onScheduleFollowup,
  onCompleteFollowup,
  onAddTag,
  onRemoveTag,
}: Omit<LeadDetailDrawerProps, 'open' | 'onOpenChange'>) {
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const permission = usePermission();
  const canViewDetailedLeadData = permission.isAdmin() || permission.can('leads.detail.view');
  const canUpdateLead = permission.can('leads.update');
  const canDeleteLead = permission.can('leads.delete');
  const canCreateFollowup = permission.can('leads.followups.create');
  const canUpdateFollowup = permission.can('leads.followups.update');

  if (!lead) {
    return <div className="p-6 text-sm text-muted-foreground">{loading ? 'Loading lead...' : 'Select a lead to view details.'}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border bg-muted/30 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {lead.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{lead.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {lead.designation || 'Lead'} {lead.company ? `- ${lead.company}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">{lead.pipeline_stage.replace('_', ' ')}</Badge>
              <Badge variant="outline" className="capitalize">{lead.priority}</Badge>
              <Badge variant="outline" className="capitalize">{(lead.source || 'manual').replace('_', ' ')}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LeadScoreBadge score={lead.lead_score} />
            {canDeleteLead ? (
              <Button variant="destructive" size="sm" onClick={() => onDelete(lead.id)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-background p-3 text-sm">
            <p className="text-muted-foreground">Contact</p>
            <p>{lead.phone || '-'}</p>
            <p>{lead.email || '-'}</p>
          </div>
          <div className="rounded-xl border bg-background p-3 text-sm">
            <p className="text-muted-foreground">Budget & Close</p>
            <p>PKR {Number(lead.budget || 0).toLocaleString()}</p>
            <p>{lead.expected_close_date || '-'}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4 text-sm">
              <p className="text-muted-foreground">Assigned</p>
              <p>{lead.assigned_to_name || 'Unassigned'}</p>
            </div>
            <div className="rounded-xl border p-4 text-sm">
              <p className="text-muted-foreground">Next Follow-up</p>
              <p>{lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString() : 'Not scheduled'}</p>
            </div>
            <div className="rounded-xl border p-4 text-sm md:col-span-2">
              <p className="text-muted-foreground">Notes</p>
              <p>{lead.notes || lead.lead_notes?.[0]?.content || 'No summary note added yet.'}</p>
            </div>
            {canViewDetailedLeadData ? (
              <div className="rounded-xl border p-4 text-sm md:col-span-2">
                <p className="text-muted-foreground">Detailed Lead Data</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p>Website: {lead.website || '-'}</p>
                  <p>LinkedIn: {lead.linkedin_url || '-'}</p>
                  <p>Facebook: {lead.facebook_url || '-'}</p>
                  <p>Instagram: {lead.instagram_url || '-'}</p>
                  <p>X: {lead.x_url || '-'}</p>
                  <p>Outreach: {(lead.outreach_status || 'not_contacted').replace('_', ' ')}</p>
                  <p>Channel: {lead.outreach_channel || '-'}</p>
                  <p>Close Value: PKR {Number(lead.close_value || 0).toLocaleString()}</p>
                  <p>Last Reachout: {lead.last_reachout_at ? new Date(lead.last_reachout_at).toLocaleString() : '-'}</p>
                  <p>Follow-up Sent: {lead.followup_sent_at ? new Date(lead.followup_sent_at).toLocaleString() : '-'}</p>
                </div>
                <div className="mt-3 space-y-2">
                  <p><span className="text-muted-foreground">Services:</span> {lead.services_offered || '-'}</p>
                  <p><span className="text-muted-foreground">Follow-up Notes:</span> {lead.followup_notes || '-'}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">
                Detailed lead data is visible to admins or users with lead detail permission.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTimeline activities={lead.lead_activities || []} loading={loading} onAdd={canUpdateLead ? (payload) => onAddActivity(lead.id, payload) : undefined} />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          {canUpdateLead ? (
            <div className="space-y-3 rounded-xl border p-4">
              <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a structured note for this lead..." />
              <Button
                onClick={() => {
                  if (!note.trim()) return;
                  onAddNote(lead.id, note);
                  setNote('');
                }}
              >
                Add Note
              </Button>
            </div>
          ) : null}
          <div className="space-y-3">
            {(lead.lead_notes || []).map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <p className="text-sm">{item.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="followups">
          <FollowupScheduler
            followups={lead.lead_followups || []}
            loading={loading}
            onSchedule={canCreateFollowup ? (payload) => onScheduleFollowup(lead.id, payload) : undefined}
            onComplete={canUpdateFollowup ? onCompleteFollowup : undefined}
          />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3">
          {(lead.lead_contacts || []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No contacts added yet.</div>
          ) : (
            (lead.lead_contacts || []).map((contact) => (
              <div key={contact.id} className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{contact.name}</p>
                  {contact.is_primary ? <Badge>Primary</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{contact.role || '-'}</p>
                <p className="mt-2 text-sm">{contact.email || '-'}</p>
                <p className="text-sm">{contact.phone || '-'}</p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          {canUpdateLead ? (
            <div className="flex gap-2">
              <Textarea className="min-h-0" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add tag" />
              <Button
                onClick={() => {
                  if (!tag.trim()) return;
                  onAddTag(lead.id, tag);
                  setTag('');
                }}
              >
                Add
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {(lead.lead_tags || []).map((leadTag) => (
              <button key={leadTag.id} type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => canUpdateLead && onRemoveTag(lead.id, leadTag.tag_name)}>
                {leadTag.tag_name} x
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function LeadDetailDrawer(props: LeadDetailDrawerProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={props.open} onOpenChange={props.onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader>
            <DrawerTitle>Lead Details</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-auto">
            <LeadDetailInner {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[680px]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Lead Details</SheetTitle>
        </SheetHeader>
        <div className="h-full overflow-auto">
          <LeadDetailInner {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
