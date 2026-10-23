import { createClient } from '@supabase/supabase-js';

/* The browser only ever holds the anon key. The site is served as
   static files, so there is no server behind it: the panel reads and
   writes the database directly, and row-level security decides what
   the signed-in administrator is allowed to touch. */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

/* While the hosted database is not in use, the same panel talks to the
   local SQLite backend instead, and signs in with a password because
   there is no mail server on a laptop. Everything else is identical. */
export const LOCAL_TOKEN_KEY = 'ws-admin-token';
export const localMode = !supabaseConfigured;

export function localToken() {
  try {
    return window.localStorage.getItem(LOCAL_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setLocalToken(token) {
  try {
    if (token) window.localStorage.setItem(LOCAL_TOKEN_KEY, token);
    else window.localStorage.removeItem(LOCAL_TOKEN_KEY);
  } catch {
    /* private window: the session simply does not survive a reload */
  }
}

export async function localSignIn(email, password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Could not sign in');
  setLocalToken(body.token);
  return body.admin;
}

/* Both callers below need the same bearer token, and getting it wrong
   in one of them is a silent 401, so it is worked out in one place. */
async function authToken() {
  const token = supabase
    ? (await supabase.auth.getSession()).data?.session?.access_token || ''
    : localToken();
  if (!token) throw new Error('Not signed in');
  return token;
}

/* Every panel refetched from scratch each time it was opened, and the
   database is far enough away that the round trip is visible, so moving
   between tabs meant watching "Loading..." again for data that had not
   changed. Answers to GETs are kept for a few seconds, and anything
   that writes throws the lot away - so an edit is never shown stale. */
const GET_TTL_MS = 15_000;
const cached = new Map();
const inFlight = new Map();

export function clearAdminCache() {
  cached.clear();
}

/* Calls an admin endpoint with the signed-in administrator's token. */
export async function adminFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const hit = cached.get(path);
    if (hit && Date.now() - hit.at < GET_TTL_MS) return hit.body;

    /* Two panels asking for the same thing at once - products is wanted
       by both the products and the offers tab - should be one request. */
    const already = inFlight.get(path);
    if (already) return already;
  }

  const run = (async () => {
    const token = await authToken();

    /* Hosted: the database is the backend, and adminApi answers the
       same paths the panels ask for. Local SQLite mode still has a
       real server on 4000, so there the request goes out as a request.
       Imported here rather than at the top because adminApi needs the
       client this module creates. */
    if (supabase) {
      const { callAdmin } = await import('./adminApi');
      return callAdmin(path, options);
    }

    const res = await fetch(path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  })();

  if (method !== 'GET') {
    /* Cleared on the way out as well as on the way in: a read that
       started while the write was in flight would otherwise put the
       old answer back. */
    clearAdminCache();
    return run.finally(clearAdminCache);
  }

  inFlight.set(path, run);
  try {
    const body = await run;
    cached.set(path, { at: Date.now(), body });
    return body;
  } finally {
    inFlight.delete(path);
  }
}

/* Warmed as soon as somebody signs in, so the first tab they open and
   the next one they try are both already there. Failures are ignored:
   this is an optimisation, and the panel will ask again itself. */
export function prefetchAdmin() {
  ['/api/admin/products', '/api/admin/content', '/api/admin/themes', '/api/admin/offers'].forEach(
    (path) => {
      adminFetch(path).catch(() => {});
    }
  );
}

/* Puts one picture where the shop can load it from and returns its
   URL: straight into the Storage bucket when the hosted database is
   in use, through the local server when it is not. */
export async function adminUpload(file) {
  const token = await authToken();

  if (supabase) {
    const { uploadMedia } = await import('./adminApi');
    return uploadMedia(file);
  }

  const res = await fetch(`/api/admin/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': file.type || 'image/jpeg' },
    body: file
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
  return body.url;
}

/* Changes the signed-in administrator's own password. Supabase verifies
   the current one first, so a walked-away-from session cannot be used to
   lock the real owner out. Local SQLite mode shares one password from the
   environment, so there is nothing per-person to change there. */
export const canChangePassword = supabaseConfigured;

export async function changePassword(email, currentPassword, newPassword) {
  if (!supabase) throw new Error('Password changes need the hosted database');

  const { error: wrong } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword
  });
  if (wrong) throw new Error('Current password is not right');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
