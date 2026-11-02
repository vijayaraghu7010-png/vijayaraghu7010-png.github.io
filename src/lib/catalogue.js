import { PRODUCTS } from '../data/products';
import { DEFAULT_CONTENT, DEFAULT_THEMES, DEFAULT_OFFERS } from '../data/siteDefaults';
import { customerSupabase, CUSTOMER_BACKEND_READY } from './customerClient';

/* The shop as the studio last saved it, for everybody.

   The panel used to write to localStorage, so an edit was the shop
   only in the browser that made it. These tables have been readable
   by anybody since the first migration; now they are what the shop
   actually reads.

   Two things are kept apart, and the distinction is the whole design:

   - What the panel can edit - a name, a price, the copy, the picture,
     whether it is published - comes from the database.
   - How a product is BUILT - which customiser it opens, whether it
     takes an upload, what sizes it is sold at - stays in
     src/data/products.js, because the panel has no field for any of
     it and never has. A row from the database is laid over the
     shipped product rather than replacing it, so switching to the
     database cannot quietly cost a poster its upload step or a frame
     its sizes.

   A product the database has and the bundle does not is a product
   somebody added in the panel, and it is taken as it comes. A product
   the bundle has and the database does not is kept, because a
   half-synced catalogue should leave the shop standing rather than
   empty shelves. Only `published: false` takes something out of the
   shop, which is what that column is for.

   Every read falls back to what the site was built with. A shop that
   cannot reach its database still sells what it shipped with. */

/* Columns the panel owns. Anything outside this list that a shipped
   product carries - customiser, upload, frameSizes, sizeId, setId,
   rating - survives untouched. */
const EDITABLE = [
  'slug', 'name', 'category', 'categoryLabel', 'price', 'priceMode',
  'unitLabel', 'image', 'alt', 'gallery', 'shortDescription',
  'description', 'details', 'occasions', 'keywords', 'featured',
  'published', 'sortOrder', 'addedAt'
];

const list = (v) => (Array.isArray(v) ? v : []);

export function productFromDb(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    categoryLabel: row.category_label || '',
    price: Number(row.price) || 0,
    priceMode: row.price_mode || 'fixed',
    unitLabel: row.unit_label || '',
    unitNoun: row.unit_noun || '',
    minQty: row.min_qty ?? undefined,
    setSize: row.set_size ?? undefined,
    image: row.image || '',
    alt: row.alt || '',
    gallery: list(row.gallery),
    shortDescription: row.short_description || '',
    description: row.description || '',
    details: list(row.details),
    occasions: list(row.occasions),
    keywords: list(row.keywords),
    customiser: row.customiser ?? undefined,
    sizeId: row.size_id ?? undefined,
    featured: Boolean(row.featured),
    published: row.published !== false,
    sortOrder: Number(row.sort_order) || 0,
    addedAt: row.added_at || undefined
  };
}

export function productToDb(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    category_label: p.categoryLabel || '',
    price: Number(p.price) || 0,
    price_mode: p.priceMode || 'fixed',
    unit_label: p.unitLabel || '',
    unit_noun: p.unitNoun || '',
    min_qty: p.minQty ?? null,
    set_size: p.setSize ?? null,
    image: p.image || '',
    alt: p.alt || '',
    gallery: list(p.gallery),
    short_description: p.shortDescription || '',
    description: p.description || '',
    details: list(p.details),
    occasions: list(p.occasions),
    keywords: list(p.keywords),
    customiser: p.customiser ?? null,
    size_id: p.sizeId ?? null,
    featured: Boolean(p.featured),
    published: p.published !== false,
    sort_order: Number(p.sortOrder) || 0
  };
}

/* Fields where blank means "the panel has nothing for this", not
   "erase what the product had". A catalogue seeded with only the
   columns the server prices from left every picture and description
   empty, and the shop dutifully showed empty cards: seven posters,
   seven blank squares. A product with no picture is a fault, never a
   decision, so a blank here falls back to what shipped.

   The cost is that blanking one of these in the panel will not take
   on a product the site ships with. That is the right way round: a
   shop with the wrong description is a smaller problem than a shop
   with no pictures. */
const BLANK_MEANS_UNSET = new Set([
  'image', 'alt', 'categoryLabel', 'shortDescription', 'description',
  'gallery', 'details', 'occasions', 'keywords'
]);

const isBlank = (v) =>
  v === '' || v === null || (Array.isArray(v) && v.length === 0);

/* The shipped product, with the studio's edits laid over it. */
function overlay(shipped, edited) {
  const merged = { ...shipped };
  for (const field of EDITABLE) {
    const value = edited[field];
    if (value === undefined) continue;
    if (isBlank(value) && BLANK_MEANS_UNSET.has(field) && !isBlank(shipped[field])) continue;
    merged[field] = value;
  }
  return merged;
}

