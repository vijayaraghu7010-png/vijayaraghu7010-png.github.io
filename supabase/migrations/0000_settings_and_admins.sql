/* What was already there.

   The shop's first two tables were made by hand in the dashboard,
   before anything here was written as a migration. 0001 assumes both
   of them and the is_admin() function exist: it inserts the upload
   limits into settings and every policy it writes calls is_admin().

   So a fresh database - a staging project, a laptop, whatever comes
   next - could not run the migrations at all. This is that missing
   first step, written down from what the live database actually
   contains rather than from memory.

   Every statement is guarded. Running it against the live project
   would create nothing and change nothing, which is the point: it
   describes what is already true there.                            */

-- --------------------------------------------------------- the studio

/* Who may administer the shop. One row per address, and nothing else:
   the password lives in Supabase Auth, which is the only place that
   should ever hold one. */
create table if not exists public.admins (
  email    text primary key,
  added_at timestamptz not null default now()
);

-- ------------------------------------------------------- the settings

/* Everything the studio can change without a deploy: upload limits,
   the offer strip, where to pay. A key and a blob of JSON, because
   the shape of each one belongs to whatever reads it. */
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------- the helpers

/* Stamps updated_at on the way through. Used by orders, settings and
   price_variants; search_path is empty so nothing it touches can be
   shadowed by a table somebody else created. */
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

/* Whether the signed-in user is an administrator.

   Security definer, because the admins table is not readable by the
   person being asked about - the question is answered by the
   function, not by the caller. The address comes from the verified
   JWT and never from anything a browser sent. */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'settings_touch') then
    create trigger settings_touch before update on public.settings
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- ------------------------------------------------------------- RLS

/* settings is world-readable on purpose: it holds the shop's own
   announcements and, from 0005, the UPI address a customer is meant
   to see. Nothing secret has ever been put in it, and nothing should
   be - there is no policy stopping anyone reading every row.

   admins is readable only by an administrator, which is a little
   circular and deliberately so: the function that answers "are you
   one" is security definer and does not go through the policy.

   Neither is writable from a browser at all. Both are written only by
   Edge Functions holding the service role, which bypasses RLS. */
alter table public.admins   enable row level security;
alter table public.settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policy where polname = 'admins_self_read') then
    create policy admins_self_read on public.admins
      for select using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policy where polname = 'settings_public_read') then
    create policy settings_public_read on public.settings
      for select using (true);
  end if;
end $$;
