-- Ensure FX rates table exists for currency conversion paths used by finance calculations.

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
  ('USD', 'PKR', 285.00000000),
  ('USD', 'AED', 3.67250000),
  ('USD', 'EUR', 0.92000000),
  ('PKR', 'USD', 0.00350877),
  ('AED', 'USD', 0.27229400),
  ('EUR', 'USD', 1.08695652)
on conflict (base_currency, target_currency) do update
set rate = excluded.rate,
    updated_at = now();
