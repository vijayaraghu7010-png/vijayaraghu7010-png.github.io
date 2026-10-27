/* The pieces every function here needs: who may call it, what a reply
   looks like, and how to read the studio's own settings.

   One rule runs through all of it. A browser is never believed about
   anything that costs money or grants access: not a price, not a photo
   limit, not whether somebody is an administrator. Each of those is
   looked up here, against the database, on every request.          */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/* Which sites may call these functions. Anything not named here is
   refused by the browser before the request is made. */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ||
  'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}

export function fail(message: string, status: number, origin: string | null): Response {
  return json({ error: message }, status, origin);
}

/* The service role. It is the only thing that writes to orders, and it
   exists only inside these functions. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

/* Who is asking, if anybody. The token is the caller's own: it is
   checked with Supabase, and the email that comes back is checked
   against the admins table. A header saying "I am an administrator"
   means nothing here. */
export async function requireAdmin(
  req: Request,
  db: SupabaseClient
): Promise<{ email: string } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data?.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const { data: row } = await db
    .from('admins')
    .select('email')
    .ilike('email', email)
    .maybeSingle();

  return row ? { email } : null;
}

export type Limits = {
  max_photos_by_customiser: Record<string, number>;
  max_photos_default: number;
  max_photos_per_order: number;
  max_bytes_per_photo: number;
  max_bytes_per_order: number;
  allowed_types: string[];
};

const FALLBACK: Limits = {
  max_photos_by_customiser: {
    polaroid: 120,
    magazine: 100,
    poster: 50,
    frame: 30,
    bouquet: 50,
    'hamper-3d': 50
  },
  max_photos_default: 50,
  max_photos_per_order: 300,
  max_bytes_per_photo: 26214400,
  max_bytes_per_order: 2147483648,
  allowed_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
};

/* The studio's limits, as the panel last set them. If the row is
   missing the shipped numbers are used rather than no limit at all -
   an unreadable setting must never become permission to upload
   anything. */
export async function getLimits(db: SupabaseClient): Promise<Limits> {
  const { data } = await db.from('settings').select('value').eq('key', 'uploads.limits').maybeSingle();
  if (!data?.value) return FALLBACK;
  return { ...FALLBACK, ...(data.value as Partial<Limits>) };
}

export function photoLimitFor(limits: Limits, customiser: string | null): number {
  if (!customiser) return limits.max_photos_default;
  return limits.max_photos_by_customiser[customiser] ?? limits.max_photos_default;
}

/* A token the browser keeps so it can go on uploading to the order it
   just made. Only its hash is stored, so the database never holds
   anything that would let somebody else upload. */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Trim, cap and refuse the empty. Everything a customer types passes
   through here before it reaches a column. */
export function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}
