import { supabase } from './supabaseClient';
import {
  rowToProduct,
  productToRow,
  rowToOffer,
  offerToRow,
  rowToTheme,
  themeToRow
} from './shape';

/* What the /api/admin/* routes used to do, done in the browser.

   The site is static now, so there is no server to hold the service
   key and no server to check who is calling. Both jobs moved: the
   database decides, through the policies in migration 0006, using the
   administrator's own token. The panel asks the same questions in the
   same words it always did - every function below answers one of the
   paths the panels already call - so no panel had to change. */

const BUCKET = 'media';

const MEDIA_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

const MAX_UPLOAD = 8 * 1024 * 1024;

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/* A policy refusal comes back as a Postgres error, which says things
   like "new row violates row-level security policy". That is true but
   unhelpful to the person reading it, so the common cause is named. */
function fail(error) {
  const message = String(error?.message || error);
  if (/row-level security|permission denied/i.test(message)) {
    throw new Error('That account is not allowed to make this change. Sign in as an administrator.');
  }
  if (error?.code === 'PGRST205' || /schema cache|does not exist/i.test(message)) {
    throw new Error('The database has not been set up yet — run the migrations in the Supabase SQL editor.');
  }
  throw new Error(message);
}

function unwrap({ data, error }) {
  if (error) fail(error);
  return data;
}

/* Who is signed in, or null. The admins table is the authority - the
   same table is_admin() reads - so the panel and the policies can
   never disagree about who is let in. */
export async function currentAdmin() {
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email?.toLowerCase();
  if (!email) return null;

  const { data: row, error } = await supabase
    .from('admins')
    .select('email')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    const missing = error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message || '');
    return { email, incomplete: missing ? 'database' : 'unknown', detail: error.message };
  }
  return row ? { email } : null;
}

/* Records what changed. A failure here must never fail the edit. */
async function audit(action, entity, entityId, payload) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from('admin_audit').insert({
      actor: data?.user?.email || 'unknown',
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      payload: payload ?? null
    });
  } catch {
    /* intentionally ignored */
  }
}

// --------------------------------------------------------- products

