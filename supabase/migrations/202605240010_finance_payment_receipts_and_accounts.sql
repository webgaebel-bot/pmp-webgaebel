-- Add normalized finance payment receipt tracking without editing schema.sql.
-- This keeps the existing payments module backward-compatible while adding:
--   - client linkage
--   - account linkage
--   - a dedicated finance accounts master table
--   - a reporting view for client/project/account payment history

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null default 'bank',
  bank_name text,
  account_number text,
  iban text,
  currency text not null default 'USD',
  opening_balance numeric(18,4) not null default 0,
  current_balance numeric(18,4) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_accounts_name_unique_idx
  on public.finance_accounts ((lower(name)));

create index if not exists finance_accounts_type_idx
  on public.finance_accounts (account_type);

create index if not exists finance_accounts_active_idx
  on public.finance_accounts (is_active);

drop trigger if exists trg_finance_accounts_touch_updated_at on public.finance_accounts;
create trigger trg_finance_accounts_touch_updated_at
before update on public.finance_accounts
for each row execute function public.touch_updated_at();

alter table if exists public.payments
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists received_at timestamptz;

create index if not exists payments_client_idx
  on public.payments (client_id);

create index if not exists payments_account_idx
  on public.payments (account_id);

create index if not exists payments_client_project_date_idx
  on public.payments (client_id, project_id, payment_date desc);

create index if not exists payments_invoice_idx
  on public.payments (invoice_id);

-- Backfill client links from the legacy text field where we can match safely.
update public.payments p
set client_id = (
  select c.id
  from public.clients c
  where nullif(trim(p.client_name), '') is not null
    and lower(trim(c.name)) = lower(trim(p.client_name))
  order by c.created_at asc
  limit 1
)
where p.client_id is null
  and nullif(trim(p.client_name), '') is not null;

-- Keep client summary fields aligned with the newly linked receipts.
update public.clients c
set
  total_revenue = coalesce((
    select sum(coalesce(p.converted_amount, p.base_amount, p.amount, 0))
    from public.payments p
    where p.client_id = c.id
      and lower(coalesce(p.status, '')) in ('completed', 'paid', 'received')
  ), 0),
  last_payment_date = (
    select max(p.payment_date)
    from public.payments p
    where p.client_id = c.id
      and lower(coalesce(p.status, '')) in ('completed', 'paid', 'received')
  );

create or replace function public.sync_client_payment_summary_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_client_ids uuid[] := array[]::uuid[];
begin
  if tg_op = 'INSERT' then
    if new.client_id is not null then
      v_client_ids := array_append(v_client_ids, new.client_id);
    end if;
  elsif tg_op = 'UPDATE' then
    if old.client_id is not null then
      v_client_ids := array_append(v_client_ids, old.client_id);
    end if;
    if new.client_id is not null and new.client_id is distinct from old.client_id then
      v_client_ids := array_append(v_client_ids, new.client_id);
    end if;
  elsif tg_op = 'DELETE' then
    if old.client_id is not null then
      v_client_ids := array_append(v_client_ids, old.client_id);
    end if;
  end if;

  if coalesce(array_length(v_client_ids, 1), 0) = 0 then
    return null;
  end if;

  foreach v_client_id in array v_client_ids loop
    update public.clients c
    set
      total_revenue = coalesce((
        select sum(coalesce(p.converted_amount, p.base_amount, p.amount, 0))
        from public.payments p
        where p.client_id = c.id
          and lower(coalesce(p.status, '')) in ('completed', 'paid', 'received')
      ), 0),
      last_payment_date = (
        select max(p.payment_date)
        from public.payments p
        where p.client_id = c.id
          and lower(coalesce(p.status, '')) in ('completed', 'paid', 'received')
      )
    where c.id = v_client_id;
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_payments_sync_client_summary on public.payments;
create trigger trg_payments_sync_client_summary
after insert or update or delete on public.payments
for each row execute function public.sync_client_payment_summary_v2();

create or replace view public.finance_payment_receipts as
select
  p.id as payment_id,
  p.client_id,
  coalesce(c.name, p.client_name) as client_name,
  p.project_id,
  pr.name as project_name,
  p.account_id,
  a.name as account_name,
  a.account_type,
  p.invoice_id,
  p.amount,
  p.currency,
  p.base_currency,
  p.base_amount,
  p.converted_amount,
  p.payment_date,
  p.received_at,
  p.payment_method,
  p.payment_method_other,
  p.status,
  p.description,
  p.received_amount,
  p.tax_amount,
  p.commission_amount,
  p.transaction_fee_amount,
  p.product_cost_amount,
  p.created_by,
  p.created_at,
  p.updated_at
from public.payments p
left join public.clients c on c.id = p.client_id
left join public.projects pr on pr.id = p.project_id
left join public.finance_accounts a on a.id = p.account_id;

