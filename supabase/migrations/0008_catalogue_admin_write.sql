/* Letting the studio's panel edit the shop for everybody.

   The catalogue tables have been readable by anybody since 0000 - a
   shop's products, its copy, its themes and its offers are what a
   shop puts in the window - but nothing could write to them except
   the service role. So the admin panel wrote to localStorage instead,
   and an edit existed only in the browser that made it. That is the
   whole of the bug: the panel was built against a demo server that no
   longer runs, and on a static host there was nothing shared at all.

   Writing is opened to administrators, and to nobody else, on exactly
   the terms price_variants already uses: `to authenticated`, guarded
   by is_admin(), which checks the caller's own token against the
   admins table rather than believing a claim in the request. The
   select is wrapped so Postgres runs it once per statement instead of
   once per row.

   Orders, photographs and bags are untouched. Those are a customer's,
   they are not shop window, and they stay where they are - reachable
   only by an Edge Function holding the service role.               */

create policy products_admin_write on public.products
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy site_content_admin_write on public.site_content
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy themes_admin_write on public.themes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy offers_admin_write on public.offers
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

/* The shop shows what is published. The panel has to see the rest, so
   it can bring something back - which the admin write policy above
   already allows, since `for all` covers select too. */

-- ------------------------------------------------------------ reviews

/* Reviews had no table at all: they were written to the same local
   store, so a review was visible to the one person who wrote it and
   the panel's "delete" removed something nobody else could see.

   This is the one catalogue table a customer writes to, so it is the
   one with something to lose. The column checks are the whole of the
   defence in the database: a rating that is not one to five, an empty
   review or a name longer than a name are refused by Postgres rather
   than by a form that can be bypassed. Anybody may leave one, as
   anybody could before - there is no account requirement in the shop
   and adding one here would be a change to the shop, not a fix.    */
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  rating smallint not null check (rating between 1 and 5),
  name text not null check (length(trim(name)) between 1 and 80),
  text text not null check (length(trim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.reviews is
  'Customer reviews. Written by anybody, removed by an administrator.';

create index if not exists reviews_product_id_idx on public.reviews (product_id, created_at desc);

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

/* Read by the shop, as the products they are about are. */
create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (true);

/* Written by whoever is reading. Insert only - a review cannot be
   edited or deleted by the person who left it, or by anyone else who
   is not the studio. */
create policy reviews_public_write on public.reviews
  for insert to anon, authenticated with check (true);

create policy reviews_admin_all on public.reviews
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
