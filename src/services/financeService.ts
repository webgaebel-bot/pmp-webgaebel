import type { SupabaseApiService } from '@/services/supabaseApi';

export const createFinanceService = (
  api: Pick<
    SupabaseApiService,
    | 'getFinanceClients'
    | 'createFinanceClient'
    | 'deleteFinanceClient'
    | 'getFinanceExpenses'
    | 'createFinanceExpense'
    | 'deleteFinanceExpense'
    | 'getFinancePayments'
    | 'createFinancePayment'
    | 'deleteFinancePayment'
    | 'getFinanceFounders'
    | 'createFinanceFounder'
    | 'updateFinanceFounder'
    | 'deleteFinanceFounder'
    | 'getFoundersEquityTotal'
    | 'getFinanceSettings'
    | 'saveFinanceSettings'
    | 'getFinanceStats'
    | 'getFinanceChart'
  >
) => ({
  getFinanceClients: () => api.getFinanceClients(),
  createFinanceClient: (data: any) => api.createFinanceClient(data),
  deleteFinanceClient: (id: string) => api.deleteFinanceClient(id),
  getFinanceExpenses: () => api.getFinanceExpenses(),
  createFinanceExpense: (data: any) => api.createFinanceExpense(data),
  deleteFinanceExpense: (id: string) => api.deleteFinanceExpense(id),
  getFinancePayments: () => api.getFinancePayments(),
  createFinancePayment: (data: any) => api.createFinancePayment(data),
  deleteFinancePayment: (id: string) => api.deleteFinancePayment(id),
  getFinanceFounders: () => api.getFinanceFounders(),
  createFinanceFounder: (data: any) => api.createFinanceFounder(data),
  updateFinanceFounder: (id: string, data: any) => api.updateFinanceFounder(id, data),
  deleteFinanceFounder: (id: string) => api.deleteFinanceFounder(id),
  getFoundersEquityTotal: () => api.getFoundersEquityTotal(),
  getFinanceSettings: () => api.getFinanceSettings(),
  saveFinanceSettings: (data: any) => api.saveFinanceSettings(data),
  getFinanceStats: (range: string) => api.getFinanceStats(range),
  getFinanceChart: (range: string) => api.getFinanceChart(range),
});
