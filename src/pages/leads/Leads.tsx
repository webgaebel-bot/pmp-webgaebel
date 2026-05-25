import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, LayoutGrid, Plus, TableProperties, BarChart3, Download, ChevronLeft, ChevronRight, ListChecks, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DynamicOption } from '@/components/common/DynamicSelect';
import { ModuleEmptyState, ModuleErrorState, ModuleLoadingState } from '@/components/common/ModuleState';
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
import { useNavigate } from 'react-router-dom';

type LeadsView = 'table' | 'followups' | 'kanban' | 'analytics';

const pageSize = 1000;
const defaultSheetRowCount = 1000;

const emptyFilters: LeadFiltersType = {
  search: '',
};

const LEADS_COLUMNS_KEY = 'pmp.flexibleLeads.columns';
const FOLLOWUP_COLUMNS_KEY = 'pmp.flexibleFollowups.columns';
const CUSTOM_NICHES_KEY = 'pmp.leads.customNiches';
const CUSTOM_SERVICES_KEY = 'pmp.leads.customServices';

const defaultStatusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const defaultSourceOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'email_campaign', label: 'Email Campaign' },
];

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
  const orderedRows = [...rows].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  });
  const headers = ['created_at', 'updated_at', 'name', 'email', 'phone', 'company', 'website', 'linkedin_url', 'facebook_url', 'instagram_url', 'x_url', 'services_offered', 'source', 'priority', 'pipeline_stage', 'outreach_status', 'outreach_channel', 'last_reachout_at', 'followup_sent_at', 'lead_score', 'budget', 'close_value', 'next_followup_at'];
  const csv = [
    headers.join(','),
    ...orderedRows.map((lead) =>
      headers
        .map((header) => {
          const rawValue =
            header === 'source'
              ? getLeadPlatformSourceValue(lead)
              : (lead as unknown as Record<string, unknown>)[header] ?? '';
          const value = String(rawValue).replace(/"/g, '""');
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

function filterRowsByDateRange(rows: Lead[], dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return rows;
  const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  return rows.filter((lead) => {
    const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : 0;
    return createdAt >= fromTime && createdAt <= toTime;
  });
}

function getLeadPlatformSourceValue(lead: Lead) {
  const customSource = String((lead.custom_fields as Record<string, unknown> | undefined)?.platform_source || '').trim();
  if (lead.source === 'manual' && customSource) {
    return customSource;
  }
  return lead.source || '';
}

function getStableBlankRowId(
  rowIdsRef: React.MutableRefObject<string[]>,
  prefix: string,
  index: number
) {
  if (!rowIdsRef.current[index]) {
    rowIdsRef.current[index] = `${prefix}-${index + 1}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return rowIdsRef.current[index];
}

const Leads: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement>(null);
  const blankRowLeadIds = useRef<Record<string, string>>({});
  const blankRowFollowupIds = useRef<Record<string, string>>({});
  const leadBlankRowIds = useRef<string[]>([]);
  const followupBlankRowIds = useRef<string[]>([]);
  const pendingBlankRows = useRef<Record<string, boolean>>({});
  const pendingBlankFollowupRows = useRef<Record<string, boolean>>({});
  const queuedBlankValues = useRef<Record<string, Record<string, string>>>({});
  const queuedBlankFollowupValues = useRef<Record<string, Record<string, string>>>({});
  const shownAutosaveErrors = useRef<Record<string, number>>({});
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
  const [leadRowWarnings, setLeadRowWarnings] = useState<Record<string, string>>({});
  const [sheetFullscreen, setSheetFullscreen] = useState<'leads' | 'followups' | null>(null);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const navigate = useNavigate();
  const [sheetRowCount, setSheetRowCount] = useState(defaultSheetRowCount);
  const [followupSheetRowCount, setFollowupSheetRowCount] = useState(defaultSheetRowCount);
  const { data: taxonomiesResponse } = useQuery({
    queryKey: ['lead-taxonomies'],
    queryFn: async () => api.get('/leads/taxonomies?active=true'),
  });
  const taxonomies = taxonomiesResponse?.data || [];
  const dbNiches = useMemo(() => taxonomies.filter((t: any) => t.taxonomy_type === 'niche'), [taxonomies]);
  const dbServices = useMemo(() => taxonomies.filter((t: any) => t.taxonomy_type === 'service'), [taxonomies]);
  const customNiches = useMemo(() => dbNiches.map((t: any) => t.name), [dbNiches]);
  const customServices = useMemo(() => dbServices.map((t: any) => t.name), [dbServices]);
  
  const canCreateLead = hasPermission('leads.create');
  const canUpdateLead = hasPermission('leads.update');
  const canDeleteLead = hasPermission('leads.delete');
  const canImportLeads = hasPermission('leads.import');
  const canViewFollowups = hasPermission('leads.followups.view');
  const canCreateFollowups = hasPermission('leads.followups.create');
  const canUpdateFollowups = hasPermission('leads.followups.update');
  const canDeleteFollowups = hasPermission('leads.followups.delete');
  const canManageTaxonomies = hasPermission('leads.taxonomies.manage');
  const canCreateNiches = canManageTaxonomies;

  const { data: usersResponse } = useQuery({
    queryKey: ['lead-users'],
    queryFn: async () => api.getUsers(),
  });
  const { data: projectsResponse } = useQuery({
    queryKey: ['lead-projects'],
    queryFn: async () => api.getProjects(),
  });

  const assignedUsers = useMemo(
    () =>
      (usersResponse?.data || []).map((user: any) => ({
        id: String(user.id),
        name: user.name || user.email || 'User',
      })),
    [usersResponse?.data]
  );
  const assignedProjects = useMemo(
    () =>
      (projectsResponse?.data || []).map((project: any) => ({
        id: String(project.id),
        name: project.name || 'Project',
      })),
    [projectsResponse?.data]
  );

  const {
    data: leadsResponse,
    isLoading,
    isFetching,
    isError: isLeadsError,
    error: leadsError,
    refetch: refetchLeads,
  } = useLeads(filters, page, pageSize);
  const { data: allLeadsResponse } = useQuery({
    queryKey: ['leads-all', filters],
    queryFn: async () => api.getLeads({ ...filters, page: 1, pageSize: 1000 }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const {
    data: stats,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useLeadStats();
  const { data: leadDetail, isLoading: leadDetailLoading } = useLeadDetail(activeLeadId);
  const mutations = useLeadMutations();
  const followupQuery = useFlexibleFollowups(selectedOwnerId || undefined, followupSearch);
  const followupMutations = useFlexibleFollowupMutations();

  const leads = leadsResponse?.data || [];
  const isLeadSheetLoading = isLoading || (isFetching && !leadsResponse);
  const allLeads = allLeadsResponse?.data || leads;
  const total = leadsResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const availableTags = useMemo(
    () => [...new Set(allLeads.flatMap((lead: Lead) => (lead.lead_tags || []).map((tag) => tag.tag_name)))].sort(),
    [allLeads]
  );
  const allSelected = leads.length > 0 && leads.every((lead) => selectedLeadIds.includes(lead.id));
  const bulkActionLoading = mutations.bulkDelete.isPending || mutations.bulkAssign.isPending || mutations.bulkUpdateStatus.isPending;
  const canViewAllLeads = hasPermission('leads.view.all');
  const ownerOptions = assignedUsers.length ? assignedUsers : user ? [{ id: String(user.id), name: user.name || user.email || 'Me' }] : [];
  const nicheOptions = useMemo<DynamicOption[]>(() => {
    const values = new Map<string, DynamicOption>();
    dbNiches.forEach((item: any) => {
      const key = item.name.toLowerCase();
      values.set(key, { value: item.name, label: item.name });
    });
    allLeads.forEach((lead: Lead) => {
      if (lead.designation) {
        const val = lead.designation.trim();
        const key = val.toLowerCase();
        if (!values.has(key)) {
          values.set(key, { value: val, label: val });
        }
      }
    });
    return Array.from(values.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allLeads, dbNiches]);

  const serviceOptions = useMemo<DynamicOption[]>(() => {
    const values = new Map<string, DynamicOption>();
    dbServices.forEach((item: any) => {
      const key = item.name.toLowerCase();
      values.set(key, { value: item.name, label: item.name });
    });
    allLeads.forEach((lead: Lead) => {
      if (lead.services_offered) {
        const val = lead.services_offered.trim();
        const key = val.toLowerCase();
        if (!values.has(key)) {
          values.set(key, { value: val, label: val });
        }
      }
    });
    return Array.from(values.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allLeads, dbServices]);

  const leadColumnsWithOptions = useMemo(() =>
    leadColumns.map((column) => {
      const lowerId = column.id.toLowerCase();
      const lowerLabel = column.label.toLowerCase();
      if (lowerId === 'niche' || lowerId === 'designation' || lowerId.includes('niche') || lowerLabel.includes('niche') || lowerLabel.includes('industry')) {
        return { ...column, options: nicheOptions };
      }
      if (lowerId === 'service' || lowerId === 'services_offered' || lowerId.includes('service') || lowerLabel.includes('service')) {
        return { ...column, options: serviceOptions };
      }
      if (column.id === 'status' || lowerLabel === 'status') {
        return { ...column, options: defaultStatusOptions };
      }
      return column;
    }),
  [leadColumns, nicheOptions, serviceOptions]);

  const followupColumnsWithOptions = useMemo(() =>
    followupColumns.map((column) => {
      const lowerId = column.id.toLowerCase();
      const lowerLabel = column.label.toLowerCase();
      if (lowerId.includes('niche') || lowerId.includes('industry') || lowerLabel.includes('niche') || lowerLabel.includes('industry')) {
        return { ...column, options: nicheOptions };
      }
      if (lowerId.includes('service') || lowerLabel.includes('service')) {
        return { ...column, options: serviceOptions };
      }
      if (lowerId === 'status' || lowerLabel === 'status') {
        return { ...column, options: defaultStatusOptions };
      }
      return column;
    }),
  [followupColumns, nicheOptions, serviceOptions]);

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

  React.useEffect(() => {
    if (!sheetFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetFullscreen]);

  React.useEffect(() => {
    if (view !== 'table' && sheetFullscreen === 'leads') {
      setSheetFullscreen(null);
    }
    if (view !== 'followups' && sheetFullscreen === 'followups') {
      setSheetFullscreen(null);
    }
  }, [sheetFullscreen, view]);

  const openLead = (leadId: string) => {
    setActiveLeadId(leadId);
    setLeadDrawerOpen(true);
  };

  const handleCreateNiche = async (niche: string) => {
    const value = niche.trim();
    if (!value || !canManageTaxonomies) return;
    try {
      await api.post('/leads/taxonomies', { name: value, taxonomy_type: 'niche' });
      Swal.fire({
        title: 'Success',
        text: 'Niche created successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to create niche.', 'error');
    }
  };

  const handleCreateService = async (service: string) => {
    const value = service.trim();
    if (!value || !canManageTaxonomies) return;
    try {
      await api.post('/leads/taxonomies', { name: value, taxonomy_type: 'service' });
      Swal.fire({
        title: 'Success',
        text: 'Service created successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to create service.', 'error');
    }
  };

  const handleRemoveNiche = async (value: string) => {
    if (!canManageTaxonomies) return;
    const found = dbNiches.find((t: any) => t.name.toLowerCase() === value.toLowerCase());
    if (!found) return;
    try {
      await api.delete(`/leads/taxonomies/${found.id}`);
      Swal.fire({
        title: 'Deleted',
        text: 'Niche deleted successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to delete niche.', 'error');
    }
  };

  const handleRemoveService = async (value: string) => {
    if (!canManageTaxonomies) return;
    const found = dbServices.find((t: any) => t.name.toLowerCase() === value.toLowerCase());
    if (!found) return;
    try {
      await api.delete(`/leads/taxonomies/${found.id}`);
      Swal.fire({
        title: 'Deleted',
        text: 'Service deleted successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to delete service.', 'error');
    }
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

  const handleExportLeads = async () => {
    const baseRows = selectedLeadIds.length ? allLeads.filter((lead: Lead) => selectedLeadIds.includes(lead.id)) : allLeads;
    const result = await Swal.fire({
      title: 'Export leads',
      html: `
        <div style="display:grid;gap:12px;text-align:left;">
          <label style="display:grid;gap:6px;">
            <span>From date</span>
            <input id="export-date-from" type="date" class="swal2-input" style="width:100%;margin:0;" value="${filters.date_from || ''}">
          </label>
          <label style="display:grid;gap:6px;">
            <span>To date</span>
            <input id="export-date-to" type="date" class="swal2-input" style="width:100%;margin:0;" value="${filters.date_to || ''}">
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Export CSV',
      confirmButtonColor: '#0f766e',
      preConfirm: () => ({
        from: (document.getElementById('export-date-from') as HTMLInputElement | null)?.value || '',
        to: (document.getElementById('export-date-to') as HTMLInputElement | null)?.value || '',
      }),
    });

    if (!result.isConfirmed) return;

    const filteredRows = filterRowsByDateRange(baseRows, result.value?.from, result.value?.to);
    downloadCsv(filteredRows);
  };

  const leadRows: FlexibleSheetRow[] = useMemo(() => {
    const dataRows = leads.map((lead) => ({
      id: lead.id,
      ownerName: lead.created_by_name || lead.created_by_email,
      raw: lead,
      values: leadColumns.reduce<Record<string, string>>((acc, column) => {
        if (column.id === 'company_name') acc[column.id] = lead.company || lead.name || '';
        else if (column.systemField === 'source') acc[column.id] = getLeadPlatformSourceValue(lead);
        else if (column.systemField) acc[column.id] = String((lead as unknown as Record<string, unknown>)[column.systemField as string] ?? '');
        else acc[column.id] = String(lead.custom_fields?.[column.id] ?? '');
        return acc;
      }, {}),
    }));

    const dataLeadIds = new Set(dataRows.map((row) => String(row.id)));
    const blankRows = Array.from({ length: Math.max(sheetRowCount - dataRows.length, 0) }, (_, index) => ({
      id: getStableBlankRowId(leadBlankRowIds, `lead-page-${page}`, index),
      ownerName: '',
      raw: null,
      values: {},
    })).filter((row) => {
      const mappedLeadId = blankRowLeadIds.current[row.id];
      return !mappedLeadId || !dataLeadIds.has(String(mappedLeadId));
    });

    return [...dataRows, ...blankRows];
  }, [leadColumns, leads, page, sheetRowCount]);

  const buildLeadPayloadFromRow = (values: Record<string, string>, lead?: Lead): CreateLeadPayload & { custom_fields?: Record<string, string> } | null => {
    const hasValue = Object.values(values).some((value) => String(value || '').trim());
    if (!hasValue) return null;

    const custom_fields = leadColumns.reduce<Record<string, string>>((acc, column) => {
      if (!column.systemField) acc[column.id] = values[column.id] || '';
      return acc;
    }, {});

    const fallbackName = values.company_name || values.email || values.phone || values.niche || lead?.name || `Lead ${new Date().toLocaleString()}`;
    const rawPlatformSource = String(values.platform_source || values.source || lead?.custom_fields?.platform_source || lead?.source || 'manual').trim();
    const normalizedSource = normalizeSourceValue(rawPlatformSource);
    if (rawPlatformSource && rawPlatformSource.toLowerCase().replace(/\s+/g, '_') !== normalizedSource) {
      custom_fields.platform_source = rawPlatformSource;
    }

    return {
      name: fallbackName,
      company: values.company_name || undefined,
      designation: values.niche || undefined,
      services_offered: values.service || undefined,
      source: normalizedSource,
      email: values.email || undefined,
      phone: values.phone || undefined,
      website: values.website || undefined,
      linkedin_url: values.linkedin || undefined,
      facebook_url: values.facebook || undefined,
      instagram_url: values.insta || undefined,
      status: normalizeStatusValue(values.status, lead?.status || 'new'),
      pipeline_stage: lead?.pipeline_stage || 'new',
      priority: lead?.priority || 'medium',
      lead_score: lead?.lead_score || 0,
      custom_fields,
    };
  };

  const saveLeadRow = async (rowId: string, values: Record<string, string>, raw?: unknown) => {
    const lead = raw as Lead | null | undefined;
    const existingId = lead?.id || blankRowLeadIds.current[rowId];
    const payload = buildLeadPayloadFromRow(values, lead || undefined);
    if (!payload) return;

    try {
      setLeadRowWarnings((current) => {
        if (!current[rowId]) return current;
        const next = { ...current };
        delete next[rowId];
        return next;
      });

      if (existingId) {
        if (!canUpdateLead) return;
        await api.updateLead(existingId, payload);
        await queryClient.invalidateQueries({ queryKey: ['leads'] });
        await queryClient.invalidateQueries({ queryKey: ['leads-all'] });
        await queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
        return;
      }

      if (!canCreateLead || pendingBlankRows.current[rowId]) {
        queuedBlankValues.current[rowId] = values;
        return;
      }

      pendingBlankRows.current[rowId] = true;
      const response = await api.createLead(payload);
      const createdId = response?.data?.id || response?.id;
      if (createdId) {
        blankRowLeadIds.current[rowId] = String(createdId);
      }

      const queuedValues = queuedBlankValues.current[rowId];
      delete queuedBlankValues.current[rowId];
      if (createdId && queuedValues) {
        const queuedPayload = buildLeadPayloadFromRow(queuedValues);
        if (queuedPayload) {
          await api.updateLead(String(createdId), queuedPayload);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['leads-all'] });
      await queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    } catch (error: any) {
      console.error('Lead autosave failed:', error);
      let message = error?.message || 'Unable to autosave this lead row.';
      if (error?.error_code === 'LEAD_DUPLICATE') {
        let duplicateLabel = 'Existing row';
        try {
          const duplicateInfo = error?.details ? JSON.parse(error.details) : null;
          if (duplicateInfo?.duplicate_id) {
            const duplicateIndex = allLeads.findIndex((lead: Lead) => String(lead.id) === String(duplicateInfo.duplicate_id));
            if (duplicateIndex >= 0) {
              duplicateLabel = `Row ${duplicateIndex + 1}`;
            }
          }
          if (duplicateInfo?.duplicate_name) {
            message = `${duplicateLabel} already has data: ${duplicateInfo.duplicate_name}.`;
          } else {
            message = `${duplicateLabel} already has data.`;
          }
        } catch {
          message = 'This lead already exists. A matching row already has data.';
        }
        setLeadRowWarnings((current) => ({
          ...current,
          [rowId]: message,
        }));
      }
      const errorKey = `${rowId}:${error?.error_code || message}`;
      const now = Date.now();
      if (!shownAutosaveErrors.current[errorKey] || now - shownAutosaveErrors.current[errorKey] > 5000) {
        shownAutosaveErrors.current[errorKey] = now;
        Swal.fire('Save failed', message, 'error');
      }
    } finally {
      pendingBlankRows.current[rowId] = false;
    }
  };

  const addLeadRow = () => {
    if (!canCreateLead) return;
    Swal.fire({
      title: 'Add Rows',
      text: 'How many blank rows do you want to add?',
      input: 'number',
      inputValue: 1,
      inputAttributes: {
        min: '1',
        max: '5000',
        step: '1',
      },
      showCancelButton: true,
      confirmButtonText: 'Add Rows',
      confirmButtonColor: '#0f766e',
      inputValidator: (value) => {
        const count = Number(value);
        if (!Number.isInteger(count) || count < 1) return 'Enter a valid row count.';
        if (count > 5000) return 'Please add 5000 rows or fewer at a time.';
        return null;
      },
    }).then((result) => {
      if (!result.isConfirmed) return;
      setSheetRowCount((current) => current + Number(result.value || 1));
    });
  };

  const followupRows: FlexibleSheetRow[] = useMemo(() => {
    const dataRows = (followupQuery.data?.data || []).map((row) => ({
      id: row.id,
      ownerName: row.owner_name || row.owner_email,
      raw: row,
      values: followupColumns.reduce<Record<string, string>>((acc, column) => {
        acc[column.id] = String(row.data?.[column.id] ?? row.data?.[column.label] ?? '');
        return acc;
      }, {}),
    }));

    const blankRows = Array.from({ length: Math.max(followupSheetRowCount - dataRows.length, 0) }, (_, index) => ({
      id: getStableBlankRowId(followupBlankRowIds, 'followup', index),
      ownerName: '',
      raw: null,
      values: {},
    }));

    return [...dataRows, ...blankRows];
  }, [followupColumns, followupQuery.data?.data, followupSheetRowCount]);

  const buildFollowupPayloadFromRow = (values: Record<string, string>) => {
    const hasValue = Object.values(values).some((value) => String(value || '').trim());
    if (!hasValue) return null;
    return {
      data: values,
      status: values.status || values.Status || values.follow_up_status || values.followup_status || undefined,
    };
  };

  const saveFollowupRow = async (rowId: string, values: Record<string, string>, raw?: unknown) => {
    const record = raw as { id?: string } | null | undefined;
    const existingId = record?.id || blankRowFollowupIds.current[rowId];
    const payload = buildFollowupPayloadFromRow(values);
    if (!payload) return;

    try {
      if (existingId) {
        if (!canUpdateFollowups) return;
        await api.updateFlexibleFollowup(existingId, payload);
        queryClient.invalidateQueries({ queryKey: ['flexible-followups'] });
        return;
      }

      if (!canCreateFollowups || pendingBlankFollowupRows.current[rowId]) {
        queuedBlankFollowupValues.current[rowId] = values;
        return;
      }

      pendingBlankFollowupRows.current[rowId] = true;
      const response = await api.createFlexibleFollowup(payload);
      const createdId = response?.data?.id || response?.id;
      if (createdId) {
        blankRowFollowupIds.current[rowId] = String(createdId);
      }

      const queuedValues = queuedBlankFollowupValues.current[rowId];
      delete queuedBlankFollowupValues.current[rowId];
      if (createdId && queuedValues) {
        const queuedPayload = buildFollowupPayloadFromRow(queuedValues);
        if (queuedPayload) {
          await api.updateFlexibleFollowup(String(createdId), queuedPayload);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['flexible-followups'] });
    } catch (error: any) {
      console.error('Follow-up autosave failed:', error);
      Swal.fire('Save failed', error?.message || 'Unable to autosave this follow-up row.', 'error');
    } finally {
      pendingBlankFollowupRows.current[rowId] = false;
    }
  };

  const addFollowupRows = () => {
    if (!canCreateFollowups) return;
    Swal.fire({
      title: 'Add Follow-up Rows',
      text: 'How many blank rows do you want to add?',
      input: 'number',
      inputValue: 1,
      inputAttributes: {
        min: '1',
        max: '5000',
        step: '1',
      },
      showCancelButton: true,
      confirmButtonText: 'Add Rows',
      confirmButtonColor: '#0f766e',
      inputValidator: (value) => {
        const count = Number(value);
        if (!Number.isInteger(count) || count < 1) return 'Enter a valid row count.';
        if (count > 5000) return 'Please add 5000 rows or fewer at a time.';
        return null;
      },
    }).then((result) => {
      if (!result.isConfirmed) return;
      setFollowupSheetRowCount((current) => current + Number(result.value || 1));
    });
  };

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
            Object.keys(blankRowLeadIds.current).forEach((rowKey) => {
              if (blankRowLeadIds.current[rowKey] === leadId) {
                delete blankRowLeadIds.current[rowKey];
                delete queuedBlankValues.current[rowKey];
                delete pendingBlankRows.current[rowKey];
              }
            });
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
              <Button
                variant="secondary"
                onClick={() => importInputRef.current?.click()}
                isLoading={mutations.importLeads.isPending}
                loadingText="Importing..."
              >
                Import CSV
              </Button>
            ) : null}
            <Button variant="secondary" onClick={handleExportLeads}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            {canManageTaxonomies ? (
              <Button
                variant="secondary"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-slate-700"
                onClick={() => navigate('/leads/taxonomies')}
              >
                <ListChecks className="mr-2 h-4 w-4" />
                Manage Niches & Services
              </Button>
            ) : null}
            {canCreateLead ? (
              <Button onClick={() => { setEditingLead(null); setLeadFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Lead
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {isStatsError ? (
        <ModuleErrorState
          title="Lead analytics could not load"
          description={statsError instanceof Error ? statsError.message : 'Please try again.'}
          onAction={() => refetchStats()}
          className="mb-4"
        />
      ) : null}

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
                <Button onClick={handleBulkAction} isLoading={bulkActionLoading} loadingText="Applying...">Apply</Button>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {showFilters ? (
            <LeadFilters
              value={filters}
              onChange={(next) => { setPage(1); setFilters(next); }}
              assignedUsers={assignedUsers}
              availableTags={availableTags}
              nicheOptions={customNiches}
              serviceOptions={customServices}
            />
          ) : null}

          {view === 'table' ? (
            <div className={sheetFullscreen === 'leads' ? 'fixed inset-0 z-50 bg-background/95 p-4 backdrop-blur-sm' : ''}>
              <div className={sheetFullscreen === 'leads' ? 'flex h-full flex-col gap-4' : 'space-y-4'}>
              {isLeadSheetLoading ? (
                <ModuleLoadingState
                  title="Loading leads"
                  description="Fetching your filtered CRM pipeline from Supabase."
                />
              ) : isLeadsError ? (
                <ModuleErrorState
                  title="Leads could not load"
                  description={leadsError instanceof Error ? leadsError.message : 'Your lead workspace could not be loaded.'}
                  onAction={() => refetchLeads()}
                />
              ) : (
                <FlexibleSheetTable
                  title="Editable Leads Sheet"
                  columns={leadColumnsWithOptions}
                  rows={leadRows}
                  showOwner={canViewAllLeads}
                  emptyText={leads.length === 0 ? 'No leads yet. Enter data into the sheet to create the first lead.' : 'No leads found for the selected filters.'}
                  onColumnsChange={setLeadColumns}
                  onSaveRow={(canUpdateLead || canCreateLead) ? saveLeadRow : undefined}
                  onAddRow={canCreateLead ? addLeadRow : undefined}
                  onDeleteRow={canDeleteLead ? handleDeleteLead : undefined}
                  rowWarnings={leadRowWarnings}
                  isFullscreen={sheetFullscreen === 'leads'}
                  onToggleFullscreen={() => setSheetFullscreen((current) => (current === 'leads' ? null : 'leads'))}
                  canAdd={canCreateLead}
                  canEdit={canUpdateLead || canCreateLead}
                  canDelete={canDeleteLead}
                  canManageColumns={canUpdateLead}
                  autoSave
                />
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {isLeadSheetLoading ? 'Loading leads...' : `Showing page ${page} of ${totalPages} - ${total} total leads`}
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
              </div>
            </div>
          ) : null}

          {view === 'followups' ? (
            <div className={sheetFullscreen === 'followups' ? 'fixed inset-0 z-50 bg-background/95 p-4 backdrop-blur-sm' : ''}>
              <div className={sheetFullscreen === 'followups' ? 'flex h-full flex-col gap-4' : 'space-y-4'}>
              <Input
                value={followupSearch}
                onChange={(event) => setFollowupSearch(event.target.value)}
                placeholder="Search follow-ups"
                className="max-w-md"
              />
              {followupQuery.isError ? (
                <ModuleErrorState
                  title="Follow-ups could not load"
                  description={followupQuery.error instanceof Error ? followupQuery.error.message : 'Unable to read follow-up records.'}
                  onAction={() => followupQuery.refetch()}
                />
              ) : followupRows.length === 0 ? (
                <ModuleEmptyState
                  title="No follow-up rows"
                  description="Follow-up rows will appear here after they are created."
                  action={canCreateFollowups ? { label: 'Add Follow-up Rows', onClick: addFollowupRows } : undefined}
                />
              ) : (
                <FlexibleSheetTable
                  title="Editable Follow-up Sheet"
                  columns={followupColumnsWithOptions}
                  rows={followupRows}
                  showOwner={canViewAllLeads}
                  emptyText={followupQuery.isLoading ? 'Loading follow-ups...' : 'No follow-up rows found.'}
                  onColumnsChange={setFollowupColumns}
                  onSaveRow={(canUpdateFollowups || canCreateFollowups) ? saveFollowupRow : undefined}
                  onAddRow={canCreateFollowups ? addFollowupRows : undefined}
                  onDeleteRow={canDeleteFollowups ? (rowId) => followupMutations.deleteFollowup.mutate(rowId) : undefined}
                  isFullscreen={sheetFullscreen === 'followups'}
                  onToggleFullscreen={() => setSheetFullscreen((current) => (current === 'followups' ? null : 'followups'))}
                  canAdd={canCreateFollowups}
                  canEdit={canUpdateFollowups || canCreateFollowups}
                  canDelete={canDeleteFollowups}
                  canManageColumns={canUpdateFollowups}
                  autoSave
                />
              )}
              </div>
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
        projects={assignedProjects}
        niches={nicheOptions}
        services={serviceOptions}
        nicheLoading={isLoading && !leadsResponse}
        onCreateNiche={canCreateNiches ? handleCreateNiche : undefined}
        onCreateService={canCreateNiches ? handleCreateService : undefined}
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
