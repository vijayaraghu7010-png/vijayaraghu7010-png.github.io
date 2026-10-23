-- Until now the shop only learned about a change by asking again, so an
-- edit made on a laptop showed on a phone when that phone next reloaded.
-- Adding the four tables the storefront reads to the realtime
-- publication lets Postgres push the change instead.
--
-- Every one of these already has a public read policy, and realtime
-- applies the same policies, so this exposes nothing that a visitor
-- could not already fetch from /api/site-config.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.site_content;
alter publication supabase_realtime add table public.themes;
alter publication supabase_realtime add table public.offers;
