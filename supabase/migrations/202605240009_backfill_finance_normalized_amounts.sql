-- Backfill legacy finance rows that still have zero or missing normalized amounts.
-- This keeps dashboard totals deterministic without relying on raw amounts at read time.

create temporary table if not exists finance_fx_backfill (
  source_table text not null,
  row_id text not null,
  original_currency text not null,
  base_currency text not null,
  exchange_rate numeric(18,8) not null,
  fx_timestamp timestamptz not null
) on commit drop;

truncate finance_fx_backfill;

with finance_base as (
  select coalesce(
    (select setting_value from public.finance_settings where setting_key = 'base_currency' limit 1),
    'USD'
  )::text as base_currency
),
fx_lookup as (
  select
    upper(base_currency) as base_currency,
    upper(target_currency) as target_currency,
    rate::numeric(18,8) as rate,
    updated_at
  from public.fx_rates
),
resolved_fx as (
  select
    'payments'::text as source_table,
    p.id::text as row_id,
    coalesce(nullif(trim(p.currency), ''), fb.base_currency) as original_currency,
    fb.base_currency as base_currency,
    coalesce(direct.rate, case when inverse.rate > 0 then 1 / inverse.rate end, 1)::numeric(18,8) as exchange_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as fx_timestamp
  from public.payments p
  cross join finance_base fb
  left join fx_lookup direct
    on direct.base_currency = coalesce(nullif(trim(p.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join fx_lookup inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(p.currency), ''), fb.base_currency)

  union all

  select
    'expenses'::text as source_table,
    e.id::text as row_id,
    coalesce(nullif(trim(e.currency), ''), fb.base_currency) as original_currency,
    fb.base_currency as base_currency,
    coalesce(direct.rate, case when inverse.rate > 0 then 1 / inverse.rate end, 1)::numeric(18,8) as exchange_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as fx_timestamp
  from public.expenses e
  cross join finance_base fb
  left join fx_lookup direct
    on direct.base_currency = coalesce(nullif(trim(e.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join fx_lookup inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(e.currency), ''), fb.base_currency)

  union all

  select
    'salary_runs'::text as source_table,
    s.id::text as row_id,
    coalesce(nullif(trim(s.currency), ''), fb.base_currency) as original_currency,
    fb.base_currency as base_currency,
    coalesce(direct.rate, case when inverse.rate > 0 then 1 / inverse.rate end, 1)::numeric(18,8) as exchange_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as fx_timestamp
  from public.salary_runs s
  cross join finance_base fb
  left join fx_lookup direct
    on direct.base_currency = coalesce(nullif(trim(s.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join fx_lookup inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(s.currency), ''), fb.base_currency)

  union all

  select
    'future_fund_transactions'::text as source_table,
    f.id::text as row_id,
    coalesce(nullif(trim(f.currency), ''), fb.base_currency) as original_currency,
    fb.base_currency as base_currency,
    coalesce(direct.rate, case when inverse.rate > 0 then 1 / inverse.rate end, 1)::numeric(18,8) as exchange_rate,
    coalesce(direct.updated_at, inverse.updated_at, now()) as fx_timestamp
  from public.future_fund_transactions f
  cross join finance_base fb
  left join fx_lookup direct
    on direct.base_currency = coalesce(nullif(trim(f.currency), ''), fb.base_currency)
   and direct.target_currency = fb.base_currency
  left join fx_lookup inverse
    on inverse.base_currency = fb.base_currency
   and inverse.target_currency = coalesce(nullif(trim(f.currency), ''), fb.base_currency)

  union all

  select
    'salary_entries'::text as source_table,
    se.id::text as row_id,
    coalesce(nullif(trim(sr.currency), ''), fb.base_currency) as original_currency,
    coalesce(nullif(trim(sr.base_currency), ''), fb.base_currency) as base_currency,
    coalesce(sr.exchange_rate, sr.fx_rate_used, 1)::numeric(18,8) as exchange_rate,
    coalesce(sr.fx_timestamp, now()) as fx_timestamp
  from public.salary_entries se
  left join public.salary_runs sr
    on sr.id = se.salary_run_id
  cross join finance_base fb
)
insert into finance_fx_backfill (source_table, row_id, original_currency, base_currency, exchange_rate, fx_timestamp)
select source_table, row_id, original_currency, base_currency, exchange_rate, fx_timestamp
from resolved_fx;

update public.payments p
set
  original_amount = coalesce(nullif(p.original_amount, 0), p.amount, 0),
  original_currency = coalesce(nullif(trim(p.original_currency), ''), ff.original_currency, ff.base_currency),
  base_currency = ff.base_currency,
  exchange_rate = ff.exchange_rate,
  fx_rate_used = ff.exchange_rate,
  fx_timestamp = ff.fx_timestamp,
  converted_amount = case
    when coalesce(p.converted_amount, 0) > 0 then p.converted_amount
    else round(coalesce(p.amount, 0)::numeric * ff.exchange_rate, 4)
  end,
  tax_converted_amount = case
    when coalesce(p.tax_converted_amount, 0) > 0 then p.tax_converted_amount
    else round(coalesce(p.tax_amount, 0)::numeric * ff.exchange_rate, 4)
  end,
  commission_converted_amount = case
    when coalesce(p.commission_converted_amount, 0) > 0 then p.commission_converted_amount
    else round(coalesce(p.commission_amount, 0)::numeric * ff.exchange_rate, 4)
  end,
  transaction_fee_converted_amount = case
    when coalesce(p.transaction_fee_converted_amount, 0) > 0 then p.transaction_fee_converted_amount
    else round(coalesce(p.transaction_fee_amount, 0)::numeric * ff.exchange_rate, 4)
  end,
  product_cost_converted_amount = case
    when coalesce(p.product_cost_converted_amount, 0) > 0 then p.product_cost_converted_amount
    else round(coalesce(p.product_cost_amount, 0)::numeric * ff.exchange_rate, 4)
  end
from finance_fx_backfill ff
where ff.source_table = 'payments'
  and p.id::text = ff.row_id;

update public.expenses e
set
  original_amount = coalesce(nullif(e.original_amount, 0), e.amount, 0),
  original_currency = coalesce(nullif(trim(e.original_currency), ''), ff.original_currency, ff.base_currency),
  base_currency = ff.base_currency,
  exchange_rate = ff.exchange_rate,
  fx_rate_used = ff.exchange_rate,
  fx_timestamp = ff.fx_timestamp,
  converted_amount = case
    when coalesce(e.converted_amount, 0) > 0 then e.converted_amount
    else round(coalesce(e.amount, 0)::numeric * ff.exchange_rate, 4)
  end
from finance_fx_backfill ff
where ff.source_table = 'expenses'
  and e.id::text = ff.row_id;

update public.salary_runs s
set
  original_amount = coalesce(nullif(s.original_amount, 0), s.total_salary, 0),
  original_currency = coalesce(nullif(trim(s.original_currency), ''), ff.original_currency, ff.base_currency),
  base_currency = ff.base_currency,
  exchange_rate = ff.exchange_rate,
  fx_rate_used = ff.exchange_rate,
  fx_timestamp = ff.fx_timestamp,
  converted_amount = case
    when coalesce(s.converted_amount, 0) > 0 then s.converted_amount
    else round(coalesce(s.total_salary, 0)::numeric * ff.exchange_rate, 4)
  end
from finance_fx_backfill ff
where ff.source_table = 'salary_runs'
  and s.id::text = ff.row_id;

update public.future_fund_transactions f
set
  original_amount = coalesce(nullif(f.original_amount, 0), f.amount, 0),
  original_currency = coalesce(nullif(trim(f.original_currency), ''), ff.original_currency, ff.base_currency),
  base_currency = ff.base_currency,
  exchange_rate = ff.exchange_rate,
  fx_rate_used = ff.exchange_rate,
  fx_timestamp = ff.fx_timestamp,
  converted_amount = case
    when coalesce(f.converted_amount, 0) > 0 then f.converted_amount
    else round(coalesce(f.amount, 0)::numeric * ff.exchange_rate, 4)
  end
from finance_fx_backfill ff
where ff.source_table = 'future_fund_transactions'
  and f.id::text = ff.row_id;

update public.salary_entries se
set
  original_amount = coalesce(nullif(se.original_amount, 0), se.total_salary, 0),
  original_currency = coalesce(nullif(trim(se.original_currency), ''), ff.original_currency, ff.base_currency),
  base_currency = ff.base_currency,
  exchange_rate = ff.exchange_rate,
  fx_rate_used = ff.exchange_rate,
  fx_timestamp = ff.fx_timestamp,
  converted_amount = case
    when coalesce(se.converted_amount, 0) > 0 then se.converted_amount
    else round(coalesce(se.total_salary, 0)::numeric * ff.exchange_rate, 4)
  end
from finance_fx_backfill ff
where ff.source_table = 'salary_entries'
  and se.id::text = ff.row_id;
