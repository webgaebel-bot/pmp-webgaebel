-- Allow authorized users to delete salary entries that belong to salary runs they can manage.
drop policy if exists salary_entries_delete_accessible on public.salary_entries;

create policy salary_entries_delete_accessible
  on public.salary_entries
  for delete
  using (
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
