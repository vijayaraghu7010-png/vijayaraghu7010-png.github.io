import { anonClient, serviceClient } from './supabase.js';

/* Who is allowed in. The env var is the first gate so access can be
   changed without a deploy or a migration; the admins table is the
   second, so the list is also visible to the app itself. */
function allowList() {
  return (process.env.ADMIN_EMAILS || 'roshinip.0931@gmail.com,vijayaraghu7010@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function bearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

/* Checking a caller costs two calls to Supabase - one to turn the token
   into a user, one to read the admins row - and the database is in
   Tokyo while the function may not be, so that was most of the delay on
   every click in the panel. The answer for a given token cannot change
   within a minute in any way that matters (a revoked admin is out as
   soon as this lapses, and their token expires in an hour regardless),
   so a warm instance remembers it. */
const VERDICT_TTL_MS = 60_000;
const verdicts = new Map();

function remembered(token) {
  const hit = verdicts.get(token);
  if (!hit) return undefined;
  if (Date.now() > hit.until) {
    verdicts.delete(token);
    return undefined;
  }
  return hit.admin;
}

function remember(token, admin) {
  /* The map lives as long as the instance, so it must not grow without
     bound; tokens are few here, but a sweep costs nothing. */
  if (verdicts.size > 100) {
    const now = Date.now();
    for (const [key, value] of verdicts) if (now > value.until) verdicts.delete(key);
  }
  verdicts.set(token, { admin, until: Date.now() + VERDICT_TTL_MS });
  return admin;
}

/* Resolves the caller, or returns null. Never throws on a bad token. */
export async function currentAdmin(req) {
  const token = bearer(req);
  if (!token) return null;

  const cached = remembered(token);
  if (cached !== undefined) return cached;

  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data?.user?.email) return remember(token, null);

  const email = data.user.email.toLowerCase();
  if (!allowList().includes(email)) return remember(token, null);

  /* the table is authoritative when it has rows for this address */
  const { data: row, error: dbError } = await serviceClient()
    .from('admins')
    .select('email')
    .ilike('email', email)
    .maybeSingle();

  /* A missing table is a setup problem, not a rejected person: say so,
     otherwise the panel tells the owner they are not the owner. */
  if (dbError) {
    const missing = dbError.code === 'PGRST205' || /schema cache|does not exist/i.test(dbError.message || '');
    return { id: data.user.id, email, incomplete: missing ? 'database' : 'unknown', detail: dbError.message };
  }

  if (!row) return remember(token, null);
  return remember(token, { id: data.user.id, email });
}

/* Wraps a handler so it only runs for a signed-in admin. */
export function requireAdmin(handler) {
  return async (req, res) => {
    const admin = await currentAdmin(req);
    if (!admin) {
      res.status(401).json({ error: 'Not authorised' });
      return;
    }
    if (admin.incomplete) {
      res.status(503).json({
        error: 'The database has not been set up yet. Run supabase/RUN_ME_IN_SQL_EDITOR.sql in the Supabase SQL editor.',
        detail: admin.detail
      });
      return;
    }
    return handler(req, res, admin);
  };
}

/* Records what changed, so a mistaken edit can be traced. */
export async function audit(admin, action, entity, entityId, payload) {
  try {
    await serviceClient().from('admin_audit').insert({
      actor: admin.email,
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      payload: payload ?? null
    });
  } catch {
    /* an audit failure must never fail the edit itself */
  }
}
