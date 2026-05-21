export interface FinanceSummaryInput {
  revenue: number;
  expenses: number;
  salaries?: number;
  taxes?: number;
  commissions?: number;
  futureFundRate?: number;
}

export interface FinanceSummary {
  revenue: number;
  expenses: number;
  salaries: number;
  taxes: number;
  commissions: number;
  grossProfit: number;
  futureFund: number;
  founderProfit: number;
  liabilities: number;
  netProfit: number;
}

const round = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const calculateFinanceSummary = (input: FinanceSummaryInput): FinanceSummary => {
  const revenue = round(input.revenue || 0);
  const expenses = round(input.expenses || 0);
  const salaries = round(input.salaries || 0);
  const taxes = round(input.taxes || 0);
  const commissions = round(input.commissions || 0);
  const grossProfit = round(revenue - expenses - salaries - taxes - commissions);
  const futureFundRate = Math.min(100, Math.max(0, Number(input.futureFundRate ?? 10)));
  const futureFund = round(grossProfit * (futureFundRate / 100));
  const founderProfit = round(grossProfit - futureFund);
  const liabilities = round(salaries + taxes + commissions);
  const netProfit = founderProfit;

  return {
    revenue,
    expenses,
    salaries,
    taxes,
    commissions,
    grossProfit,
    futureFund,
    founderProfit,
    liabilities,
    netProfit,
  };
};

export const formatMoney = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
