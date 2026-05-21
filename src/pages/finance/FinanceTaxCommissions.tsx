import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, Users, PlusCircle, Trash2, LayoutGrid } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModuleEmptyState, ModuleErrorState, ModuleLoadingState } from '@/components/common/ModuleState';
import { formatMoney } from '@/lib/financeEngine';
import { TaxModal } from './TaxModal';
import { CommissionModal } from './CommissionModal';

const FinanceTaxCommissions: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permission = usePermission();
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);

  const canManageTaxes = permission.canAny(['finance.taxes.manage', 'finance.settings.manage', 'finance.view.all']);
  const canManageCommissions = permission.canAny(['finance.commissions.manage', 'finance.settings.manage', 'finance.view.all']);

  const { data: taxesResponse, isLoading: taxesLoading, isError: taxesIsError, error: taxesError, refetch: refetchTaxes } = useQuery({
    queryKey: ['finance-taxes'],
    queryFn: async () => api.get('/finance/taxes'),
  });
  const taxes = taxesResponse?.data || [];

  const { data: commissionsResponse, isLoading: commissionsLoading, isError: commissionsIsError, error: commissionsError, refetch: refetchCommissions } = useQuery({
    queryKey: ['finance-commissions'],
    queryFn: async () => api.get('/finance/commissions'),
  });
  const commissions = commissionsResponse?.data || [];

  const deleteTaxMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/taxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-taxes'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
      toast.success('Project tax deleted');
    },
    onError: () => toast.error('Failed to delete project tax'),
  });

  const deleteCommissionMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/commissions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
      toast.success('Commission deleted');
    },
    onError: () => toast.error('Failed to delete commission'),
  });

  const handleDeleteTax = (id: string) => {
    Swal.fire({
      title: 'Delete Tax?',
      text: 'This will remove the project tax record permanently.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it',
    }).then((result) => {
      if (result.isConfirmed) deleteTaxMutation.mutate(id);
    });
  };

  const handleDeleteCommission = (id: string) => {
    Swal.fire({
      title: 'Delete Commission?',
      text: 'This will remove the commission record permanently.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it',
    }).then((result) => {
      if (result.isConfirmed) deleteCommissionMutation.mutate(id);
    });
  };

  const isLoading = taxesLoading || commissionsLoading;
  const isError = taxesIsError || commissionsIsError;
  const error = taxesError || commissionsError;

  if (isLoading) {
    return <ModuleLoadingState title="Loading finance records" description="Fetching project taxes and commissions." />;
  }

  if (isError) {
    return (
      <ModuleErrorState
        title="Finance records unavailable"
        description={error instanceof Error ? error.message : 'Unable to load project tax and commission records.'}
        onAction={() => {
          refetchTaxes();
          refetchCommissions();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-3xl border bg-gradient-to-r from-slate-950 via-teal-900 to-cyan-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <Button variant="secondary" size="sm" className="w-fit bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/finance')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Finance
            </Button>
            <Badge className="bg-white/15 text-white hover:bg-white/20">
              Finance Records
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Project taxes and outsider commissions</h1>
            <p className="text-sm text-white/80">
              Keep tax tracking and agent commissions separate from the main finance dashboard for a cleaner workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIsTaxModalOpen(true)} disabled={!canManageTaxes}>
              <Receipt className="mr-2 h-4 w-4" />
              Add Project Tax
            </Button>
            <Button variant="secondary" onClick={() => setIsCommissionModalOpen(true)} disabled={!canManageCommissions}>
              <Users className="mr-2 h-4 w-4" />
              Add Commission
            </Button>
            <Button variant="secondary" onClick={() => navigate('/finance')}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Open Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Project Taxes</CardTitle>
          </CardHeader>
          <CardContent>
            {taxes.length === 0 ? (
              <ModuleEmptyState
                title="No project taxes yet"
                description="Add a tax record for a specific project from the action button above."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Rate/Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxes.map((tax: any) => (
                      <TableRow key={tax.id}>
                        <TableCell className="font-medium">{tax.projects?.name || 'Unknown project'}</TableCell>
                        <TableCell>{tax.title}</TableCell>
                        <TableCell>{tax.rate ? `${tax.rate}%` : formatMoney(tax.amount, tax.currency)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTax(tax.id)} disabled={!canManageTaxes}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Outsider Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <ModuleEmptyState
                title="No commissions yet"
                description="Log a commission for an outsider resource or agent from the action button above."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Rate/Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission: any) => (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium">{commission.projects?.name || 'Unknown project'}</TableCell>
                        <TableCell>{commission.title}</TableCell>
                        <TableCell>{commission.rate ? `${commission.rate}%` : formatMoney(commission.amount, commission.currency)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCommission(commission.id)} disabled={!canManageCommissions}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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

      <TaxModal open={isTaxModalOpen} onOpenChange={setIsTaxModalOpen} />
      <CommissionModal open={isCommissionModalOpen} onOpenChange={setIsCommissionModalOpen} />
    </div>
  );
};

export default FinanceTaxCommissions;