create or replace function public.create_finance_payment_secure_v2(p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
  v_client_name text;
begin
  select c.name
    into v_client_name
  from public.clients c
  where c.id = nullif(trim(p_payment->>'client_id'), '')::uuid
  limit 1;

  insert into public.payments (
    client_id, client_name, account_id, amount, currency, base_currency, base_amount, payment_date,
    received_at, payment_method, payment_method_other, status, description, project_id,
    commission_assignee_id, received_amount, tax_amount, commission_amount,
    transaction_fee_amount, product_cost_amount, invoice_id, created_by
  )
  values (
    nullif(trim(p_payment->>'client_id'), '')::uuid,
    coalesce(nullif(trim(p_payment->>'client_name'), ''), v_client_name, 'Client'),
    nullif(trim(p_payment->>'account_id'), '')::uuid,
    coalesce((p_payment->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_payment->>'base_currency'), ''), 'USD'),
    coalesce((p_payment->>'base_amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, current_date),
    nullif(trim(p_payment->>'received_at'), '')::timestamptz,
    coalesce(nullif(trim(p_payment->>'payment_method'), ''), 'bank_transfer'),
    nullif(trim(p_payment->>'payment_method_other'), ''),
    coalesce(nullif(trim(p_payment->>'status'), ''), 'completed'),
    nullif(trim(p_payment->>'description'), ''),
    nullif(trim(p_payment->>'project_id'), '')::uuid,
    nullif(trim(p_payment->>'commission_assignee_id'), '')::uuid,
    coalesce((p_payment->>'received_amount')::numeric, 0),
    coalesce((p_payment->>'tax_amount')::numeric, 0),
    coalesce((p_payment->>'commission_amount')::numeric, 0),
    coalesce((p_payment->>'transaction_fee_amount')::numeric, 0),
    coalesce((p_payment->>'product_cost_amount')::numeric, 0),
    nullif(trim(p_payment->>'invoice_id'), ''),
    auth.uid()
  )
  returning * into v_result;

  return next v_result;
end;
$$;

create or replace function public.update_finance_payment_secure_v2(p_payment_id uuid, p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
  v_client_name text;
begin
  select c.name
    into v_client_name
  from public.clients c
  where c.id = nullif(trim(p_payment->>'client_id'), '')::uuid
  limit 1;

  update public.payments
  set
    client_id = coalesce(nullif(trim(p_payment->>'client_id'), '')::uuid, client_id),
    client_name = coalesce(nullif(trim(p_payment->>'client_name'), ''), v_client_name, client_name),
    account_id = coalesce(nullif(trim(p_payment->>'account_id'), '')::uuid, account_id),
    amount = coalesce((p_payment->>'amount')::numeric, amount),
    currency = coalesce(nullif(trim(p_payment->>'currency'), ''), currency),
    base_currency = coalesce(nullif(trim(p_payment->>'base_currency'), ''), base_currency),
    base_amount = coalesce((p_payment->>'base_amount')::numeric, base_amount),
    payment_date = coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, payment_date),
    received_at = coalesce(nullif(trim(p_payment->>'received_at'), '')::timestamptz, received_at),
    payment_method = coalesce(nullif(trim(p_payment->>'payment_method'), ''), payment_method),
    payment_method_other = nullif(trim(p_payment->>'payment_method_other'), ''),
    status = coalesce(nullif(trim(p_payment->>'status'), ''), status),
    description = nullif(trim(p_payment->>'description'), ''),
    project_id = coalesce(nullif(trim(p_payment->>'project_id'), '')::uuid, project_id),
    commission_assignee_id = coalesce(nullif(trim(p_payment->>'commission_assignee_id'), '')::uuid, commission_assignee_id),
    received_amount = coalesce((p_payment->>'received_amount')::numeric, received_amount),
    tax_amount = coalesce((p_payment->>'tax_amount')::numeric, tax_amount),
    commission_amount = coalesce((p_payment->>'commission_amount')::numeric, commission_amount),
    transaction_fee_amount = coalesce((p_payment->>'transaction_fee_amount')::numeric, transaction_fee_amount),
    product_cost_amount = coalesce((p_payment->>'product_cost_amount')::numeric, product_cost_amount),
    invoice_id = coalesce(nullif(trim(p_payment->>'invoice_id'), ''), invoice_id),
    updated_at = now()
  where id = p_payment_id
  returning * into v_result;

  return next v_result;
end;
$$;

alter table if exists public.finance_accounts disable row level security;
alter table if exists public.payments disable row level security;

grant select, insert, update, delete on public.finance_accounts to anon, authenticated, service_role;
grant select, insert, update, delete on public.payments to anon, authenticated, service_role;
grant select on public.finance_payment_receipts to anon, authenticated, service_role;
grant execute on function public.sync_client_payment_summary_v2() to anon, authenticated, service_role;
grant execute on function public.create_finance_payment_secure_v2(jsonb) to anon, authenticated, service_role;
grant execute on function public.update_finance_payment_secure_v2(uuid, jsonb) to anon, authenticated, service_role;
