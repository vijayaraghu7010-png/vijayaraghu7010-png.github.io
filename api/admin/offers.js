import { requireAdmin, audit } from '../_lib/auth.js';
import { serviceClient } from '../_lib/supabase.js';
import { cacheBust } from '../_lib/cache.js';
import { rowToOffer, offerToRow } from '../_lib/shape.js';

/* GET    /api/admin/offers           every offer, expired ones included
   POST   /api/admin/offers           create
   PATCH  /api/admin/offers?id=uuid   update
   DELETE /api/admin/offers?id=uuid   delete                           */
async function handler(req, res, admin) {
  const db = serviceClient();
  const id = req.query.id;

  if (req.method === 'GET') {
    const { data, error } = await db.from('offers').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ offers: (data || []).map(rowToOffer) });
  }

  if (req.method === 'POST') {
    const row = offerToRow(req.body || {});
    if (!row.title && !row.code) return res.status(400).json({ error: 'a title or a code is required' });
    const { data, error } = await db.from('offers').insert(row).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'create', 'offer', data.id, row);
    await cacheBust();
    return res.status(201).json({ offer: rowToOffer(data) });
  }

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = offerToRow(req.body || {});
    const { data, error } = await db.from('offers').update(row).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'update', 'offer', id, row);
    await cacheBust();
    return res.status(200).json({ offer: rowToOffer(data) });
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await db.from('offers').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'delete', 'offer', id, null);
    await cacheBust();
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
