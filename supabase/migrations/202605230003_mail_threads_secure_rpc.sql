-- Secure mail-thread RPCs to avoid recursive RLS on nested mail thread queries.

create or replace function public.get_all_mail_threads_secure_v2()
returns table (
  id uuid,
  subject text,
  created_at timestamptz,
  mails jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin_actor_rls() or public.has_system_permission('mails.view.all')) then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  return query
  select
    mt.id,
    mt.subject,
    mt.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'subject', m.subject,
          'body', m.body,
          'created_at', m.created_at,
          'thread_id', m.thread_id,
          'sender_id', m.sender_id,
          'sender_deleted', m.sender_deleted,
          'sender', case
            when p.id is null then null
            else jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email,
              'avatar_url', p.avatar_url,
              'profile_image', p.profile_image
            )
          end,
          'attachments', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'original_name', a.original_name,
                'file_name', a.file_name,
                'file_path', a.file_path,
                'mime_type', a.mime_type,
                'file_size', a.file_size
              )
              order by a.created_at asc
            )
            from public.mail_attachments a
            where a.mail_id = m.id
          ), '[]'::jsonb),
          'recipients', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', mr.id,
                'is_read', mr.is_read,
                'is_deleted', mr.is_deleted,
                'recipient', case
                  when rp.id is null then null
                  else jsonb_build_object(
                    'id', rp.id,
                    'name', rp.name,
                    'email', rp.email
                  )
                end
              )
              order by mr.created_at asc
            )
            from public.mail_recipients mr
            left join public.profiles rp on rp.id = mr.recipient_id
            where mr.mail_id = m.id
          ), '[]'::jsonb)
        )
        order by m.created_at asc
      )
      from public.mails m
      left join public.profiles p on p.id = m.sender_id
      where m.thread_id = mt.id
    ), '[]'::jsonb) as mails
  from public.mail_threads mt
  order by mt.created_at desc;
end;
$$;

create or replace function public.get_mail_detail_secure_v2(p_mail_id uuid)
returns table (
  id uuid,
  subject text,
  body text,
  created_at timestamptz,
  thread_id uuid,
  sender_id uuid,
  sender_deleted boolean,
  sender jsonb,
  attachments jsonb,
  recipients jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin_actor_rls()
    or public.has_system_permission('mails.view.all')
    or exists (
      select 1
      from public.mails m
      left join public.mail_recipients mr on mr.mail_id = m.id
      where (m.id = p_mail_id or m.thread_id = p_mail_id)
        and (
          m.sender_id = auth.uid()
          or mr.recipient_id = auth.uid()
        )
    )
  ) then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  return query
  select
    m.id,
    m.subject,
    m.body,
    m.created_at,
    m.thread_id,
    m.sender_id,
    m.sender_deleted,
    case
      when p.id is null then null
      else jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', p.email,
        'avatar_url', p.avatar_url,
        'profile_image', p.profile_image
      )
    end as sender,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'original_name', a.original_name,
          'file_name', a.file_name,
          'file_path', a.file_path,
          'mime_type', a.mime_type,
          'file_size', a.file_size
        )
        order by a.created_at asc
      )
      from public.mail_attachments a
      where a.mail_id = m.id
    ), '[]'::jsonb) as attachments,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', mr.id,
          'is_read', mr.is_read,
          'is_deleted', mr.is_deleted,
          'recipient', case
            when rp.id is null then null
            else jsonb_build_object(
              'id', rp.id,
              'name', rp.name,
              'email', rp.email
            )
          end
        )
        order by mr.created_at asc
      )
      from public.mail_recipients mr
      left join public.profiles rp on rp.id = mr.recipient_id
      where mr.mail_id = m.id
    ), '[]'::jsonb) as recipients
  from public.mails m
  left join public.profiles p on p.id = m.sender_id
  where m.id = p_mail_id or m.thread_id = p_mail_id
  order by m.created_at asc;
end;
$$;

