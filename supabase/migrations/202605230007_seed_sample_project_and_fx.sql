-- Seed FX rates, a sample project, founders, and a 40/30/30 payment plan

create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency varchar(10) not null,
  target_currency varchar(10) not null,
  rate numeric(18,8) not null,
  updated_at timestamptz not null default now()
);

insert into public.fx_rates (base_currency, target_currency, rate)
values
  ('USD','PKR', 285.00000000),
  ('USD','AED', 3.67250000),
  ('USD','EUR', 0.92)
on conflict do nothing;

-- Create a sample project
-- Create a sample project via CTE (portable across import tools)
-- If your DB tool supports RETURNING INTO in scripts, you may capture ids there.
with project as (
  insert into public.projects (name, description, project_value, currency, start_date, end_date)
  values ('Sample Website Project','Demo project for finance flows', 100000, 'USD', current_date, (current_date + interval '90 days')::date)
  returning id
)
insert into public.payment_plans (project_id, name, total_amount, currency, metadata)
select id, '40/30/30 Plan', 100000, 'USD', '{}'::jsonb from project;

with plan as (
  select id from public.payment_plans order by created_at desc limit 1
)
insert into public.payment_installments (payment_plan_id, installment_index, percent, due_amount, due_date)
select id, 1, 40, round(100000 * 0.40,4), (current_date + interval '7 days')::date from plan
union all
select id, 2, 30, round(100000 * 0.30,4), (current_date + interval '30 days')::date from plan
union all
select id, 3, 30, round(100000 * 0.30,4), (current_date + interval '60 days')::date from plan;

-- Seed founders
insert into public.founders (name, role, equity_percentage, vested_percentage, email)
values
  ('Founder A','Co-founder',50,50,'founder.a@example.com'),
  ('Founder B','Co-founder',50,50,'founder.b@example.com')
on conflict do nothing;
