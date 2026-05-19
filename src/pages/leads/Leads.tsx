import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, LayoutGrid, Plus, TableProperties, BarChart3, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import type { CreateLeadPayload, Lead, LeadFilters as LeadFiltersType, PipelineStage } from '@/types/leads';
import { LeadStatsCards } from '@/components/leads/LeadStatsCards';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadsKanban } from '@/components/leads/LeadsKanban';
import { LeadsAnalytics } from '@/components/leads/LeadsAnalytics';
import { LeadFormModal } from '@/components/leads/LeadFormModal';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import { useLeads } from '@/hooks/leads/useLeads';
import { useLeadStats } from '@/hooks/leads/useLeadStats';
import { useLeadDetail } from '@/hooks/leads/useLeadDetail';
import { useLeadMutations } from '@/hooks/leads/useLeadMutations';

type LeadsView = 'table' | 'kanban' | 'analytics';

const pageSize = 25;

const emptyFilters: LeadFiltersType = {
  search: '',
};

function downloadCsv(rows: Lead[]) {
  const headers = ['name', 'email', 'phone', 'company', 'website', 'linkedin_url', 'facebook_url', 'instagram_url', 'x_url', 'services_offered', 'source', 'priority', 'pipeline_stage', 'outreach_status', 'outreach_channel', 'last_reachout_at', 'followup_sent_at', 'lead_score', 'budget', 'close_value', 'next_followup_at'];
  const csv = [
    headers.join(','),
    ...rows.map((lead) =>
      headers
        .map((header) => {
          const value = String((lead as unknown as Record<string, unknown>)[header] ?? '').replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const Leads: React.FC = () => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<LeadsView>('table');
  const [filters, setFilters] = useState<LeadFiltersType>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string>();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkAssignTo, setBulkAssignTo] = useState('');

  const { data: usersResponse } = useQuery({
    queryKey: ['lead-users'],
    queryFn: async () => api.getUsers(),
  });

  const assignedUsers = useMemo(
    () =>
      (usersResponse?.data || []).map((user: any) => ({
        id: String(user.id),
        name: user.name || user.email || 'User',
      })),
    [usersResponse?.data]
  );

  const { data: leadsResponse, isLoading } = useLeads(filters, page, pageSize);
  const { data: allLeadsResponse } = useQuery({
    queryKey: ['leads-all', filters],
    queryFn: async () => api.getLeads({ ...filters, page: 1, pageSize: 500 }),
  });
  const { data: stats } = useLeadStats();
  const { data: leadDetail, isLoading: leadDetailLoading } = useLeadDetail(activeLeadId);
  const mutations = useLeadMutations();

  const leads = leadsResponse?.data || [];
  const allLeads = allLeadsResponse?.data || leads;
  const total = leadsResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const availableTags = useMemo(
    () => [...new Set(allLeads.flatMap((lead: Lead) => (lead.lead_tags || []).map((tag) => tag.tag_name)))].sort(),
    [allLeads]
  );
  const allSelected = leads.length > 0 && leads.every((lead) => selectedLeadIds.includes(lead.id));

  const openLead = (leadId: string) => {
    setActiveLeadId(leadId);
    setLeadDrawerOpen(true);
  };

  const handleCreateOrUpdate = (payload: CreateLeadPayload) => {
    if (editingLead) {
      mutations.updateLead.mutate(
        { id: editingLead.id, data: payload },
        {
          onSuccess: () => {
            setLeadFormOpen(false);
            setEditingLead(null);
          },
        }
      );
      return;
    }

    mutations.createLead.mutate(payload, {
      onSuccess: () => {
        setLeadFormOpen(false);
      },
    });
  };

  const handleDeleteLead = (leadId: string) => {
    const lead = allLeads.find((item: Lead) => item.id === leadId);
    if (!window.confirm(`Delete lead "${lead?.name || leadId}"?`)) return;
    mutations.deleteLead.mutate(leadId, {
      onSuccess: () => {
        if (activeLeadId === leadId) {
          setLeadDrawerOpen(false);
          setActiveLeadId(undefined);
        }
      },
    });
  };

  const handleBulkAction = () => {
    if (!selectedLeadIds.length || !bulkAction) return;
    if (bulkAction === 'delete') {
      if (!window.confirm(`Delete ${selectedLeadIds.length} selected leads?`)) return;
      mutations.bulkDelete.mutate(selectedLeadIds, { onSuccess: () => setSelectedLeadIds([]) });
      return;
    }
    if (bulkAction === 'assign' && bulkAssignTo) {
      mutations.bulkAssign.mutate({ leadIds: selectedLeadIds, userId: bulkAssignTo }, { onSuccess: () => setSelectedLeadIds([]) });
      return;
    }
    if (bulkAction.startsWith('status:')) {
      mutations.bulkUpdateStatus.mutate(
        { leadIds: selectedLeadIds, status: bulkAction.replace('status:', '') },
        { onSuccess: () => setSelectedLeadIds([]) }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-gradient-to-r from-slate-950 via-teal-900 to-cyan-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-2">
            <Badge className="bg-white/15 text-white hover:bg-white/20">CRM Grade Leads</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Lead pipeline, follow-ups, analytics aur sales hygiene ek jagah.</h1>
            <p className="text-sm text-white/80">
              Table, Kanban aur Analytics views ke saath poora lead lifecycle manage karo. Search, filters, bulk actions aur Supabase-backed CRM flow ab isi module mein hai.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              mutations.importLeads.mutate(file);
              event.target.value = '';
            }} />
            <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={mutations.importLeads.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {mutations.importLeads.isPending ? 'Importing...' : 'Import CSV'}
            </Button>
            <Button variant="secondary" onClick={() => downloadCsv(selectedLeadIds.length ? allLeads.filter((lead: Lead) => selectedLeadIds.includes(lead.id)) : allLeads)}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => { setEditingLead(null); setLeadFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Button>
          </div>
        </div>
      </div>

      <LeadStatsCards stats={stats} />

      <Card className="min-w-0 overflow-hidden border-slate-200/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle>Lead Workspace</CardTitle>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button className="w-full" variant={view === 'table' ? 'default' : 'outline'} onClick={() => setView('table')}>
                <TableProperties className="mr-2 h-4 w-4" />
                Table View
              </Button>
              <Button className="w-full" variant={view === 'kanban' ? 'default' : 'outline'} onClick={() => setView('kanban')}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Kanban View
              </Button>
              <Button className="w-full" variant={view === 'analytics' ? 'default' : 'outline'} onClick={() => setView('analytics')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics View
              </Button>
            </div>
          </div>

          <div className="grid w-full min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-8">
            <Input
              value={filters.search || ''}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, search: event.target.value }));
              }}
              placeholder="Search by lead, email, phone, company or designation"
              className="min-w-0 lg:col-span-3 2xl:col-span-2"
            />
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.status?.[0] || ''}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, status: event.target.value ? [event.target.value] : undefined }));
              }}
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.source?.[0] || ''}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, source: event.target.value ? [event.target.value as any] : undefined }));
              }}
            >
              <option value="">All Source</option>
              <option value="manual">Manual</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="x">X / Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="cold_call">Cold Call</option>
              <option value="email_campaign">Email Campaign</option>
            </select>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.priority?.[0] || ''}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, priority: event.target.value ? [event.target.value as any] : undefined }));
              }}
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.assigned_to?.[0] || ''}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, assigned_to: event.target.value ? [event.target.value] : undefined }));
              }}
            >
              <option value="">All Assigned</option>
              {assignedUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <Input className="w-full min-w-0" type="date" value={filters.date_from || ''} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value || undefined }))} />
            <Input className="w-full min-w-0" type="date" value={filters.date_to || ''} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value || undefined }))} />
            <Button className="w-full" variant="outline" onClick={() => setShowFilters((current) => !current)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {selectedLeadIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-3 xl:flex-row xl:items-center xl:justify-between">
              <p className="text-sm font-medium">{selectedLeadIds.length} leads selected</p>
              <div className="flex flex-wrap gap-2">
                <select className="rounded-md border bg-background px-3 py-2" value={bulkAction} onChange={(event) => setBulkAction(event.target.value)}>
                  <option value="">Bulk Action</option>
                  <option value="delete">Delete</option>
                  <option value="status:new">Change Status: New</option>
                  <option value="status:contacted">Change Status: Contacted</option>
                  <option value="status:qualified">Change Status: Qualified</option>
                  <option value="status:converted">Change Status: Converted</option>
                  <option value="status:lost">Change Status: Lost</option>
                  <option value="assign">Assign To</option>
                </select>
                {bulkAction === 'assign' ? (
                  <select className="rounded-md border bg-background px-3 py-2" value={bulkAssignTo} onChange={(event) => setBulkAssignTo(event.target.value)}>
                    <option value="">Choose user</option>
                    {assignedUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Button onClick={handleBulkAction}>Apply</Button>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {showFilters ? (
            <LeadFilters value={filters} onChange={(next) => { setPage(1); setFilters(next); }} assignedUsers={assignedUsers} availableTags={availableTags} />
          ) : null}

          {view === 'table' ? (
            <>
              <LeadTable
                leads={leads}
                selectedLeadIds={selectedLeadIds}
                allSelected={allSelected}
                onToggleLead={(leadId, checked) => {
                  setSelectedLeadIds((current) => (checked ? [...new Set([...current, leadId])] : current.filter((item) => item !== leadId)));
                }}
                onToggleAll={(checked) => setSelectedLeadIds(checked ? leads.map((lead) => lead.id) : [])}
                onOpenLead={openLead}
                onEditLead={(lead) => {
                  setEditingLead(lead);
                  setLeadFormOpen(true);
                }}
                onDeleteLead={handleDeleteLead}
                onScheduleFollowup={openLead}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {isLoading ? 'Loading leads...' : `Showing page ${page} of ${totalPages} · ${total} total leads`}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {view === 'kanban' ? (
            <LeadsKanban
              leads={allLeads}
              onOpenLead={openLead}
              onMoveLead={(leadId, stage) =>
                mutations.updateLead.mutate({
                  id: leadId,
                  data: {
                    pipeline_stage: stage,
                    status: stage === 'won' ? 'converted' : stage === 'lost' ? 'lost' : stage,
                  },
                })
              }
            />
          ) : null}

          {view === 'analytics' ? <LeadsAnalytics stats={stats} leads={allLeads} /> : null}
        </CardContent>
      </Card>

      <LeadFormModal
        open={leadFormOpen}
        onOpenChange={(open) => {
          setLeadFormOpen(open);
          if (!open) setEditingLead(null);
        }}
        onSubmit={handleCreateOrUpdate}
        loading={mutations.createLead.isPending || mutations.updateLead.isPending}
        users={assignedUsers}
        lead={editingLead}
      />

      <LeadDetailDrawer
        open={leadDrawerOpen}
        onOpenChange={setLeadDrawerOpen}
        lead={leadDetail}
        loading={leadDetailLoading}
        onDelete={handleDeleteLead}
        onAddActivity={(leadId, payload) => mutations.addActivity.mutate({ leadId, payload })}
        onAddNote={(leadId, content) => mutations.addNote.mutate({ leadId, content })}
        onScheduleFollowup={(leadId, payload) => mutations.scheduleFollowup.mutate({ leadId, payload })}
        onCompleteFollowup={(followupId, notes) => mutations.completeFollowup.mutate({ followupId, notes })}
        onAddTag={(leadId, tag) => mutations.addTag.mutate({ leadId, tagName: tag })}
        onRemoveTag={(leadId, tag) => mutations.removeTag.mutate({ leadId, tagName: tag })}
      />
    </div>
  );
};

export default Leads;
