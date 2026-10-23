-- ============================================================
-- The site is served as static files from GitHub Pages, so the
-- /api/admin/* routes that used to hold the service-role key are
-- gone. The panel now writes straight from the browser with the
-- signed-in administrator's own token, which means the rules that
-- used to live in those routes have to live here instead.
--
-- Nothing is loosened for the public: anon still only reads, and
-- every write is gated on is_admin(), which answers from the
-- admins table for the email in the caller's JWT.
-- ============================================================

-- ---------------------------------------------- anon read paths
-- products and offers checked `published or is_admin()`, and 0004
-- took EXECUTE on is_admin() away from anon. A signed-out visitor
-- only escaped an error because OR short-circuits on the published
-- rows; a draft row in the scan would have failed the whole query.
-- Split in two: anon gets a check it is allowed to run, signed-in
-- callers get the one that can also see drafts.
drop policy if exists products_public_read on products;
create policy products_anon_read on products
  for select to anon using (published);
create policy products_auth_read on products
  for select to authenticated using (published or public.is_admin());

drop policy if exists offers_public_read on offers;
create policy offers_anon_read on offers
  for select to anon using (active);
create policy offers_auth_read on offers
  for select to authenticated using (active or public.is_admin());

-- ------------------------------------------- administrator writes
-- `for all` covers insert, update and delete; the matching select
-- is harmless next to the read policies above. USING decides which
-- existing rows may be touched, WITH CHECK what may be written, and
-- both ask the same question, so an admin cannot write a row they
-- would not be allowed to read back.
do $$
declare t text;
begin
  foreach t in array array['products','site_content','themes','offers','settings'] loop
    execute format('drop policy if exists %1$s_admin_write on %1$s;
      create policy %1$s_admin_write on %1$s for all to authenticated
      using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- The audit trail is append-only from the panel: an admin may record
-- what they did and read it back, but not rewrite the history.
drop policy if exists audit_admin_insert on admin_audit;
create policy audit_admin_insert on admin_audit
  for insert to authenticated with check (public.is_admin());

-- -------------------------------------------------- image uploads
-- upload.js streamed the bytes through the server; the panel now
-- hands them to Storage directly, so the bucket needs the same
-- "admins write, everyone reads" shape.
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do update set public = true;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists media_admin_write on storage.objects;
create policy media_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());
