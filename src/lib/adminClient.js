import {
  getProducts,
  setProducts,
  getContent,
  setContent,
  getThemes,
  setThemes,
  getOffers,
  setOffers,
  newId
} from './store';
import { currentAdmin } from './adminAuth';

/* The panels ask for `/api/admin/products` and so on, because that is
   what they asked a server for when there was one. The paths are kept
   as the panels' vocabulary - it is a clear way to name an operation -
   but nothing leaves the browser: every one of them reads or writes
   the local store.

   Keeping the shape means the panels did not change when the backend
   went away, and they would not have to change again if one came
   back. */

const MAX_IMAGE_BYTES = 512 * 1024;

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function requireAdmin() {
  if (!currentAdmin()) throw new Error('Not signed in');
}

// --------------------------------------------------------- products

function products(method, id, body) {
  const all = getProducts();

  if (method === 'GET') return { products: all };

  if (method === 'POST') {
    if (!body?.name || !body?.category) throw new Error('name and category are required');
    const product = {
      sortOrder: all.length,
      published: true,
      featured: false,
      gallery: [],
      details: [],
      occasions: [],
      keywords: [],
      ...body,
      id: body.id || slugify(body.name),
      slug: body.slug || slugify(body.name),
      addedAt: body.addedAt || new Date().toISOString().slice(0, 10)
    };
    if (all.some((p) => p.id === product.id)) throw new Error('A product with that id already exists');
    setProducts([...all, product]);
    return { product };
  }

  if (method === 'PATCH' || method === 'PUT') {
    if (!id) throw new Error('id is required');
    const i = all.findIndex((p) => p.id === id);
    if (i === -1) throw new Error('That product no longer exists');
    const product = { ...all[i], ...body, id };
    const next = [...all];
    next[i] = product;
    setProducts(next);
    return { product };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    setProducts(all.filter((p) => p.id !== id));
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ---------------------------------------------------------- content

function content(method, query, body) {
  const all = getContent();

  if (method === 'GET') {
    const sorted = [...all].sort(
      (a, b) => a.group_name.localeCompare(b.group_name) || a.key.localeCompare(b.key)
    );
    return { content: sorted };
  }

  if (method === 'PATCH') {
    const entries = body?.entries;
    if (!entries || typeof entries !== 'object') throw new Error('entries object is required');
    const next = all.map((row) =>
      Object.prototype.hasOwnProperty.call(entries, row.key)
        ? { ...row, value: String(entries[row.key] ?? '') }
        : row
    );
    setContent(next);
    return { ok: true, updated: Object.keys(entries).length };
  }

  if (method === 'POST') {
    const { key, value, group, label, multiline } = body || {};
    if (!key) throw new Error('key is required');
    const row = {
      key,
      value: String(value ?? ''),
      group_name: group || 'general',
      label: label || key,
      multiline: Boolean(multiline)
    };
    const i = all.findIndex((r) => r.key === key);
    const next = [...all];
    if (i === -1) next.push(row);
    else next[i] = row;
    setContent(next);
    return { ok: true };
  }

  if (method === 'DELETE') {
    const key = query.get('key');
    if (!key) throw new Error('key is required');
    setContent(all.filter((r) => r.key !== key));
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ----------------------------------------------------------- themes

function themes(method, query, body) {
  const all = getThemes();
  const id = query.get('id');
  const activate = query.get('activate');

  if (method === 'GET') {
    const sorted = [...all].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)
    );
    return { themes: sorted };
  }

  if (method === 'POST' && activate) {
    /* exactly one theme wears the crown */
    const next = all.map((t) => ({ ...t, isActive: t.id === activate }));
    setThemes(next);
    const theme = next.find((t) => t.id === activate);
    if (!theme) throw new Error('That theme no longer exists');
    return { theme };
  }

  if (method === 'POST') {
    const theme = {
      id: newId('theme'),
      name: 'Untitled',
      kind: 'custom',
      tokens: {},
      isDefault: false,
      isActive: false,
      startsAt: null,
      endsAt: null,
      bannerText: '',
      ...body
    };
    setThemes([...all, theme]);
    return { theme };
  }

  if (method === 'PATCH') {
    if (!id) throw new Error('id is required');
    const i = all.findIndex((t) => t.id === id);
    if (i === -1) throw new Error('That theme no longer exists');
    const theme = { ...all[i], ...body, id };
    const next = [...all];
    next[i] = theme;
    setThemes(next);
    return { theme };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    const existing = all.find((t) => t.id === id);
    if (existing?.isDefault) throw new Error('The default theme cannot be deleted');
    setThemes(all.filter((t) => t.id !== id));
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ----------------------------------------------------------- offers

function offers(method, id, body) {
  const all = getOffers();

  if (method === 'GET') return { offers: all };

  if (method === 'POST') {
    const offer = {
      id: newId('offer'),
      code: null,
      title: '',
      description: '',
      discountType: 'percent',
      value: 0,
      appliesTo: { scope: 'all' },
      minOrder: 0,
      maxDiscount: null,
      startsAt: null,
      endsAt: null,
      active: true,
      showBanner: false,
      ...body
    };
    if (!offer.title && !offer.code) throw new Error('a title or a code is required');
    if (offer.code) offer.code = String(offer.code).trim().toUpperCase();
    setOffers([offer, ...all]);
    return { offer };
  }

  if (method === 'PATCH') {
    if (!id) throw new Error('id is required');
    const i = all.findIndex((o) => o.id === id);
    if (i === -1) throw new Error('That offer no longer exists');
    const offer = { ...all[i], ...body, id };
    if (offer.code) offer.code = String(offer.code).trim().toUpperCase();
    const next = [...all];
    next[i] = offer;
    setOffers(next);
    return { offer };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    setOffers(all.filter((o) => o.id !== id));
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ----------------------------------------------------------- upload

/* No server and no bucket, so a picture becomes a data URL held in the
   store with everything else. localStorage is small, so this is capped
   well below it: anything bigger belongs in public/images, where it
   costs the shop nothing and ships with the build. */
export function adminUpload(file) {
  requireAdmin();

  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      'That picture is over 512 KB. Put it in public/images and use the path instead, e.g. /images/rose.jpg'
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/* The one door the panels come through. */
export async function adminFetch(path, options = {}) {
  requireAdmin();

  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(path, 'http://local');
  const query = url.searchParams;
  const body = options.body ? JSON.parse(options.body) : undefined;

  switch (url.pathname) {
    case '/api/admin/products':
      return products(method, query.get('id'), body);
    case '/api/admin/content':
      return content(method, query, body);
    case '/api/admin/themes':
      return themes(method, query, body);
    case '/api/admin/offers':
      return offers(method, query.get('id'), body);
    default:
      throw new Error(`Unknown admin path ${url.pathname}`);
  }
}

/* Kept so the panels' call sites read the same. There is nothing to
   cache when the data is already in memory. */
export function clearAdminCache() {}
export function prefetchAdmin() {}
