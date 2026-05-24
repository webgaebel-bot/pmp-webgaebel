-- Payment plans and installments
-- Adds tables to support project payment plans and a helper RPC to generate installments

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Default Plan',
  total_amount numeric(18,4) not null default 0,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payment_plans_touch_updated_at on public.payment_plans;
create trigger trg_payment_plans_touch_updated_at
before update on public.payment_plans
for each row execute function public.touch_updated_at();

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans(id) on delete cascade,
  installment_index integer not null,
  percent numeric(8,4) not null default 0,
  due_amount numeric(18,4) not null default 0,
  due_date date,
  status text not null default 'pending', -- pending / paid / overdue
  received_amount numeric(18,4) not null default 0,
  received_date timestamptz,
  tax_amount numeric(18,4) not null default 0,
  transaction_fee_amount numeric(18,4) not null default 0,
  commission_amount numeric(18,4) not null default 0,
  product_cost_amount numeric(18,4) not null default 0,
  net_income numeric(18,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payment_installments_touch_updated_at on public.payment_installments;
create trigger trg_payment_installments_touch_updated_at
before update on public.payment_installments
for each row execute function public.touch_updated_at();

-- RPC: generate_payment_plan(project_id, name, schedule_json)
-- schedule_json: JSON array of objects with { percent: number, offset_days: integer }
create or replace function public.generate_payment_plan(p_project_id uuid, p_name text, p_schedule jsonb)
returns table(plan_id uuid, installment_id uuid) language plpgsql security definer as $$
declare
  total numeric := 0;
  plan uuid;
  item jsonb;
  idx integer := 0;
  project_row record;
  base_amount numeric := 0;
  d date := now()::date;
begin
  select into project_row id, name, project_value, currency, metadata from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project not found: %', p_project_id;
  end if;

  -- Determine base_amount from project value if available (budget or explicit metadata)
  -- prefer explicit total in schedule call; otherwise try project metadata
  -- Prefer explicit project_value column, fallback to metadata.project_value
  base_amount := coalesce(project_row.project_value, (select coalesce((metadata->>'project_value')::numeric, 0)
                  from public.projects where id = p_project_id limit 1));

  if base_amount is null or base_amount = 0 then
    -- fallback: sum of existing payments if any
    select coalesce(sum(amount),0) into base_amount from public.payments where project_id = p_project_id;
  end if;

  -- If schedule contains explicit total_amount, use it
  begin
    if p_schedule ? 'total_amount' then
      total := (p_schedule->>'total_amount')::numeric;
    end if;
  exception when others then
    total := 0;
  end;

  if total <= 0 then
    total := coalesce(base_amount, 0);
  end if;

  if total <= 0 then
    raise exception 'Unable to determine plan total amount. Provide project value or total_amount in schedule.';
  end if;

  insert into public.payment_plans (project_id, name, total_amount, currency, created_by, metadata)
  values (p_project_id, coalesce(p_name, 'Default Plan'), total, coalesce(project_row.currency, 'USD'), null, '{}'::jsonb)
  returning id into plan;

  for idx in 0 .. jsonb_array_length(p_schedule) - 1 loop
    item := p_schedule->idx;
    insert into public.payment_installments (payment_plan_id, installment_index, percent, due_amount, due_date)
    values (
      plan,
      idx + 1,
      coalesce((item->>'percent')::numeric, 0),
      round(coalesce((item->>'percent')::numeric,0) * total / 100::numeric, 4),
      (now()::date + coalesce((item->>'offset_days')::int, 0))
    ) returning id into installment_id;
    plan_id := plan;
    return next;
  end loop;

  return;
end;
$$;
