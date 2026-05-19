import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, LayoutGrid, Plus, TableProperties, BarChart3, Upload, Download, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import type { CreateLeadPayload, FlexibleColumn, Lead, LeadFilters as LeadFiltersType } from '@/types/leads';
import { useAuth } from '@/contexts/AuthContext';
import { LeadStatsCards } from '@/components/leads/LeadStatsCards';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadsKanban } from '@/components/leads/LeadsKanban';
import { LeadsAnalytics } from '@/components/leads/LeadsAnalytics';
import { LeadFormModal } from '@/components/leads/LeadFormModal';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import { FlexibleSheetTable, type FlexibleSheetRow } from '@/components/leads/FlexibleSheetTable';
import { useLeads } from '@/hooks/leads/useLeads';
import { useLeadStats } from '@/hooks/leads/useLeadStats';
import { useLeadDetail } from '@/hooks/leads/useLeadDetail';
import { useLeadMutations } from '@/hooks/leads/useLeadMutations';
import { useFlexibleFollowupMutations, useFlexibleFollowups } from '@/hooks/leads/useFlexibleFollowups';

type LeadsView = 'table' | 'followups' | 'kanban' | 'analytics';

const pageSize = 25;

const emptyFilters: LeadFiltersType = {
  search: '',
};

const LEADS_COLUMNS_KEY = 'pmp.flexibleLeads.columns';
const FOLLOWUP_COLUMNS_KEY = 'pmp.flexibleFollowups.columns';

const defaultLeadColumns: FlexibleColumn[] = [
  { id: 'company_name', label: 'Company Name', systemField: 'company', type: 'text' },
  { id: 'niche', label: 'Niche', systemField: 'designation', type: 'text' },
  { id: 'service', label: 'Service', systemField: 'services_offered', type: 'text' },
  { id: 'platform_source', label: 'Platform Source', systemField: 'source', type: 'text' },
  { id: 'email', label: 'Gmail / Email', systemField: 'email', type: 'email' },
  { id: 'phone', label: 'Phone Number', systemField: 'phone', type: 'phone' },
  { id: 'website', label: 'Website', systemField: 'website', type: 'url' },
  { id: 'linkedin', label: 'LinkedIn', systemField: 'linkedin_url', type: 'url' },
  { id: 'facebook', label: 'Facebook', systemField: 'facebook_url', type: 'url' },
  { id: 'insta', label: 'Insta', systemField: 'instagram_url', type: 'url' },
  { id: 'status', label: 'Status', systemField: 'status', type: 'status' },
];

const defaultFollowupColumns: FlexibleColumn[] = [
  'Client Name',
  'Company',
  'Email Address',
  'Industry / Niche',
  'Problem Identified',
  'Email Sent Date',
  'Subject Line',
  'Follow-Up 1',
  'Follow-Up 2',
  'Follow-Up 3',
  'Breakup Email',
  'BusinEmail',
  'Email Opened?',
  'Replied?',
  'Status',
  'Notes',
].map((label) => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
  label,
  type: label.includes('Date') ? 'date' : label.includes('?') ? 'boolean' : 'text',
}));

function loadColumns(key: string, fallback: FlexibleColumn[]) {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeSourceValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const allowed = ['manual', 'facebook', 'instagram', 'x', 'linkedin', 'whatsapp', 'website', 'referral', 'cold_call', 'email_campaign'];
  return (allowed.includes(normalized) ? normalized : 'manual') as CreateLeadPayload['source'];
}

