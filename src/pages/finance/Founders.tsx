import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Edit, Trash2, Users } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Swal from 'sweetalert2';

const Founders: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFounder, setEditingFounder] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', equity_percentage: '', role: '' });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingFounder(null);
      setFormData({ name: '', equity_percentage: '', role: '' });
    }
    if (!open && searchParams.get('create') === '1') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('create');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const { data: foundersResponse, isLoading } = useQuery({
    queryKey: ['founders'],
    queryFn: async () => {
      const response = await api.get('/finance/founders');
      return response;
    },
  });

  const { data: totalEquityResponse } = useQuery({
    queryKey: ['founders-equity'],
    queryFn: async () => {
      const response = await api.get('/finance/founders/equity-total');
      return response;
    },
  });
  const founders = foundersResponse?.data || [];
  const totalEquity = totalEquityResponse?.data || { total: 0 };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/finance/founders', { ...data, equity_percentage: parseFloat(data.equity_percentage) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['founders'] });
      queryClient.invalidateQueries({ queryKey: ['founders-equity'] });
      setIsDialogOpen(false);
      toast.success('Founder added successfully');
      setFormData({ name: '', equity_percentage: '', role: '' });
    },
    onError: () => toast.error('Failed to add founder'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.put(`/finance/founders/${editingFounder.id}`, { ...data, equity_percentage: parseFloat(data.equity_percentage) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['founders'] });
      queryClient.invalidateQueries({ queryKey: ['founders-equity'] });
      setIsDialogOpen(false);
      setEditingFounder(null);
      setFormData({ name: '', equity_percentage: '', role: '' });
      toast.success('Founder updated successfully');
    },
    onError: () => toast.error('Failed to update founder'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/finance/founders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['founders'] });
      queryClient.invalidateQueries({ queryKey: ['founders-equity'] });
      toast.success('Founder deleted successfully');
    },
    onError: () => toast.error('Failed to delete founder'),
  });

  const handleDelete = (id: string, name: string) => {
    Swal.fire({
      title: 'Delete Founder?',
      text: `Are you sure you want to delete founder "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFounder) {
      updateMutation.mutate(formData);
      return;
    }
    createMutation.mutate(formData);
  };

  const openEdit = (founder: any) => {
    setEditingFounder(founder);
    setFormData({
      name: founder.name || '',
      role: founder.role || '',
      equity_percentage: String(founder.equity_percentage || ''),
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/finance')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Finance
          </Button>
          <h1 className="text-2xl font-bold">Founders</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditingFounder(null); setFormData({ name: '', equity_percentage: '', role: '' }); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Founder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingFounder ? 'Edit Founder' : 'Add Founder'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} />
              </div>
              <div>
                <Label htmlFor="equity">Equity Percentage *</Label>
                <Input id="equity" type="number" step="0.01" max="100" value={formData.equity_percentage} onChange={(e) => setFormData({...formData, equity_percentage: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingFounder ? 'Update Founder' : 'Add Founder'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equity Allocated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEquity?.data?.total || 0}%</div>
            <Progress value={totalEquity?.data?.total || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {(100 - (totalEquity?.data?.total || 0)).toFixed(2)}% remaining
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Founders List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : !founders?.length ? (
            <div className="text-center py-8 text-muted-foreground">No founders added yet.</div>
          ) : (
            <div className="space-y-4">
              {founders.map((founder: any) => (
                <div key={founder.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{founder.name}</p>
                    <p className="text-sm text-muted-foreground">{founder.role || 'No role specified'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold">{founder.equity_percentage}%</p>
                      <p className="text-xs text-muted-foreground">equity</p>
                    </div>
                     <div className="flex gap-2">
                       <Button variant="ghost" size="icon" onClick={() => openEdit(founder)}><Edit className="h-4 w-4" /></Button>
                       <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(founder.id, founder.name)}>
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Founders;
