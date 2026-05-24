-- Add payout tracking fields to commission_records

alter table if exists public.commission_records
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references public.profiles(id) on delete set null,
  add column if not exists paid_amount numeric(18,4) default 0;

create index if not exists commission_records_paid_idx on public.commission_records (paid, paid_at desc);
