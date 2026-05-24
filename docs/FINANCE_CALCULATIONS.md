**Finance Flow & Calculations**

This document describes how the finance dashboard numbers are calculated in the codebase and shows the formulas used by the engine.

**Source code**: calculations are implemented in src/lib/financeEngine.ts and assembled in src/services/supabaseApi.ts (functions: `summarizeFinanceRows`, `convertCurrencyAmount`, `getFinanceStats`).

**Key Inputs**
- **Payments (revenue)**: completed payments (gross amount). Tax, commission, transaction fees, product costs are tracked per payment when present.
- **Expenses**: expense records and their amounts.
- **Salary runs**: `salary_runs.total_salary` or computed from `salary_entries`.
- **Finance settings**: percentages for tax, commission, transaction fees, product costs, and future fund rate.

**Primary formulas**

- **Revenue**: sum of payment gross values (payments with `status === 'completed'`).

- **Tax total**: sum of explicit `payment.tax_amount` or, when missing, calculated as

  $\text{tax} = \text{gross_payment} \times \frac{\text{tax_rate}}{100}$

- **Commission total**: sum of explicit `payment.commission_amount` or, when missing, calculated as

  $\text{commission} = \text{gross_payment} \times \frac{\text{commission_pct}}{100}$

- **Transaction Fees total**: for completed payments, either explicit `transaction_fee_amount` or calculated as percentage/fixed depending on `transaction_fee_type`/value.

- **Product Costs total**: similar to transaction fees — explicit if present otherwise calculated based on settings.

- **Salaries total**: sum of `salary_runs.total_salary` (or derived from `salary_entries` if total is missing).

- **Expenses total**: sum of expense amounts.

**Liabilities (code's formula)**

In the code (`src/lib/financeEngine.ts`) liabilities are computed as:

$\text{Liabilities} = \text{Expenses} + \text{Salaries} + \text{Taxes} + \text{TransactionFees} + \text{ProductCosts}$

Note: commissions are not included in `liabilities` in the current implementation — commissions are treated as a deduction affecting profit but not as part of the `liabilities` aggregation.

**Net / Founder Profit flow**
- Gross Profit = Revenue - (Expenses + Salaries + Taxes + Commissions + TransactionFees + ProductCosts)
- Future Fund = max(Gross Profit, 0) * (future_fund_percentage / 100)
- Founder Profit = Gross Profit - Future Fund
- Net Profit = Founder Profit (the dashboard uses `founderProfit` as `netProfit`)

Formally (as in code):

$\text{grossProfit} = \text{revenue} - \text{expenses} - \text{salaries} - \text{taxes} - \text{commissions} - \text{transactionFees} - \text{productCosts}$
$\text{futureFund} = \max(\text{grossProfit}, 0) \times \frac{\text{futureFundRate}}{100}$
$\text{founderProfit} = \text{grossProfit} - \text{futureFund}$
$\text{liabilities} = \text{expenses} + \text{salaries} + \text{taxes} + \text{transactionFees} + \text{productCosts}$

**Example (numbers from your dashboard)**
- Expenses = 2,000
- Salaries = 26,000
- Taxes = 200
- Commissions = 200
- Transaction Fees = 200
- Product Costs = 0

Using the code's liabilities formula:

Liabilities = 2,000 + 26,000 + 200 + 200 + 0 = 28,400

(This matches the dashboard value 28,400.)

If you instead use the formula you suggested (Expenses + Salaries + Taxes + Commission + Fees) that sums to:

2,000 + 26,000 + 200 + 200 + 200 = 28,600 (includes both commissions and fees)

So the dashboard's 28,400 indicates it includes either transaction fees (as the code does) or commissions — but the actual implementation includes transaction fees and excludes commissions from `liabilities`.

**Recommendations**
- If you want commissions included in `liabilities`, update `src/lib/financeEngine.ts` to add `commissions` into the `liabilities` calculation.
- If you prefer liabilities to exclude transaction fees instead, remove `transactionFees` from the liabilities formula.
- After changing the formula, re-run tests / rebuild frontend and verify the dashboard values.

**Files to review**
- `src/lib/financeEngine.ts` — core calculation logic
- `src/services/supabaseApi.ts` — data assembly, currency conversion and normalization
- `src/pages/finance/FinanceDashboard.tsx` — UI presentation and which fields are shown

If you want, I can (choose one):
- update the code to include commissions in liabilities and run quick local checks, or
- add a dashboard toggle to treat commissions as liabilities — tell me which you prefer.

---
Generated on: 2026-05-24
