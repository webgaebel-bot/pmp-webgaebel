-- Normalize salary entries so dashboard queries can aggregate them safely.
-- Adds the missing converted_amount and FX audit columns, then backfills
-- historical rows from the linked salary run snapshot where available.

alter table if exists public.salary_entries
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
entry_fx as (
  select
    se.id,
    coalesce(nullif(trim(sr.currency), ''), fb.base_currency) as normalized_original_currency,
    coalesce(nullif(trim(sr.base_currency), ''), fb.base_currency) as normalized_base_currency,
    coalesce(sr.exchange_rate, sr.fx_rate_used, 1)::numeric(18,8) as normalized_fx_rate,
    coalesce(sr.fx_timestamp, now()) as normalized_fx_timestamp
  from public.salary_entries se
  left join public.salary_runs sr
    on sr.id = se.salary_run_id
  cross join finance_base fb
)
update public.salary_entries se
set original_amount = coalesce(se.total_salary, 0),
    original_currency = ef.normalized_original_currency,
    base_currency = ef.normalized_base_currency,
    exchange_rate = ef.normalized_fx_rate,
    fx_rate_used = ef.normalized_fx_rate,
    fx_timestamp = ef.normalized_fx_timestamp,
    converted_amount = round(coalesce(se.total_salary, 0)::numeric * ef.normalized_fx_rate, 4)
from entry_fx ef
where se.id = ef.id;
