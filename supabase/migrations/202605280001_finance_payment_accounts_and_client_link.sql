-- Add account-level payment tracking without modifying supabase/schema.sql.
-- This migration introduces receiving accounts and links payments to clients,
-- projects, and the destination account where money was received.

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_type text not null default 'bank',
  institution_name text,
  account_number_last4 text,
  account_identifier text,
  currency text not null default 'USD',
  status text not null default 'active',
  is_default boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_finance_accounts_touch_updated_at on public.finance_accounts;
create trigger trg_finance_accounts_touch_updated_at
before update on public.finance_accounts
for each row execute function public.touch_updated_at();

create unique index if not exists finance_accounts_default_unique_idx
  on public.finance_accounts (is_default)
  where is_default = true;

create unique index if not exists finance_accounts_name_unique_idx
  on public.finance_accounts (lower(trim(account_name)));

alter table if exists public.payments
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists received_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists received_at timestamptz,
  add column if not exists transaction_reference text,
  add column if not exists source_account_name text,
  add column if not exists source_account_identifier text;

create index if not exists payments_client_id_idx
  on public.payments (client_id);

create index if not exists payments_received_account_id_idx
  on public.payments (received_account_id);

create index if not exists payments_received_at_idx
  on public.payments (received_at desc);

create index if not exists payments_project_client_date_idx
  on public.payments (project_id, client_id, payment_date desc);

create or replace function public.create_finance_payment_secure_v2(p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
  v_client_id uuid;
  v_received_account_id uuid;
  v_received_at timestamptz;
  v_client_name text;
begin
  v_client_id := nullif(trim(p_payment->>'client_id'), '')::uuid;
  v_received_account_id := nullif(trim(p_payment->>'received_account_id'), '')::uuid;
  v_received_at := coalesce(nullif(trim(p_payment->>'received_at'), '')::timestamptz, now());
  v_client_name := coalesce(
    nullif(trim(p_payment->>'client_name'), ''),
    (select c.name from public.clients c where c.id = v_client_id limit 1),
    'Client'
  );

  insert into public.payments (
    client_id,
    client_name,
    amount,
    currency,
    base_currency,
    base_amount,
    payment_date,
    payment_method,
    payment_method_other,
    status,
    description,
    project_id,
    received_account_id,
    received_at,
    transaction_reference,
    source_account_name,
    source_account_identifier,
    commission_assignee_id,
    received_amount,
    tax_amount,
    commission_amount,
    transaction_fee_amount,
    product_cost_amount,
    invoice_id,
    created_by
  )
  values (
    v_client_id,
    v_client_name,
    coalesce((p_payment->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_payment->>'base_currency'), ''), 'USD'),
    coalesce((p_payment->>'base_amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, v_received_at::date, current_date),
    coalesce(nullif(trim(p_payment->>'payment_method'), ''), 'bank_transfer'),
    nullif(trim(p_payment->>'payment_method_other'), ''),
    coalesce(nullif(trim(p_payment->>'status'), ''), 'completed'),
    nullif(trim(p_payment->>'description'), ''),
    nullif(trim(p_payment->>'project_id'), '')::uuid,
    v_received_account_id,
    v_received_at,
    nullif(trim(p_payment->>'transaction_reference'), ''),
    nullif(trim(p_payment->>'source_account_name'), ''),
    nullif(trim(p_payment->>'source_account_identifier'), ''),
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
  v_client_id uuid;
  v_received_account_id uuid;
  v_received_at timestamptz;
begin
  v_client_id := nullif(trim(p_payment->>'client_id'), '')::uuid;
  v_received_account_id := nullif(trim(p_payment->>'received_account_id'), '')::uuid;
  v_received_at := nullif(trim(p_payment->>'received_at'), '')::timestamptz;

  update public.payments
  set
    client_id = coalesce(v_client_id, client_id),
    client_name = coalesce(
      nullif(trim(p_payment->>'client_name'), ''),
      case when v_client_id is not null then (select c.name from public.clients c where c.id = v_client_id limit 1) end,
      client_name
    ),
    amount = coalesce((p_payment->>'amount')::numeric, amount),
    currency = coalesce(nullif(trim(p_payment->>'currency'), ''), currency),
    base_currency = coalesce(nullif(trim(p_payment->>'base_currency'), ''), base_currency),
    base_amount = coalesce((p_payment->>'base_amount')::numeric, base_amount),
    payment_date = coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, payment_date),
    payment_method = coalesce(nullif(trim(p_payment->>'payment_method'), ''), payment_method),
    payment_method_other = nullif(trim(p_payment->>'payment_method_other'), ''),
    status = coalesce(nullif(trim(p_payment->>'status'), ''), status),
    description = nullif(trim(p_payment->>'description'), ''),
    project_id = nullif(trim(p_payment->>'project_id'), '')::uuid,
    received_account_id = coalesce(v_received_account_id, received_account_id),
    received_at = coalesce(v_received_at, received_at),
    transaction_reference = nullif(trim(p_payment->>'transaction_reference'), ''),
    source_account_name = nullif(trim(p_payment->>'source_account_name'), ''),
    source_account_identifier = nullif(trim(p_payment->>'source_account_identifier'), ''),
    commission_assignee_id = nullif(trim(p_payment->>'commission_assignee_id'), '')::uuid,
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
