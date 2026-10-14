-- Read-only observability for authenticated workspace members.
-- Write access remains reserved for server-side sync and audit code.

grant usage on schema cm_ops, cm_audit to authenticated, service_role;
grant select on all tables in schema cm_ops, cm_audit to authenticated, service_role;

drop policy if exists member_read_workspaces on cm_core.workspaces;
create policy member_read_workspaces on cm_core.workspaces
  for select to authenticated
  using (
    id in (
      select workspace_id
      from cm_core.workspace_members
      where user_id = (select auth.uid())
        and revoked_at is null
    )
  );

do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a
      on a.attrelid = c.oid
     and a.attname = 'workspace_id'
     and not a.attisdropped
    where c.relkind = 'r'
      and n.nspname in ('cm_ops', 'cm_audit')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'member_read_' || r.table_name,
      r.schema_name,
      r.table_name
    );
    execute format(
      'create policy %I on %I.%I for select to authenticated using (workspace_id in (select workspace_id from cm_core.workspace_members where user_id=(select auth.uid()) and revoked_at is null))',
      'member_read_' || r.table_name,
      r.schema_name,
      r.table_name
    );
  end loop;
end $$;

