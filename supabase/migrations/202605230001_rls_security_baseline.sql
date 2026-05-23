-- Security baseline: enable RLS on core tables and add app-friendly policies.
-- This keeps service-role RPC/backend flows working while closing direct public access.

create or replace function public.is_admin_actor_rls(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = coalesce(p_user_id, auth.uid())
      and lower(replace(coalesce(r.name, ''), '_', ' ')) like '%admin%'
  );
$$;

create or replace function public.has_system_permission(
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions perm on perm.id = rp.permission_id
      where p.id = coalesce(p_user_id, auth.uid())
        and lower(trim(perm.key)) = lower(trim(p_permission_key))
    );
$$;

create or replace function public.can_access_project_record(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or public.has_system_permission('projects.view.all', coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.projects pr
      where pr.id = p_project_id
        and pr.created_by = coalesce(p_user_id, auth.uid())
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = coalesce(p_user_id, auth.uid())
    );
$$;

create or replace function public.can_access_task_record(
  p_task_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or public.has_system_permission('tasks.view.all', coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.tasks t
      where t.id = p_task_id
        and (
          t.assignee_id = coalesce(p_user_id, auth.uid())
          or t.reporter_id = coalesce(p_user_id, auth.uid())
        )
    )
    or exists (
      select 1
      from public.tasks t
      where t.id = p_task_id
        and t.project_id is not null
        and public.can_access_project_record(t.project_id, coalesce(p_user_id, auth.uid()))
    );
$$;

create or replace function public.can_access_lead_record(
  p_lead_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or public.has_system_permission('leads.view.all', coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.leads l
      where l.id = p_lead_id
        and (
          l.created_by = coalesce(p_user_id, auth.uid())
          or l.assigned_to = coalesce(p_user_id, auth.uid())
        )
    )
    or exists (
      select 1
      from public.leads l
      where l.id = p_lead_id
        and l.project_id is not null
        and public.can_access_project_record(l.project_id, coalesce(p_user_id, auth.uid()))
    );
$$;

create or replace function public.can_access_time_record(
  p_log_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or public.has_system_permission('time.view.all', coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.time_logs tl
      where tl.id = p_log_id
        and (
          tl.user_id = coalesce(p_user_id, auth.uid())
          or tl.created_by = coalesce(p_user_id, auth.uid())
          or tl.approved_by = coalesce(p_user_id, auth.uid())
        )
    )
    or exists (
      select 1
      from public.time_logs tl
      where tl.id = p_log_id
        and tl.project_id is not null
        and public.can_access_project_record(tl.project_id, coalesce(p_user_id, auth.uid()))
    );
$$;

create or replace function public.can_access_mail_thread_record(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or public.has_system_permission('mails.view.all', coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.mail_threads mt
      where mt.id = p_thread_id
        and mt.created_by = coalesce(p_user_id, auth.uid())
    )
    or exists (
      select 1
      from public.mails m
      join public.mail_recipients mr on mr.mail_id = m.id
      where m.thread_id = p_thread_id
        and (m.sender_id = coalesce(p_user_id, auth.uid()) or mr.recipient_id = coalesce(p_user_id, auth.uid()))
    );
$$;

create or replace function public.can_access_mail_record(
  p_mail_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin_actor_rls(coalesce(p_user_id, auth.uid()))
    or public.has_system_permission('mails.view.all', coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from public.mails m
      left join public.mail_recipients mr on mr.mail_id = m.id
      where m.id = p_mail_id
        and (
          m.sender_id = coalesce(p_user_id, auth.uid())
          or mr.recipient_id = coalesce(p_user_id, auth.uid())
        )
    );
$$;

alter table if exists public.profiles enable row level security;
alter table if exists public.roles enable row level security;
alter table if exists public.permissions enable row level security;
alter table if exists public.role_permissions enable row level security;
alter table if exists public.projects enable row level security;
alter table if exists public.project_members enable row level security;
alter table if exists public.project_roles enable row level security;
alter table if exists public.project_permissions enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.task_comments enable row level security;
alter table if exists public.leads enable row level security;
alter table if exists public.lead_activities enable row level security;
alter table if exists public.lead_notes enable row level security;
alter table if exists public.lead_followups enable row level security;
alter table if exists public.lead_contacts enable row level security;
alter table if exists public.lead_followup_records enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.activity_logs enable row level security;
alter table if exists public.clients enable row level security;
alter table if exists public.expenses enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.founders enable row level security;
alter table if exists public.finance_settings enable row level security;
alter table if exists public.system_currencies enable row level security;
alter table if exists public.salary_runs enable row level security;
alter table if exists public.salary_entries enable row level security;
alter table if exists public.project_taxes enable row level security;
alter table if exists public.project_commissions enable row level security;
alter table if exists public.files enable row level security;
alter table if exists public.lead_tags enable row level security;
alter table if exists public.lead_tag_links enable row level security;
alter table if exists public.lead_taxonomies enable row level security;
alter table if exists public.time_tracking_sessions enable row level security;
alter table if exists public.time_logs enable row level security;
alter table if exists public.mail_threads enable row level security;
alter table if exists public.mails enable row level security;
alter table if exists public.mail_recipients enable row level security;
alter table if exists public.mail_attachments enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  using (id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists profiles_insert_self_or_admin on public.profiles;
create policy profiles_insert_self_or_admin
  on public.profiles
  for insert
  with check (id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles
  for update
  using (id = auth.uid() or public.is_admin_actor_rls())
  with check (id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists profiles_delete_admin_only on public.profiles;
create policy profiles_delete_admin_only
  on public.profiles
  for delete
  using (public.is_admin_actor_rls());

drop policy if exists roles_select_admin_only on public.roles;
create policy roles_select_admin_only
  on public.roles
  for select
  using (public.is_admin_actor_rls());

drop policy if exists roles_write_admin_only on public.roles;
create policy roles_write_admin_only
  on public.roles
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists roles_update_admin_only on public.roles;
create policy roles_update_admin_only
  on public.roles
  for update
  using (public.is_admin_actor_rls())
  with check (public.is_admin_actor_rls());

drop policy if exists roles_delete_admin_only on public.roles;
create policy roles_delete_admin_only
  on public.roles
  for delete
  using (public.is_admin_actor_rls());

drop policy if exists permissions_select_admin_only on public.permissions;
create policy permissions_select_admin_only
  on public.permissions
  for select
  using (public.is_admin_actor_rls());

drop policy if exists permissions_write_admin_only on public.permissions;
create policy permissions_write_admin_only
  on public.permissions
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists permissions_update_admin_only on public.permissions;
create policy permissions_update_admin_only
  on public.permissions
  for update
  using (public.is_admin_actor_rls())
  with check (public.is_admin_actor_rls());

drop policy if exists permissions_delete_admin_only on public.permissions;
create policy permissions_delete_admin_only
  on public.permissions
  for delete
  using (public.is_admin_actor_rls());

drop policy if exists role_permissions_select_admin_only on public.role_permissions;
create policy role_permissions_select_admin_only
  on public.role_permissions
  for select
  using (public.is_admin_actor_rls());

drop policy if exists role_permissions_write_admin_only on public.role_permissions;
create policy role_permissions_write_admin_only
  on public.role_permissions
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists role_permissions_update_admin_only on public.role_permissions;
create policy role_permissions_update_admin_only
  on public.role_permissions
  for update
  using (public.is_admin_actor_rls())
  with check (public.is_admin_actor_rls());

drop policy if exists role_permissions_delete_admin_only on public.role_permissions;
create policy role_permissions_delete_admin_only
  on public.role_permissions
  for delete
  using (public.is_admin_actor_rls());

drop policy if exists projects_select_accessible on public.projects;
create policy projects_select_accessible
  on public.projects
  for select
  using (public.can_access_project_record(id));

drop policy if exists projects_insert_creator_or_admin on public.projects;
create policy projects_insert_creator_or_admin
  on public.projects
  for insert
  with check (created_by = auth.uid() or public.is_admin_actor_rls());

drop policy if exists projects_update_owner_or_admin on public.projects;
create policy projects_update_owner_or_admin
  on public.projects
  for update
  using (created_by = auth.uid() or public.has_system_permission('projects.update') or public.is_admin_actor_rls())
  with check (created_by = auth.uid() or public.has_system_permission('projects.update') or public.is_admin_actor_rls());

drop policy if exists projects_delete_owner_or_admin on public.projects;
create policy projects_delete_owner_or_admin
  on public.projects
  for delete
  using (created_by = auth.uid() or public.has_system_permission('projects.delete') or public.is_admin_actor_rls());

drop policy if exists project_members_select_accessible on public.project_members;
create policy project_members_select_accessible
  on public.project_members
  for select
  using (public.can_access_project_record(project_id));

drop policy if exists project_members_write_manage_roles on public.project_members;
create policy project_members_write_manage_roles
  on public.project_members
  for insert
  with check (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls());

drop policy if exists project_members_update_manage_roles on public.project_members;
create policy project_members_update_manage_roles
  on public.project_members
  for update
  using (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls())
  with check (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls());

drop policy if exists project_members_delete_manage_roles on public.project_members;
create policy project_members_delete_manage_roles
  on public.project_members
  for delete
  using (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls());

drop policy if exists project_roles_select_accessible on public.project_roles;
create policy project_roles_select_accessible
  on public.project_roles
  for select
  using (public.can_access_project_record(project_id));

drop policy if exists project_roles_write_manage_roles on public.project_roles;
create policy project_roles_write_manage_roles
  on public.project_roles
  for insert
  with check (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls());

drop policy if exists project_roles_update_manage_roles on public.project_roles;
create policy project_roles_update_manage_roles
  on public.project_roles
  for update
  using (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls())
  with check (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls());

drop policy if exists project_roles_delete_manage_roles on public.project_roles;
create policy project_roles_delete_manage_roles
  on public.project_roles
  for delete
  using (public.can_manage_project_roles_v2(project_id) or public.is_admin_actor_rls());

drop policy if exists project_permissions_select_authenticated on public.project_permissions;
create policy project_permissions_select_authenticated
  on public.project_permissions
  for select
  using (auth.uid() is not null);

drop policy if exists project_permissions_write_admin_only on public.project_permissions;
create policy project_permissions_write_admin_only
  on public.project_permissions
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists project_permissions_update_admin_only on public.project_permissions;
create policy project_permissions_update_admin_only
  on public.project_permissions
  for update
  using (public.is_admin_actor_rls())
  with check (public.is_admin_actor_rls());

drop policy if exists project_permissions_delete_admin_only on public.project_permissions;
create policy project_permissions_delete_admin_only
  on public.project_permissions
  for delete
  using (public.is_admin_actor_rls());

drop policy if exists tasks_select_accessible on public.tasks;
create policy tasks_select_accessible
  on public.tasks
  for select
  using (public.can_access_task_record(id));

drop policy if exists tasks_insert_project_access on public.tasks;
create policy tasks_insert_project_access
  on public.tasks
  for insert
  with check (
    public.can_access_project_record(project_id)
    and (
      public.has_system_permission('tasks.create')
      or reporter_id = auth.uid()
      or assignee_id = auth.uid()
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists tasks_update_project_access on public.tasks;
create policy tasks_update_project_access
  on public.tasks
  for update
  using (
    public.can_access_project_record(project_id)
    and (
      public.has_system_permission('tasks.update')
      or public.is_admin_actor_rls()
    )
  )
  with check (
    public.can_access_project_record(project_id)
    and (
      public.has_system_permission('tasks.update')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists tasks_delete_project_access on public.tasks;
create policy tasks_delete_project_access
  on public.tasks
  for delete
  using (
    public.can_access_project_record(project_id)
    and (
      public.has_system_permission('tasks.delete')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists task_comments_select_accessible on public.task_comments;
create policy task_comments_select_accessible
  on public.task_comments
  for select
  using (public.can_access_task_record(task_id));

drop policy if exists task_comments_insert_accessible on public.task_comments;
create policy task_comments_insert_accessible
  on public.task_comments
  for insert
  with check (
    public.can_access_task_record(task_id)
    and (user_id = auth.uid() or public.has_system_permission('comments.create') or public.is_admin_actor_rls())
  );

drop policy if exists task_comments_update_owner_or_admin on public.task_comments;
create policy task_comments_update_owner_or_admin
  on public.task_comments
  for update
  using (user_id = auth.uid() or public.has_system_permission('comments.delete') or public.is_admin_actor_rls())
  with check (user_id = auth.uid() or public.has_system_permission('comments.delete') or public.is_admin_actor_rls());

drop policy if exists task_comments_delete_owner_or_admin on public.task_comments;
create policy task_comments_delete_owner_or_admin
  on public.task_comments
  for delete
  using (user_id = auth.uid() or public.has_system_permission('comments.delete') or public.is_admin_actor_rls());

drop policy if exists leads_select_accessible on public.leads;
create policy leads_select_accessible
  on public.leads
  for select
  using (public.can_access_lead_record(id));

drop policy if exists leads_insert_accessible on public.leads;
create policy leads_insert_accessible
  on public.leads
  for insert
  with check (
    created_by = auth.uid()
    and (public.has_system_permission('leads.create') or public.is_admin_actor_rls())
  );

drop policy if exists leads_update_accessible on public.leads;
create policy leads_update_accessible
  on public.leads
  for update
  using (public.has_system_permission('leads.update') or public.is_admin_actor_rls() or created_by = auth.uid())
  with check (public.has_system_permission('leads.update') or public.is_admin_actor_rls() or created_by = auth.uid());

drop policy if exists leads_delete_accessible on public.leads;
create policy leads_delete_accessible
  on public.leads
  for delete
  using (public.has_system_permission('leads.delete') or public.is_admin_actor_rls() or created_by = auth.uid());

drop policy if exists lead_activities_select_accessible on public.lead_activities;
create policy lead_activities_select_accessible
  on public.lead_activities
  for select
  using (public.can_access_lead_record(lead_id));

drop policy if exists lead_activities_write_accessible on public.lead_activities;
create policy lead_activities_write_accessible
  on public.lead_activities
  for insert
  with check (
    public.can_access_lead_record(lead_id)
    and (created_by = auth.uid() or user_id = auth.uid() or public.is_admin_actor_rls())
  );

drop policy if exists lead_notes_select_accessible on public.lead_notes;
create policy lead_notes_select_accessible
  on public.lead_notes
  for select
  using (public.can_access_lead_record(lead_id));

drop policy if exists lead_notes_write_accessible on public.lead_notes;
create policy lead_notes_write_accessible
  on public.lead_notes
  for insert
  with check (public.can_access_lead_record(lead_id) and (user_id = auth.uid() or public.is_admin_actor_rls()));

drop policy if exists lead_followups_select_accessible on public.lead_followups;
create policy lead_followups_select_accessible
  on public.lead_followups
  for select
  using (public.can_access_lead_record(lead_id));

drop policy if exists lead_followups_write_accessible on public.lead_followups;
create policy lead_followups_write_accessible
  on public.lead_followups
  for insert
  with check (public.can_access_lead_record(lead_id) and (created_by = auth.uid() or public.is_admin_actor_rls()));

drop policy if exists lead_contacts_select_accessible on public.lead_contacts;
create policy lead_contacts_select_accessible
  on public.lead_contacts
  for select
  using (
    lead_id is null
    or public.can_access_lead_record(lead_id)
  );

drop policy if exists lead_contacts_write_accessible on public.lead_contacts;
create policy lead_contacts_write_accessible
  on public.lead_contacts
  for insert
  with check (
    lead_id is null
    or public.can_access_lead_record(lead_id)
    or public.is_admin_actor_rls()
  );

drop policy if exists lead_followup_records_select_accessible on public.lead_followup_records;
create policy lead_followup_records_select_accessible
  on public.lead_followup_records
  for select
  using (owner_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists lead_followup_records_write_accessible on public.lead_followup_records;
create policy lead_followup_records_write_accessible
  on public.lead_followup_records
  for insert
  with check (owner_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists notifications_select_own_or_admin on public.notifications;
create policy notifications_select_own_or_admin
  on public.notifications
  for select
  using (user_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists notifications_insert_own_or_admin on public.notifications;
create policy notifications_insert_own_or_admin
  on public.notifications
  for insert
  with check (user_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists notifications_update_own_or_admin on public.notifications;
create policy notifications_update_own_or_admin
  on public.notifications
  for update
  using (user_id = auth.uid() or public.is_admin_actor_rls())
  with check (user_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists notifications_delete_admin_only on public.notifications;
create policy notifications_delete_admin_only
  on public.notifications
  for delete
  using (public.is_admin_actor_rls());

drop policy if exists activity_logs_select_admin_only on public.activity_logs;
create policy activity_logs_select_admin_only
  on public.activity_logs
  for select
  using (public.is_admin_actor_rls());

drop policy if exists activity_logs_write_admin_only on public.activity_logs;
create policy activity_logs_write_admin_only
  on public.activity_logs
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists clients_select_admin_only on public.clients;
create policy clients_select_admin_only
  on public.clients
  for select
  using (public.is_admin_actor_rls());

drop policy if exists clients_write_admin_only on public.clients;
create policy clients_write_admin_only
  on public.clients
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists expenses_select_accessible on public.expenses;
create policy expenses_select_accessible
  on public.expenses
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.view.all')
    or (
      public.has_system_permission('finance.view.team')
      and project_id is not null
      and public.can_access_project_record(project_id)
    )
    or (
      public.has_system_permission('finance.view.own')
      and created_by = auth.uid()
    )
  );

drop policy if exists expenses_write_accessible on public.expenses;
create policy expenses_write_accessible
  on public.expenses
  for insert
  with check (
    created_by = auth.uid()
    and (
      public.has_system_permission('finance.expenses.manage')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists expenses_update_accessible on public.expenses;
create policy expenses_update_accessible
  on public.expenses
  for update
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.expenses.manage')
    or created_by = auth.uid()
  )
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.expenses.manage')
    or created_by = auth.uid()
  );

drop policy if exists expenses_delete_accessible on public.expenses;
create policy expenses_delete_accessible
  on public.expenses
  for delete
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.expenses.manage')
    or created_by = auth.uid()
  );

drop policy if exists payments_select_accessible on public.payments;
create policy payments_select_accessible
  on public.payments
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.view.all')
    or (
      public.has_system_permission('finance.view.team')
      and project_id is not null
      and public.can_access_project_record(project_id)
    )
    or (
      public.has_system_permission('finance.view.own')
      and created_by = auth.uid()
    )
  );

drop policy if exists payments_write_accessible on public.payments;
create policy payments_write_accessible
  on public.payments
  for insert
  with check (
    created_by = auth.uid()
    and (
      public.has_system_permission('finance.payments.manage')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists payments_update_accessible on public.payments;
create policy payments_update_accessible
  on public.payments
  for update
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.payments.manage')
    or created_by = auth.uid()
  )
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.payments.manage')
    or created_by = auth.uid()
  );

drop policy if exists payments_delete_accessible on public.payments;
create policy payments_delete_accessible
  on public.payments
  for delete
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.payments.manage')
    or created_by = auth.uid()
  );

drop policy if exists founders_select_admin_only on public.founders;
create policy founders_select_admin_only
  on public.founders
  for select
  using (public.is_admin_actor_rls());

drop policy if exists founders_write_admin_only on public.founders;
create policy founders_write_admin_only
  on public.founders
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists finance_settings_select_admin_only on public.finance_settings;
create policy finance_settings_select_admin_only
  on public.finance_settings
  for select
  using (public.is_admin_actor_rls());

drop policy if exists finance_settings_write_admin_only on public.finance_settings;
create policy finance_settings_write_admin_only
  on public.finance_settings
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists system_currencies_select_authenticated on public.system_currencies;
create policy system_currencies_select_authenticated
  on public.system_currencies
  for select
  using (auth.uid() is not null);

drop policy if exists system_currencies_write_admin_only on public.system_currencies;
create policy system_currencies_write_admin_only
  on public.system_currencies
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists salary_runs_select_accessible on public.salary_runs;
create policy salary_runs_select_accessible
  on public.salary_runs
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.salaries.view')
    or created_by = auth.uid()
  );

drop policy if exists salary_runs_write_accessible on public.salary_runs;
create policy salary_runs_write_accessible
  on public.salary_runs
  for insert
  with check (
    created_by = auth.uid()
    and (
      public.has_system_permission('finance.salaries.manage')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists salary_runs_update_accessible on public.salary_runs;
create policy salary_runs_update_accessible
  on public.salary_runs
  for update
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.salaries.manage')
    or created_by = auth.uid()
  )
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.salaries.manage')
    or created_by = auth.uid()
  );

drop policy if exists salary_runs_delete_accessible on public.salary_runs;
create policy salary_runs_delete_accessible
  on public.salary_runs
  for delete
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.salaries.manage')
    or created_by = auth.uid()
  );

drop policy if exists salary_entries_select_accessible on public.salary_entries;
create policy salary_entries_select_accessible
  on public.salary_entries
  for select
  using (
    public.is_admin_actor_rls()
    or exists (
      select 1
      from public.salary_runs sr
      where sr.id = salary_run_id
        and (sr.created_by = auth.uid() or public.has_system_permission('finance.salaries.view'))
    )
  );

drop policy if exists salary_entries_write_accessible on public.salary_entries;
create policy salary_entries_write_accessible
  on public.salary_entries
  for insert
  with check (
    exists (
      select 1
      from public.salary_runs sr
      where sr.id = salary_run_id
        and (
          sr.created_by = auth.uid()
          or public.has_system_permission('finance.salaries.manage')
          or public.is_admin_actor_rls()
        )
    )
  );

drop policy if exists project_taxes_select_accessible on public.project_taxes;
create policy project_taxes_select_accessible
  on public.project_taxes
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.taxes.view')
    or (
      project_id is not null
      and public.can_access_project_record(project_id)
    )
  );

drop policy if exists project_taxes_write_accessible on public.project_taxes;
create policy project_taxes_write_accessible
  on public.project_taxes
  for insert
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.taxes.manage')
  );

drop policy if exists project_taxes_update_accessible on public.project_taxes;
create policy project_taxes_update_accessible
  on public.project_taxes
  for update
  using (public.is_admin_actor_rls() or public.has_system_permission('finance.taxes.manage'))
  with check (public.is_admin_actor_rls() or public.has_system_permission('finance.taxes.manage'));

drop policy if exists project_taxes_delete_accessible on public.project_taxes;
create policy project_taxes_delete_accessible
  on public.project_taxes
  for delete
  using (public.is_admin_actor_rls() or public.has_system_permission('finance.taxes.manage'));

drop policy if exists project_commissions_select_accessible on public.project_commissions;
create policy project_commissions_select_accessible
  on public.project_commissions
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.commissions.view')
    or (
      project_id is not null
      and public.can_access_project_record(project_id)
    )
  );

drop policy if exists project_commissions_write_accessible on public.project_commissions;
create policy project_commissions_write_accessible
  on public.project_commissions
  for insert
  with check (
    public.is_admin_actor_rls()
    or public.has_system_permission('finance.commissions.manage')
  );

drop policy if exists project_commissions_update_accessible on public.project_commissions;
create policy project_commissions_update_accessible
  on public.project_commissions
  for update
  using (public.is_admin_actor_rls() or public.has_system_permission('finance.commissions.manage'))
  with check (public.is_admin_actor_rls() or public.has_system_permission('finance.commissions.manage'));

drop policy if exists project_commissions_delete_accessible on public.project_commissions;
create policy project_commissions_delete_accessible
  on public.project_commissions
  for delete
  using (public.is_admin_actor_rls() or public.has_system_permission('finance.commissions.manage'));

drop policy if exists files_select_own_or_admin on public.files;
create policy files_select_own_or_admin
  on public.files
  for select
  using (uploaded_by = auth.uid() or public.is_admin_actor_rls());

drop policy if exists files_write_own_or_admin on public.files;
create policy files_write_own_or_admin
  on public.files
  for insert
  with check (uploaded_by = auth.uid() or public.is_admin_actor_rls());

drop policy if exists lead_tags_select_authenticated on public.lead_tags;
create policy lead_tags_select_authenticated
  on public.lead_tags
  for select
  using (auth.uid() is not null);

drop policy if exists lead_tags_write_admin_only on public.lead_tags;
create policy lead_tags_write_admin_only
  on public.lead_tags
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists lead_tag_links_select_accessible on public.lead_tag_links;
create policy lead_tag_links_select_accessible
  on public.lead_tag_links
  for select
  using (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and public.can_access_lead_record(l.id)
    )
  );

drop policy if exists lead_tag_links_write_accessible on public.lead_tag_links;
create policy lead_tag_links_write_accessible
  on public.lead_tag_links
  for insert
  with check (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and public.can_access_lead_record(l.id)
    )
  );

drop policy if exists lead_taxonomies_select_authenticated on public.lead_taxonomies;
create policy lead_taxonomies_select_authenticated
  on public.lead_taxonomies
  for select
  using (auth.uid() is not null);

drop policy if exists lead_taxonomies_write_admin_only on public.lead_taxonomies;
create policy lead_taxonomies_write_admin_only
  on public.lead_taxonomies
  for insert
  with check (public.is_admin_actor_rls());

drop policy if exists time_tracking_sessions_select_accessible on public.time_tracking_sessions;
create policy time_tracking_sessions_select_accessible
  on public.time_tracking_sessions
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('time.view.all')
    or user_id = auth.uid()
    or (
      project_id is not null
      and public.can_access_project_record(project_id)
      and public.has_system_permission('time.view.team')
    )
  );

drop policy if exists time_tracking_sessions_write_accessible on public.time_tracking_sessions;
create policy time_tracking_sessions_write_accessible
  on public.time_tracking_sessions
  for insert
  with check (
    user_id = auth.uid()
    and (
      public.has_system_permission('time.create')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists time_logs_select_accessible on public.time_logs;
create policy time_logs_select_accessible
  on public.time_logs
  for select
  using (public.can_access_time_record(id));

drop policy if exists time_logs_write_accessible on public.time_logs;
create policy time_logs_write_accessible
  on public.time_logs
  for insert
  with check (
    user_id = auth.uid()
    and (
      public.has_system_permission('time.create')
      or public.is_admin_actor_rls()
    )
  );

drop policy if exists mail_threads_select_accessible on public.mail_threads;
create policy mail_threads_select_accessible
  on public.mail_threads
  for select
  using (public.can_access_mail_thread_record(id));

drop policy if exists mail_threads_write_accessible on public.mail_threads;
create policy mail_threads_write_accessible
  on public.mail_threads
  for insert
  with check (created_by = auth.uid() or public.is_admin_actor_rls());

drop policy if exists mails_select_accessible on public.mails;
create policy mails_select_accessible
  on public.mails
  for select
  using (
    public.is_admin_actor_rls()
    or public.has_system_permission('mails.view.all')
    or sender_id = auth.uid()
    or exists (
      select 1
      from public.mail_recipients mr
      where mr.mail_id = id
        and mr.recipient_id = auth.uid()
    )
  );

drop policy if exists mails_write_accessible on public.mails;
create policy mails_write_accessible
  on public.mails
  for insert
  with check (sender_id = auth.uid() or public.has_system_permission('mails.send') or public.is_admin_actor_rls());

drop policy if exists mail_recipients_select_accessible on public.mail_recipients;
create policy mail_recipients_select_accessible
  on public.mail_recipients
  for select
  using (recipient_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists mail_recipients_write_accessible on public.mail_recipients;
create policy mail_recipients_write_accessible
  on public.mail_recipients
  for insert
  with check (recipient_id = auth.uid() or public.is_admin_actor_rls());

drop policy if exists mail_attachments_select_accessible on public.mail_attachments;
create policy mail_attachments_select_accessible
  on public.mail_attachments
  for select
  using (
    public.is_admin_actor_rls()
    or exists (
      select 1
      from public.mails m
      where m.id = mail_id
        and public.can_access_mail_record(m.id)
    )
  );

drop policy if exists mail_attachments_write_accessible on public.mail_attachments;
create policy mail_attachments_write_accessible
  on public.mail_attachments
  for insert
  with check (public.is_admin_actor_rls());

