/* What a customer is allowed to know, and how often they may ask.

   Three ideas live here, and they are the whole of the customer side.

   First: who is asking. A signed-in customer is whoever their own
   token says they are, checked with Supabase, exactly as requireAdmin
   does it. An id in a request body is not an identity and is never
   read.

   Second: what comes back. An order row holds a delivery address, a
   phone number, payment identifiers and a running history that names
   the administrator who looked at the photographs. A tracking page
   needs a status and a date. customerView builds that reply out of
   named fields, so a column added to orders later cannot leak by
   being there.

   Third: how often. Order codes run in sequence, so the defence
   against walking through them is that walking is slow.            */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { hashToken, newToken } from './common.ts';

/* The five the shop actually has. Nothing here invents a status: the
   labels are the ones the studio already uses in its own panel. */
export const STATUS_LABEL: Record<string, string> = {
  /* 'created' is here because the event written when an order is made
     is order.created, while the status it lands in is 'pending'. The
     two names have to meet somewhere, and a customer should never be
     shown either of them raw. */
  created: 'Order placed',
  pending: 'Order placed',
  paid: 'Payment received',
  in_progress: 'Being made',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

/* The order a customer is walked through. cancelled is not a step on
   the way anywhere, so it is not in the line. */
export const STATUS_FLOW = ['pending', 'paid', 'in_progress', 'completed'];

/* Which history entries a customer may see. The photographs ones are
   deliberately absent: photos.downloaded records an administrator's
   email address, and photos.deleted is studio housekeeping. */
const CUSTOMER_EVENTS = new Set([
  'order.created',
  'order.paid',
  'order.in_progress',
  'order.completed',
  'order.cancelled'
]);

export type Customer = { id: string; email: string };

/* Who is asking, if anybody. The token is the caller's own and is
   checked with Supabase; nothing in the body is believed. */
export async function requireCustomer(
  req: Request,
  db: SupabaseClient
): Promise<Customer | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data?.user?.id || !data.user.email) return null;

  /* An unverified address proves nothing. Supabase sets this once the
     customer has followed the link it sent them. */
  if (!data.user.email_confirmed_at && !data.user.confirmed_at) return null;

  return { id: data.user.id, email: data.user.email.toLowerCase() };
}

/* One order, as a customer may see it. Every field is named. */
export function customerView(
  order: Record<string, unknown>,
  items: Record<string, unknown>[] = [],
  events: Record<string, unknown>[] = []
) {
  return {
    order_code: order.order_code,
    status: order.status,
    status_label: STATUS_LABEL[String(order.status)] ?? 'In hand',
    placed_at: order.created_at,
    updated_at: order.updated_at,
    completed_at: order.completed_at ?? null,
    cancelled: order.status === 'cancelled',
    items: items.map((i) => ({
      product_name: i.product_name,
      quantity: i.quantity
    })),
    timeline: events
      .filter((e) => CUSTOMER_EVENTS.has(String(e.event)))
      .map((e) => ({
        event: e.event,
        label: STATUS_LABEL[String(e.event).replace('order.', '')] ?? String(e.event),
        at: e.created_at
      }))
  };
}

/* Comparing two hex digests without letting the clock say how far
   along they matched.

   A six-digit code is small enough that an attacker who could measure
   where a comparison gave up would have a real advantage, and the
   cost of removing that is a loop. Length is compared first and then
   the whole string is walked regardless, so the time depends on the
   length and nothing else. */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* What a token claims to be, without believing any of it.

   This reads the role out of a JWT's payload without checking the
   signature, so it proves nothing and is used for nothing that
   matters. Its one job is telling two situations apart: a guest whose
   request carries the publishable key, whose role is 'anon', and a
   customer whose session has expired, whose role is 'authenticated'.

   Those two deserve different answers, and without this they look
   identical - both are simply a token Supabase will not resolve to a
   user. Whether the caller is actually anybody is still decided by
   auth.getUser, which does check the signature. */
export function unverifiedJwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const role = JSON.parse(json)?.role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/* A six-digit code, drawn from the same source as everything else
   here rather than from Math.random. */
export function sixDigitCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
}

export { hashToken, newToken };

/* A key that identifies an attempt without recording what was
   attempted. Neither the address nor the order code survives
   hashing, so the rate-limit table is worth nothing if read. */
export async function attemptKey(parts: (string | null)[]): Promise<string> {
  return await hashToken(parts.map((p) => (p ?? '').toLowerCase().trim()).join('|'));
}

export type RateVerdict = {
  ok: boolean;
  retry_after_seconds: number;
  /* False when the count could not be read or incremented. The caller
     is let through, but the fact is reported rather than swallowed. */
  enforced: boolean;
  /* False when the key was derived from a header the client could
     have written. Honest labelling, not decoration: it decides
     whether this limit may be described as a control at all. */
  trustworthy: boolean;
};

