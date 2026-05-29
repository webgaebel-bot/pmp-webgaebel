-- Finance payment account tracking
-- Adds first-class payment account support and links payments to clients, projects, and receiving accounts

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null default 'bank',
  bank_name text,
  account_number text,
  account_holder_name text,
  currency text not null default 'USD',
  status text not null default 'active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_finance_accounts_touch_updated_at on public.finance_accounts;
create trigger trg_finance_accounts_touch_updated_at
before update on public.finance_accounts
for each row execute function public.touch_updated_at();

alter table if exists public.payments
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists received_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists received_at timestamptz;

create index if not exists finance_accounts_status_idx
  on public.finance_accounts (status);

create index if not exists finance_accounts_type_idx
  on public.finance_accounts (account_type);

create index if not exists payments_client_idx
  on public.payments (client_id);

create index if not exists payments_received_account_idx
  on public.payments (received_account_id);

create index if not exists payments_received_at_idx
  on public.payments (received_at desc);

create or replace function public.create_finance_payment_secure_v2(p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
begin
  insert into public.payments (
    client_name, client_id, amount, currency, base_currency, base_amount, payment_date, received_at,
    payment_method, payment_method_other, status, description, project_id, received_account_id,
    commission_assignee_id, received_amount, tax_amount, commission_amount,
    transaction_fee_amount, product_cost_amount, invoice_id, created_by
  )
  values (
    coalesce(
      nullif(trim(p_payment->>'client_name'), ''),
      (select c.name from public.clients c where c.id = nullif(trim(p_payment->>'client_id'), '')::uuid limit 1),
      'Client'
    ),
    nullif(trim(p_payment->>'client_id'), '')::uuid,
    coalesce((p_payment->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_payment->>'base_currency'), ''), 'USD'),
    coalesce((p_payment->>'base_amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, current_date),
    coalesce(nullif(trim(p_payment->>'received_at'), '')::timestamptz, now()),
    coalesce(nullif(trim(p_payment->>'payment_method'), ''), 'bank_transfer'),
    nullif(trim(p_payment->>'payment_method_other'), ''),
    coalesce(nullif(trim(p_payment->>'status'), ''), 'completed'),
    nullif(trim(p_payment->>'description'), ''),
    nullif(trim(p_payment->>'project_id'), '')::uuid,
    nullif(trim(p_payment->>'received_account_id'), '')::uuid,
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
begin
  update public.payments
  set
    client_name = coalesce(
      nullif(trim(p_payment->>'client_name'), ''),
      client_name
    ),
    client_id = coalesce(nullif(trim(p_payment->>'client_id'), '')::uuid, client_id),
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
    received_account_id = coalesce(nullif(trim(p_payment->>'received_account_id'), '')::uuid, received_account_id),
    commission_assignee_id = coalesce(nullif(trim(p_payment->>'commission_assignee_id'), '')::uuid, commission_assignee_id),
    received_amount = coalesce((p_payment->>'received_amount')::numeric, received_amount),
    tax_amount = coalesce((p_payment->>'tax_amount')::numeric, tax_amount),
    commission_amount = coalesce((p_payment->>'commission_amount')::numeric, commission_amount),
    transaction_fee_amount = coalesce((p_payment->>'transaction_fee_amount')::numeric, transaction_fee_amount),
    product_cost_amount = coalesce((p_payment->>'product_cost_amount')::numeric, product_cost_amount),
    invoice_id = nullif(trim(p_payment->>'invoice_id'), ''),
    updated_at = now()
  where id = p_payment_id
  returning * into v_result;

  return next v_result;
end;
$$;

update public.payments p
set client_id = c.id
from public.clients c
where p.client_id is null
  and lower(trim(p.client_name)) = lower(trim(c.name));

