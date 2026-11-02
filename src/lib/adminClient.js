import { supabase } from './supabaseClient';
import { DEFAULT_CONTENT, DEFAULT_THEMES } from '../data/siteDefaults';
import { currentAdmin } from './adminAuth';
import { DATA_URL_OVERHEAD, compressFile, toDataUrl } from './imageCompress';
import {
  contentFromDb,
  contentToDb,
  offerFromDb,
  offerToDb,
  productFromDb,
  productToDb,
  reviewFromDb,
  themeFromDb,
  themeToDb
} from './catalogue';

/* The panels ask for `/api/admin/products` and so on, because that is
   what they asked a server for when there was one. The paths are kept
   as the panels' vocabulary - it is a clear way to name an operation -
   and now they reach a server again.

   They used to reach nothing. Every one of these read and wrote
   localStorage, so a price change was the shop's price in the browser
   that typed it and nowhere else. That was written for a demo server
   which no longer runs; on a static host it meant the panel edited a
   shop only its author could see.

   Writing goes through the administrator's own Supabase session. What
   they may actually change is decided by the database - the policies
   added in 0008 check is_admin() against the admins table - not by
   this file, and not by anything the browser claims. These functions
   are the panel's convenience, never its permission. */

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
  if (!supabase) throw new Error('No backend is configured');
}

/* Postgres says no in its own words. The panel shows whatever comes
   back, so it is worth saying which of the two likely things went
   wrong rather than printing a constraint name at somebody. */
function blew(error, what) {
  if (!error) return;
  if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
    throw new Error(`You are signed in, but not as an administrator of this shop.`);
  }
  if (error.code === '23505') throw new Error(`Another ${what} already uses that id or slug`);
  throw new Error(error.message || `That ${what} could not be saved`);
}

// --------------------------------------------------------- products

async function products(method, id, body) {
  if (method === 'GET') {
    const { data, error } = await supabase.from('products').select('*').order('sort_order');
    blew(error, 'product');
    return { products: (data || []).map(productFromDb) };
  }

  if (method === 'POST') {
    if (!body?.name || !body?.category) throw new Error('name and category are required');
    const { count } = await supabase.from('products').select('id', { count: 'exact', head: true });

    const row = productToDb({
      sortOrder: count ?? 0,
      published: true,
      featured: false,
      gallery: [],
      details: [],
      occasions: [],
      keywords: [],
      ...body,
      id: body.id || slugify(body.name),
      slug: body.slug || slugify(body.name)
    });

    const { data, error } = await supabase.from('products').insert(row).select('*').maybeSingle();
    blew(error, 'product');
    return { product: data ? productFromDb(data) : null };
  }

  if (method === 'PUT' || method === 'PATCH') {
    if (!id) throw new Error('id is required');
    /* id is the key the basket and the server price from; renaming one
       would orphan every line that already names it. */
    const { id: _ignored, ...rest } = body || {};
    const row = productToDb({ ...rest, id });
    delete row.id;

    const { data, error } = await supabase
      .from('products')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    blew(error, 'product');
    return { product: data ? productFromDb(data) : null };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    const { error } = await supabase.from('products').delete().eq('id', id);
    blew(error, 'product');
    return { ok: true };
  }

  throw new Error(`Unsupported ${method} on products`);
}

// ---------------------------------------------------------- content

