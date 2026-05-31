import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Edit, Eye, Plus, Search, Trash2, Wallet } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModuleEmptyState, ModuleErrorState, ModuleLoadingState } from '@/components/common/ModuleState';
import { usePermission } from '@/hooks/usePermission';

const emptyForm = {
  name: '',
  account_type: 'bank',
  user_id: '',
  bank_name: '',
  account_number: '',
  iban: '',
  branch_name: '',
  status: 'active',
  is_default: false,
  notes: '',
};

const FinanceAccounts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permission = usePermission();
  const canManageAccounts = permission.canAny(['finance.payments.manage', 'finance.settings.manage', 'finance.view.all']);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  const { data: accountsResponse, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance-accounts'],
    queryFn: async () => api.get('/finance/accounts'),
  });
  const accounts = accountsResponse?.data || [];

  const { data: usersResponse } = useQuery({
    queryKey: ['finance-accounts-users'],
    queryFn: async () => api.getUsers(),
    enabled: isDialogOpen,
  });
  const users = usersResponse?.data || [];

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData({ ...emptyForm });
      if (searchParams.get('create') === '1') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('create');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const handleEdit = (account: any) => {
    setEditingId(account.id);
    setFormData({
      name: account.name || '',
      account_type: account.account_type || 'bank',
      user_id: account.user_id || account.user?.id || account.created_by || '',
      bank_name: account.bank_name || '',
      account_number: account.account_number || '',
      iban: account.iban || '',
      branch_name: account.branch_name || '',
      status: account.status || 'active',
      is_default: Boolean(account.is_default),
      notes: account.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleView = (account: any) => {
    setSelectedAccount(account);
  };

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return api.put(`/finance/accounts/${editingId}`, data);
      }
      return api.post('/finance/accounts', data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance-accounts'] });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({ ...emptyForm });
      toast.success(editingId ? 'Account updated successfully' : 'Account added successfully');
    },
    onError: () => toast.error(editingId ? 'Failed to update account' : 'Failed to add account'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/accounts/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance-accounts'] });
      toast.success('Account deleted successfully');
    },
    onError: () => toast.error('Failed to delete account'),
  });

  const handleDelete = (id: string, name: string) => {
    Swal.fire({
      title: 'Delete Account?',
      text: `Are you sure you want to delete account "${name}"?`,
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
    createOrUpdateMutation.mutate({
      ...formData,
      name: formData.name.trim(),
      user_id: formData.user_id || null,
      bank_name: formData.bank_name.trim() || null,
      account_number: formData.account_number.trim() || null,
      iban: formData.iban.trim() || null,
      branch_name: formData.branch_name.trim() || null,
      notes: formData.notes.trim() || null,
      is_default: Boolean(formData.is_default),
    });
  };

  const filteredAccounts = accounts.filter((account: any) => {
    const haystack = [
      account.name,
      account.bank_name,
      account.account_number,
      account.account_number_last4,
      account.iban,
      account.branch_name,
      account.user?.name,
      account.user_name,
      account.created_by_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const formatAccountNumber = (account: any) => {
    const raw = String(account.account_number || account.account_number_last4 || '');
    if (!raw) return '-';
    if (raw.length <= 4) return raw;
    return `**** **** **** ${raw.slice(-4)}`;
  };

  if (isLoading) {
    return <ModuleLoadingState title="Loading finance accounts" description="Fetching receiving bank and wallet accounts." />;
  }

  if (isError) {
    return (
      <ModuleErrorState
        title="Finance accounts unavailable"
        description={error instanceof Error ? error.message : 'Unable to fetch finance accounts right now.'}
        onAction={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/finance')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Finance
          </Button>
          <h1 className="text-2xl font-bold">Finance Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage the accounts where client payments are received.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" disabled={!canManageAccounts}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Account' : 'Add New Account'}</DialogTitle>
              <DialogDescription>
                Store the bank, IBAN, wallet, or other receiving account used for payments.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type</Label>
                  <select
                    id="account_type"
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="bank">Bank</option>
                    <option value="wallet">Wallet</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_id">User</Label>
                  <select
                    id="user_id"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="">Select user</option>
                    {users.map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.name}{user.email ? ` - ${user.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank / Provider</Label>
                  <Input id="bank_name" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input id="account_number" value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" value={formData.iban} onChange={(e) => setFormData({ ...formData, iban: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_name">Branch</Label>
                  <Input id="branch_name" value={formData.branch_name} onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    />
                    Set as default receiving account
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!canManageAccounts || createOrUpdateMutation.isPending}>
                {createOrUpdateMutation.isPending ? (editingId ? 'Updating...' : 'Saving...') : (editingId ? 'Update Account' : 'Add Account')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={Boolean(selectedAccount)} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
            <DialogDescription>Receiving account information for payments.</DialogDescription>
          </DialogHeader>
          {selectedAccount ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedAccount.name || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">User</p>
                  <p className="font-medium">{selectedAccount.user?.name || selectedAccount.user_name || selectedAccount.created_by_name || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedAccount.account_type || '-'}</p>
                </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Bank / Provider</p>
                <p className="font-medium">{selectedAccount.bank_name || '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Account Number</p>
                <p className="font-medium">{formatAccountNumber(selectedAccount)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">IBAN</p>
                <p className="font-medium">{selectedAccount.iban || '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Branch</p>
                <p className="font-medium">{selectedAccount.branch_name || '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{selectedAccount.status || '-'}</p>
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                <p className="font-medium">{selectedAccount.notes || '-'}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredAccounts.length === 0 ? (
            <ModuleEmptyState
              title="No accounts found"
              description="Add a receiving account so payments can be linked to a destination account."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 font-medium">Bank / Provider</th>
                    <th className="px-4 py-3 font-medium">Number</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Default</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account: any) => (
                    <tr key={account.id} className="border-b last:border-b-0">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Wallet className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{account.name}</p>
                            <p className="text-xs text-muted-foreground">{account.account_type || 'bank'}</p>
                            <p className="text-xs text-muted-foreground">
                              {account.user?.name || account.user_name || account.created_by_name || 'No user linked'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{account.bank_name || '-'}</td>
                      <td className="px-4 py-4">{formatAccountNumber(account)}</td>
                      <td className="px-4 py-4">
                        <Badge variant={account.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                          {account.status || 'active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {account.is_default ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Default</Badge> : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleView(account)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(account)} disabled={!canManageAccounts}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(account.id, account.name)} disabled={!canManageAccounts}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceAccounts;
