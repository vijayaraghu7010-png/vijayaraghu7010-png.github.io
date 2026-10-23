-- ============================================================
-- WrappedStudio — admin/CMS schema
-- Everything the storefront reads is public-readable; every
-- write goes through the service role (the /api/admin routes),
-- so no browser key can change the site.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------ who may administer
create table if not exists admins (
  email text primary key,
  added_at timestamptz not null default now()
);

insert into admins (email) values
  ('roshinip.0931@gmail.com'),
  ('vijayaraghu7010@gmail.com')
  on conflict (email) do nothing;

create or replace function is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ------------------------------------------------------- products
create table if not exists products (
  id text primary key,
  slug text unique not null,
  name text not null,
  category text not null,
  category_label text not null default '',
  price numeric(10,2) not null default 0,
  price_mode text not null default 'fixed',      -- fixed | per-unit
  unit_label text not null default '',
  unit_noun text not null default '',
  min_qty integer,
  set_size integer,
  image text not null default '',
  alt text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  short_description text not null default '',
  description text not null default '',
  details jsonb not null default '[]'::jsonb,
  occasions jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  customiser text,
  size_id text,
  featured boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  added_at date not null default current_date,
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on products (category);
create index if not exists products_published_idx on products (published);

-- --------------------------------------------- editable site copy
-- Any string on the site can be addressed by a key such as
-- 'home.hero.title'. A missing key falls back to the code default,
-- so the site never breaks because a row is absent.
create table if not exists site_content (
  key text primary key,
  value text not null default '',
  group_name text not null default 'general',
  label text not null default '',
  multiline boolean not null default false,
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------- themes
-- tokens is a map of CSS custom properties, e.g.
--   {"--coral": "#603D42", "--cream": "#FAF6F2"}
-- A festival theme can be scheduled: whichever active theme has the
-- narrowest live window wins, otherwise the one marked default.
create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'custom',           -- base | festival | custom
  tokens jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  banner_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists themes_one_default_idx
  on themes (is_default) where is_default;

-- -------------------------------------------------------- offers
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  code text unique,                              -- null = automatic offer
  title text not null default '',
  description text not null default '',
  discount_type text not null default 'percent', -- percent | flat
  value numeric(10,2) not null default 0,
  applies_to jsonb not null default '{"scope":"all"}'::jsonb,
  min_order numeric(10,2) not null default 0,
  max_discount numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  show_banner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------ settings
create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------- audit of edits
create table if not exists admin_audit (
  id bigserial primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------- RLS
alter table admins        enable row level security;
alter table products      enable row level security;
alter table site_content  enable row level security;
alter table themes        enable row level security;
alter table offers        enable row level security;
alter table settings      enable row level security;
alter table admin_audit   enable row level security;

-- the storefront reads published content with the anon key
drop policy if exists products_public_read on products;
create policy products_public_read on products
  for select using (published or is_admin());

drop policy if exists content_public_read on site_content;
create policy content_public_read on site_content for select using (true);

drop policy if exists themes_public_read on themes;
create policy themes_public_read on themes for select using (true);

drop policy if exists offers_public_read on offers;
create policy offers_public_read on offers for select using (active or is_admin());

drop policy if exists settings_public_read on settings;
create policy settings_public_read on settings for select using (true);

-- admins may read the admin tables while signed in
drop policy if exists admins_self_read on admins;
create policy admins_self_read on admins for select using (is_admin());

drop policy if exists audit_admin_read on admin_audit;
create policy audit_admin_read on admin_audit for select using (is_admin());

-- no insert/update/delete policies anywhere: writes are server-side
-- only, through the service role, which bypasses RLS.

-- -------------------------------------------- updated_at triggers
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['products','site_content','themes','offers','settings'] loop
    execute format(
      'drop trigger if exists %1$s_touch on %1$s;
       create trigger %1$s_touch before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;
-- generated by scripts/generate-seed.mjs - do not edit by hand

insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'magazine-4', 'personalised-magazine-4-pages', 'Personalised Magazine (4 Pages)', 'magazine', 'Magazine', 300,
  'fixed', '', '', null, null,
  '/images/magazine-4p.jpg', 'An open personalised photo magazine lying on a table with printed memories across both pages', '["/images/magazine-4p.jpg","/images/magazine-hero.jpg"]'::jsonb, '4 pages, 8 printed sides of your own photos.', 'Four pages, eight printed sides. Send us your photos, pick a theme, and we lay out every side by hand. You approve a PDF preview before anything is printed.',
  '["4 pages / 8 printed sides","Theme of your choice","PDF preview before printing","Shipping charged separately"]'::jsonb, '["Love","Friendship","Birthday","Anniversary","Memories"]'::jsonb, '["magazine","photo book","personalised","zine","memories","pages"]'::jsonb, 'magazine', 'mag-4',
  true, 0, '2026-02-10'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'magazine-8', 'personalised-magazine-8-pages', 'Personalised Magazine (8 Pages)', 'magazine', 'Magazine', 550,
  'fixed', '', '', null, null,
  '/images/magazine-8p.jpg', 'A layered personalised magazine spread with photographs, notes and pressed flowers', '["/images/magazine-8p.jpg","/images/magazine-hero.jpg"]'::jsonb, '8 pages, 16 printed sides — room for the whole story.', 'Eight pages, sixteen printed sides — room for a whole year, a whole trip, or a whole friendship. Same process: your photos, your theme, a PDF preview, then print.',
  '["8 pages / 16 printed sides","Theme of your choice","PDF preview before printing","Shipping charged separately"]'::jsonb, '["Love","Friendship","Birthday","Anniversary","Memories"]'::jsonb, '["magazine","photo book","personalised","zine","memories","pages"]'::jsonb, 'magazine', 'mag-8',
  true, 1, '2026-02-10'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'polaroid-medium', 'polaroid-prints-medium', 'Polaroid Prints (Medium)', 'polaroid', 'Polaroid', 6,
  'per-unit', 'each', 'print', 9, null,
  '/images/polaroid-medium.jpg', 'Medium polaroid prints spread across a wooden table beside an instant camera', '["/images/polaroid-medium.jpg","/images/polaroid-hero.jpg"]'::jsonb, 'Medium polaroid prints, ₹6 each, minimum 9 prints.', 'Medium polaroid prints of your own photos on soft matte stock. Priced per print, with a minimum of 9 prints per order so the pack arrives worth sending.',
  '["₹6 per print","Minimum 9 prints","Medium size, matte finish","Dispatch in 3–4 working days"]'::jsonb, '["Love","Friendship","Birthday","Just Because"]'::jsonb, '["polaroid","prints","photos","instant","pictures"]'::jsonb, 'polaroid', null,
  true, 2, '2026-03-02'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'polaroid-set-25', 'polaroid-set-25-prints', 'Polaroid Set (25 Prints)', 'polaroid', 'Polaroid', 150,
  'fixed', 'per set', '', null, 25,
  '/images/polaroid-set.jpg', 'A set of polaroid prints laid out in rows on a wooden surface', '["/images/polaroid-set.jpg","/images/polaroid-hero.jpg"]'::jsonb, '25 polaroid prints in one set for ₹150.', 'Twenty-five medium polaroid prints as one set — the easy way to turn a camera roll into something you can hold. ₹150 for the set of 25.',
  '["25 prints per set","₹150 per set","Medium size, matte finish","Dispatch in 3–4 working days"]'::jsonb, '["Love","Friendship","Birthday","Just Because"]'::jsonb, '["polaroid","prints","set","bundle","photos","pictures"]'::jsonb, 'polaroid', null,
  true, 3, '2026-03-02'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'bouquet-blush-coast', 'blush-sunset-bouquet', 'Blush Sunset Bouquet', 'bouquet', 'Bouquet', 1299,
  'fixed', '', '', null, null,
  '/images/p-blush-coast.jpg', 'A handmade bouquet of blush pink roses wrapped in pale paper', '["/images/p-blush-coast.jpg","/images/o-love.jpg"]'::jsonb, 'Soft, romantic and serene — blush roses tied by hand.', 'Blush pink roses and soft fillers, tied by hand and wrapped in pale paper. Made to order, so every bouquet is a little different.',
  '["Handmade to order","Choice of wrap colour","Optional message card","Shipping charged separately"]'::jsonb, '["Love","Anniversary","Just Because"]'::jsonb, '["bouquet","rose","pink","blush","flowers","romantic"]'::jsonb, 'bouquet', null,
  true, 4, '2026-01-18'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'bouquet-golden-hour', 'golden-hour-bouquet', 'Golden Hour Bouquet', 'bouquet', 'Bouquet', 1499,
  'fixed', '', '', null, null,
  '/images/p-golden-hour.jpg', 'A warm bouquet of coral and cream roses in sunset light', '["/images/p-golden-hour.jpg","/images/o-anniversary.jpg"]'::jsonb, 'A warm blend of sunset hues, coral through cream.', 'Coral, peach and cream blooms in the colours of the last hour of light. Our most-sent bouquet, and the one most often asked for again.',
  '["Handmade to order","Choice of wrap colour","Optional message card","Shipping charged separately"]'::jsonb, '["Anniversary","Congratulations","Love"]'::jsonb, '["bouquet","rose","coral","sunset","flowers","golden"]'::jsonb, 'bouquet', null,
  true, 5, '2026-01-18'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'bouquet-sunset-sunflower', 'sunset-sunflower-bouquet', 'Sunset Sunflower Bouquet', 'bouquet', 'Bouquet', 1349,
  'fixed', '', '', null, null,
  '/images/p-sunflower.jpg', 'A bright bouquet of sunflowers wrapped for gifting', '["/images/p-sunflower.jpg","/images/o-congrats.jpg"]'::jsonb, 'Radiates joy and positivity — sunflowers, front and centre.', 'Big, bright sunflowers with warm fillers. The bouquet to send when the news is good and you want it to feel like it.',
  '["Handmade to order","Choice of wrap colour","Optional message card","Shipping charged separately"]'::jsonb, '["Congratulations","Birthday","Just Because"]'::jsonb, '["bouquet","sunflower","yellow","bright","flowers","congratulations"]'::jsonb, 'bouquet', null,
  false, 6, '2026-04-06'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'bouquet-ocean-breeze', 'ocean-breeze-bouquet', 'Ocean Breeze Bouquet', 'bouquet', 'Bouquet', 1599,
  'fixed', '', '', null, null,
  '/images/p-ocean-breeze.jpg', 'A cream and white bouquet with pastel blooms held in warm light', '["/images/p-ocean-breeze.jpg","/images/o-justbecause.jpg"]'::jsonb, 'A touch of calm, a lot of love — cream and pastel blooms.', 'Cream and white blooms with cool pastel accents, tied loose and airy. Quiet, and the one people keep the longest.',
  '["Handmade to order","Choice of wrap colour","Optional message card","Shipping charged separately"]'::jsonb, '["Just Because","Birthday","Anniversary"]'::jsonb, '["bouquet","white","cream","pastel","calm","flowers"]'::jsonb, 'bouquet', null,
  false, 7, '2026-04-06'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'hamper-blush-luxe', 'blush-luxe-hamper', 'Blush Luxe Hamper', 'hamper', 'Hamper', 2499,
  'fixed', '', '', null, null,
  '/images/hampers/hamper-blush-luxe.jpg', 'A blush pink gift box holding perfumes, a pearl clutch, earrings and chocolates', '["/images/hampers/hamper-blush-luxe.jpg","/images/hampers/hamper-rosewood.jpg"]'::jsonb, 'Perfume, a pearl clutch, earrings and chocolates in a ribboned box.', 'Our most indulgent hamper. A satin-ribboned blush box holding two eau de parfums, a pearl-finish clutch, pearl earring sets, a claw clip, silk scrunchies and Ferrero Rocher, finished with illustrated cards and a handwritten note.',
  '["Packed to order","Handwritten note included","Contents can be swapped on request","Shipping charged separately"]'::jsonb, '["Love","Birthday","Anniversary"]'::jsonb, '["hamper","gift box","perfume","clutch","jewellery","chocolate","luxury"]'::jsonb, null, null,
  true, 8, '2026-10-22'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'hamper-keepsake', 'keepsake-memory-hamper', 'Keepsake Memory Hamper', 'hamper', 'Hamper', 2999,
  'fixed', '', '', null, null,
  '/images/hampers/hamper-keepsake.jpg', 'A navy gift box with an engraved message board, a handmade bouquet and polaroids', '["/images/hampers/hamper-keepsake.jpg","/images/hampers/hamper-blush-luxe.jpg"]'::jsonb, 'An engraved letter board, a handmade bouquet and your own polaroids.', 'Built around your own words. An engraved message board carries your letter, paired with a handmade bouquet, printed polaroids of your people, and room for one gift of your choosing.',
  '["Your message engraved","Handmade bouquet included","Photos printed from your uploads","Shipping charged separately"]'::jsonb, '["Rakhi","Birthday","Just Because"]'::jsonb, '["hamper","gift box","engraved","message","bouquet","polaroid","rakhi"]'::jsonb, null, null,
  true, 9, '2026-10-22'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'hamper-sweet-thanks', 'sweet-thanks-hamper', 'Sweet Thanks Hamper', 'hamper', 'Hamper', 1499,
  'fixed', '', '', null, null,
  '/images/hampers/hamper-sweet-thanks.jpg', 'An ivory gift box with a scented candle, satin scrunchies, chocolate and a pendant set', '["/images/hampers/hamper-sweet-thanks.jpg","/images/hampers/hamper-keepsake.jpg"]'::jsonb, 'Scented candle, satin scrunchies, a macrame keyring and chocolate.', 'A warm little thank-you in an ivory keepsake box: a grapefruit and mandarin candle, two satin scrunchies, a handmade macrame tassel keyring, a chocolate bar and a gold-tone pendant and earring set.',
  '["Packed to order","Thank-you card included","Contents can be swapped on request","Shipping charged separately"]'::jsonb, '["Thank You","Just Because","Birthday"]'::jsonb, '["hamper","gift box","candle","scrunchie","keyring","chocolate","thank you"]'::jsonb, null, null,
  false, 10, '2026-10-22'
) on conflict (id) do nothing;
insert into products (
  id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
  min_qty, set_size, image, alt, gallery, short_description, description, details,
  occasions, keywords, customiser, size_id, featured, sort_order, added_at
) values (
  'hamper-rosewood', 'rosewood-charm-hamper', 'Rosewood Charm Hamper', 'hamper', 'Hamper', 1799,
  'fixed', '', '', null, null,
  '/images/hampers/hamper-rosewood.jpg', 'A red and ivory gift box with a brooch, stud earrings, a heart purse and velvet roses', '["/images/hampers/hamper-rosewood.jpg","/images/hampers/hamper-sweet-thanks.jpg"]'::jsonb, 'A charm brooch, stud sets, a heart envelope purse and velvet roses.', 'Romance in a red-and-ivory box. A charm brooch and ring card, a six-pair stud earring set, a soft heart-clasp envelope purse and velvet roses, cushioned in blush crinkle paper with our handwritten thank-you card.',
  '["Packed to order","Handwritten note included","Contents can be swapped on request","Shipping charged separately"]'::jsonb, '["Love","Anniversary","Just Because"]'::jsonb, '["hamper","gift box","brooch","earrings","purse","roses","romantic"]'::jsonb, null, null,
  false, 11, '2026-10-22'
) on conflict (id) do nothing;

insert into site_content (key, value, group_name, label, multiline) values ('brand.name', 'WrappedStudio', 'brand', 'Brand name', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('brand.tagline', 'More than gifts, a little piece of your story.', 'brand', 'Tagline', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('brand.footerLine', 'Flowers inspired by sunsets, moments inspired by you.', 'brand', 'Footer line', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('contact.phone', '+91 98765 43210', 'contact', 'Phone', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('contact.email', 'hello@wrappedstudio.in', 'contact', 'Email', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('contact.address', '', 'contact', 'Address', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('home.hero.eyebrow', 'Personalised gifts for beautiful people', 'home', 'Hero eyebrow', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('home.hero.title', 'Make Every Memory Bloom', 'home', 'Hero title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('home.hero.text', 'Personalised magazines, polaroids and handcrafted bouquets for your special moments.', 'home', 'Hero paragraph', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('home.hero.ctaPrimary', 'Explore Collections', 'home', 'Hero primary button', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('home.hero.ctaSecondary', 'Custom Gifts', 'home', 'Hero secondary button', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('home.hero.proof', '4.9/5 from 10K+ happy customers', 'home', 'Hero rating line', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('magazines.title', 'Personalised Magazines', 'magazines', 'Page title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('magazines.subtitle', 'Turn your favourite memories into a magazine made just for you.', 'magazines', 'Page subtitle', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('polaroids.title', 'Polaroids', 'polaroids', 'Page title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('polaroids.subtitle', 'Small prints. Big memories.', 'polaroids', 'Page subtitle', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('bouquets.title', 'Bouquets for Every Occasion', 'bouquets', 'Page title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('bouquets.subtitle', 'Because every moment deserves a beautiful beginning.', 'bouquets', 'Page subtitle', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('hampers.title', 'Hampers', 'hampers', 'Page title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('hampers.subtitle', 'Curated boxes, wrapped and ready to give.', 'hampers', 'Page subtitle', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.magazine.title', 'MAGAZINES', 'categories', 'MAGAZINES - title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.magazine.description', 'Turn your moments into beautifully designed personalised magazines.', 'categories', 'MAGAZINES - description', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.magazine.cta', 'Explore Magazines', 'categories', 'MAGAZINES - button', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.polaroid.title', 'POLAROIDS', 'categories', 'POLAROIDS - title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.polaroid.description', 'Your favourite moments as insta-style polaroid prints.', 'categories', 'POLAROIDS - description', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.polaroid.cta', 'Shop Polaroids', 'categories', 'POLAROIDS - button', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.bouquet.title', 'BOUQUETS', 'categories', 'BOUQUETS - title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.bouquet.description', 'Handcrafted bouquets inspired by the calm, warmth and beauty of sunsets.', 'categories', 'BOUQUETS - description', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.bouquet.cta', 'Shop Bouquets', 'categories', 'BOUQUETS - button', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.hamper.title', 'HAMPERS', 'categories', 'HAMPERS - title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.hamper.description', 'Keepsake boxes packed by hand — candles, jewellery, chocolates and a note from you.', 'categories', 'HAMPERS - description', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('category.hamper.cta', 'Shop Hampers', 'categories', 'HAMPERS - button', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.0.title', 'Personalised with Love', 'benefits', 'Benefit 1 title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.0.text', 'Made for your special moments', 'benefits', 'Benefit 1 text', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.1.title', 'Premium Print Quality', 'benefits', 'Benefit 2 title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.1.text', 'Vibrant colours, lasting memories', 'benefits', 'Benefit 2 text', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.2.title', 'Carefully Packed', 'benefits', 'Benefit 3 title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.2.text', 'Safe & secure packaging', 'benefits', 'Benefit 3 text', true) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.3.title', 'Delivery Across India', 'benefits', 'Benefit 4 title', false) on conflict (key) do nothing;
insert into site_content (key, value, group_name, label, multiline) values ('benefit.3.text', 'Bringing happiness to your doorstep', 'benefits', 'Benefit 4 text', true) on conflict (key) do nothing;

insert into themes (name, kind, tokens, is_default, is_active)
  select 'WrappedStudio', 'base', '{"--coral":"#603D42","--coral-dark":"#4C3135","--coral-soft":"#EFE2E2","--burgundy":"#603D42","--burgundy-soft":"#7A5257","--cream":"#FAF6F2","--cream-2":"#FFFCF9","--peach":"#F1E8E2","--peach-deep":"#E5D9D1","--blush":"#E5D9D1","--orange":"#B98285","--brown":"#827674","--ink":"#2E2425","--ink-2":"#3F3233","--accent":"#B98285","--btn-text":"#FAF6F2","--line":"#E5D9D1","--line-2":"#D8C8BE"}'::jsonb, true, true
  where not exists (select 1 from themes where is_default);
insert into themes (name, kind, tokens, is_active, banner_text)
  select 'Diwali', 'festival', '{"--coral":"#8A2F2A","--coral-dark":"#6D241F","--coral-soft":"#EFE2E2","--burgundy":"#603D42","--burgundy-soft":"#7A5257","--cream":"#FAF6F2","--cream-2":"#FFFCF9","--peach":"#F1E8E2","--peach-deep":"#EBD9C2","--blush":"#E5D9D1","--orange":"#C9922F","--brown":"#827674","--ink":"#2E2425","--ink-2":"#3F3233","--accent":"#C9922F","--btn-text":"#FAF6F2","--line":"#E7D4B8","--line-2":"#D8C8BE"}'::jsonb, false, 'Diwali offers are live'
  where not exists (select 1 from themes where name = 'Diwali');
insert into themes (name, kind, tokens, is_active, banner_text)
  select 'Christmas', 'festival', '{"--coral":"#2F5D4A","--coral-dark":"#24483A","--coral-soft":"#EFE2E2","--burgundy":"#603D42","--burgundy-soft":"#7A5257","--cream":"#FAF6F2","--cream-2":"#FFFCF9","--peach":"#F1E8E2","--peach-deep":"#E3E8E1","--blush":"#E5D9D1","--orange":"#B03A3A","--brown":"#827674","--ink":"#2E2425","--ink-2":"#3F3233","--accent":"#B03A3A","--btn-text":"#FAF6F2","--line":"#D8E2D8","--line-2":"#D8C8BE"}'::jsonb, false, 'Christmas gifting is open'
  where not exists (select 1 from themes where name = 'Christmas');
insert into themes (name, kind, tokens, is_active, banner_text)
  select 'Valentine', 'festival', '{"--coral":"#9B2F45","--coral-dark":"#7C2537","--coral-soft":"#EFE2E2","--burgundy":"#603D42","--burgundy-soft":"#7A5257","--cream":"#FAF6F2","--cream-2":"#FFFCF9","--peach":"#F1E8E2","--peach-deep":"#F3DEE2","--blush":"#E5D9D1","--orange":"#D98395","--brown":"#827674","--ink":"#2E2425","--ink-2":"#3F3233","--accent":"#D98395","--btn-text":"#FAF6F2","--line":"#EDD3D9","--line-2":"#D8C8BE"}'::jsonb, false, 'Valentine collection is here'
  where not exists (select 1 from themes where name = 'Valentine');
insert into themes (name, kind, tokens, is_active, banner_text)
  select 'Pongal', 'festival', '{"--coral":"#8A5A1F","--coral-dark":"#6E4718","--coral-soft":"#EFE2E2","--burgundy":"#603D42","--burgundy-soft":"#7A5257","--cream":"#FAF6F2","--cream-2":"#FFFCF9","--peach":"#F1E8E2","--peach-deep":"#F0E4C8","--blush":"#E5D9D1","--orange":"#C9A227","--brown":"#827674","--ink":"#2E2425","--ink-2":"#3F3233","--accent":"#C9A227","--btn-text":"#FAF6F2","--line":"#E6D6B4","--line-2":"#D8C8BE"}'::jsonb, false, 'Pongal hampers are ready'
  where not exists (select 1 from themes where name = 'Pongal');
