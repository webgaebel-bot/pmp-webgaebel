// src/pages/leads/ManageTaxonomies.tsx
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ListFilter,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface Taxonomy {
  id: string;
  name: string;
  taxonomy_type: 'niche' | 'service';
  created_by?: string;
  created_at: string;
  is_active: boolean;
}

export const ManageTaxonomies: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'niche' | 'service'>('niche');
  
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'niche' | 'service'>('all');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Ek page par kitne items dikhane hain

  // Fetch Data
  const { data: taxonomies, isLoading, isError } = useQuery<Taxonomy[]>({
    queryKey: ['lead-taxonomies'],
    queryFn: async () => api.get('/leads/taxonomies').then((res) => res.data),
  });

  // Fetch distinct taxonomy types for the dropdown
  const { data: typeOptions = [] } = useQuery<string[]>({
    queryKey: ['taxonomy-types'],
    queryFn: async () => {
      const res = await api.get('/leads/taxonomies');
      const types = Array.from(new Set(res.data.map((t: any) => t.taxonomy_type)));
      return types;
    },
  });

  // 1. Calculate Stats Cards Metrics (Memoized)
  const stats = useMemo(() => {
    if (!taxonomies) return { total: 0, niches: 0, services: 0, active: 0 };
    return {
      total: taxonomies.length,
      niches: taxonomies.filter(t => t.taxonomy_type === 'niche').length,
      services: taxonomies.filter(t => t.taxonomy_type === 'service').length,
      active: taxonomies.filter(t => t.is_active).length,
    };
  }, [taxonomies]);

  // 2. Filter and Search Logic (Memoized)
  const filteredTaxonomies = useMemo(() => {
    if (!taxonomies) return [];
    return taxonomies.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = typeFilter === 'all' || t.taxonomy_type === typeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [taxonomies, searchQuery, typeFilter]);

  // 3. Pagination Logic (Calculated from filtered array)
  const totalPages = Math.ceil(filteredTaxonomies.length / itemsPerPage) || 1;
  
  // Reset to page 1 if filters change search length
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const paginatedTaxonomies = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTaxonomies.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTaxonomies, currentPage, itemsPerPage]);

  // Handlers
  const handleCreate = async () => {
    if (taxonomies?.some(t => t.name.toLowerCase() === newName.trim().toLowerCase())) {
        Swal.fire('Warning', 'This taxonomy already exists.', 'warning');
        return;
      }
    try {
      await api.post('/leads/taxonomies', {
        name: newName.trim(),
        taxonomy_type: newType,
        is_active: true,
        created_by: user?.id,
      });
      Swal.fire({ icon: 'success', title: 'Taxonomy Created', timer: 1200, showConfirmButton: false });
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to create', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
    });
    if (!confirm.isConfirmed) return;
    try {
      await api.delete(`/leads/taxonomies/${id}`);
      Swal.fire({ icon: 'success', title: 'Deleted successfully', timer: 1200, showConfirmButton: false });
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to delete', 'error');
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await api.patch(`/leads/taxonomies/${id}`, { is_active: !current });
      queryClient.invalidateQueries({ queryKey: ['lead-taxonomies'] });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to update status', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground animate-pulse">
        Loading taxonomies architecture...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive font-medium">
        Failed to load taxonomies. Please check database logs.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-5 gap-4">
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)} 
            className="mb-1 -ml-2 text-muted-foreground hover:text-foreground h-8 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Manage Niches & Services
          </h1>
          <p className="text-sm text-muted-foreground">
            Group, classify, and configure your incoming pipeline pipelines.
          </p>
        </div>
      </div>

      {/* 1. Stats Counter Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Combined</p>
          <p className="text-2xl font-bold tracking-tight">{stats.total}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Niches</p>
          <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{stats.niches}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Services</p>
          <p className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">{stats.services}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Records</p>
          <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.active}</p>
        </div>
      </div>

      {/* 2. Interactive Creation Module */}
      <div className="bg-card p-4 rounded-xl border shadow-sm space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Create New Taxonomy Item
        </h3>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <Input 
              placeholder="Enter name (e.g., E-commerce, SEO Consulting)" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="max-w-md"
            />
            <select 
              value={newType} 
              onChange={(e) => setNewType(e.target.value as any)} 
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-10 min-w-[140px]"
            >
              <option value="niche">Niche</option>
              <option value="service">Service</option>
            </select>
          </div>
          <Button onClick={handleCreate} className="gap-1.5 h-10 px-5 shadow-xs">
            Add Records
          </Button>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/40 p-3 rounded-xl border">
        {/* Search Input Box */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        {/* Filter Selection Grid */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <ListFilter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-9 min-w-[135px]"
          >
            <option value="all">All Types</option>
            {typeOptions && typeOptions.length > 0 ? (
              typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}s
                </option>
              ))
            ) : (
              <>
                <option value="niche">Niche</option>
                <option value="service">Service</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* 4. Main Data Grid Structure */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-medium py-3.5 pl-6">Name</TableHead>
              <TableHead className="font-medium py-3.5">Type</TableHead>
              <TableHead className="font-medium py-3.5">Status</TableHead>
              <TableHead className="text-right font-medium py-3.5 pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTaxonomies.length > 0 ? (
              paginatedTaxonomies.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-sm">{t.name}</td>
                  <td className="px-4 py-3.5 text-sm">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                      t.taxonomy_type === 'niche' 
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900'
                    }`}>
                      {t.taxonomy_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    {t.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <XCircle className="h-3 w-3 text-slate-400" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2 pr-6">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleToggleActive(t.id, t.is_active)}
                      className="h-8 px-3 text-xs font-medium transition-all"
                    >
                      {t.is_active ? (
                        <span className="flex items-center gap-1 text-slate-600"><ShieldAlert className="h-3.5 w-3.5" /> Deactivate</span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> Activate</span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(t.id)}
                      className="h-8 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                  No matching items found. Try modifying your search parameters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* 5. Pagination Footer Control Grid */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-muted/30 border-t">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium">{filteredTaxonomies.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, filteredTaxonomies.length)}
            </span>{' '}
            of <span className="font-medium">{filteredTaxonomies.length}</span> results
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageTaxonomies;