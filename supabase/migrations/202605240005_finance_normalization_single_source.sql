-- Standardize finance records around converted_amount and FX audit metadata.
-- This migration backfills legacy rows using the stored fx_rates table so
-- historical calculations stay deterministic after the application switches
-- to a normalized-only finance pipeline.

alter table if exists public.payments
  add column if not exists original_amount numeric(18,4) not null default 0,
  add column if not exists original_currency text not null default 'USD',
  add column if not exists converted_amount numeric(18,4) not null default 0,
  add column if not exists exchange_rate numeric(18,8) not null default 1,
  add column if not exists fx_rate_used numeric(18,8) not null default 1,
  add column if not exists tax_converted_amount numeric(18,4) not null default 0,
  add column if not exists commission_converted_amount numeric(18,4) not null default 0,
  add column if not exists transaction_fee_converted_amount numeric(18,4) not null default 0,
  add column if not exists product_cost_converted_amount numeric(18,4) not null default 0,
  add column if not exists fx_timestamp timestamptz;

alter table if exists public.expenses
  add column if not exists original_amount numeric(18,4) not null default 0,
  add column if not exists original_currency text not null default 'USD',
  add column if not exists base_currency text not null default 'USD',
  add column if not exists exchange_rate numeric(18,8) not null default 1,
  add column if not exists converted_amount numeric(18,4) not null default 0,
  add column if not exists fx_rate_used numeric(18,8) not null default 1,
  add column if not exists fx_timestamp timestamptz;

alter table if exists public.salary_runs
  add column if not exists original_amount numeric(18,4) not null default 0,
  add column if not exists original_currency text not null default 'USD',
  add column if not exists base_currency text not null default 'USD',
  add column if not exists exchange_rate numeric(18,8) not null default 1,
  add column if not exists converted_amount numeric(18,4) not null default 0,
  add column if not exists fx_rate_used numeric(18,8) not null default 1,
  add column if not exists fx_timestamp timestamptz;

alter table if exists public.future_fund_transactions
  add column if not exists original_amount numeric(18,4) not null default 0,
  add column if not exists original_currency text not null default 'USD',
  add column if not exists base_currency text not null default 'USD',
  add column if not exists exchange_rate numeric(18,8) not null default 1,
  add column if not exists converted_amount numeric(18,4) not null default 0,
  add column if not exists fx_rate_used numeric(18,8) not null default 1,
  add column if not exists fx_timestamp timestamptz;

