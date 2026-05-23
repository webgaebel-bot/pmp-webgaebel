-- Secure inbox RPC to avoid recursive RLS when loading recipient mail rows.

create or replace function public.get_mail_inbox_secure_v2(p_limit integer default 100)
returns table (
  recipient_id uuid,
  is_read boolean,
  is_deleted boolean,
  read_at timestamptz,
  mail jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    mr.recipient_id,
    mr.is_read,
    mr.is_deleted,
    mr.read_at,
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
      ), '[]'::jsonb)
    ) as mail
  from public.mail_recipients mr
  join public.mails m
    on m.id = mr.mail_id
  left join public.profiles p
    on p.id = m.sender_id
  where mr.recipient_id = auth.uid()
    and mr.is_deleted = false
  order by mr.created_at desc
  limit greatest(coalesce(p_limit, 100), 0);
$$;