async function content(method, query, body) {
  if (method === 'GET') {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .order('group_name')
      .order('key');
    blew(error, 'text');
    return { content: (data || []).map(contentFromDb) };
  }

  if (method === 'PATCH') {
    const entries = body?.entries;
    if (!entries || typeof entries !== 'object') throw new Error('entries object is required');

    const keys = Object.keys(entries);
    if (!keys.length) return { updated: 0 };

    /* One statement rather than one per key: a long page of copy is
       saved in a single round trip, and either all of it lands or
       none of it does. */
    const { data: existing } = await supabase.from('site_content').select('*').in('key', keys);
    const rows = (existing || []).map((row) =>
      contentToDb({ ...contentFromDb(row), value: String(entries[row.key] ?? '') })
    );

    if (!rows.length) return { updated: 0 };

    const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'key' });
    blew(error, 'text');
    return { updated: rows.length };
  }

  if (method === 'POST') {
    /* Back to the words the site shipped with. */
    if (query.get('reset')) {
      const rows = DEFAULT_CONTENT.map(contentToDb);
      const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'key' });
      blew(error, 'text');
      return { reset: rows.length };
    }

    if (!body?.key) throw new Error('key is required');
    const row = contentToDb({
      key: String(body.key).trim(),
      value: body.value ?? '',
      group_name: body.group_name || 'general',
      label: body.label || '',
      multiline: Boolean(body.multiline)
    });

    const { error } = await supabase.from('site_content').upsert(row, { onConflict: 'key' });
    blew(error, 'text');
    return { ok: true };
  }

  throw new Error(`Unsupported ${method} on content`);
}

// ----------------------------------------------------------- themes

/* The shipped palette, so the panel can show what a token was before
   anybody touched it.

   themes.id is a uuid the table generates; the built-in themes in
   siteDefaults.js are identified by a word - 'base', 'diwali'. The
   two never meet, so everything here matches on the name instead,
   and the panel is handed `shipped` keyed by the row's own id, which
   is what it looks up by. Sending 'base' as an id is what produced
   `invalid input syntax for type uuid: "base"`. */
const SHIPPED_BY_NAME = new Map(
  DEFAULT_THEMES.map((t) => [t.name.trim().toLowerCase(), t])
);

const BASE_THEME = DEFAULT_THEMES.find((t) => t.isDefault) || DEFAULT_THEMES[0];

async function themes(method, query, body) {
  if (method === 'GET') {
    const { data, error } = await supabase.from('themes').select('*').order('name');
    blew(error, 'theme');

    const rows = (data || []).map(themeFromDb);

    /* Keyed by the id the panel holds, not by the word the file uses. */
    const shipped = {};
    for (const row of rows) {
      const original = SHIPPED_BY_NAME.get((row.name || '').trim().toLowerCase());
      if (original) shipped[row.id] = { ...original.tokens };
    }
    /* The panel falls back to `shipped.base` for a theme made here. */
    if (BASE_THEME) shipped.base = { ...BASE_THEME.tokens };

    return { themes: rows, shipped };
  }

  if (method === 'POST') {
    /* Exactly one theme is on. Turning one on turns the rest off, in
       that order, so a failure leaves the shop with a theme rather
       than with none. */
    const activate = query.get('activate');
    if (activate) {
      const { error: on } = await supabase.from('themes').update({ is_active: true }).eq('id', activate);
      blew(on, 'theme');
      const { error: off } = await supabase
        .from('themes')
        .update({ is_active: false })
        .neq('id', activate);
      blew(off, 'theme');
      return { ok: true };
    }

    /* Back to the palettes the shop shipped with: anything added here
       goes, the built-in colours are restored, and the default is
       live again - which is what the panel warns it will do. */
    if (query.get('reset')) {
      const { data: existing, error: readError } = await supabase
        .from('themes')
        .select('id, name');
      blew(readError, 'theme');

      const byName = new Map(
        (existing || []).map((r) => [(r.name || '').trim().toLowerCase(), r.id])
      );

      /* Added here means: not one of the shipped names. */
      const strays = (existing || [])
        .filter((r) => !SHIPPED_BY_NAME.has((r.name || '').trim().toLowerCase()))
        .map((r) => r.id);
      if (strays.length) {
        const { error } = await supabase.from('themes').delete().in('id', strays);
        blew(error, 'theme');
      }

      for (const t of DEFAULT_THEMES) {
        const id = byName.get(t.name.trim().toLowerCase());
        const row = themeToDb(t);
        delete row.id; /* the table owns the uuid */
        row.is_active = Boolean(t.isDefault);

        if (id) {
          const { error } = await supabase.from('themes').update(row).eq('id', id);
          blew(error, 'theme');
        } else {
          const { error } = await supabase.from('themes').insert(row);
          blew(error, 'theme');
        }
      }

      return { reset: DEFAULT_THEMES.length };
    }

    if (!body?.name) throw new Error('name is required');
    const row = themeToDb({ ...body, kind: body.kind || 'custom', isActive: false });
    delete row.id; /* a new theme is given its uuid by the table */
    const { error } = await supabase.from('themes').insert(row);
    blew(error, 'theme');
    return { ok: true };
  }

  if (method === 'PATCH') {
    const id = query.get('id');
    if (!id) throw new Error('id is required');
    const row = themeToDb({ ...body, id });
    delete row.id;
    const { error } = await supabase.from('themes').update(row).eq('id', id);
    blew(error, 'theme');
    return { ok: true };
  }

  if (method === 'DELETE') {
    const id = query.get('id');
    if (!id) throw new Error('id is required');

    /* The shop must always have a theme to fall back to. */
    const { data: row } = await supabase
      .from('themes')
      .select('is_default, is_active')
      .eq('id', id)
      .maybeSingle();
    if (row?.is_default) throw new Error('The base theme cannot be deleted');

    const { error } = await supabase.from('themes').delete().eq('id', id);
    blew(error, 'theme');

    if (row?.is_active) {
      await supabase.from('themes').update({ is_active: true }).eq('is_default', true);
    }
    return { ok: true };
  }

  throw new Error(`Unsupported ${method} on themes`);
}

