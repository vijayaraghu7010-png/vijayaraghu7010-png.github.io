import { requireAdmin, audit } from '../_lib/auth.js';
import { serviceClient } from '../_lib/supabase.js';
import { cacheBust } from '../_lib/cache.js';
import { rowToProduct, productToRow } from '../_lib/shape.js';

/* GET    /api/admin/products            every product, drafts included
   POST   /api/admin/products            create
   PATCH  /api/admin/products?id=xyz     update
   DELETE /api/admin/products?id=xyz     delete                        */
async function handler(req, res, admin) {
  const db = serviceClient();
  const id = req.query.id;

  if (req.method === 'GET') {
    const { data, error } = await db.from('products').select('*').order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ products: (data || []).map(rowToProduct) });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name || !body.category) {
      return res.status(400).json({ error: 'name and category are required' });
    }
    const row = productToRow({
      ...body,
      id: body.id || slugify(body.name),
      slug: body.slug || slugify(body.name)
    });
    const { data, error } = await db.from('products').insert(row).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'create', 'product', data.id, row);
    await cacheBust();
    return res.status(201).json({ product: rowToProduct(data) });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = productToRow({ ...req.body, id });
    delete row.id;
    const { data, error } = await db.from('products').update(row).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'update', 'product', id, row);
    await cacheBust();
    return res.status(200).json({ product: rowToProduct(data) });
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'delete', 'product', id, null);
    await cacheBust();
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export default requireAdmin(handler);
