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
    | 'updateFinancePayment'
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
    | 'generatePaymentPlan'
    | 'getPaymentPlansForProject'
    | 'receiveInstallmentPayment'
    | 'createCommissionRecord'
    | 'runSalaryRun'
    | 'distributeFounderProfits'
    | 'recordFutureFund'
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
  updateFinancePayment: (id: string, data: any) => (api as any).updateFinancePayment(id, data),
  deleteFinancePayment: (id: string) => api.deleteFinancePayment(id),
  getFinanceFounders: () => api.getFinanceFounders(),
  createFinanceFounder: (data: any) => api.createFinanceFounder(data),
  updateFinanceFounder: (id: string, data: any) => api.updateFinanceFounder(id, data),
  deleteFinanceFounder: (id: string) => api.deleteFinanceFounder(id),
  getFoundersEquityTotal: () => api.getFoundersEquityTotal(),
  getFinanceSettings: () => api.getFinanceSettings(),
  saveFinanceSettings: (data: any) => api.saveFinanceSettings(data),
  getFinanceStats: (range: string, currency?: string, month?: string) => api.getFinanceStats(range, currency, month),
  getFinanceChart: (range: string, currency?: string, month?: string) => api.getFinanceChart(range, currency, month),
  generatePaymentPlan: (projectId: string, name: string | null, schedule: any) => (api as any).generatePaymentPlan(projectId, name, schedule),
  getPaymentPlansForProject: (projectId: string) => (api as any).getPaymentPlansForProject(projectId),
  receiveInstallmentPayment: (installmentId: string, payload: any) => (api as any).receiveInstallmentPayment(installmentId, payload),
  createCommissionRecord: (data: any) => (api as any).createCommissionRecord(data),
  getCommissionRecords: (projectId?: string) => (api as any).getCommissionRecords(projectId),
  payCommission: (commissionId: string, amount?: number) => (api as any).payCommission(commissionId, amount),
  runSalaryRun: (month: string) => (api as any).runSalaryRun(month),
  distributeFounderProfits: (salaryRunId: string) => (api as any).distributeFounderProfits(salaryRunId),
  recordFutureFund: (source: string, sourceId: string | null, amount: number, month?: string, currency?: string) => (api as any).recordFutureFund(source, sourceId, amount, month, currency),
  getFutureFundSummary: (projectId?: string) => (api as any).getFutureFundSummary(projectId),
  paySalaryEntry: (salaryEntryId: string, amount: number, currency?: string) => (api as any).paySalaryEntry(salaryEntryId, amount, currency),
  finalizeAndDistributeFounderProfits: (salaryRunId: string) => (api as any).finalizeAndDistributeFounderProfits(salaryRunId),
});
