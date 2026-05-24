export interface FinanceSummaryInput {
  revenue: number;
  expenses: number;
  salaries?: number;
  taxes?: number;
  commissions?: number;
  transactionFees?: number;
  productCosts?: number;
  futureFundRate?: number;
}

export interface FinanceSummary {
  revenue: number;
  expenses: number;
  salaries: number;
  taxes: number;
  commissions: number;
  transactionFees: number;
  productCosts: number;
  grossProfit: number;
  futureFund: number;
  founderProfit: number;
  liabilities: number;
  netProfit: number;
}

const round = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const assertNormalizedFinanceInput = (input: FinanceSummaryInput) => {
  const forbiddenKeys = ['amount', 'base_amount', 'received_amount', 'currency', 'exchange_rate', 'fx_rate_used', 'fx_timestamp'];
  const presentForbiddenKeys = forbiddenKeys.filter((key) => Object.prototype.hasOwnProperty.call(input as Record<string, unknown>, key));

  if (presentForbiddenKeys.length > 0) {
    throw new Error(
      `calculateFinanceSummary expects normalized totals only. Remove raw finance fields: ${presentForbiddenKeys.join(', ')}.`
    );
  }
};

export const calculateFinanceSummary = (input: FinanceSummaryInput): FinanceSummary => {
  assertNormalizedFinanceInput(input);
  const revenue = round(input.revenue || 0);
  const expenses = round(input.expenses || 0);
  const salaries = round(input.salaries || 0);
  const taxes = round(input.taxes || 0);
  const commissions = round(input.commissions || 0);
  const transactionFees = round(input.transactionFees || 0);
  const productCosts = round(input.productCosts || 0);
  const grossProfit = round(revenue - expenses - salaries - taxes - commissions - transactionFees - productCosts);
  const futureFundRate = Math.min(100, Math.max(0, Number(input.futureFundRate ?? 10)));
  const futureFund = round(Math.max(grossProfit, 0) * (futureFundRate / 100));
  const founderProfit = round(grossProfit - futureFund);
  const liabilities = round(expenses + salaries + taxes + transactionFees + productCosts);
  const netProfit = founderProfit;

  return {
    revenue,
    expenses,
    salaries,
    taxes,
    commissions,
    transactionFees,
    productCosts,
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
