import { createClient } from '@supabase/supabase-js';

/* The one connection to the backend.

   Both values here are meant to be public: the URL is where the
   project lives, and the publishable key identifies the project, not a
   person. What the key may actually do is decided by the row-level
   security on every table, which is why it can sit in a bundle that
   anybody can read. Nothing secret belongs in this file, or in any
   file the browser is handed: the service role and the storage
   credentials live in the Edge Functions and never leave them.

   The shop still works with no backend configured. Everything the
   catalogue needs is in the bundle; what stops is ordering, and the
   checkout says so rather than failing in some quieter way.       */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const BACKEND_READY = Boolean(url && key);

export const supabase = BACKEND_READY
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ws-admin-auth' }
    })
  : null;

export function functionUrl(name) {
  if (!url) throw new Error('No backend is configured');
  return `${String(url).replace(/\/$/, '')}/functions/v1/${name}`;
}

/* Every call to a function carries a token. For a customer that is the
   publishable key; for an administrator it is their own session, which
   is what the function checks them against. */
export async function callFunction(name, body, { asAdmin = false } = {}) {
  if (!BACKEND_READY) throw new Error('No backend is configured');

  let bearer = key;
  if (asAdmin) {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error('Your session has ended. Sign in again.');
    bearer = data.session.access_token;
  }

  const res = await fetch(functionUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${bearer}`
    },
    body: JSON.stringify(body ?? {})
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* an empty or unreadable body is handled by the status alone */
  }

  if (!res.ok) {
    const error = new Error(payload?.error || payload?.message || `That request failed (${res.status})`);
    error.status = res.status;
    error.fields = payload?.fields;
    throw error;
  }

  return payload;
}

/* The same call, when what comes back is a file rather than JSON.

   callFunction reads the body as JSON, which would turn an image
   into a parse failure and lose the error message with it. This
   keeps the body as a blob, and still reads a refusal as JSON - a
   function that says no says it the same way whatever it would have
   returned. */
export async function callFunctionForBlob(name, body, { asAdmin = false } = {}) {
  if (!BACKEND_READY) throw new Error('No backend is configured');

  let bearer = key;
  if (asAdmin) {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error('Your session has ended. Sign in again.');
    bearer = data.session.access_token;
  }

  const res = await fetch(functionUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${bearer}`
    },
    body: JSON.stringify(body ?? {})
  });

  if (!res.ok) {
    let message = `That request failed (${res.status})`;
    try {
      const payload = await res.json();
      message = payload?.error || payload?.message || message;
    } catch {
      /* a refusal with no readable body is handled by the status */
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return { blob: await res.blob() };
}
