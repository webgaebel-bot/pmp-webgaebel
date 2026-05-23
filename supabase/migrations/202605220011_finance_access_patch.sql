-- Finance access patch for an already-migrated database.
-- Run this once in Supabase SQL Editor on the live database.

alter table if exists public.roles disable row level security;
alter table if exists public.permissions disable row level security;
alter table if exists public.role_permissions disable row level security;
alter table if exists public.profiles disable row level security;
alter table if exists public.projects disable row level security;
alter table if exists public.project_members disable row level security;
alter table if exists public.tasks disable row level security;
alter table if exists public.task_comments disable row level security;
alter table if exists public.project_roles disable row level security;
alter table if exists public.project_permissions disable row level security;
alter table if exists public.files disable row level security;
alter table if exists public.activity_logs disable row level security;
alter table if exists public.notifications disable row level security;
alter table if exists public.lead_taxonomies disable row level security;
alter table if exists public.lead_tags disable row level security;
alter table if exists public.leads disable row level security;
alter table if exists public.lead_contacts disable row level security;
alter table if exists public.lead_activities disable row level security;
alter table if exists public.lead_notes disable row level security;
alter table if exists public.lead_followups disable row level security;
alter table if exists public.lead_tag_links disable row level security;
alter table if exists public.lead_followup_records disable row level security;
alter table if exists public.time_tracking_sessions disable row level security;
alter table if exists public.time_logs disable row level security;
alter table if exists public.clients disable row level security;
alter table if exists public.expenses disable row level security;
alter table if exists public.payments disable row level security;
alter table if exists public.founders disable row level security;
alter table if exists public.finance_settings disable row level security;
alter table if exists public.system_currencies disable row level security;
alter table if exists public.salary_runs disable row level security;
alter table if exists public.salary_entries disable row level security;
alter table if exists public.project_taxes disable row level security;
alter table if exists public.project_commissions disable row level security;
alter table if exists public.mail_threads disable row level security;
alter table if exists public.mails disable row level security;
alter table if exists public.mail_recipients disable row level security;
alter table if exists public.mail_attachments disable row level security;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
