import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

/* Both clients are built once per warm instance. A fresh client per
   request threw away the kept-alive TLS connection to Supabase, which
   is the expensive part of a cross-region call. */
let service = null;
let anon = null;

/* The service client bypasses row level security, so it never leaves
   the server. Every write in this API goes through it, after the
   caller has been checked against the admin list. */
export function serviceClient() {
  if (service) return service;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return service;
}

/* Reading is a public operation: row level security already limits it
   to published rows, so the storefront payload can be built with the
   publishable key alone. The service key is used when it is present
   because it skips the policy check, which is a little faster. */
export function readClient() {
  try {
    return serviceClient();
  } catch {
    return anonClient();
  }
}

/* An anon client used only to turn a caller's access token into a user. */
export function anonClient() {
  if (anon) return anon;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return anon;
}
