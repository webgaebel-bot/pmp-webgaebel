-- Fix: infinite recursion detected in policy for relation "mails"
-- Run this in Supabase SQL editor if inbox/all-mails returns 500 after access-control RLS changes.

create or replace function public.current_role_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select lower(replace(coalesce(r.name, ''), '_', ' '))
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create or replace function public.current_user_has_permission(permission_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.permissions pe on pe.id = rp.permission_id
    where pr.id = auth.uid()
      and pe.key = permission_key
  )
$$;

create or replace function public.current_user_can_view_all_mails()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role_name() in ('admin', 'super admin', 'superadmin'), false)
    or public.current_user_has_permission('mails.view.all')
$$;

create or replace function public.current_user_sent_mail(mail_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.mails m
    where m.id = mail_id_input
      and m.sender_id = auth.uid()
  )
$$;

create or replace function public.current_user_received_mail(mail_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.mail_recipients mr
    where mr.mail_id = mail_id_input
      and mr.recipient_id = auth.uid()
  )
$$;

create or replace function public.current_user_can_access_mail(mail_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_can_view_all_mails()
    or public.current_user_sent_mail(mail_id_input)
    or public.current_user_received_mail(mail_id_input)
$$;

create or replace function public.current_user_can_access_mail_thread(thread_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_can_view_all_mails()
    or exists (
      select 1
      from public.mail_threads mt
      where mt.id = thread_id_input
        and mt.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.mails m
      where m.thread_id = thread_id_input
        and (
          m.sender_id = auth.uid()
          or exists (
            select 1
            from public.mail_recipients mr
            where mr.mail_id = m.id
              and mr.recipient_id = auth.uid()
          )
        )
    )
$$;

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.current_user_can_view_all_mails() to authenticated;
grant execute on function public.current_user_sent_mail(uuid) to authenticated;
grant execute on function public.current_user_received_mail(uuid) to authenticated;
grant execute on function public.current_user_can_access_mail(uuid) to authenticated;
grant execute on function public.current_user_can_access_mail_thread(uuid) to authenticated;

drop policy if exists "authenticated mail_threads access" on public.mail_threads;
drop policy if exists "mail_threads scoped access" on public.mail_threads;
create policy "mail_threads scoped access"
on public.mail_threads
for all
to authenticated
using (public.current_user_can_access_mail_thread(id))
with check (
  public.current_user_can_view_all_mails()
  or created_by = auth.uid()
);

drop policy if exists "authenticated mails access" on public.mails;
drop policy if exists "mails scoped access" on public.mails;
create policy "mails scoped access"
on public.mails
for all
to authenticated
using (public.current_user_can_access_mail(id))
with check (
  public.current_user_can_view_all_mails()
  or sender_id = auth.uid()
);

drop policy if exists "authenticated mail_recipients access" on public.mail_recipients;
drop policy if exists "mail_recipients scoped access" on public.mail_recipients;
create policy "mail_recipients scoped access"
on public.mail_recipients
for all
to authenticated
using (
  public.current_user_can_view_all_mails()
  or recipient_id = auth.uid()
  or public.current_user_sent_mail(mail_id)
)
with check (
  public.current_user_can_view_all_mails()
  or recipient_id = auth.uid()
  or public.current_user_sent_mail(mail_id)
);

drop policy if exists "authenticated mail_attachments access" on public.mail_attachments;
drop policy if exists "mail_attachments scoped access" on public.mail_attachments;
create policy "mail_attachments scoped access"
on public.mail_attachments
for all
to authenticated
using (public.current_user_can_access_mail(mail_id))
with check (
  public.current_user_can_view_all_mails()
  or public.current_user_sent_mail(mail_id)
);
