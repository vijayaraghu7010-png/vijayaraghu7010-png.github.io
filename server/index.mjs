/* Temporary local backend.

   Same URLs, same request bodies and same responses as the Vercel
   functions in /api, so the admin panel and the storefront cannot
   tell the difference. The only differences are where the data is
   kept (a SQLite file instead of Supabase Postgres) and how the
   administrator signs in (a password instead of a mailed link,
   because there is no mail server here).

   Run it with:  npm run server       (or npm run dev:all) */

import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { db, seed } from './db.mjs';

const PORT = Number(process.env.SERVER_PORT || 4000);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'roshinip.0931@gmail.com,vijayaraghu7010@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const PASSWORD = process.env.LOCAL_ADMIN_PASSWORD || 'wrapped-admin';
const SECRET = process.env.LOCAL_ADMIN_SECRET || 'wrappedstudio-local-dev-secret';
const DAY = 24 * 60 * 60 * 1000;

seed(ADMIN_EMAILS);

/* ----------------------------------------------------------- tokens
   A signed string rather than a stored session, so a restart of this
   server does not sign the administrator out. */

function issue(email) {
  const expires = Date.now() + 7 * DAY;
  const body = `${email}|${expires}`;
  const sig = createHmac('sha256', SECRET).update(body).digest('hex');
  return Buffer.from(`${body}|${sig}`).toString('base64url');
}

function verify(token) {
  try {
    const [email, expires, sig] = Buffer.from(token, 'base64url').toString().split('|');
    if (!email || !expires || !sig) return null;
    if (Number(expires) < Date.now()) return null;

    const expected = createHmac('sha256', SECRET).update(`${email}|${expires}`).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (!ADMIN_EMAILS.includes(email)) return null;

    const row = db.prepare('select email from admins where email = ?').get(email);
    return row ? { email } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- row shapes
   Identical to api/_lib/shape.js, with the JSON columns parsed,
   because SQLite stores them as text. */

const parse = (v, fallback) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

const rowToProduct = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  category: r.category,
  categoryLabel: r.category_label,
  price: Number(r.price),
  priceMode: r.price_mode,
  unitLabel: r.unit_label || '',
  unitNoun: r.unit_noun || undefined,
  minQty: r.min_qty ?? undefined,
  setSize: r.set_size ?? undefined,
  image: r.image,
  alt: r.alt,
  gallery: parse(r.gallery, []),
  shortDescription: r.short_description,
  description: r.description,
  details: parse(r.details, []),
  occasions: parse(r.occasions, []),
  keywords: parse(r.keywords, []),
  customiser: r.customiser || undefined,
  sizeId: r.size_id || undefined,
  featured: Boolean(r.featured),
  published: Boolean(r.published),
  sortOrder: r.sort_order,
  addedAt: r.added_at
});

const rowToTheme = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  tokens: parse(r.tokens, {}),
  isDefault: Boolean(r.is_default),
  isActive: Boolean(r.is_active),
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  bannerText: r.banner_text || ''
});

const rowToOffer = (r) => ({
  id: r.id,
  code: r.code,
  title: r.title,
  description: r.description,
  discountType: r.discount_type,
  value: Number(r.value),
  appliesTo: parse(r.applies_to, { scope: 'all' }),
  minOrder: Number(r.min_order),
  maxDiscount: r.max_discount ?? null,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  active: Boolean(r.active),
  showBanner: Boolean(r.show_banner)
});

function pickActiveTheme(themes, now = new Date()) {
  const live = themes.filter((t) => {
    if (!t.isActive) return false;
    if (t.startsAt && new Date(t.startsAt) > now) return false;
    if (t.endsAt && new Date(t.endsAt) < now) return false;
    return true;
  });
  const scheduled = live
    .filter((t) => t.startsAt || t.endsAt)
    .sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0));
  return scheduled[0] || live.find((t) => !t.isDefault) || live[0] || themes.find((t) => t.isDefault) || null;
}

