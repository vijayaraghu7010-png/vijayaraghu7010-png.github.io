/* The temporary database: plain SQLite in a file beside the project,
   through Node's built-in driver, so there is nothing to install and
   nothing to sign up for. It speaks the same shapes the Supabase API
   speaks, so when the hosted database is ready the admin panel and
   the storefront do not change at all — only which server answers. */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { PRODUCTS } from '../src/data/products.js';
import { BRAND, CONTACT, BENEFITS, CATEGORIES } from '../src/data/categories.js';

const file = resolve(process.cwd(), 'server/data/wrappedstudio.db');
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

db.exec(`
  pragma journal_mode = wal;

  create table if not exists admins (
    email text primary key
  );

  create table if not exists products (
    id text primary key,
    slug text unique not null,
    name text not null,
    category text not null,
    category_label text not null default '',
    price real not null default 0,
    price_mode text not null default 'fixed',
    unit_label text not null default '',
    unit_noun text not null default '',
    min_qty integer,
    set_size integer,
    image text not null default '',
    alt text not null default '',
    gallery text not null default '[]',
    short_description text not null default '',
    description text not null default '',
    details text not null default '[]',
    occasions text not null default '[]',
    keywords text not null default '[]',
    customiser text,
    size_id text,
    featured integer not null default 0,
    published integer not null default 1,
    sort_order integer not null default 0,
    added_at text not null default (date('now'))
  );

  create table if not exists site_content (
    key text primary key,
    value text not null default '',
    group_name text not null default 'general',
    label text not null default '',
    multiline integer not null default 0
  );

  create table if not exists themes (
    id text primary key,
    name text not null,
    kind text not null default 'custom',
    tokens text not null default '{}',
    is_default integer not null default 0,
    is_active integer not null default 0,
    starts_at text,
    ends_at text,
    banner_text text not null default ''
  );

  create table if not exists offers (
    id text primary key,
    code text unique,
    title text not null default '',
    description text not null default '',
    discount_type text not null default 'percent',
    value real not null default 0,
    applies_to text not null default '{"scope":"all"}',
    min_order real not null default 0,
    max_discount real,
    starts_at text,
    ends_at text,
    active integer not null default 1,
    show_banner integer not null default 0,
    created_at text not null default (datetime('now'))
  );

  create table if not exists admin_audit (
    id integer primary key autoincrement,
    actor text not null,
    action text not null,
    entity text not null,
    entity_id text,
    payload text,
    created_at text not null default (datetime('now'))
  );
`);

const count = (table) => db.prepare(`select count(*) as n from ${table}`).get().n;

/* --------------------------------------------------------- seeding
   Exactly what the site ships with, inserted once. Re-running the
   server never overwrites an edit made in the panel. */

