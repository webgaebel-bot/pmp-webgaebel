-- Link finance accounts to a user owner so the account form can assign accounts
-- without relying on client/project placeholders.

alter table if exists public.finance_accounts
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists finance_accounts_user_id_idx
  on public.finance_accounts (user_id);

update public.finance_accounts
set user_id = created_by
where user_id is null
  and created_by is not null;

drop view if exists public.finance_accounts_with_context;

create view public.finance_accounts_with_context as
select
  a.*,
  u.name as user_name,
  u.email as user_email
from public.finance_accounts a
left join public.profiles u on u.id = a.user_id;
