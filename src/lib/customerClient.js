import { createClient } from '@supabase/supabase-js';

/* The shop's own connection, kept apart from the studio's.

   There are two kinds of person who sign in here and they must not
   share a session. The administrator's client keeps its session under
   'ws-admin-auth' and has done since the panel was built; changing
   that key would sign them out, so it is left exactly as it is. The
   customer gets a second client with a key of its own.

   Supabase-js notices two clients in one page and says so in the
   console. It is a warning about shared storage, and these two share
   none: different keys, different sessions, and in practice different
   halves of the site, since the admin panel is loaded only when
   somebody opens /admin.

   The same publishable key as everywhere else. What a signed-in
   customer may actually do is decided by the Edge Functions, which
   check the token with Supabase rather than believing the browser. */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const CUSTOMER_BACKEND_READY = Boolean(url && key);

export const customerSupabase = CUSTOMER_BACKEND_READY
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ws-customer-auth'
      }
    })
  : null;

/* The token for a customer-side call, or null if nobody is signed in.
   Never cached: a session that has just refreshed must not be called
   with the token it had a minute ago. */
export async function customerToken() {
  if (!customerSupabase) return null;
  const { data } = await customerSupabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/* The shop's own calls. A customer's token when there is one, the
   publishable key when there is not - which is what lets a guest
   place an order and look one up without an account. */
export async function callCustomerFunction(name, body, { raw = false } = {}) {
  if (!CUSTOMER_BACKEND_READY) throw new Error('No backend is configured');

  const token = await customerToken();
  const res = await fetch(`${String(url).replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${token || key}`
    },
    body: JSON.stringify(body ?? {})
  });

  /* `raw` is for the one reply that is a file rather than JSON - the
     studio's photograph download. Reading it as JSON would turn a zip
     into a parse failure and lose the refusal with it, so a refusal
     is still read as JSON here and only a success is handed back
     whole. */
  if (raw) {
    if (res.ok) return res;
    let message = `That request failed (${res.status})`;
    try {
      const refused = await res.json();
      message = refused?.error || message;
    } catch {
      /* a refusal with no readable body is handled by the status */
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* an empty or unreadable body is handled by the status alone */
  }

  if (!res.ok) {
    const error = new Error(payload?.error || `That request failed (${res.status})`);
    error.status = res.status;
    error.retryAfter = res.headers.get('retry-after');
    /* The checkout highlights the fields a server refused. */
    error.fields = payload?.fields;
    throw error;
  }

  return payload;
}