/* A fixed window, counted in one statement.

   The increment happens inside Postgres, through bump_lookup_attempt
   in migration 0004. Doing it here as read-then-write lost counts:
   two requests arriving together both read the same number and both
   wrote the same number back, so ten parallel attempts could register
   as one. Attackers send requests in parallel by default, which is
   precisely when a limiter has to be right.

   If the function is not there - because 0004 has not been run - the
   old read-then-write is used instead, and the verdict says
   enforced: false so nobody can mistake it for a working limit.

   It still lets the caller through when the database cannot be
   reached. That is deliberate: this guards against noise, not
   against access, and a limiter that cannot read its own table must
   not take checkout down with it. The difference now is that the
   failure is reported in the verdict and written to the log instead
   of vanishing. */
export async function rateLimit(
  db: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
  trustworthy = true
): Promise<RateVerdict> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const retryAfter = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000);
  const open = (enforced: boolean): RateVerdict => ({
    ok: true, retry_after_seconds: 0, enforced, trustworthy
  });

  try {
    const { data, error } = await db.rpc('bump_lookup_attempt', {
      p_key_hash: key,
      p_window_start: windowStart.toISOString()
    });

    if (!error && typeof data === 'number') {
      return data > max
        ? { ok: false, retry_after_seconds: retryAfter, enforced: true, trustworthy }
        : { ok: true, retry_after_seconds: 0, enforced: true, trustworthy };
    }

    /* No function yet. Fall back, and say so. */
    console.warn('[rate-limit] bump_lookup_attempt unavailable; counting is not atomic');
    const { data: row, error: readError } = await db
      .from('lookup_attempts')
      .select('count')
      .eq('key_hash', key)
      .eq('window_start', windowStart.toISOString())
      .maybeSingle();

    if (readError) {
      console.warn('[rate-limit] could not read the attempt count; letting this one through');
      return open(false);
    }

    const used = Number(row?.count ?? 0);
    if (used >= max) {
      return { ok: false, retry_after_seconds: retryAfter, enforced: false, trustworthy };
    }

    await db
      .from('lookup_attempts')
      .upsert(
        { key_hash: key, window_start: windowStart.toISOString(), count: used + 1 },
        { onConflict: 'key_hash,window_start' }
      );

    return open(false);
  } catch {
    console.warn('[rate-limit] the attempt table could not be used; letting this one through');
    return open(false);
  }
}

/* Who is on the other end - as far as that can honestly be said.

   X-Forwarded-For is a list that proxies append to, so its leftmost
   entry is whatever the client typed. Anyone can send a different one
   per request and have a fresh identity every time. The rightmost
   entry is only better if you know how many proxies are in front of
   you, and taking it blindly is its own mistake.

   No Supabase documentation was found establishing which header its
   platform sets and strips. Rather than guess, the operator names the
   header they trust in TRUSTED_IP_HEADER; until they do, the value is
   marked untrustworthy and travels with that label.

   What this means in practice: IP limiting here is noise control, not
   a security control, and nothing in this phase depends on it. What
   actually stops a code being guessed is the per-code attempt counter
   on the row itself, which no header can touch.                   */
export function callerIdentity(req: Request): { value: string; trusted: boolean } {
  const configured = (Deno.env.get('TRUSTED_IP_HEADER') || '').trim();
  if (configured) {
    const value = req.headers.get(configured)?.trim();
    if (value) return { value, trusted: true };
  }

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  return { value: forwarded || cf || 'unknown', trusted: false };
}

/* Saying out loud when a limit is not really a limit.

   A verdict can come back ok for three quite different reasons: the
   caller is under the ceiling, or the counting is not atomic because
   migration 0004 has not been run, or the table could not be read at
   all. Only the first is a working limit, and from the outside they
   are indistinguishable.

   So each endpoint reports the other two. What goes in the log is the
   endpoint, which limit, and why - never the key, which is a hash of
   an address and an order code, and never anything a customer typed.
   A log line that needed redacting would be the wrong log line. */
export function noteVerdict(endpoint: string, which: string, verdict: RateVerdict): void {
  if (!verdict.enforced) {
    console.warn(`[rate-limit] ${endpoint}/${which}: not enforced (counter unavailable)`);
  }
  if (!verdict.trustworthy) {
    console.warn(
      `[rate-limit] ${endpoint}/${which}: caller identity is unverified ` +
        '(set TRUSTED_IP_HEADER to the header this platform sets)'
    );
  }
}

/* Sensitive replies are not for keeping. */
export const NO_STORE = { 'Cache-Control': 'no-store, private' };
