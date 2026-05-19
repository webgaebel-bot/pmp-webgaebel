import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Lead } from '@/types/leads';
import { LeadScoreBadge } from './LeadScoreBadge';

interface LeadTableProps {
  leads: Lead[];
  selectedLeadIds: string[];
  onToggleLead: (leadId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenLead: (leadId: string) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onScheduleFollowup: (leadId: string) => void;
  allSelected: boolean;
}

const priorityTone: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-rose-50 text-rose-700',
};

const pipelineTone: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-sky-100 text-sky-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  proposal_sent: 'bg-indigo-100 text-indigo-700',
  negotiation: 'bg-amber-100 text-amber-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-rose-100 text-rose-700',
};

function formatFollowup(value?: string) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `Overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return `Today ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return `Tomorrow ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleDateString();
}

export function LeadTable({
  leads,
  selectedLeadIds,
  onToggleLead,
  onToggleAll,
  onOpenLead,
  onEditLead,
  onDeleteLead,
  onScheduleFollowup,
  allSelected,
}: LeadTableProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:hidden">
        {leads.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No leads found for the selected filters.
          </div>
        ) : (
          leads.map((lead) => (
            <button key={lead.id} type="button" className="rounded-lg border bg-background p-4 text-left shadow-sm" onClick={() => onOpenLead(lead.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{lead.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{lead.company || lead.email || lead.phone || '-'}</p>
                </div>
                <LeadScoreBadge score={lead.lead_score} size="sm" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{(lead.source || 'manual').replace('_', ' ')}</Badge>
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${pipelineTone[lead.pipeline_stage] || pipelineTone.new}`}>
                  {lead.pipeline_stage.replace('_', ' ')}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${priorityTone[lead.priority] || priorityTone.medium}`}>{lead.priority}</span>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <span>Outreach: {(lead.outreach_status || 'not_contacted').replace('_', ' ')}</span>
                <span>Follow-up: {formatFollowup(lead.next_followup_at)}</span>
                {lead.services_offered ? <span className="line-clamp-2">Services: {lead.services_offered}</span> : null}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox checked={allSelected} onCheckedChange={(checked) => onToggleAll(Boolean(checked))} />
            </TableHead>
            <TableHead>#</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Outreach</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Pipeline Stage</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Next Follow-up</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} className="py-12 text-center text-muted-foreground">
                No leads found for the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead, index) => (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpenLead(lead.id)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={selectedLeadIds.includes(lead.id)} onCheckedChange={(checked) => onToggleLead(lead.id, Boolean(checked))} />
                </TableCell>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      {lead.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.email || '-'}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone || '-'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{lead.company || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {(lead.source || 'manual').replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-xs">
                    <p className="capitalize">{(lead.outreach_status || 'not_contacted').replace('_', ' ')}</p>
                    <p className="text-muted-foreground">{lead.last_reachout_at ? new Date(lead.last_reachout_at).toLocaleDateString() : lead.outreach_channel || '-'}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${priorityTone[lead.priority] || priorityTone.medium}`}>{lead.priority}</span>
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${pipelineTone[lead.pipeline_stage] || pipelineTone.new}`}>
                    {lead.pipeline_stage.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell>
                  <LeadScoreBadge score={lead.lead_score} size="sm" />
                </TableCell>
                <TableCell>{lead.assigned_to_name || 'Unassigned'}</TableCell>
                <TableCell className={lead.next_followup_at && new Date(lead.next_followup_at) < new Date() ? 'text-rose-600' : ''}>{formatFollowup(lead.next_followup_at)}</TableCell>
                <TableCell>{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenLead(lead.id)}>
                      View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEditLead(lead)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onScheduleFollowup(lead.id)}>
                      Follow-up
                    </Button>
                    <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => onDeleteLead(lead.id)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
