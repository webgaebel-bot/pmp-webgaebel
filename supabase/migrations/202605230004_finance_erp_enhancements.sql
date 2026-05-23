-- Finance ERP enhancements
-- Adds payment-level deduction storage, salary bonus storage, and finance setting defaults.

alter table if exists public.payments
  add column if not exists transaction_fee_amount numeric(14,2) not null default 0,
  add column if not exists product_cost_amount numeric(14,2) not null default 0;

alter table if exists public.salary_entries
  add column if not exists bonus_amount numeric(14,2) not null default 0;

insert into public.finance_settings (setting_key, setting_value)
values
  ('base_currency', 'USD'),
  ('future_fund_percentage', '10'),
  ('commission_percentage', '15'),
  ('tax_rate', '30'),
  ('transaction_fee_type', 'percentage'),
  ('transaction_fee_value', '0'),
  ('product_cost_enabled', 'false'),
  ('product_cost_type', 'percentage'),
  ('product_cost_value', '0'),
  ('enable_auto_calculation', 'true')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();
