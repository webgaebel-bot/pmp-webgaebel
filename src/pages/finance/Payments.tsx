import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, Search, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModuleEmptyState, ModuleLoadingState } from '@/components/common/ModuleState';
import { formatMoney } from '@/lib/financeEngine';

const Payments: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    client_name: '',
    amount: '',
    currency: 'USD',
    payment_date: '',
    payment_method: 'bank_transfer',
    payment_method_other: '',
    status: 'pending',
    description: '',
    project_id: '',
    commission_assignee_id: '',
    received_amount: '',
    tax_amount: '',
    commission_amount: '',
    transaction_fee_amount: '',
    product_cost_amount: '',
  });

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  const { data: paymentsResponse, isLoading, refetch: refetchPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => api.get('/finance/payments'),
  });
  const payments = paymentsResponse?.data || [];

  const { data: projectsResponse } = useQuery({
    queryKey: ['finance-projects'],
    queryFn: async () => api.getProjects(),
    enabled: isDialogOpen,
  });
  const projects = projectsResponse?.data || [];

  const { data: clientsResponse } = useQuery({
    queryKey: ['finance-clients'],
    queryFn: async () => api.get('/finance/clients'),
    enabled: isDialogOpen,
  });
  const clients = clientsResponse?.data || [];

  const { data: assigneesResponse } = useQuery({
    queryKey: ['finance-payment-commission-assignees'],
    queryFn: async () => api.getUsers(),
    enabled: isDialogOpen,
  });
  const commissionAssignees = assigneesResponse?.data || [];

  const { data: financeSettingsResponse } = useQuery({
    queryKey: ['finance-settings'],
    queryFn: async () => api.get('/finance/settings'),
  });
  const financeSettings = financeSettingsResponse?.data?.data || {};
  const baseCurrency = financeSettings.base_currency || 'USD';

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      client_name: '',
      amount: '',
      currency: 'USD',
      payment_date: '',
      payment_method: 'bank_transfer',
      payment_method_other: '',
      status: 'pending',
      description: '',
      project_id: '',
      commission_assignee_id: '',
      received_amount: '',
      tax_amount: '',
      commission_amount: '',
      transaction_fee_amount: '',
      product_cost_amount: '',
    });
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
      if (searchParams.get('create') === '1') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('create');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const handleEdit = (payment: any) => {
    setEditingId(payment.id);
    setFormData({
      client_name: payment.client_name || '',
      amount: String(payment.amount || ''),
      currency: payment.currency || 'USD',
      payment_date: payment.payment_date || '',
      payment_method: payment.payment_method || 'bank_transfer',
      payment_method_other: payment.payment_method_other || '',
      status: payment.status || 'pending',
      description: payment.description || '',
      project_id: payment.project_id || '',
      commission_assignee_id: payment.commission_assignee_id || '',
      received_amount: String(payment.received_amount || ''),
      tax_amount: String(payment.tax_amount || ''),
      commission_amount: String(payment.commission_amount || ''),
      transaction_fee_amount: String(payment.transaction_fee_amount || ''),
      product_cost_amount: String(payment.product_cost_amount || ''),
    });
    setIsDialogOpen(true);
  };

  const getBaseValues = (payment: any) => {
    const amount = Number(payment?.amount || 0);
    const received = Number(payment?.received_amount || 0);
    const baseAmount = Number(payment?.base_amount || 0);

    if (baseAmount > 0 && amount > 0) {
      const ratio = baseAmount / amount;
      return {
        baseGross: baseAmount,
        baseReceived: Math.min(baseAmount, received * ratio),
      };
    }

    return {
      baseGross: amount,
      baseReceived: received,
    };
  };

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return api.put(`/finance/payments/${editingId}`, data);
      }
      return api.post('/finance/payments', data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-stats'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['finance-chart'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['payments'] });
      await refetchPayments();
      setIsDialogOpen(false);
      resetForm();
      toast.success(editingId ? 'Payment updated successfully' : 'Payment added successfully');
    },
    onError: () => {
      toast.error(editingId ? 'Failed to update payment' : 'Failed to add payment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/payments/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-stats'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['finance-chart'], exact: false });
      toast.success('Payment deleted successfully');
    },
    onError: () => toast.error('Failed to delete payment'),
  });

  const handleDelete = (id: string, clientName: string) => {
    Swal.fire({
      title: 'Delete Payment?',
      text: `Are you sure you want to delete payment from "${clientName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = Number(formData.amount || 0);
    const receivedValue = formData.received_amount === ''
      ? (formData.status === 'completed' ? amountValue : formData.status === 'half' ? amountValue / 2 : 0)
      : Number(formData.received_amount || 0);

    createOrUpdateMutation.mutate({
      ...formData,
      amount: amountValue,
      received_amount: receivedValue,
      commission_assignee_id: formData.commission_assignee_id || undefined,
      tax_amount: Number(formData.tax_amount || 0),
      commission_amount: Number(formData.commission_amount || 0),
      transaction_fee_amount: Number(formData.transaction_fee_amount || 0),
      product_cost_amount: Number(formData.product_cost_amount || 0),
    });
  };

  const filteredPayments = payments.filter((p: any) =>
    p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.project?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const completedPayments = filteredPayments.filter((p: any) => p.status === 'completed');
  const pendingPayments = filteredPayments.filter((p: any) => p.status !== 'completed');
  const totalCompletedBase = completedPayments.reduce((sum: number, payment: any) => {
    const values = getBaseValues(payment);
    return sum + values.baseGross;
  }, 0);
  const totalPendingBase = pendingPayments.reduce((sum: number, payment: any) => {
    const values = getBaseValues(payment);
    return sum + Math.max(values.baseGross - values.baseReceived, 0);
  }, 0);
  const totalReceivedBase = completedPayments.reduce((sum: number, payment: any) => {
    const values = getBaseValues(payment);
    return sum + values.baseReceived;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/finance')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Finance
          </Button>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Base currency: {baseCurrency}. Pending payments stay out of net profit until they are marked completed.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setEditingId(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Payment' : 'Add New Payment'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Edit the payment and its deductions.' : 'Create a payment record and attach it to a client/project.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="client_name">Client Name</Label>
                <select
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((client: any) => (
                    <option key={client.id} value={client.name}>
                      {client.name}{client.company ? ` - ${client.company}` : ''}
                    </option>
                  ))}
                </select>
                <Input
                  className="mt-2"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Or type a new client name manually"
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="received_amount">Received Amount</Label>
                  <Input
                    id="received_amount"
                    type="number"
                    step="0.01"
                    value={formData.received_amount}
                    onChange={(e) => setFormData({ ...formData, received_amount: e.target.value })}
                    placeholder="Defaults to amount when completed"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_amount">Tax Amount</Label>
                  <Input
                    id="tax_amount"
                    type="number"
                    step="0.01"
                    value={formData.tax_amount}
                    onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="commission_amount">Commission Amount</Label>
                  <Input
                    id="commission_amount"
                    type="number"
                    step="0.01"
                    value={formData.commission_amount}
                    onChange={(e) => setFormData({ ...formData, commission_amount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="transaction_fee_amount">Transaction Fee Amount</Label>
                  <Input
                    id="transaction_fee_amount"
                    type="number"
                    step="0.01"
                    value={formData.transaction_fee_amount}
                    onChange={(e) => setFormData({ ...formData, transaction_fee_amount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="product_cost_amount">Product Cost Amount</Label>
                  <Input
                    id="product_cost_amount"
                    type="number"
                    step="0.01"
                    value={formData.product_cost_amount}
                    onChange={(e) => setFormData({ ...formData, product_cost_amount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                >
                  {['USD', 'PKR', 'EUR', 'GBP', 'AED'].map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <select
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="paypal">PayPal</option>
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
                    placeholder="e.g. Bank app, offline transfer"
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="project_id">Project</Label>
                <select
                  id="project_id"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="">Select project</option>
                  {projects.map((project: any) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="commission_assignee_id">Commission Given To</Label>
                <select
                  id="commission_assignee_id"
                  value={formData.commission_assignee_id}
                  onChange={(e) => setFormData({ ...formData, commission_assignee_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="">No commission assigned</option>
                  {commissionAssignees.map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || user.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="pending">Pending</option>
                  <option value="half">Half</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" isLoading={createOrUpdateMutation.isPending} loadingText={editingId ? 'Updating...' : 'Adding...'}>
                {createOrUpdateMutation.isPending ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Payment' : 'Add Payment')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed Revenue</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(totalCompletedBase, baseCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Received Total</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(totalReceivedBase, baseCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Value</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(totalPendingBase, baseCurrency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ModuleLoadingState title="Loading payments" description="Syncing finance payments from Supabase." />
          ) : filteredPayments.length === 0 ? (
            <ModuleEmptyState
              title="No payments found"
              description="Add your first payment record or adjust the search term."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment: any) => {
                    const values = getBaseValues(payment);
                    const pendingBase = Math.max(values.baseGross - values.baseReceived, 0);
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.client_name}</TableCell>
                        <TableCell>{payment.project?.name || payment.project_name || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{formatMoney(payment.amount, payment.currency || baseCurrency)}</div>
                            {payment.base_amount ? (
                              <div className="text-xs text-muted-foreground">
                                Base: {formatMoney(payment.base_amount, baseCurrency)}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{formatMoney(payment.received_amount || 0, payment.currency || baseCurrency)}</div>
                            {payment.base_amount ? (
                              <div className="text-xs text-muted-foreground">
                                Base: {formatMoney(values.baseReceived, baseCurrency)}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{formatMoney(pendingBase, baseCurrency)}</div>
                            <div className="text-xs text-muted-foreground">
                              {payment.status === 'completed' ? 'Closed' : 'Awaiting receipt'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="capitalize">{payment.payment_method?.replace(/_/g, ' ') || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{formatMoney(payment.commission_amount || 0, payment.currency || baseCurrency)}</div>
                            <div className="text-xs text-muted-foreground">
                              {payment.commission_assignee?.name || payment.commission_assignee_name || 'No assignee'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'completed' ? 'default' : payment.status === 'half' ? 'outline' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(payment)} aria-label="Edit payment">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDelete(payment.id, payment.client_name)}
                              aria-label="Delete payment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
