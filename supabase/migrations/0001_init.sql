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
