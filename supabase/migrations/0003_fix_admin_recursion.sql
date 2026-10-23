-- The admins policy called is_admin(), which reads admins, which runs
-- the policy again: Postgres stops at "stack depth limit exceeded".
-- Marking the function security definer lets it read the table once,
-- without the policy, which is the whole point of the check.

create or replace function is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke execute on function is_admin() from public;
grant execute on function is_admin() to authenticated, service_role;
