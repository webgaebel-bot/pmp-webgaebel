-- Finance payment account tracking
-- Adds account-level receipt tracking without touching supabase/schema.sql.
-- This keeps the existing payments module backward-compatible while adding:
--   - client linkage
--   - destination account linkage
--   - received timestamp / reference metadata
--   - a finance accounts master table
--   - a reporting view for client/project/account receipt history

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null default 'bank',
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  bank_name text,
  account_number text,
  iban text,
  branch_name text,
  account_holder_name text,
  currency text not null default 'USD',
  status text not null default 'active',
  is_default boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_accounts_name_unique_idx
  on public.finance_accounts (lower(trim(name)));

create index if not exists finance_accounts_status_idx
  on public.finance_accounts (status);

create index if not exists finance_accounts_default_idx
  on public.finance_accounts (is_default);

create index if not exists finance_accounts_client_id_idx
  on public.finance_accounts (client_id);

create index if not exists finance_accounts_project_id_idx
  on public.finance_accounts (project_id);

drop trigger if exists trg_finance_accounts_touch_updated_at on public.finance_accounts;
create trigger trg_finance_accounts_touch_updated_at
before update on public.finance_accounts
for each row execute function public.touch_updated_at();

alter table if exists public.payments
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists received_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists payment_channel text,
  add column if not exists payer_name text;

create index if not exists payments_client_id_idx
  on public.payments (client_id);

create index if not exists payments_account_id_idx
  on public.payments (account_id);

create index if not exists payments_received_at_idx
  on public.payments (received_at desc);

create index if not exists payments_project_client_received_idx
  on public.payments (project_id, client_id, received_at desc);

create index if not exists payments_invoice_idx
  on public.payments (invoice_id);

-- Backfill the new foreign key where we can safely match the legacy text field.
update public.payments p
set client_id = c.id
from public.clients c
where p.client_id is null
  and nullif(trim(p.client_name), '') is not null
  and lower(trim(c.name)) = lower(trim(p.client_name));

update public.payments
set received_at = coalesce(received_at, payment_date::timestamptz);

-- Keep the current payment RPC working while accepting the new tracking fields.
create or replace function public.create_finance_payment_secure_v2(p_payment jsonb)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.payments;
  v_client_id uuid;
  v_account_id uuid;
  v_client_name text;
  v_received_at timestamptz;
begin
  v_client_id := nullif(trim(p_payment->>'client_id'), '')::uuid;
  v_account_id := nullif(trim(p_payment->>'account_id'), '')::uuid;
  v_received_at := coalesce(nullif(trim(p_payment->>'received_at'), '')::timestamptz, now());

  select c.name
    into v_client_name
  from public.clients c
  where c.id = v_client_id
  limit 1;

  insert into public.payments (
    client_id, client_name, account_id, amount, currency, base_currency, base_amount, payment_date,
    received_at, payment_method, payment_method_other, status, description, project_id,
    commission_assignee_id, received_amount, tax_amount, commission_amount,
    transaction_fee_amount, product_cost_amount, invoice_id, payment_reference, payment_channel,
    payer_name, created_by
  )
  values (
    v_client_id,
    coalesce(nullif(trim(p_payment->>'client_name'), ''), v_client_name, 'Client'),
    v_account_id,
    coalesce((p_payment->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_payment->>'base_currency'), ''), 'USD'),
    coalesce((p_payment->>'base_amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, v_received_at::date, current_date),
    v_received_at,
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
    nullif(trim(p_payment->>'payment_reference'), ''),
    nullif(trim(p_payment->>'payment_channel'), ''),
    nullif(trim(p_payment->>'payer_name'), ''),
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
  v_account_id uuid;
  v_client_name text;
  v_received_at timestamptz;
begin
  v_client_id := nullif(trim(p_payment->>'client_id'), '')::uuid;
  v_account_id := nullif(trim(p_payment->>'account_id'), '')::uuid;
  v_received_at := nullif(trim(p_payment->>'received_at'), '')::timestamptz;

  select c.name
    into v_client_name
  from public.clients c
  where c.id = v_client_id
  limit 1;

  update public.payments
  set
    client_id = coalesce(v_client_id, client_id),
    client_name = coalesce(nullif(trim(p_payment->>'client_name'), ''), v_client_name, client_name),
    account_id = coalesce(v_account_id, account_id),
    amount = coalesce((p_payment->>'amount')::numeric, amount),
    currency = coalesce(nullif(trim(p_payment->>'currency'), ''), currency),
    base_currency = coalesce(nullif(trim(p_payment->>'base_currency'), ''), base_currency),
    base_amount = coalesce((p_payment->>'base_amount')::numeric, base_amount),
    payment_date = coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, payment_date),
    received_at = coalesce(v_received_at, received_at),
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
    payment_reference = nullif(trim(p_payment->>'payment_reference'), ''),
    payment_channel = nullif(trim(p_payment->>'payment_channel'), ''),
    payer_name = nullif(trim(p_payment->>'payer_name'), ''),
    updated_at = now()
  where id = p_payment_id
  returning * into v_result;

  return next v_result;
end;
$$;

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
  a.bank_name,
  p.amount,
  p.currency,
  p.base_currency,
  p.base_amount,
  p.converted_amount,
  p.payment_date,
  p.received_at,
  p.payment_method,
  p.payment_reference,
  p.payment_channel,
  p.payer_name,
  p.status,
  p.description,
  p.received_amount,
  p.tax_amount,
  p.commission_amount,
  p.transaction_fee_amount,
  p.product_cost_amount,
  p.invoice_id,
  p.created_by,
  p.created_at,
  p.updated_at
from public.payments p
left join public.clients c on c.id = p.client_id
left join public.projects pr on pr.id = p.project_id
left join public.finance_accounts a on a.id = p.account_id;

create or replace view public.finance_accounts_with_context as
select
  a.*,
  c.name as client_name,
  pr.name as project_name
from public.finance_accounts a
left join public.clients c on c.id = a.client_id
left join public.projects pr on pr.id = a.project_id;
