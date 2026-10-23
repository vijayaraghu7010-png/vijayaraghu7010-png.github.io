-- Two warnings from the Supabase security linter, both about functions.
--
-- touch_updated_at ran with whatever search_path the caller had. It is a
-- trigger, so it fires under any role that writes a row; pinning the path
-- to nothing closes the usual "shadow a function with your own schema"
-- trick. The body only calls now(), which lives in pg_catalog and is always
-- found, so an empty path costs it nothing.
alter function public.touch_updated_at() set search_path = '';

-- is_admin() is security definer, and public is the schema PostgREST
-- exposes, so /rest/v1/rpc/is_admin was callable by a signed-out visitor.
-- It leaks nothing (anon has no email claim, so it answers false), but a
-- definer function reachable without a session is not worth keeping.
-- authenticated keeps EXECUTE on purpose: the admins RLS policy calls it,
-- and policies run with the caller's privileges.
revoke execute on function public.is_admin() from anon;
