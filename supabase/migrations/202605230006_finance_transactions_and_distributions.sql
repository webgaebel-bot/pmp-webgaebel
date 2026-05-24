-- Finance transactions: commissions, future fund, founder distributions, and salary payments

create table if not exists public.commission_records (
  id uuid primary key default gen_random_uuid(),
  name text,
  amount numeric(18,4) not null default 0,
  currency text not null default 'USD',
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists commission_records_user_idx on public.commission_records (user_id);
create index if not exists commission_records_project_idx on public.commission_records (project_id);

create table if not exists public.future_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id uuid,
  amount numeric(18,4) not null default 0,
  currency text not null default 'USD',
  month date not null,
  created_at timestamptz not null default now()
);

create index if not exists future_fund_month_idx on public.future_fund_transactions (month desc);

create table if not exists public.founder_profit_distributions (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid references public.founders(id) on delete set null,
  salary_run_id uuid references public.salary_runs(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(18,4) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create index if not exists founder_profit_founder_idx on public.founder_profit_distributions (founder_id);

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  salary_entry_id uuid references public.salary_entries(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric(18,4) not null default 0,
  currency text not null default 'USD',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists salary_payments_user_idx on public.salary_payments (user_id);