with finance_base as (
  select coalesce(
    (select setting_value from public.finance_settings where setting_key = 'base_currency' limit 1),
    'USD'
  )::text as base_currency
),
payment_fx as (
  select
    p.id,
    coalesce(nullif(trim(p.base_currency), ''), fb.base_currency) as normalized_base_currency,
    coalesce(
      direct.rate,
      case when inverse.rate > 0 then 1 / inverse.rate end,
      1
    )::numeric(18,8) as normalized_fx_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as normalized_fx_timestamp
  from public.payments p
  cross join finance_base fb
  left join public.fx_rates direct
    on direct.base_currency = coalesce(nullif(trim(p.currency), ''), fb.base_currency)
   and direct.target_currency = coalesce(nullif(trim(p.base_currency), ''), fb.base_currency)
  left join public.fx_rates inverse
    on inverse.base_currency = coalesce(nullif(trim(p.base_currency), ''), fb.base_currency)
   and inverse.target_currency = coalesce(nullif(trim(p.currency), ''), fb.base_currency)
)
update public.payments p
set base_currency = payment_fx.normalized_base_currency,
    original_amount = coalesce(p.amount, 0),
    original_currency = coalesce(nullif(trim(p.currency), ''), payment_fx.normalized_base_currency),
    exchange_rate = payment_fx.normalized_fx_rate,
    fx_rate_used = payment_fx.normalized_fx_rate,
    fx_timestamp = payment_fx.normalized_fx_timestamp,
    converted_amount = coalesce(nullif(p.base_amount, 0), round(coalesce(p.amount, 0)::numeric * payment_fx.normalized_fx_rate, 4)),
    tax_converted_amount = round(coalesce(p.tax_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
    commission_converted_amount = round(coalesce(p.commission_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
    transaction_fee_converted_amount = round(coalesce(p.transaction_fee_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
    product_cost_converted_amount = round(coalesce(p.product_cost_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4)
from payment_fx
where p.id = payment_fx.id;

with finance_base as (
  select coalesce(
    (select setting_value from public.finance_settings where setting_key = 'base_currency' limit 1),
    'USD'
  )::text as base_currency
),
expense_fx as (
  select
    e.id,
    fb.base_currency as normalized_base_currency,
    coalesce(
      direct.rate,
      case when inverse.rate > 0 then 1 / inverse.rate end,
      1
    )::numeric(18,8) as normalized_fx_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as normalized_fx_timestamp
  from public.expenses e
  cross join finance_base fb
  left join public.fx_rates direct
    on direct.base_currency = coalesce(nullif(trim(e.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join public.fx_rates inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(e.currency), ''), fb.base_currency)
)
update public.expenses e
set base_currency = expense_fx.normalized_base_currency,
    original_amount = coalesce(e.amount, 0),
    original_currency = coalesce(nullif(trim(e.currency), ''), expense_fx.normalized_base_currency),
    exchange_rate = expense_fx.normalized_fx_rate,
    fx_rate_used = expense_fx.normalized_fx_rate,
    fx_timestamp = expense_fx.normalized_fx_timestamp,
    converted_amount = round(coalesce(e.amount, 0)::numeric * expense_fx.normalized_fx_rate, 4)
from expense_fx
where e.id = expense_fx.id;

with finance_base as (
  select coalesce(
    (select setting_value from public.finance_settings where setting_key = 'base_currency' limit 1),
    'USD'
  )::text as base_currency
),
salary_fx as (
  select
    s.id,
    fb.base_currency as normalized_base_currency,
    coalesce(
      direct.rate,
      case when inverse.rate > 0 then 1 / inverse.rate end,
      1
    )::numeric(18,8) as normalized_fx_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as normalized_fx_timestamp
  from public.salary_runs s
  cross join finance_base fb
  left join public.fx_rates direct
    on direct.base_currency = coalesce(nullif(trim(s.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join public.fx_rates inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(s.currency), ''), fb.base_currency)
)
update public.salary_runs s
set base_currency = salary_fx.normalized_base_currency,
    original_amount = coalesce(s.total_salary, 0),
    original_currency = coalesce(nullif(trim(s.currency), ''), salary_fx.normalized_base_currency),
    exchange_rate = salary_fx.normalized_fx_rate,
    fx_rate_used = salary_fx.normalized_fx_rate,
    fx_timestamp = salary_fx.normalized_fx_timestamp,
    converted_amount = round(coalesce(s.total_salary, 0)::numeric * salary_fx.normalized_fx_rate, 4)
from salary_fx
where s.id = salary_fx.id;

with finance_base as (
  select coalesce(
    (select setting_value from public.finance_settings where setting_key = 'base_currency' limit 1),
    'USD'
  )::text as base_currency
),
future_fx as (
  select
    f.id,
    fb.base_currency as normalized_base_currency,
    coalesce(
      direct.rate,
      case when inverse.rate > 0 then 1 / inverse.rate end,
      1
    )::numeric(18,8) as normalized_fx_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as normalized_fx_timestamp
  from public.future_fund_transactions f
  cross join finance_base fb
  left join public.fx_rates direct
    on direct.base_currency = coalesce(nullif(trim(f.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join public.fx_rates inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(f.currency), ''), fb.base_currency)
)
update public.future_fund_transactions f
set base_currency = future_fx.normalized_base_currency,
    original_amount = coalesce(f.amount, 0),
    original_currency = coalesce(nullif(trim(f.currency), ''), future_fx.normalized_base_currency),
    exchange_rate = future_fx.normalized_fx_rate,
    fx_rate_used = future_fx.normalized_fx_rate,
    fx_timestamp = future_fx.normalized_fx_timestamp,
    converted_amount = round(coalesce(f.amount, 0)::numeric * future_fx.normalized_fx_rate, 4)
from future_fx
where f.id = future_fx.id;
