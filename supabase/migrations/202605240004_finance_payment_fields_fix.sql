-- Ensure payment finance fields exist on the payments table.
-- This patch is required for older deployments that still lack the new payment columns.

alter table if exists public.payments
  add column if not exists base_currency text not null default 'USD',
  add column if not exists base_amount numeric(18,4) not null default 0,
  add column if not exists transaction_fee_amount numeric(14,2) not null default 0,
  add column if not exists product_cost_amount numeric(14,2) not null default 0;