async function products(method, id, body) {
  if (method === 'GET') {
    const rows = unwrap(await supabase.from('products').select('*').order('sort_order', { ascending: true }));
    return { products: (rows || []).map(rowToProduct) };
  }

  if (method === 'POST') {
    if (!body?.name || !body?.category) throw new Error('name and category are required');
    const row = productToRow({
      ...body,
      id: body.id || slugify(body.name),
      slug: body.slug || slugify(body.name)
    });
    const data = unwrap(await supabase.from('products').insert(row).select().single());
    await audit('create', 'product', data.id, row);
    return { product: rowToProduct(data) };
  }

  if (method === 'PATCH' || method === 'PUT') {
    if (!id) throw new Error('id is required');
    const row = productToRow({ ...body, id });
    delete row.id;
    const data = unwrap(await supabase.from('products').update(row).eq('id', id).select().single());
    await audit('update', 'product', id, row);
    return { product: rowToProduct(data) };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    unwrap(await supabase.from('products').delete().eq('id', id));
    await audit('delete', 'product', id, null);
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ---------------------------------------------------------- content

async function content(method, query, body) {
  if (method === 'GET') {
    const rows = unwrap(
      await supabase.from('site_content').select('*').order('group_name').order('key')
    );
    return { content: rows || [] };
  }

  if (method === 'PATCH') {
    const entries = body?.entries;
    if (!entries || typeof entries !== 'object') throw new Error('entries object is required');
    const rows = Object.entries(entries).map(([key, value]) => ({ key, value: String(value ?? '') }));
    unwrap(await supabase.from('site_content').upsert(rows, { onConflict: 'key' }));
    await audit('update', 'content', `${rows.length} keys`, entries);
    return { ok: true, updated: rows.length };
  }

  if (method === 'POST') {
    const { key, value, group, label, multiline } = body || {};
    if (!key) throw new Error('key is required');
    unwrap(
      await supabase.from('site_content').upsert(
        {
          key,
          value: String(value ?? ''),
          group_name: group || 'general',
          label: label || key,
          multiline: Boolean(multiline)
        },
        { onConflict: 'key' }
      )
    );
    await audit('create', 'content', key, { value });
    return { ok: true };
  }

  if (method === 'DELETE') {
    const key = query.get('key');
    if (!key) throw new Error('key is required');
    unwrap(await supabase.from('site_content').delete().eq('key', key));
    await audit('delete', 'content', key, null);
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ----------------------------------------------------------- themes

async function themes(method, query, body) {
  const id = query.get('id');
  const activate = query.get('activate');

  if (method === 'GET') {
    const rows = unwrap(
      await supabase.from('themes').select('*').order('is_default', { ascending: false }).order('name')
    );
    return { themes: (rows || []).map(rowToTheme) };
  }

  if (method === 'POST' && activate) {
    /* exactly one theme wears the crown: clear the rest, then set it */
    unwrap(await supabase.from('themes').update({ is_active: false }).neq('id', activate));
    const data = unwrap(
      await supabase.from('themes').update({ is_active: true }).eq('id', activate).select().single()
    );
    await audit('activate', 'theme', activate, { name: data.name });
    return { theme: rowToTheme(data) };
  }

  if (method === 'POST') {
    const data = unwrap(await supabase.from('themes').insert(themeToRow(body || {})).select().single());
    await audit('create', 'theme', data.id, { name: data.name });
    return { theme: rowToTheme(data) };
  }

  if (method === 'PATCH') {
    if (!id) throw new Error('id is required');
    const row = themeToRow(body || {});
    const data = unwrap(await supabase.from('themes').update(row).eq('id', id).select().single());
    await audit('update', 'theme', id, row);
    return { theme: rowToTheme(data) };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    const existing = unwrap(
      await supabase.from('themes').select('is_default, name').eq('id', id).maybeSingle()
    );
    if (existing?.is_default) throw new Error('The default theme cannot be deleted');
    unwrap(await supabase.from('themes').delete().eq('id', id));
    await audit('delete', 'theme', id, { name: existing?.name });
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ----------------------------------------------------------- offers

async function offers(method, id, body) {
  if (method === 'GET') {
    const rows = unwrap(
      await supabase.from('offers').select('*').order('created_at', { ascending: false })
    );
    return { offers: (rows || []).map(rowToOffer) };
  }

  if (method === 'POST') {
    const row = offerToRow(body || {});
    if (!row.title && !row.code) throw new Error('a title or a code is required');
    const data = unwrap(await supabase.from('offers').insert(row).select().single());
    await audit('create', 'offer', data.id, row);
    return { offer: rowToOffer(data) };
  }

  if (method === 'PATCH') {
    if (!id) throw new Error('id is required');
    const row = offerToRow(body || {});
    const data = unwrap(await supabase.from('offers').update(row).eq('id', id).select().single());
    await audit('update', 'offer', id, row);
    return { offer: rowToOffer(data) };
  }

  if (method === 'DELETE') {
    if (!id) throw new Error('id is required');
    unwrap(await supabase.from('offers').delete().eq('id', id));
    await audit('delete', 'offer', id, null);
    return { ok: true };
  }

  throw new Error(`Method not allowed (${method})`);
}

// ---------------------------------------------------------- session

async function session(method) {
  const admin = await currentAdmin();

  if (method === 'POST') {
    /* There is no shared cache to clear any more - every reader goes
       to the database - so this succeeds by having nothing to do. */
    if (!admin) throw new Error('Not authorised');
    return { ok: true, cleared: true };
  }

  if (admin?.incomplete) {
    const error = new Error(
      `Signed in as ${admin.email}, but the database tables do not exist yet.`
    );
    error.setup = 'database';
    throw error;
  }

  if (!admin) throw new Error('Not authorised');
  return { admin: { email: admin.email }, cache: 'off', database: true };
}

// ----------------------------------------------------------- upload

/* Straight into Storage. The bucket is public to read and admin-only
   to write, so the URL the product stores is a plain public one. */
export async function uploadMedia(file) {
  const type = String(file.type || 'image/jpeg').split(';')[0].trim();
  const ext = MEDIA_TYPES[type] || (file.name.split('.').pop() || '').toLowerCase();
  if (!Object.values(MEDIA_TYPES).includes(ext)) {
    throw new Error('Only image files can be uploaded');
  }
  if (file.size > MAX_UPLOAD) throw new Error('That file is larger than 8 MB');
  if (!file.size) throw new Error('No file was received');

  const base =
    (file.name.replace(/\.[^.]+$/, '') || 'image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'image';
  const path = `products/${base}-${Date.now().toString(36)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: type, upsert: false });

  if (error) {
    const hint = /bucket/i.test(error.message)
      ? ` — create a public bucket called "${BUCKET}" in Supabase Storage`
      : '';
    throw new Error(error.message + hint);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  await audit('upload', 'media', path, { bytes: file.size });
  return data.publicUrl;
}

/* The one door the panels come through. `path` is the URL they used
   to fetch, query string and all, so the call sites read the same as
   they did when there was a server at the other end. */
export async function callAdmin(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(path, 'http://local');
  const query = url.searchParams;
  const body = options.body ? JSON.parse(options.body) : undefined;

  switch (url.pathname) {
    case '/api/admin/session':
      return session(method);
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
