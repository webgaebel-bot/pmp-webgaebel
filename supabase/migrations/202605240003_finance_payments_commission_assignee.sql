-- Add payment commission assignee and keep RPCs in sync with the new field.

alter table if exists public.payments
  add column if not exists commission_assignee_id uuid references public.profiles(id) on delete set null;

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
    client_name, amount, currency, base_currency, base_amount, payment_date, payment_method,
    payment_method_other, status, description, project_id, commission_assignee_id,
    received_amount, tax_amount, commission_amount, transaction_fee_amount, product_cost_amount, invoice_id, created_by
  )
  values (
    coalesce(nullif(trim(p_payment->>'client_name'), ''), 'Client'),
    coalesce((p_payment->>'amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'currency'), ''), 'USD'),
    coalesce(nullif(trim(p_payment->>'base_currency'), ''), 'USD'),
    coalesce((p_payment->>'base_amount')::numeric, 0),
    coalesce(nullif(trim(p_payment->>'payment_date'), '')::date, current_date),
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
begin
  update public.payments
  set
    client_name = coalesce(nullif(trim(p_payment->>'client_name'), ''), client_name),
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
