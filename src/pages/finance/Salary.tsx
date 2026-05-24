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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { ModuleEmptyState, ModuleLoadingState } from '@/components/common/ModuleState';
import { formatMoney } from '@/lib/financeEngine';
import SalaryRuns from '@/components/finance/SalaryRuns';

const Salary: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    employee_name: '',
    base_salary: '',
    bonus: '0',
    deductions: '0',
    salary_months: '1',
    currency: 'USD',
    salary_date: '',
    payment_method: 'bank_transfer',
    payment_method_other: '',
    notes: '',
  });
  const queryClient = useQueryClient();

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
        employee_id: '',
        employee_name: '',
        base_salary: '',
        bonus: '0',
        deductions: '0',
        salary_months: '1',
        currency: 'USD',
        salary_date: '',
        payment_method: 'bank_transfer',
        payment_method_other: '',
        notes: '',
      });
      if (searchParams.get('create') === '1') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('create');
        setSearchParams(nextParams, { replace: true });
      }
    }
  };

  const { data: salariesResponse, isLoading } = useQuery({
    queryKey: ['salaries'],
    queryFn: async () => {
      const response = await api.get('/finance/salaries');
      return response;
    },
  });
  const salaries = salariesResponse?.data || [];

  const { data: employeesResponse } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => api.get('/users'),
  });
  const employees = employeesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return api.put(`/finance/salaries/${editingId}`, data);
      }
      return api.post('/finance/salaries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      handleDialogChange(false);
      toast.success(editingId ? 'Salary record updated' : 'Salary record added successfully');
    },
    onError: () => {
      toast.error(editingId ? 'Failed to update salary' : 'Failed to add salary');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/finance/salaries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      toast.success('Salary record deleted successfully');
    },
    onError: () => toast.error('Failed to delete salary'),
  });

  const handleDelete = (id: string, employeeName: string) => {
    Swal.fire({
      title: 'Delete Salary Record?',
      text: `Are you sure you want to delete the salary record for "${employeeName}"?`,
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

  const handleEdit = (salary: any) => {
    setEditingId(salary.id);
    setFormData({
      employee_id: salary.employee_id || '',
      employee_name: salary.employee_name || '',
      base_salary: String(salary.base_salary || ''),
      bonus: String(salary.bonus || '0'),
      deductions: String(salary.deductions || '0'),
      salary_months: String(salary.salary_months || '1'),
      currency: salary.currency || 'USD',
      salary_date: salary.salary_date || '',
      payment_method: salary.payment_method || 'bank_transfer',
      payment_method_other: salary.payment_method_other || '',
      notes: salary.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      base_salary: parseFloat(formData.base_salary),
      bonus: parseFloat(formData.bonus),
      deductions: parseFloat(formData.deductions),
      salary_months: parseInt(formData.salary_months, 10) || 1,
    });
  };

  const filteredSalaries = salaries?.filter((s: any) =>
    s.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getTotalSalary = (salary: any) => {
    const months = Number(salary.salary_months || 1);
    return ((parseFloat(salary.base_salary) || 0) * months) + (parseFloat(salary.bonus) || 0) - (parseFloat(salary.deductions) || 0);
  };

  const summaryCurrency = salaries[0]?.currency || 'USD';
  const currentMonthPayroll = salaries.reduce((sum: number, salary: any) => {
    return sum + (parseFloat(salary.base_salary) || 0) + (parseFloat(salary.bonus) || 0) - (parseFloat(salary.deductions) || 0);
  }, 0);
  
  const futureLiabilities = salaries.reduce((sum: number, salary: any) => {
    const months = Number(salary.salary_months || 1);
    if (months > 1) {
      return sum + ((parseFloat(salary.base_salary) || 0) * (months - 1));
    }
    return sum;
  }, 0);

  const projectedPayroll = currentMonthPayroll + futureLiabilities;
  const uniqueEmployees = new Set(salaries.map((salary: any) => salary.employee_id)).size;
  const averageSalary = uniqueEmployees > 0 ? currentMonthPayroll / uniqueEmployees : 0;
  const salaryPeriodTotal = (parseFloat(formData.base_salary) || 0) * (parseInt(formData.salary_months, 10) || 1) + (parseFloat(formData.bonus) || 0) - (parseFloat(formData.deductions) || 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/finance')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Finance
          </Button>
          <h1 className="text-2xl font-bold">Salary Management</h1>
          <p className="text-sm text-muted-foreground">Manage employee salaries, bonuses, and deductions</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { title: 'Employee Count', value: uniqueEmployees },
          { title: 'This Month Payroll', value: currentMonthPayroll },
          { title: 'Future Liabilities', value: futureLiabilities },
          { title: 'Total Projected', value: projectedPayroll },
          { title: 'Average Payout (Monthly)', value: averageSalary },
        ].map((item) => (
          <Card key={item.title} className="p-4 border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
            <div className="text-sm font-medium text-muted-foreground">{item.title}</div>
            <div className="mt-3 text-2xl font-bold text-foreground">
              {typeof item.value === 'number' && item.title !== 'Employee Count' ? formatMoney(item.value, summaryCurrency) : item.value}
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Salary Record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Salary Record' : 'Add New Salary Record'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="employee_id">Employee</Label>
                <select
                  id="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => {
                    const selected = employees.find((emp: any) => emp.id === e.target.value);
                    setFormData({
                      ...formData,
                      employee_id: e.target.value,
                      employee_name: selected?.name || '',
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="base_salary">Base Salary</Label>
                <Input
                  id="base_salary"
                  type="number"
                  step="0.01"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="salary_months">Salary Period (months)</Label>
                <select
                  id="salary_months"
                  value={formData.salary_months}
                  onChange={(e) => setFormData({ ...formData, salary_months: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>{month} month{month > 1 ? 's' : ''}</option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-muted-foreground">
                  Projected payout for selected period: {formatMoney(salaryPeriodTotal, formData.currency)}
                </p>
              </div>
              <div>
                <Label htmlFor="bonus">Bonus (optional)</Label>
                <Input
                  id="bonus"
                  type="number"
                  step="0.01"
                  value={formData.bonus}
                  onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="deductions">Deductions (optional)</Label>
                <Input
                  id="deductions"
                  type="number"
                  step="0.01"
                  value={formData.deductions}
                  onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
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
                <Label htmlFor="salary_date">Payment Date</Label>
                <Input
                  id="salary_date"
                  type="date"
                  value={formData.salary_date}
                  onChange={(e) => setFormData({ ...formData, salary_date: e.target.value })}
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
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes about this salary"
                />
              </div>
              <Button type="submit" className="w-full" isLoading={createMutation.isPending} loadingText={editingId ? 'Updating...' : 'Adding...'}>
                {createMutation.isPending ? 'Saving...' : editingId ? 'Update Record' : 'Add Record'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ModuleLoadingState title="Loading salary records" description="Syncing salary data from Supabase." />
          ) : filteredSalaries.length === 0 ? (
            <ModuleEmptyState title="No salary records found" description="Add a salary record or adjust the search term." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSalaries.map((salary: any) => (
                    <TableRow key={salary.id}>
                      <TableCell className="font-medium">{salary.employee_name}</TableCell>
                      <TableCell>{formatMoney(salary.base_salary, salary.currency)}</TableCell>
                      <TableCell>{salary.bonus ? formatMoney(salary.bonus, salary.currency) : '-'}</TableCell>
                      <TableCell>{salary.deductions ? formatMoney(salary.deductions, salary.currency) : '-'}</TableCell>
                      <TableCell className="font-semibold">{formatMoney(getTotalSalary(salary), salary.currency)}</TableCell>
                      <TableCell>{new Date(salary.salary_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{salary.payment_method === 'bank_transfer' ? 'Bank' : salary.payment_method}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(salary)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(salary.id, salary.employee_name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Salary Runs</h2>
        <SalaryRuns />
      </div>
    </div>
  );
};

export default Salary;
