-- Refresh normalized finance amounts after live FX rate updates.
-- This keeps expenses and payments aligned with the latest stored fx_rates.

create or replace function public.auto_convert_expense_currency()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with finance_base as (
    select coalesce(
      (select setting_value from public.finance_settings where setting_key = 'base_currency' limit 1),
      'USD'
    )::text as base_currency
  ),
  expense_fx as (
    select
      e.id,
      source_currency,
      upper(fb.base_currency) as normalized_base_currency,
      case
        when source_currency = upper(fb.base_currency) then 1
        when source_currency = 'USD' then coalesce(
          usd_to_base.rate,
          case when base_to_usd.rate > 0 then 1 / base_to_usd.rate end,
          1
        )
        when upper(fb.base_currency) = 'USD' then coalesce(
          source_to_usd.rate,
          case when usd_to_source.rate > 0 then 1 / usd_to_source.rate end,
          1
        )
        else coalesce(
          source_to_usd.rate,
          case when usd_to_source.rate > 0 then 1 / usd_to_source.rate end,
          1
        ) * coalesce(
          usd_to_base.rate,
          case when base_to_usd.rate > 0 then 1 / base_to_usd.rate end,
          1
        )
      end::numeric(18,8) as normalized_fx_rate,
      coalesce(
        greatest(
          coalesce(source_to_usd.updated_at, now()),
          coalesce(usd_to_base.updated_at, now())
        ),
        now()
      ) as normalized_fx_timestamp
    from public.expenses e
    cross join finance_base fb
    left join lateral (
      select upper(coalesce(nullif(trim(e.currency), ''), 'USD')) as source_currency
    ) currency on true
    left join public.fx_rates source_to_usd
      on upper(source_to_usd.base_currency) = source_currency
     and upper(source_to_usd.target_currency) = 'USD'
    left join public.fx_rates usd_to_source
      on upper(usd_to_source.base_currency) = 'USD'
     and upper(usd_to_source.target_currency) = source_currency
    left join public.fx_rates usd_to_base
      on upper(usd_to_base.base_currency) = 'USD'
     and upper(usd_to_base.target_currency) = upper(fb.base_currency)
    left join public.fx_rates base_to_usd
      on upper(base_to_usd.base_currency) = upper(fb.base_currency)
     and upper(base_to_usd.target_currency) = 'USD'
    where source_currency <> 'USD'
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
  payment_fx as (
    select
      p.id,
      source_currency,
      upper(fb.base_currency) as normalized_base_currency,
      case
        when source_currency = upper(fb.base_currency) then 1
        when source_currency = 'USD' then coalesce(
          usd_to_base.rate,
          case when base_to_usd.rate > 0 then 1 / base_to_usd.rate end,
          1
        )
        when upper(fb.base_currency) = 'USD' then coalesce(
          source_to_usd.rate,
          case when usd_to_source.rate > 0 then 1 / usd_to_source.rate end,
          1
        )
        else coalesce(
          source_to_usd.rate,
          case when usd_to_source.rate > 0 then 1 / usd_to_source.rate end,
          1
        ) * coalesce(
          usd_to_base.rate,
          case when base_to_usd.rate > 0 then 1 / base_to_usd.rate end,
          1
        )
      end::numeric(18,8) as normalized_fx_rate,
      coalesce(
        greatest(
          coalesce(source_to_usd.updated_at, now()),
          coalesce(usd_to_base.updated_at, now())
        ),
        now()
      ) as normalized_fx_timestamp
    from public.payments p
    cross join finance_base fb
    left join lateral (
      select upper(coalesce(nullif(trim(p.currency), ''), 'USD')) as source_currency
    ) currency on true
    left join public.fx_rates source_to_usd
      on upper(source_to_usd.base_currency) = source_currency
     and upper(source_to_usd.target_currency) = 'USD'
    left join public.fx_rates usd_to_source
      on upper(usd_to_source.base_currency) = 'USD'
     and upper(usd_to_source.target_currency) = source_currency
    left join public.fx_rates usd_to_base
      on upper(usd_to_base.base_currency) = 'USD'
     and upper(usd_to_base.target_currency) = upper(fb.base_currency)
    left join public.fx_rates base_to_usd
      on upper(base_to_usd.base_currency) = upper(fb.base_currency)
     and upper(base_to_usd.target_currency) = 'USD'
    where source_currency <> 'USD'
  )
  update public.payments p
  set base_currency = payment_fx.normalized_base_currency,
      original_amount = coalesce(p.amount, 0),
      original_currency = coalesce(nullif(trim(p.currency), ''), payment_fx.normalized_base_currency),
      exchange_rate = payment_fx.normalized_fx_rate,
      fx_rate_used = payment_fx.normalized_fx_rate,
      fx_timestamp = payment_fx.normalized_fx_timestamp,
      base_amount = round(coalesce(p.amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
      converted_amount = round(coalesce(p.amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
      tax_converted_amount = round(coalesce(p.tax_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
      commission_converted_amount = round(coalesce(p.commission_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
      transaction_fee_converted_amount = round(coalesce(p.transaction_fee_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4),
      product_cost_converted_amount = round(coalesce(p.product_cost_amount, 0)::numeric * payment_fx.normalized_fx_rate, 4)
  from payment_fx
  where p.id = payment_fx.id;
end;
$$;
