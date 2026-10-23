import { requireAdmin, audit } from '../_lib/auth.js';
import { serviceClient } from '../_lib/supabase.js';
import { cacheBust } from '../_lib/cache.js';
import { rowToTheme, themeToRow } from '../_lib/shape.js';

/* GET    /api/admin/themes               every theme, festival ones included
   POST   /api/admin/themes               create
   PATCH  /api/admin/themes?id=uuid       update (tokens, schedule, active)
   DELETE /api/admin/themes?id=uuid       delete (never the default)
   POST   /api/admin/themes?activate=uuid make this the live theme        */
async function handler(req, res, admin) {
  const db = serviceClient();
  const id = req.query.id;
  const activate = req.query.activate;

  if (req.method === 'GET') {
    const { data, error } = await db.from('themes').select('*').order('is_default', { ascending: false }).order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ themes: (data || []).map(rowToTheme) });
  }

  if (req.method === 'POST' && activate) {
    /* exactly one theme wears the crown: clear the rest, then set it */
    const clear = await db.from('themes').update({ is_active: false }).neq('id', activate);
    if (clear.error) return res.status(400).json({ error: clear.error.message });
    const { data, error } = await db.from('themes').update({ is_active: true }).eq('id', activate).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'activate', 'theme', activate, { name: data.name });
    await cacheBust();
    return res.status(200).json({ theme: rowToTheme(data) });
  }

  if (req.method === 'POST') {
    const { data, error } = await db.from('themes').insert(themeToRow(req.body || {})).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'create', 'theme', data.id, { name: data.name });
    await cacheBust();
    return res.status(201).json({ theme: rowToTheme(data) });
  }

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = themeToRow(req.body || {});
    const { data, error } = await db.from('themes').update(row).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'update', 'theme', id, row);
    await cacheBust();
    return res.status(200).json({ theme: rowToTheme(data) });
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { data: existing } = await db.from('themes').select('is_default, name').eq('id', id).maybeSingle();
    if (existing?.is_default) {
      return res.status(400).json({ error: 'The default theme cannot be deleted' });
    }
    const { error } = await db.from('themes').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await audit(admin, 'delete', 'theme', id, { name: existing?.name });
    await cacheBust();
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
