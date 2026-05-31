import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, Edit, Eye, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { ModuleEmptyState, ModuleLoadingState } from '@/components/common/ModuleState';
import { formatMoney } from '@/lib/financeEngine';

const Expenses: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    currency: 'USD',
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer',
    payment_method_other: '',
    project_id: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const projectQueryId = searchParams.get('project_id') || '';

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData({
        category: '',
        description: '',
        amount: '',
        currency: 'USD',
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: 'bank_transfer',
        payment_method_other: '',
        project_id: projectQueryId || '',
      });
      if (searchParams.get('create') === '1') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('create');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const handleEdit = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
      category: expense.category || '',
      description: expense.description || '',
      amount: String(
        expense.original_amount ??
          expense.amount ??
          expense.base_amount ??
          expense.converted_amount ??
          ''
      ),
      currency: expense.currency || 'USD',
      expense_date: expense.expense_date || '',
      payment_method: expense.payment_method || 'bank_transfer',
      payment_method_other: expense.payment_method_other || '',
      project_id: expense.project_id || projectQueryId || '',
    });
    setIsDialogOpen(true);
  };

  const handleView = (expense: any) => {
    setSelectedExpense(expense);
  };

  useEffect(() => {
    if (projectQueryId && !formData.project_id) {
      setFormData((prev) => ({ ...prev, project_id: projectQueryId }));
    }
  }, [projectQueryId]);

  const { data: expensesResponse, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const response = await api.get('/finance/expenses');
      return response;
    },
  });
  const expenses = expensesResponse?.data || [];
  const { data: projectsResponse } = useQuery({
    queryKey: ['finance-projects'],
    queryFn: async () => api.getProjects(),
    enabled: isDialogOpen || Boolean(projectQueryId),
  });
  const projects = projectsResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return api.put(`/finance/expenses/${editingId}`, data);
      }
      return api.post('/finance/expenses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['finance-chart'], exact: false });
      setIsDialogOpen(false);
      toast.success(editingId ? 'Expense updated successfully' : 'Expense added successfully');
      setEditingId(null);
      setFormData({
        category: '',
        description: '',
        amount: '',
        currency: 'USD',
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: 'bank_transfer',
        payment_method_other: '',
        project_id: projectQueryId || '',
      });
    },
    onError: () => {
      toast.error(editingId ? 'Failed to update expense' : 'Failed to add expense');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['finance-chart'], exact: false });
      toast.success('Expense deleted successfully');
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  const handleDelete = (id: string, description: string) => {
    Swal.fire({
      title: 'Delete Expense?',
      text: `Are you sure you want to delete expense "${description}"?`,
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
    createMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  const filteredExpenses = expenses?.filter((e: any) => {
    const matchesSearch =
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase()) ||
      e.payment_method?.toLowerCase().includes(search.toLowerCase());
    const matchesProject = projectQueryId ? e.project_id === projectQueryId : true;
    return matchesSearch && matchesProject;
  }) || [];
  const expenseCurrency = filteredExpenses[0]?.original_currency || filteredExpenses[0]?.currency || filteredExpenses[0]?.base_currency || 'USD';
  const getFirstPositiveExpenseAmount = (expense: any) => {
    const candidates = [expense?.original_amount, expense?.amount, expense?.base_amount, expense?.converted_amount];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  };
  const getOriginalExpenseAmount = (expense: any) => getFirstPositiveExpenseAmount(expense);
  const getBaseExpenseAmount = (expense: any) => {
    const candidates = [expense?.base_amount, expense?.converted_amount, expense?.original_amount, expense?.amount];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  };
  const getExpenseMoneyCurrency = (expense: any) => expense?.original_currency || expense?.currency || expense?.base_currency || expenseCurrency;

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/finance')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Finance
            </Button>
            <h1 className="text-2xl font-bold">Expenses</h1>
          </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                >
                  <option value="">Select category</option>
                  <option value="software">Software</option>
                  <option value="marketing">Marketing</option>
                  <option value="office">Office</option>
                  <option value="travel">Travel</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                >
                  {['USD', 'PKR', 'EUR', 'GBP', 'AED'].map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="expense_date">Date</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <select
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {formData.payment_method === 'other' ? (
                <div>
                  <Label htmlFor="payment_method_other">Custom Payment Method</Label>
                  <Input
                    id="payment_method_other"
                    value={formData.payment_method_other}
                    onChange={(e) => setFormData({ ...formData, payment_method_other: e.target.value })}
                    placeholder="e.g. Bank transfer app"
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="project_id">Project</Label>
                <select
                  id="project_id"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Select project</option>
                  {projects.map((project: any) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full" isLoading={createMutation.isPending} loadingText={editingId ? 'Updating...' : 'Adding...'}>
                {createMutation.isPending ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Expense' : 'Add Expense')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={Boolean(selectedExpense)} onOpenChange={(open) => !open && setSelectedExpense(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>Detailed breakdown of the selected expense.</DialogDescription>
          </DialogHeader>
          {selectedExpense ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Category</p>
                  <p className="font-medium capitalize">{selectedExpense.category || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedExpense.project?.name || selectedExpense.project_name || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatMoney(getOriginalExpenseAmount(selectedExpense), getExpenseMoneyCurrency(selectedExpense))}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Currency</p>
                  <p className="font-medium">{selectedExpense.original_currency || selectedExpense.currency || 'USD'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Base Amount</p>
                  <p className="font-medium">{formatMoney(getBaseExpenseAmount(selectedExpense), selectedExpense.base_currency || expenseCurrency)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Base Currency</p>
                  <p className="font-medium">{selectedExpense.base_currency || selectedExpense.currency || expenseCurrency}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Date</p>
                  <p className="font-medium">{selectedExpense.expense_date ? new Date(selectedExpense.expense_date).toLocaleDateString() : '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Method</p>
                  <p className="font-medium capitalize">
                    {selectedExpense.payment_method === 'other'
                      ? selectedExpense.payment_method_other || 'Other'
                      : selectedExpense.payment_method?.replace('_', ' ') || '-'}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Description</p>
                <p className="font-medium">{selectedExpense.description || '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Receipt</p>
                <p className="font-medium">
                  {selectedExpense.receipt_url ? (
                    <a href={selectedExpense.receipt_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      View receipt
                    </a>
                  ) : '-'}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {projectQueryId ? (
              <div className="text-sm text-muted-foreground">
                Viewing expenses for project <strong>{searchParams.get('project_name') || projectQueryId}</strong>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ModuleLoadingState title="Loading expenses" description="Syncing company expenses from Supabase." />
          ) : filteredExpenses.length === 0 ? (
            <ModuleEmptyState title="No expenses found" description="Add an expense or adjust the search term." />
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>{formatMoney(getOriginalExpenseAmount(expense), getExpenseMoneyCurrency(expense))}</TableCell>
                      <TableCell>{expense.project?.name || expense.project_name || '-'}</TableCell>
                      <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">
                        {expense.payment_method === 'other'
                          ? expense.payment_method_other || 'Other'
                          : expense.payment_method?.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        {expense.receipt_url ? (
                          <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="text-primary underline">
                            View receipt
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleView(expense)} aria-label="View expense details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(expense.id, expense.description)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Expenses;
