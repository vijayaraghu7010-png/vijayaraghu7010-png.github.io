/* Things that carry a price but are not products in their own right:
   the three frame sizes and the twelve hamper boxes. The cart names
   them by joining a product id to a size id, and the server has to be
   able to price one on its own authority rather than taking the
   browser's word for what an A3 frame costs.

   Filled from the shop's own catalogue by scripts/catalogue-sql.mjs. */

create table public.price_variants (
  id text primary key,
  kind text not null check (kind in ('frame-size', 'hamper-box')),
  parent_product_id text not null,
  label text not null,
  price_paise integer not null check (price_paise >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index price_variants_parent_idx on public.price_variants (parent_product_id) where active;

alter table public.price_variants enable row level security;
alter table public.price_variants force row level security;

/* A price is public: the shop shows it, and it is in the bundle
   already. Changing one stays with an administrator. */
create policy price_variants_public_read on public.price_variants
  for select to anon, authenticated using (active);

create policy price_variants_admin_write on public.price_variants
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger price_variants_touch_updated_at
  before update on public.price_variants
  for each row execute function public.touch_updated_at();
