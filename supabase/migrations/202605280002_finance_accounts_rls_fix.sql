-- Finance accounts RLS/access fix
-- Keep this table consistent with the rest of the finance module, which is
-- accessed directly through the REST API.

alter table if exists public.finance_accounts disable row level security;

grant select, insert, update, delete
  on public.finance_accounts
  to anon, authenticated, service_role;