function logEdit(admin, action, entity, id, payload) {
  db.prepare('insert into admin_audit (actor, action, entity, entity_id, payload) values (?,?,?,?,?)').run(
    admin.email,
    action,
    entity,
    id ? String(id) : null,
    payload ? JSON.stringify(payload) : null
  );
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/* ------------------------------------------------------------ uploads
   A picture has to be served by the site to appear on it, so the file
   is copied into public/images/uploads and the product stores that
   path. A path like C:\Users\... can never work in a browser. */

const UPLOAD_DIR = resolve(process.cwd(), 'public/images/uploads');
const MAX_UPLOAD = 8 * 1024 * 1024;
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

async function readBytes(req, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('That file is larger than 8 MB');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function saveUpload(buffer, type, originalName) {
  const ext = TYPES[type] || (originalName.split('.').pop() || 'jpg').toLowerCase();
  if (!Object.values(TYPES).includes(ext)) throw new Error('Only image files can be uploaded');

  const base = (originalName.replace(/\.[^.]+$/, '') || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'image';

  const name = `${base}-${Date.now().toString(36)}.${ext}`;
  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(resolve(UPLOAD_DIR, name), buffer);
  return `/images/uploads/${name}`;
}

/* ------------------------------------------------------------ routes */

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return {};
  }
}

const json = (res, status, payload) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(payload));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const q = url.searchParams;

  if (req.method === 'OPTIONS') return json(res, 204, {});

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const admin = token ? verify(token) : null;
  const need = () => {
    json(res, 401, { error: 'Not authorised' });
    return null;
  };

  try {
    /* ---------------------------------------------- public payload */
    if (path === '/api/site-config' && req.method === 'GET') {
      const products = db
        .prepare('select * from products where published = 1 order by sort_order')
        .all()
        .map(rowToProduct);
      const content = Object.fromEntries(
        db.prepare('select key, value from site_content').all().map((r) => [r.key, r.value])
      );
      const themes = db.prepare('select * from themes').all().map(rowToTheme);
      const offers = db.prepare('select * from offers where active = 1').all().map(rowToOffer);

      return json(res, 200, {
        products,
        content,
        theme: pickActiveTheme(themes),
        offers,
        source: 'local-sqlite',
        generatedAt: new Date().toISOString()
      });
    }

    /* ------------------------------------------------------- login */
    if (path === '/api/admin/login' && req.method === 'POST') {
      const { email, password } = await body(req);
      const addr = String(email || '').trim().toLowerCase();
      if (!ADMIN_EMAILS.includes(addr)) return json(res, 401, { error: 'That address cannot administer this shop' });
      if (String(password || '') !== PASSWORD) return json(res, 401, { error: 'Wrong password' });
      db.prepare('insert or ignore into admins (email) values (?)').run(addr);
      return json(res, 200, { token: issue(addr), admin: { email: addr } });
    }

    if (path === '/api/admin/session') {
      if (req.method === 'POST') {
        if (!admin) return need();
        return json(res, 200, { ok: true, cleared: true });
      }
      return json(res, admin ? 200 : 401, {
        admin: admin ? { email: admin.email } : null,
        cache: 'off',
        database: 'local-sqlite',
        mode: 'local'
      });
    }

    /* ------------------------------------------------------ upload */
    if (path === '/api/admin/upload' && req.method === 'POST') {
      if (!admin) return need();
      const type = req.headers['content-type'] || 'image/jpeg';
      const name = decodeURIComponent(q.get('name') || 'image.jpg');
      const bytes = await readBytes(req, MAX_UPLOAD);
      if (!bytes.length) return json(res, 400, { error: 'No file was received' });
      const url = saveUpload(bytes, type.split(';')[0].trim(), name);
      logEdit(admin, 'upload', 'media', url, { bytes: bytes.length });
      return json(res, 201, { url });
    }

    /* ---------------------------------------------------- products */
    if (path === '/api/admin/products') {
      if (!admin) return need();

      if (req.method === 'GET') {
        return json(res, 200, {
          products: db.prepare('select * from products order by sort_order').all().map(rowToProduct)
        });
      }

      if (req.method === 'POST') {
        const p = await body(req);
        if (!p.name || !p.category) return json(res, 400, { error: 'name and category are required' });
        const id = p.id || slugify(p.name);
        db.prepare(
          `insert into products (id, slug, name, category, category_label, price, price_mode,
            unit_label, unit_noun, min_qty, set_size, image, alt, gallery, short_description,
            description, details, occasions, keywords, customiser, size_id, featured, published,
            sort_order, added_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,date('now'))`
        ).run(
          id, p.slug || slugify(p.name), p.name, p.category, p.categoryLabel || '',
          Number(p.price) || 0, p.priceMode || 'fixed', p.unitLabel || '', p.unitNoun || '',
          p.minQty ?? null, p.setSize ?? null, p.image || '', p.alt || '',
          JSON.stringify(p.gallery || []), p.shortDescription || '', p.description || '',
          JSON.stringify(p.details || []), JSON.stringify(p.occasions || []),
          JSON.stringify(p.keywords || []), p.customiser || null, p.sizeId || null,
          p.featured ? 1 : 0, p.published === false ? 0 : 1, Number(p.sortOrder) || 0
        );
        logEdit(admin, 'create', 'product', id, p);
        return json(res, 201, { product: rowToProduct(db.prepare('select * from products where id = ?').get(id)) });
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        const id = q.get('id');
        if (!id) return json(res, 400, { error: 'id is required' });
        const p = await body(req);
        db.prepare(
          `update products set slug=?, name=?, category=?, category_label=?, price=?, price_mode=?,
             unit_label=?, unit_noun=?, min_qty=?, set_size=?, image=?, alt=?, gallery=?,
             short_description=?, description=?, details=?, occasions=?, keywords=?,
             customiser=?, size_id=?, featured=?, published=?, sort_order=? where id=?`
        ).run(
          p.slug || slugify(p.name || id), p.name || '', p.category || '', p.categoryLabel || '',
          Number(p.price) || 0, p.priceMode || 'fixed', p.unitLabel || '', p.unitNoun || '',
          p.minQty ?? null, p.setSize ?? null, p.image || '', p.alt || '',
          JSON.stringify(p.gallery || []), p.shortDescription || '', p.description || '',
          JSON.stringify(p.details || []), JSON.stringify(p.occasions || []),
          JSON.stringify(p.keywords || []), p.customiser || null, p.sizeId || null,
          p.featured ? 1 : 0, p.published === false ? 0 : 1, Number(p.sortOrder) || 0, id
        );
        logEdit(admin, 'update', 'product', id, p);
        return json(res, 200, { product: rowToProduct(db.prepare('select * from products where id = ?').get(id)) });
      }

      if (req.method === 'DELETE') {
        const id = q.get('id');
        if (!id) return json(res, 400, { error: 'id is required' });
        db.prepare('delete from products where id = ?').run(id);
        logEdit(admin, 'delete', 'product', id, null);
        return json(res, 200, { ok: true });
      }
    }

    /* ----------------------------------------------------- content */
    if (path === '/api/admin/content') {
      if (!admin) return need();

      if (req.method === 'GET') {
        return json(res, 200, {
          content: db.prepare('select * from site_content order by group_name, key').all()
        });
      }

      if (req.method === 'PATCH') {
        const { entries } = await body(req);
        if (!entries || typeof entries !== 'object') return json(res, 400, { error: 'entries object is required' });
        const stmt = db.prepare(
          `insert into site_content (key, value) values (?, ?)
           on conflict(key) do update set value = excluded.value`
        );
        Object.entries(entries).forEach(([k, v]) => stmt.run(k, String(v ?? '')));
        logEdit(admin, 'update', 'content', `${Object.keys(entries).length} keys`, entries);
        return json(res, 200, { ok: true, updated: Object.keys(entries).length });
      }

      if (req.method === 'POST') {
        const { key, value, group, label, multiline } = await body(req);
        if (!key) return json(res, 400, { error: 'key is required' });
        db.prepare(
          `insert into site_content (key, value, group_name, label, multiline) values (?,?,?,?,?)
           on conflict(key) do update set value = excluded.value, group_name = excluded.group_name,
             label = excluded.label, multiline = excluded.multiline`
        ).run(key, String(value ?? ''), group || 'general', label || key, multiline ? 1 : 0);
        logEdit(admin, 'create', 'content', key, { value });
        return json(res, 201, { ok: true });
      }

      if (req.method === 'DELETE') {
        const key = q.get('key');
        if (!key) return json(res, 400, { error: 'key is required' });
        db.prepare('delete from site_content where key = ?').run(key);
        logEdit(admin, 'delete', 'content', key, null);
        return json(res, 200, { ok: true });
      }
    }

    /* ------------------------------------------------------ themes */
    if (path === '/api/admin/themes') {
      if (!admin) return need();

      if (req.method === 'GET') {
        return json(res, 200, {
          themes: db.prepare('select * from themes order by is_default desc, name').all().map(rowToTheme)
        });
      }

      if (req.method === 'POST' && q.get('activate')) {
        const id = q.get('activate');
        db.prepare('update themes set is_active = 0').run();
        db.prepare('update themes set is_active = 1 where id = ?').run(id);
        logEdit(admin, 'activate', 'theme', id, null);
        return json(res, 200, { theme: rowToTheme(db.prepare('select * from themes where id = ?').get(id)) });
      }

      if (req.method === 'POST') {
        const t = await body(req);
        const id = crypto.randomUUID();
        db.prepare(
          `insert into themes (id, name, kind, tokens, is_active, starts_at, ends_at, banner_text)
           values (?,?,?,?,?,?,?,?)`
        ).run(
          id, t.name || 'Untitled', t.kind || 'custom', JSON.stringify(t.tokens || {}),
          t.isActive ? 1 : 0, t.startsAt || null, t.endsAt || null, t.bannerText || ''
        );
        logEdit(admin, 'create', 'theme', id, { name: t.name });
        return json(res, 201, { theme: rowToTheme(db.prepare('select * from themes where id = ?').get(id)) });
      }

      if (req.method === 'PATCH') {
        const id = q.get('id');
        if (!id) return json(res, 400, { error: 'id is required' });
        const t = await body(req);
        db.prepare(
          `update themes set name=?, kind=?, tokens=?, is_active=?, starts_at=?, ends_at=?, banner_text=?
           where id=?`
        ).run(
          t.name || 'Untitled', t.kind || 'custom', JSON.stringify(t.tokens || {}),
          t.isActive ? 1 : 0, t.startsAt || null, t.endsAt || null, t.bannerText || '', id
        );
        logEdit(admin, 'update', 'theme', id, { name: t.name });
        return json(res, 200, { theme: rowToTheme(db.prepare('select * from themes where id = ?').get(id)) });
      }

      if (req.method === 'DELETE') {
        const id = q.get('id');
        const row = db.prepare('select is_default from themes where id = ?').get(id);
        if (row?.is_default) return json(res, 400, { error: 'The default theme cannot be deleted' });
        db.prepare('delete from themes where id = ?').run(id);
        logEdit(admin, 'delete', 'theme', id, null);
        return json(res, 200, { ok: true });
      }
    }

    /* ------------------------------------------------------ offers */
    if (path === '/api/admin/offers') {
      if (!admin) return need();

      if (req.method === 'GET') {
        return json(res, 200, {
          offers: db.prepare('select * from offers order by created_at desc').all().map(rowToOffer)
        });
      }

      if (req.method === 'POST') {
        const o = await body(req);
        if (!o.title && !o.code) return json(res, 400, { error: 'a title or a code is required' });
        const id = crypto.randomUUID();
        db.prepare(
          `insert into offers (id, code, title, description, discount_type, value, applies_to,
             min_order, max_discount, starts_at, ends_at, active, show_banner)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
          id, o.code ? String(o.code).toUpperCase() : null, o.title || '', o.description || '',
          o.discountType || 'percent', Number(o.value) || 0,
          JSON.stringify(o.appliesTo || { scope: 'all' }), Number(o.minOrder) || 0,
          o.maxDiscount === '' || o.maxDiscount === undefined ? null : Number(o.maxDiscount),
          o.startsAt || null, o.endsAt || null, o.active === false ? 0 : 1, o.showBanner ? 1 : 0
        );
        logEdit(admin, 'create', 'offer', id, o);
        return json(res, 201, { offer: rowToOffer(db.prepare('select * from offers where id = ?').get(id)) });
      }

      if (req.method === 'PATCH') {
        const id = q.get('id');
        if (!id) return json(res, 400, { error: 'id is required' });
        const o = await body(req);
        db.prepare(
          `update offers set code=?, title=?, description=?, discount_type=?, value=?, applies_to=?,
             min_order=?, max_discount=?, starts_at=?, ends_at=?, active=?, show_banner=? where id=?`
        ).run(
          o.code ? String(o.code).toUpperCase() : null, o.title || '', o.description || '',
          o.discountType || 'percent', Number(o.value) || 0,
          JSON.stringify(o.appliesTo || { scope: 'all' }), Number(o.minOrder) || 0,
          o.maxDiscount === '' || o.maxDiscount === undefined ? null : Number(o.maxDiscount),
          o.startsAt || null, o.endsAt || null, o.active === false ? 0 : 1, o.showBanner ? 1 : 0, id
        );
        logEdit(admin, 'update', 'offer', id, o);
        return json(res, 200, { offer: rowToOffer(db.prepare('select * from offers where id = ?').get(id)) });
      }

      if (req.method === 'DELETE') {
        const id = q.get('id');
        db.prepare('delete from offers where id = ?').run(id);
        logEdit(admin, 'delete', 'offer', id, null);
        return json(res, 200, { ok: true });
      }
    }

    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 500, { error: String(error.message || error) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  WrappedStudio local backend`);
  console.log(`  http://localhost:${PORT}/api/site-config`);
  console.log(`  database  server/data/wrappedstudio.db`);
  console.log(`  sign in   ${ADMIN_EMAILS.join(' or ')}`);
  console.log(`  password  ${PASSWORD}   (set LOCAL_ADMIN_PASSWORD to change)\n`);
});