export function mergeProducts(shipped, fromDb) {
  if (!fromDb?.length) return shipped.map((p) => ({ ...p }));

  const byId = new Map(shipped.map((p) => [p.id, p]));
  const out = [];
  const seen = new Set();

  for (const row of fromDb) {
    seen.add(row.id);
    const base = byId.get(row.id);
    out.push(base ? overlay(base, row) : row);
  }

  /* Shipped but not in the database: a catalogue that has not been
     synced yet, not a product somebody deleted. Deleting is
     `published: false`, and that arrives as a row. */
  for (const p of shipped) {
    if (!seen.has(p.id)) out.push({ ...p });
  }

  return out;
}

export const themeFromDb = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind || 'custom',
  tokens: r.tokens || {},
  isDefault: Boolean(r.is_default),
  isActive: Boolean(r.is_active),
  startsAt: r.starts_at || null,
  endsAt: r.ends_at || null,
  bannerText: r.banner_text || ''
});

export const themeToDb = (t) => ({
  id: t.id,
  name: t.name,
  kind: t.kind || 'custom',
  tokens: t.tokens || {},
  is_default: Boolean(t.isDefault),
  is_active: Boolean(t.isActive),
  starts_at: t.startsAt || null,
  ends_at: t.endsAt || null,
  banner_text: t.bannerText || ''
});

export const offerFromDb = (r) => ({
  id: r.id,
  code: r.code || null,
  title: r.title || '',
  description: r.description || '',
  discountType: r.discount_type || 'percent',
  value: Number(r.value) || 0,
  appliesTo: r.applies_to || { scope: 'all' },
  minOrder: Number(r.min_order) || 0,
  maxDiscount: r.max_discount ?? null,
  startsAt: r.starts_at || null,
  endsAt: r.ends_at || null,
  active: r.active !== false,
  showBanner: Boolean(r.show_banner)
});

export const offerToDb = (o) => ({
  id: o.id,
  code: o.code || null,
  title: o.title || '',
  description: o.description || '',
  discount_type: o.discountType || 'percent',
  value: Number(o.value) || 0,
  applies_to: o.appliesTo || { scope: 'all' },
  min_order: Number(o.minOrder) || 0,
  max_discount: o.maxDiscount ?? null,
  starts_at: o.startsAt || null,
  ends_at: o.endsAt || null,
  active: o.active !== false,
  show_banner: Boolean(o.showBanner)
});

/* Content already travels in the database's own shape - the panel
   reads group_name straight off the row - so there is nothing to
   rename here. */
export const contentFromDb = (r) => ({
  key: r.key,
  value: r.value ?? '',
  group_name: r.group_name || 'general',
  label: r.label || '',
  multiline: Boolean(r.multiline)
});

export const contentToDb = (c) => ({
  key: c.key,
  value: c.value ?? '',
  group_name: c.group_name || 'general',
  label: c.label || '',
  multiline: Boolean(c.multiline)
});

export const reviewFromDb = (r) => ({
  id: r.id,
  productId: r.product_id,
  rating: Number(r.rating) || 0,
  name: r.name || '',
  text: r.text || '',
  createdAt: r.created_at
});

/* What the site was built with, for a first paint and for a browser
   that cannot reach the database at all. */
export function shippedCatalogue() {
  return {
    products: PRODUCTS.map((p) => ({ ...p })),
    content: DEFAULT_CONTENT.map((c) => ({ ...c })),
    themes: DEFAULT_THEMES.map((t) => ({ ...t, tokens: { ...t.tokens } })),
    offers: [...DEFAULT_OFFERS],
    reviews: []
  };
}

/* The shop, as it stands. Never throws: a table that will not answer
   falls back to what shipped, because a shop that cannot reach its
   database should still sell things. */
export async function fetchCatalogue() {
  if (!CUSTOMER_BACKEND_READY || !customerSupabase) return { ...shippedCatalogue(), source: 'built-in' };

  const shipped = shippedCatalogue();

  const [products, content, themes, offers, reviews] = await Promise.all([
    customerSupabase.from('products').select('*').order('sort_order'),
    customerSupabase.from('site_content').select('*'),
    customerSupabase.from('themes').select('*'),
    customerSupabase.from('offers').select('*'),
    customerSupabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(500)
  ]);

  /* Nothing came back at all - offline, or the project is asleep.
     Shipped data, and the page never notices. */
  if (products.error && content.error && themes.error) {
    return { ...shipped, source: 'built-in' };
  }

  const dbProducts = (products.data || []).map(productFromDb);

  return {
    products: mergeProducts(shipped.products, dbProducts).filter((p) => p.published !== false),
    content: content.data?.length ? content.data.map(contentFromDb) : shipped.content,
    themes: themes.data?.length ? themes.data.map(themeFromDb) : shipped.themes,
    offers: offers.data ? offers.data.map(offerFromDb) : shipped.offers,
    reviews: (reviews.data || []).map(reviewFromDb),
    source: 'live'
  };
}
