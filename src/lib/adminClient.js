import {
  getProducts,
  setProducts,
  getReviews,
  setReviews,
  getContent,
  setContent,
  getThemes,
  setThemes,
  getOffers,
  setOffers,
  newId
} from './store';
import { DEFAULT_CONTENT, DEFAULT_THEMES } from '../data/siteDefaults';
import { currentAdmin } from './adminAuth';
import { DATA_URL_OVERHEAD, compressFile, toDataUrl } from './imageCompress';

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
  const reset = query.get('reset');

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

  /* Every sentence back to the words the shop ships with, and any key
     added here since gone. It is the way out of a page that has been
     edited into something unreadable, and the only way to get the
     original wording of a string back once it has been typed over.
     The rows are copied rather than handed over, so a later edit in
     the panel cannot write into the shipped table. */
  if (method === 'POST' && reset) {
    const next = DEFAULT_CONTENT.map((r) => ({ ...r }));
    setContent(next);
    return { content: next };
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
  const reset = query.get('reset');

  if (method === 'GET') {
    const sorted = [...all].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)
    );
    /* The shipped palettes travel with the list so the panel can offer
       to undo colour edits per theme - Diwali back to Diwali's own
       colours, not to the base palette - without reaching past this
       module into the store. */
    return {
      themes: sorted,
      shipped: Object.fromEntries(DEFAULT_THEMES.map((t) => [t.id, { ...t.tokens }]))
    };
  }

  /* Back to the palettes the shop ships with: the built-in ones as
     they were written, the default one live, and anything added here
     since gone. The tokens are copied rather than handed over, so a
     later edit in the panel cannot write into the shipped table. */
  if (method === 'POST' && reset) {
    const next = DEFAULT_THEMES.map((t) => ({ ...t, tokens: { ...t.tokens } }));
    setThemes(next);
    return { themes: next };
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

// ---------------------------------------------------------- reviews

/* Reviews are written by customers, not by the panel, so there is
   nothing here to create or edit - only the power to take one down.
   A shop with no accounts cannot tell a real review from a bored
   one, and this is the answer to that. */

function reviews(method, id) {
  const all = getReviews();

  if (method === 'GET') {
    const products = new Map(getProducts().map((p) => [p.id, p.name]));
    return {
      reviews: [...all]
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
        .map((r) => ({ ...r, productName: products.get(r.productId) || r.productId }))
    };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    setReviews(all.filter((r) => r.id !== id));
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ----------------------------------------------------------- upload

/* No server and no bucket, so a picture becomes a data URL held in the
   store with everything else.

   Every picture is compressed on the way in. It used to refuse
   anything over 512 KB and tell whoever was uploading to go and put
   the file in public/images by hand - which meant that in practice a
   phone photograph could not be used at all, and the pictures that did
   get in were whatever had been shrunk somewhere else first. Now a
   4 MB photo straight off a camera is resized and re-encoded until it
   fits, and only a picture that will not come down even at the bottom
   of the ladder is refused.

   The budget counts base64: a data URL is about a third larger than
   the blob behind it, and it is the data URL that goes in
   localStorage. */
export async function adminUpload(file) {
  requireAdmin();

  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded');

  const { blob, from, to } = await compressFile(file, {
    /* wide enough for a hero banner across a desktop */
    maxEdge: 1600,
    quality: 0.82,
    budgetBytes: Math.floor(MAX_IMAGE_BYTES / DATA_URL_OVERHEAD)
  });

  const dataUrl = await toDataUrl(blob);

  if (dataUrl.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `That picture is still ${Math.round(dataUrl.length / 1024)} KB after compressing, which is too big to ` +
        'keep in the browser. Put it in public/images and use the path instead, e.g. /images/rose.jpg'
    );
  }

  if (typeof console !== 'undefined' && from > to) {
    console.info(`[upload] ${file.name || 'image'} compressed ${Math.round(from / 1024)}KB -> ${Math.round(to / 1024)}KB`);
  }

  return dataUrl;
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
    case '/api/admin/reviews':
      return reviews(method, query.get('id'));
    default:
      throw new Error(`Unknown admin path ${url.pathname}`);
  }
}

/* Kept so the panels' call sites read the same. There is nothing to
   cache when the data is already in memory. */
export function clearAdminCache() {}
export function prefetchAdmin() {}
