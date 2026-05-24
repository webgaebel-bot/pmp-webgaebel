-- Add base currency fields to payments and a reminders RPC

alter table public.payments
  add column if not exists base_currency text not null default 'USD',
  add column if not exists base_amount numeric(18,4) not null default 0;

-- RPC: enqueue finance reminders (due in 7/3/1 days and overdue)
create or replace function public.enqueue_finance_reminders()
returns void language plpgsql security definer as $$
declare
  r record;
  notify_text text;
begin
  -- Due reminders: 7,3,1 days
  for r in
    select id, project_id, due_date, amount, currency
    from public.payment_installments
    where status = 'pending' and due_date is not null and due_date between now()::date and (now()::date + interval '7 days')::date
  loop
    notify_text := format('Payment due on %s: %s %s', r.due_date::text, r.amount::text, r.currency);
    insert into public.notifications (user_id, title, message, type, entity_type, entity_id, project_id, audience_type, created_at)
    values (null, 'Payment Due', notify_text, 'finance', 'installment', r.id::text, r.project_id, 'project', now());
  end loop;

  -- Overdue alerts
  for r in
    select id, project_id, due_date, amount, currency
    from public.payment_installments
    where status = 'pending' and due_date < now()::date
  loop
    notify_text := format('Overdue payment: due %s amount %s %s', r.due_date::text, r.amount::text, r.currency);
    insert into public.notifications (user_id, title, message, type, entity_type, entity_id, project_id, audience_type, created_at)
    values (null, 'Overdue Payment', notify_text, 'finance', 'installment', r.id::text, r.project_id, 'project', now());
  end loop;
  return;
end;
$$;

-- Grant execute to anon/public roles as appropriate (adjust as needed)
grant execute on function public.enqueue_finance_reminders() to public;
