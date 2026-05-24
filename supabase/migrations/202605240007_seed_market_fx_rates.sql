-- Replace placeholder FX values with the market rates provided by the user.
-- These values are used by the dashboard, currency settings, and historical
-- normalization helpers.

create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency varchar(10) not null,
  target_currency varchar(10) not null,
  rate numeric(18,8) not null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'fx_rates'
      and c.conname = 'fx_rates_base_target_unique'
  ) then
    alter table public.fx_rates
      add constraint fx_rates_base_target_unique unique (base_currency, target_currency);
  end if;
end
$$;

insert into public.fx_rates (base_currency, target_currency, rate)
values
  ('USD', 'PKR', 278.14000000),
  ('PKR', 'USD', 0.00359592),
  ('USD', 'EUR', 0.86206897),
  ('EUR', 'USD', 1.16000000),
  ('USD', 'GBP', 0.74626866),
  ('GBP', 'USD', 1.34000000),
  ('USD', 'AED', 3.70370370),
  ('AED', 'USD', 0.27000000),
  ('EUR', 'PKR', 322.90000000),
  ('PKR', 'EUR', 0.00309663),
  ('GBP', 'PKR', 374.36000000),
  ('PKR', 'GBP', 0.00267056),
  ('AED', 'PKR', 75.86000000),
  ('PKR', 'AED', 0.01318194)
on conflict (base_currency, target_currency) do update
set rate = excluded.rate,
    updated_at = now();
