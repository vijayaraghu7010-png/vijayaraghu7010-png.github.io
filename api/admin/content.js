import { requireAdmin, audit } from '../_lib/auth.js';
import { serviceClient } from '../_lib/supabase.js';
import { cacheBust } from '../_lib/cache.js';

/* GET   /api/admin/content   every editable string on the site
   PATCH /api/admin/content   { entries: { key: value, ... } }
   POST  /api/admin/content   add a new key                        */
async function handler(req, res, admin) {
  const db = serviceClient();

  if (req.method === 'GET') {
    const { data, error } = await db.from('site_content').select('*').order('group_name').order('key');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ content: data || [] });
  }

  if (req.method === 'PATCH') {
    const entries = req.body?.entries;
    if (!entries || typeof entries !== 'object') {
      return res.status(400).json({ error: 'entries object is required' });
    }
    const rows = Object.entries(entries).map(([key, value]) => ({ key, value: String(value ?? '') }));
    const { error } = await db.from('site_content').upsert(rows, { onConflict: 'key' });
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'update', 'content', `${rows.length} keys`, entries);
    await cacheBust();
    return res.status(200).json({ ok: true, updated: rows.length });
  }

  if (req.method === 'POST') {
    const { key, value, group, label, multiline } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key is required' });
    const { error } = await db.from('site_content').upsert(
      {
        key,
        value: String(value ?? ''),
        group_name: group || 'general',
        label: label || key,
        multiline: Boolean(multiline)
      },
      { onConflict: 'key' }
    );
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'create', 'content', key, { value });
    await cacheBust();
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'key is required' });
    const { error } = await db.from('site_content').delete().eq('key', key);
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'delete', 'content', key, null);
    await cacheBust();
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