function normalizeStatusValue(value: string | undefined, fallback: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  return ['new', 'contacted', 'qualified', 'converted', 'lost'].includes(normalized) ? normalized : fallback;
}

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
  const { user, hasPermission } = useAuth();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<LeadsView>('table');
  const [filters, setFilters] = useState<LeadFiltersType>(emptyFilters);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [leadColumns, setLeadColumns] = useState<FlexibleColumn[]>(() => loadColumns(LEADS_COLUMNS_KEY, defaultLeadColumns));
  const [followupColumns, setFollowupColumns] = useState<FlexibleColumn[]>(() => loadColumns(FOLLOWUP_COLUMNS_KEY, defaultFollowupColumns));
  const [followupSearch, setFollowupSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string>();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const canCreateLead = hasPermission('leads.create');
  const canUpdateLead = hasPermission('leads.update');
  const canDeleteLead = hasPermission('leads.delete');
  const canImportLeads = hasPermission('leads.import');
  const canViewFollowups = hasPermission('leads.followups.view');
  const canCreateFollowups = hasPermission('leads.followups.create');
  const canUpdateFollowups = hasPermission('leads.followups.update');
  const canDeleteFollowups = hasPermission('leads.followups.delete');

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
  const followupQuery = useFlexibleFollowups(selectedOwnerId || undefined, followupSearch);
  const followupMutations = useFlexibleFollowupMutations();

  const leads = leadsResponse?.data || [];
  const allLeads = allLeadsResponse?.data || leads;
  const total = leadsResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const availableTags = useMemo(
    () => [...new Set(allLeads.flatMap((lead: Lead) => (lead.lead_tags || []).map((tag) => tag.tag_name)))].sort(),
    [allLeads]
  );
  const allSelected = leads.length > 0 && leads.every((lead) => selectedLeadIds.includes(lead.id));
  const roleName = user?.role?.name?.toLowerCase().replace(/_/g, ' ') || '';
  const canViewAllLeads = roleName.includes('admin') || hasPermission('leads.view.all');
  const ownerOptions = assignedUsers.length ? assignedUsers : user ? [{ id: String(user.id), name: user.name || user.email || 'Me' }] : [];

  React.useEffect(() => {
    localStorage.setItem(LEADS_COLUMNS_KEY, JSON.stringify(leadColumns));
  }, [leadColumns]);

  React.useEffect(() => {
    localStorage.setItem(FOLLOWUP_COLUMNS_KEY, JSON.stringify(followupColumns));
  }, [followupColumns]);

  React.useEffect(() => {
    setPage(1);
    setFilters((current) => ({ ...current, owner_id: selectedOwnerId || undefined }));
  }, [selectedOwnerId]);

  React.useEffect(() => {
    if (view === 'followups' && !canViewFollowups) {
      setView('table');
    }
  }, [canViewFollowups, view]);

  const openLead = (leadId: string) => {
    setActiveLeadId(leadId);
    setLeadDrawerOpen(true);
  };

  const handleCreateOrUpdate = (payload: CreateLeadPayload) => {
    if (editingLead) {
      if (!canUpdateLead) return;
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

    if (!canCreateLead) return;
    mutations.createLead.mutate(payload, {
      onSuccess: () => {
        setLeadFormOpen(false);
      },
    });
  };

  const leadRows: FlexibleSheetRow[] = leads.map((lead) => ({
    id: lead.id,
    ownerName: lead.created_by_name || lead.created_by_email,
    raw: lead,
    values: leadColumns.reduce<Record<string, string>>((acc, column) => {
      if (column.id === 'company_name') acc[column.id] = lead.company || lead.name || '';
      else if (column.systemField) acc[column.id] = String((lead as unknown as Record<string, unknown>)[column.systemField as string] ?? '');
      else acc[column.id] = String(lead.custom_fields?.[column.id] ?? '');
      return acc;
    }, {}),
  }));

  const saveLeadRow = (_rowId: string, values: Record<string, string>, raw?: unknown) => {
    if (!canUpdateLead) return;
    const lead = raw as Lead | undefined;
    if (!lead) return;
    const custom_fields = leadColumns.reduce<Record<string, string>>((acc, column) => {
      if (!column.systemField) acc[column.id] = values[column.id] || '';
      return acc;
    }, {});

    mutations.updateLead.mutate({
      id: lead.id,
      data: {
        name: values.company_name || lead.name,
        company: values.company_name || undefined,
        designation: values.niche || undefined,
        services_offered: values.service || undefined,
        source: normalizeSourceValue(values.platform_source || lead.source || 'manual'),
        email: values.email || undefined,
        phone: values.phone || undefined,
        website: values.website || undefined,
        linkedin_url: values.linkedin || undefined,
        facebook_url: values.facebook || undefined,
        instagram_url: values.insta || undefined,
        status: normalizeStatusValue(values.status, lead.status),
        pipeline_stage: lead.pipeline_stage,
        priority: lead.priority,
        lead_score: lead.lead_score,
        custom_fields,
      },
    });
  };

  const addLeadRow = () => {
    if (!canCreateLead) return;
    const stamp = new Date().toLocaleString();
    mutations.createLead.mutate({
      name: `New Lead ${stamp}`,
      source: 'manual',
      priority: 'medium',
      pipeline_stage: 'new',
      lead_score: 0,
      custom_fields: {},
    });
  };

  const followupRows: FlexibleSheetRow[] = (followupQuery.data?.data || []).map((row) => ({
    id: row.id,
    ownerName: row.owner_name || row.owner_email,
    raw: row,
    values: followupColumns.reduce<Record<string, string>>((acc, column) => {
      acc[column.id] = String(row.data?.[column.id] ?? row.data?.[column.label] ?? '');
      return acc;
    }, {}),
  }));

  const handleDeleteLead = (leadId: string) => {
    if (!canDeleteLead) return;
    const lead = allLeads.find((item: Lead) => item.id === leadId);
    Swal.fire({
      title: 'Delete Lead?',
      text: `Are you sure you want to delete lead "${lead?.name || leadId}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        mutations.deleteLead.mutate(leadId, {
          onSuccess: () => {
            if (activeLeadId === leadId) {
              setLeadDrawerOpen(false);
              setActiveLeadId(undefined);
            }
          },
        });
      }
    });
  };

  const handleBulkAction = () => {
    if (!selectedLeadIds.length || !bulkAction) return;
    if (bulkAction === 'delete') {
      if (!canDeleteLead) return;
      Swal.fire({
        title: 'Delete Selected Leads?',
        text: `Are you sure you want to delete ${selectedLeadIds.length} selected leads?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete them!'
      }).then((result) => {
        if (result.isConfirmed) {
          mutations.bulkDelete.mutate(selectedLeadIds, { onSuccess: () => setSelectedLeadIds([]) });
        }
      });
      return;
    }
    if (bulkAction === 'assign' && bulkAssignTo) {
      if (!canUpdateLead) return;
      mutations.bulkAssign.mutate({ leadIds: selectedLeadIds, userId: bulkAssignTo }, { onSuccess: () => setSelectedLeadIds([]) });
      return;
    }
    if (bulkAction.startsWith('status:')) {
      if (!canUpdateLead) return;
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
            <h1 className="text-3xl font-semibold tracking-tight">Lead pipeline, follow-ups, analytics and sales hygiene in one place.</h1>
            <p className="text-sm text-white/80">
              Manage the complete lead lifecycle with Table, Kanban and Analytics views. Search, filters, bulk actions and Supabase-backed CRM flow all in this module.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              mutations.importLeads.mutate(file);
              event.target.value = '';
            }} />
            {canImportLeads ? (
              <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={mutations.importLeads.isPending}>
                <Upload className="mr-2 h-4 w-4" />
                {mutations.importLeads.isPending ? 'Importing...' : 'Import CSV'}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => downloadCsv(selectedLeadIds.length ? allLeads.filter((lead: Lead) => selectedLeadIds.includes(lead.id)) : allLeads)}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            {canCreateLead ? (
              <Button onClick={() => { setEditingLead(null); setLeadFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Lead
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <LeadStatsCards stats={stats} />

      <Card className="min-w-0 overflow-hidden border-slate-200/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle>Lead Workspace</CardTitle>
            <Tabs value={view} onValueChange={(value) => setView(value as LeadsView)}>
              <TabsList className="grid h-auto grid-cols-2 gap-1 sm:grid-cols-4">
                <TabsTrigger value="table"><TableProperties className="mr-2 h-4 w-4" />Leads</TabsTrigger>
                {canViewFollowups ? <TabsTrigger value="followups"><ListChecks className="mr-2 h-4 w-4" />Follow-ups</TabsTrigger> : null}
                <TabsTrigger value="kanban"><LayoutGrid className="mr-2 h-4 w-4" />Kanban</TabsTrigger>
                <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
              </TabsList>
            </Tabs>
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
            {canViewAllLeads ? (
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={selectedOwnerId}
                onChange={(event) => setSelectedOwnerId(event.target.value)}
              >
                <option value="">All Users</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            ) : null}
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
                  {canDeleteLead ? <option value="delete">Delete</option> : null}
                  {canUpdateLead ? <option value="status:new">Change Status: New</option> : null}
                  {canUpdateLead ? <option value="status:contacted">Change Status: Contacted</option> : null}
                  {canUpdateLead ? <option value="status:qualified">Change Status: Qualified</option> : null}
                  {canUpdateLead ? <option value="status:converted">Change Status: Converted</option> : null}
                  {canUpdateLead ? <option value="status:lost">Change Status: Lost</option> : null}
                  {canUpdateLead ? <option value="assign">Assign To</option> : null}
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
              <FlexibleSheetTable
                title="Editable Leads Sheet"
                columns={leadColumns}
                rows={leadRows}
                showOwner={canViewAllLeads}
                emptyText="No leads found for the selected filters."
                onColumnsChange={setLeadColumns}
                onSaveRow={canUpdateLead ? saveLeadRow : undefined}
                onAddRow={canCreateLead ? addLeadRow : undefined}
                onDeleteRow={canDeleteLead ? handleDeleteLead : undefined}
                canAdd={canCreateLead}
                canEdit={canUpdateLead}
                canDelete={canDeleteLead}
                canManageColumns={canUpdateLead}
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

          {view === 'followups' ? (
            <div className="space-y-4">
              <Input
                value={followupSearch}
                onChange={(event) => setFollowupSearch(event.target.value)}
                placeholder="Search follow-ups"
                className="max-w-md"
              />
              <FlexibleSheetTable
                title="Editable Follow-up Sheet"
                columns={followupColumns}
                rows={followupRows}
                showOwner={canViewAllLeads}
                emptyText={followupQuery.isLoading ? 'Loading follow-ups...' : 'No follow-up rows found.'}
                onColumnsChange={setFollowupColumns}
                onSaveRow={canUpdateFollowups ? (rowId, values) =>
                  followupMutations.updateFollowup.mutate({
                    id: rowId,
                    data: { data: values, status: values.status || values.Status },
                  })
                : undefined}
                onAddRow={canCreateFollowups ? () => followupMutations.createFollowup.mutate({ data: {} }) : undefined}
                onDeleteRow={canDeleteFollowups ? (rowId) => followupMutations.deleteFollowup.mutate(rowId) : undefined}
                canAdd={canCreateFollowups}
                canEdit={canUpdateFollowups}
                canDelete={canDeleteFollowups}
                canManageColumns={canUpdateFollowups}
              />
            </div>
          ) : null}

          {view === 'kanban' ? (
            <LeadsKanban
              leads={allLeads}
              onOpenLead={openLead}
              canMove={canUpdateLead}
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