export function seed(adminEmails) {
  const addAdmin = db.prepare('insert or ignore into admins (email) values (?)');
  adminEmails.forEach((e) => addAdmin.run(e.toLowerCase()));

  if (count('products') === 0) {
    const stmt = db.prepare(`insert into products (
      id, slug, name, category, category_label, price, price_mode, unit_label, unit_noun,
      min_qty, set_size, image, alt, gallery, short_description, description, details,
      occasions, keywords, customiser, size_id, featured, sort_order, added_at
    ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    PRODUCTS.forEach((p, i) => {
      stmt.run(
        p.id, p.slug, p.name, p.category, p.categoryLabel || '', Number(p.price) || 0,
        p.priceMode || 'fixed', p.unitLabel || '', p.unitNoun || '',
        p.minQty ?? null, p.setSize ?? null, p.image || '', p.alt || '',
        JSON.stringify(p.gallery || []), p.shortDescription || '', p.description || '',
        JSON.stringify(p.details || []), JSON.stringify(p.occasions || []),
        JSON.stringify(p.keywords || []), p.customiser || null, p.sizeId || null,
        p.featured ? 1 : 0, i, p.addedAt || new Date().toISOString().slice(0, 10)
      );
    });
  }

  if (count('site_content') === 0) {
    const stmt = db.prepare(
      'insert into site_content (key, value, group_name, label, multiline) values (?,?,?,?,?)'
    );
    contentSeed().forEach(([key, value, group, label, multi]) =>
      stmt.run(key, value ?? '', group, label, multi ? 1 : 0)
    );
  }

  if (count('themes') === 0) {
    const stmt = db.prepare(
      'insert into themes (id, name, kind, tokens, is_default, is_active, banner_text) values (?,?,?,?,?,?,?)'
    );
    stmt.run(crypto.randomUUID(), 'WrappedStudio', 'base', JSON.stringify(BASE_TOKENS), 1, 1, '');
    FESTIVALS.forEach((f) =>
      stmt.run(crypto.randomUUID(), f.name, 'festival', JSON.stringify({ ...BASE_TOKENS, ...f.tokens }), 0, 0, f.banner)
    );
  }
}

function contentSeed() {
  const rows = [
    ['brand.name', BRAND.name, 'brand', 'Brand name'],
    ['brand.tagline', BRAND.tagline || '', 'brand', 'Tagline'],
    ['brand.footerLine', BRAND.footerLine || '', 'brand', 'Footer line'],
    ['contact.phone', CONTACT.phone || '', 'contact', 'Phone'],
    ['contact.email', CONTACT.email || '', 'contact', 'Email'],
    ['contact.address', CONTACT.address || '', 'contact', 'Address'],
    ['home.hero.eyebrow', 'Personalised gifts for beautiful people', 'home', 'Hero eyebrow'],
    ['home.hero.title', 'Make Every Memory Bloom', 'home', 'Hero title'],
    ['home.hero.text', 'Personalised magazines, polaroids and handcrafted bouquets for your special moments.', 'home', 'Hero paragraph', true],
    ['home.hero.ctaPrimary', 'Explore Collections', 'home', 'Hero primary button'],
    ['home.hero.ctaSecondary', 'Custom Gifts', 'home', 'Hero secondary button'],
    ['home.hero.proof', '4.9/5 from 10K+ happy customers', 'home', 'Hero rating line'],
    ['magazines.subtitle', 'Turn your favourite memories into a magazine made just for you.', 'magazines', 'Page subtitle', true],
    ['polaroids.subtitle', 'Small prints. Big memories.', 'polaroids', 'Page subtitle', true],
    ['bouquets.subtitle', 'Because every moment deserves a beautiful beginning.', 'bouquets', 'Page subtitle', true],
    ['hampers.title', 'Gift Hampers', 'hampers', 'Page title'],
    ['hampers.subtitle', 'Keepsake boxes packed by hand, for the people you love most.', 'hampers', 'Page subtitle', true]
  ];

  CATEGORIES.forEach((c) => {
    rows.push([`category.${c.id}.title`, c.title, 'categories', `${c.title} - title`]);
    rows.push([`category.${c.id}.description`, c.description, 'categories', `${c.title} - description`, true]);
    rows.push([`category.${c.id}.cta`, c.cta, 'categories', `${c.title} - button`]);
  });

  BENEFITS.forEach((b, i) => {
    rows.push([`benefit.${i}.title`, b.title, 'benefits', `Benefit ${i + 1} title`]);
    rows.push([`benefit.${i}.text`, b.text, 'benefits', `Benefit ${i + 1} text`, true]);
  });

  return rows;
}

export const BASE_TOKENS = {
  '--coral': '#603D42',
  '--coral-dark': '#4C3135',
  '--coral-soft': '#EFE2E2',
  '--burgundy': '#603D42',
  '--burgundy-soft': '#7A5257',
  '--cream': '#FAF6F2',
  '--cream-2': '#FFFCF9',
  '--peach': '#F1E8E2',
  '--peach-deep': '#E5D9D1',
  '--blush': '#E5D9D1',
  '--orange': '#B98285',
  '--brown': '#827674',
  '--ink': '#2E2425',
  '--ink-2': '#3F3233',
  '--accent': '#B98285',
  '--btn-text': '#FAF6F2',
  '--line': '#E5D9D1',
  '--line-2': '#D8C8BE'
};

export const FESTIVALS = [
  { name: 'Diwali', banner: 'Diwali offers are live', tokens: { '--coral': '#8A2F2A', '--coral-dark': '#6D241F', '--accent': '#C9922F', '--orange': '#C9922F', '--peach-deep': '#EBD9C2', '--line': '#E7D4B8' } },
  { name: 'Christmas', banner: 'Christmas gifting is open', tokens: { '--coral': '#2F5D4A', '--coral-dark': '#24483A', '--accent': '#B03A3A', '--orange': '#B03A3A', '--peach-deep': '#E3E8E1', '--line': '#D8E2D8' } },
  { name: 'Valentine', banner: 'Valentine collection is here', tokens: { '--coral': '#9B2F45', '--coral-dark': '#7C2537', '--accent': '#D98395', '--orange': '#D98395', '--peach-deep': '#F3DEE2', '--line': '#EDD3D9' } },
  { name: 'Pongal', banner: 'Pongal hampers are ready', tokens: { '--coral': '#8A5A1F', '--coral-dark': '#6E4718', '--accent': '#C9A227', '--orange': '#C9A227', '--peach-deep': '#F0E4C8', '--line': '#E6D6B4' } }
];
