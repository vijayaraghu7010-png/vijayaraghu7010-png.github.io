/* Counting attempts without losing any.

   The first version of the limiter read a count, added one, and wrote
   it back. Two requests arriving together read the same number and
   wrote the same number, so ten attempts in parallel could register
   as one or two. That is exactly the shape of traffic a limiter is
   for, so the counting moves into the database, where one statement
   can read and write at once.

   Nothing else changes. The table, its key and its meaning are as
   0003 left them.                                                  */

-- --------------------------------------------------- the increment

/* One attempt, counted, and the new total returned.

   `on conflict do update` makes this a single statement: the row is
   created if this is the first attempt in the window and incremented
   if it is not, and no two callers can interleave between a read and
   a write because there is no gap between them.

   SECURITY INVOKER, deliberately, and this is the part worth
   understanding before approving it.

   The obvious choice is SECURITY DEFINER, so the function carries its
   own access to a table that nobody may touch. But lookup_attempts
   has row-level security FORCED (0003), and forcing it means it
   applies to the table's owner too - which is exactly who a DEFINER
   function runs as. With no policies on the table, such a function
   would be refused by the very rule it was meant to work around,
   unless its owner happens to hold BYPASSRLS.

   Running as the invoker removes the question. The only caller is an
   Edge Function holding the service role (see _shared/common.ts,
   serviceClient), and that is the role Supabase documents as
   bypassing row-level security. It also means this function grants
   nobody anything they did not already have, which is a smaller
   surface than a DEFINER function with a table nobody else may read.

   If that assumption is ever wrong, the failure is safe rather than
   silent: the insert is refused, rateLimit logs that counting is not
   enforced, and the request is allowed through - the same behaviour
   as a database that cannot be reached. It does not open a door.

   search_path is emptied rather than set to public: every object
   below is schema-qualified, so nothing needs to be searched for, and
   an empty path cannot be pointed at somebody else's table.

   It returns the count after the increment, so the caller compares
   against its own ceiling. The ceiling is not stored here: different
   endpoints allow different numbers, and a limit written into the
   database would be a second place to keep them in step.          */
create or replace function public.bump_lookup_attempt(
  p_key_hash text,
  p_window_start timestamptz
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.lookup_attempts (key_hash, window_start, count)
  values (p_key_hash, p_window_start, 1)
  on conflict (key_hash, window_start)
    do update set count = lookup_attempts.count + 1
  returning lookup_attempts.count;
$$;

/* Only the service role calls this, and only from an Edge Function.
   A browser holding the publishable key has no business incrementing
   anybody's counter, so the default grant to anon and authenticated
   is taken away. */
revoke all on function public.bump_lookup_attempt(text, timestamptz) from public;
revoke all on function public.bump_lookup_attempt(text, timestamptz) from anon;
revoke all on function public.bump_lookup_attempt(text, timestamptz) from authenticated;
grant execute on function public.bump_lookup_attempt(text, timestamptz) to service_role;

-- ------------------------------------------------------ the sweeping

/* Windows that have passed are of no further interest.

   One row per caller per window, kept forever, is a table that only
   grows. This removes the ones nobody will read again. A day is far
   longer than the longest window in use, so nothing live is at risk.

   It is not scheduled here. Scheduling means pg_cron, which is a
   decision about an extension and a recurring job on somebody's
   database, and that belongs to whoever runs it rather than to a
   migration. Run it by hand, or add:

     select cron.schedule('prune-lookup-attempts', '0 4 * * *',
                          $$select public.prune_lookup_attempts()$$);

   once pg_cron is enabled and that has been agreed.

   SECURITY INVOKER for the same reason as above: forced RLS on the
   table applies to a DEFINER function's owner, so defining it away
   solves nothing it does not also risk.

   This has a consequence worth knowing. Run as the service role, it
   deletes what it should. Run as some other role that does not bypass
   row-level security, the delete simply matches no rows and it
   returns 0 - no error, no complaint, nothing removed. So if it ever
   reports 0 on a table you know is full of old windows, the answer is
   the role it was called with, not the interval.

   Nothing is lost either way: the rows it removes are windows that
   have long since expired, and the limiter never reads them.

   search_path is empty; now() is in pg_catalog, which is always
   searched, and the table is schema-qualified.                    */
create or replace function public.prune_lookup_attempts(
  p_older_than interval default interval '1 day'
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.lookup_attempts
  where window_start < now() - p_older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_lookup_attempts(interval) from public;
revoke all on function public.prune_lookup_attempts(interval) from anon;
revoke all on function public.prune_lookup_attempts(interval) from authenticated;
grant execute on function public.prune_lookup_attempts(interval) to service_role;

/* ------------------------------------------------------------------
   Rolling this back

     drop function if exists public.prune_lookup_attempts(interval);
     drop function if exists public.bump_lookup_attempt(text, timestamptz);

   Dropping them loses nothing. The limiter notices the function has
   gone, says so in the log, and falls back to counting in the
   function - less accurate, and reported as not enforced, but not
   broken.                                                          */
