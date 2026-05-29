-- Add finance account tracking to payments without touching schema.sql.
-- This migration adds a dedicated account table, links payments to clients and accounts,
-- and seeds the access-control entries needed by the finance module.

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null default 'bank_account',
  bank_name text,
  account_number_last4 text,
  account_holder_name text,
  currency text not null default 'USD',
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_accounts_name_unique_idx
  on public.finance_accounts (lower(name));

create index if not exists finance_accounts_active_idx
  on public.finance_accounts (is_active, name);

drop trigger if exists trg_finance_accounts_touch_updated_at on public.finance_accounts;
create trigger trg_finance_accounts_touch_updated_at
before update on public.finance_accounts
for each row execute function public.touch_updated_at();

alter table if exists public.payments
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists received_at timestamptz;

create index if not exists payments_client_date_idx
  on public.payments (client_id, payment_date desc);

create index if not exists payments_account_date_idx
  on public.payments (account_id, payment_date desc);

create index if not exists payments_received_at_idx
  on public.payments (received_at desc);

create index if not exists payments_project_client_idx
  on public.payments (project_id, client_id);

update public.payments p
set client_id = c.id
from public.clients c
where p.client_id is null
  and lower(trim(coalesce(p.client_name, ''))) = lower(trim(c.name));

update public.payments
set received_at = coalesce(received_at, payment_date::timestamptz)
where received_at is null;

alter table if exists public.finance_accounts enable row level security;

drop policy if exists finance_accounts_select_accessible on public.finance_accounts;
create policy finance_accounts_select_accessible
  on public.finance_accounts
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.accounts.view')
    or public.has_system_permission('finance.accounts.manage')
    or public.has_system_permission('finance.payments.manage')
    or public.has_system_permission('finance.payments.view')
    or public.has_system_permission('finance.view.all')
  );

drop policy if exists finance_accounts_write_accessible on public.finance_accounts;
create policy finance_accounts_write_accessible
  on public.finance_accounts
  for insert
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.accounts.manage')
  );

drop policy if exists finance_accounts_update_accessible on public.finance_accounts;
create policy finance_accounts_update_accessible
  on public.finance_accounts
  for update
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.accounts.manage')
  )
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.accounts.manage')
  );

drop policy if exists finance_accounts_delete_accessible on public.finance_accounts;
create policy finance_accounts_delete_accessible
  on public.finance_accounts
  for delete
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.accounts.manage')
  );

insert into public.permissions (key, name, module, description)
values
  ('finance.accounts.view', 'finance.accounts.view', 'finance', 'View finance accounts'),
  ('finance.accounts.manage', 'finance.accounts.manage', 'finance', 'Manage finance accounts')
on conflict (key) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'finance.accounts.view'
where r.name = 'Manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'finance.accounts.manage'
where r.name = 'Admin'
   or r.name = 'Super Admin'
on conflict do nothing;

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
  v_client_name := nullif(trim(p_payment->>'client_name'), '');

  if v_client_name is null and v_client_id is not null then
    select name into v_client_name
    from public.clients
    where id = v_client_id;
  end if;

  insert into public.payments (
    client_id, client_name, account_id, amount, currency, base_currency, base_amount, payment_date, received_at, payment_method,
    payment_method_other, status, description, project_id,
    received_amount, tax_amount, commission_amount, transaction_fee_amount, product_cost_amount, invoice_id, created_by
  )
  values (
    v_client_id,
    coalesce(v_client_name, 'Client'),
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
  v_account_id uuid;
  v_client_name text;
  v_received_at timestamptz;
begin
  v_client_id := nullif(trim(p_payment->>'client_id'), '')::uuid;
  v_account_id := nullif(trim(p_payment->>'account_id'), '')::uuid;
  v_received_at := nullif(trim(p_payment->>'received_at'), '')::timestamptz;
  v_client_name := nullif(trim(p_payment->>'client_name'), '');

  if v_client_name is null and v_client_id is not null then
    select name into v_client_name
    from public.clients
    where id = v_client_id;
  end if;

  update public.payments
  set
    client_id = coalesce(v_client_id, client_id),
    client_name = coalesce(v_client_name, client_name),
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
    project_id = nullif(trim(p_payment->>'project_id'), '')::uuid,
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

grant select, insert, update, delete on public.finance_accounts to anon, authenticated, service_role;
grant execute on function public.create_finance_payment_secure_v2(jsonb) to anon, authenticated, service_role;
grant execute on function public.update_finance_payment_secure_v2(uuid, jsonb) to anon, authenticated, service_role;
