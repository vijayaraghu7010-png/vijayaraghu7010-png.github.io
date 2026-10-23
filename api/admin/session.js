import { currentAdmin } from '../_lib/auth.js';
import { cacheEnabled, cacheBust } from '../_lib/cache.js';

/* GET  /api/admin/session   is this caller an admin, and is the stack wired up
   POST /api/admin/session   clear the storefront cache by hand            */
export default async function handler(req, res) {
  const admin = await currentAdmin(req);

  if (req.method === 'POST') {
    if (!admin) return res.status(401).json({ error: 'Not authorised' });
    await cacheBust();
    return res.status(200).json({ ok: true, cleared: true });
  }

  if (admin?.incomplete) {
    return res.status(503).json({
      admin: null,
      setup: 'database',
      error: 'Signed in as ' + admin.email + ', but the database tables do not exist yet.',
      detail: admin.detail
    });
  }

  return res.status(admin ? 200 : 401).json({
    admin: admin ? { email: admin.email } : null,
    cache: cacheEnabled() ? 'redis' : 'off',
    database: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  });
}
