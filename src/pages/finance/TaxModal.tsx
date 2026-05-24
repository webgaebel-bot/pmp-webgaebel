import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface TaxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTax?: any | null;
}

export const TaxModal: React.FC<TaxModalProps> = ({ open, onOpenChange, editingTax }) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(editingTax?.id);
  const [formData, setFormData] = useState({
    project_id: '',
    title: '',
    rate: '',
    amount: '',
    currency: 'USD',
    effective_from: '',
    effective_to: '',
  });

  useEffect(() => {
    if (!open) return;
    setFormData({
      project_id: editingTax?.project_id || '',
      title: editingTax?.title || '',
      rate: editingTax?.rate !== undefined && editingTax?.rate !== null ? String(editingTax.rate) : '',
      amount: editingTax?.amount !== undefined && editingTax?.amount !== null ? String(editingTax.amount) : '',
      currency: editingTax?.currency || 'USD',
      effective_from: editingTax?.effective_from || '',
      effective_to: editingTax?.effective_to || '',
    });
  }, [open, editingTax]);

  const { data: projectsResponse } = useQuery({
    queryKey: ['finance-projects'],
    queryFn: async () => api.getProjects(),
    enabled: open,
  });
  const projects = projectsResponse?.data || [];

  const { data: currenciesResponse } = useQuery({
    queryKey: ['system-currencies'],
    queryFn: async () => api.get('/currencies'),
    enabled: open,
  });
  const currencies = currenciesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing && editingTax?.id) return (api as any).updateFinanceTax(editingTax.id, data);
      return api.post('/finance/taxes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-taxes'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
      toast.success(isEditing ? 'Project tax updated successfully' : 'Project tax added successfully');
      onOpenChange(false);
      setFormData({ project_id: '', title: '', rate: '', amount: '', currency: 'USD', effective_from: '', effective_to: '' });
    },
    onError: () => {
      toast.error(isEditing ? 'Failed to update project tax' : 'Failed to add project tax');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(formData.rate);
    const amount = Number(formData.amount);
    if ((!rate || rate <= 0) && (!amount || amount <= 0)) {
      toast.error('Enter either a tax rate or a flat amount.');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project Tax' : 'Add Project Tax'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the tax rule for this project.' : 'Create a tax rule for a project.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="project_id">Project</Label>
            <select
              id="project_id"
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            >
              <option value="">Select project...</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="title">Tax Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g. VAT, GST"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                required
              >
                {currencies.map((c: any) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rate">Rate (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="amount">Flat Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="effective_from">Effective From</Label>
              <Input
                id="effective_from"
                type="date"
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="effective_to">Effective To</Label>
              <Input
                id="effective_to"
                type="date"
                value={formData.effective_to}
                onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" isLoading={createMutation.isPending} loadingText={isEditing ? 'Saving...' : 'Saving...'}>
            {createMutation.isPending ? 'Saving...' : (isEditing ? 'Update Tax' : 'Add Tax')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