// ----------------------------------------------------------- offers

async function offers(method, id, body) {
  if (method === 'GET') {
    const { data, error } = await supabase.from('offers').select('*').order('created_at');
    blew(error, 'offer');
    return { offers: (data || []).map(offerFromDb) };
  }

  if (method === 'POST') {
    const { id: _drop, isNew: _new, ...rest } = body || {};
    const row = offerToDb(rest);
    delete row.id; /* the table makes its own uuid */
    const { error } = await supabase.from('offers').insert(row);
    blew(error, 'offer');
    return { ok: true };
  }

  if (method === 'PATCH' || method === 'PUT') {
    if (!id) throw new Error('id is required');
    const { id: _drop, isNew: _new, ...rest } = body || {};
    const row = offerToDb({ ...rest, id });
    delete row.id;
    const { error } = await supabase.from('offers').update(row).eq('id', id);
    blew(error, 'offer');
    return { ok: true };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    const { error } = await supabase.from('offers').delete().eq('id', id);
    blew(error, 'offer');
    return { ok: true };
  }

  throw new Error(`Unsupported ${method} on offers`);
}

// ---------------------------------------------------------- reviews

async function reviews(method, id) {
  if (method === 'GET') {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    blew(error, 'review');
    return { reviews: (data || []).map(reviewFromDb) };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    blew(error, 'review');
    return { ok: true };
  }

  throw new Error(`Unsupported ${method} on reviews`);
}

// ----------------------------------------------------------- images

/* A picture, small enough to keep.

   Every picture is compressed on the way in. It used to refuse
   anything over 512 KB and tell whoever was uploading to go and put
   the file in public/images by hand - which meant that in practice a
   phone photograph could not be used at all, and the pictures that did
   get in were whatever had been shrunk somewhere else first. Now a
   4 MB photo straight off a camera is resized and re-encoded until it
   fits, and only a picture that will not come down even at the bottom
   of the ladder is refused.

   The budget counts base64: a data URL is about a third larger than
   the blob behind it, and it is the data URL that goes in the row. */
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
        'keep in a row. Put it in public/images and use the path instead, e.g. /images/rose.jpg'
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

/* Kept so the panels' call sites read the same. Every call above goes
   to the database; there is nothing held back to clear. */
export function clearAdminCache() {}
export function prefetchAdmin() {}
