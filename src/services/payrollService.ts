import type { SupabaseApiService } from '@/services/supabaseApi';

export const createPayrollService = (
  api: Pick<SupabaseApiService, 'getFinanceFounders' | 'createFinanceFounder' | 'updateFinanceFounder' | 'deleteFinanceFounder'>
) => ({
  getPayrollFounders: () => api.getFinanceFounders(),
  createPayrollFounder: (data: any) => api.createFinanceFounder(data),
  updatePayrollFounder: (id: string, data: any) => api.updateFinanceFounder(id, data),
  deletePayrollFounder: (id: string) => api.deleteFinanceFounder(id),
});
