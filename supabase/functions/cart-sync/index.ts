/* The signed-in customer's bag, so it is the same bag on every device.

   Two calls, both POST:

     { }                       - read the saved bag
     { lines, wishlist, base } - save this bag and read back what won

   Ownership is the token, never the body: the row is keyed on the id
   Supabase gives back for the Authorization header, and there is no
   user id in the body to be read even if one were put there. A guest
   has no row and gets a 401, which the browser treats as "stay on
   localStorage" rather than as an error worth showing.

   Nothing here is trusted as money. A line is a product id, a count
   and the customiser's config; the price is decided by the orders
   function against the catalogue when the order is actually placed.
   This table only has to hand back what the customer put in it.

   `base` is the updated_at the browser last saw. If the row has moved
   on since - the other device wrote while this tab was open - the two
   bags are merged instead of this one flattening the other.        */

import { serviceClient, fail, corsHeaders } from '../_shared/common.ts';
import { requireCustomer, NO_STORE } from '../_shared/customer.ts';

const MAX_LINES = 100;
const MAX_WISHLIST = 200;
/* A line is small - ids, a count, a handful of chosen options. This is
   generous for that and still refuses a client trying to use the bag
   as free storage. */
const MAX_BYTES = 256 * 1024;

type Line = Record<string, unknown>;

/* The shape the cart context writes, taken field by named field so a
   client cannot park anything else in the row. config is passed
   through whole because every customiser writes its own, but it is
   size-capped along with the rest. */
function cleanLine(raw: unknown): Line | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;

  const key = typeof l.key === 'string' ? l.key.slice(0, 200) : '';
  const productId = typeof l.productId === 'string' ? l.productId.slice(0, 120) : '';
  if (!key || !productId) return null;

  const quantity = Math.floor(Number(l.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) return null;

  const line: Line = { key, productId, quantity };

  for (const field of ['slug', 'name', 'image', 'alt', 'categoryLabel', 'unitLabel'] as const) {
    if (typeof l[field] === 'string') line[field] = (l[field] as string).slice(0, 400);
  }
  if (Number.isFinite(Number(l.unitPrice))) line.unitPrice = Number(l.unitPrice);
  if (l.config && typeof l.config === 'object' && !Array.isArray(l.config)) line.config = l.config;

  return line;
}

/* Absent is not empty. The bag and the wishlist live in two separate
   contexts in the browser and sync on their own, so a call carrying
   only lines must leave the wishlist exactly as it was rather than
   clearing it. Null is returned for "not sent". */
function cleanLines(body: Record<string, unknown>): Line[] | null {
  if (!Array.isArray(body.lines)) return null;
  return body.lines.slice(0, MAX_LINES).map(cleanLine).filter(Boolean) as Line[];
}

function cleanWishlist(body: Record<string, unknown>): string[] | null {
  if (!Array.isArray(body.wishlist)) return null;
  return [
    ...new Set(
      body.wishlist
        .slice(0, MAX_WISHLIST)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map((id) => id.slice(0, 120))
    )
  ];
}

/* Two bags into one. A line is the same line when its key is the same
   - the key already carries the product and the choices made, so an A4
   and an A5 of one poster are two keys and stay two lines.

   The higher count wins rather than the sum: adding three on a phone
   and seeing three on a laptop is what somebody expects, where six
   would be a bug they have to undo. */
function mergeLines(mine: Line[], theirs: Line[]): Line[] {
  const out = new Map<string, Line>();
  for (const line of theirs) out.set(String(line.key), line);
  for (const line of mine) {
    const seen = out.get(String(line.key));
    if (!seen) {
      out.set(String(line.key), line);
      continue;
    }
    out.set(String(line.key), {
      ...seen,
      ...line,
      quantity: Math.max(Number(seen.quantity) || 1, Number(line.quantity) || 1)
    });
  }
  return [...out.values()].slice(0, MAX_LINES);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return fail('That bag is too large to save', 413, origin);

  const db = serviceClient();
  const customer = await requireCustomer(req, db);
  if (!customer) return fail('Please sign in again', 401, origin);

  let body: Record<string, unknown>;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  const { data: row } = await db
    .from('customer_bags')
    .select('lines, wishlist, updated_at')
    .eq('user_id', customer.id)
    .maybeSingle();

  const saved = {
    lines: (row?.lines ?? []) as Line[],
    wishlist: (row?.wishlist ?? []) as string[],
    updated_at: row?.updated_at ?? null
  };

  /* A read. */
  if (!('lines' in body) && !('wishlist' in body)) {
    return reply({ bag: saved }, origin);
  }

  /* A write. The browser's bag replaces the row, except where another
     device has written since the browser last looked - then neither
     bag is the loser and the two are merged. */
  const sentLines = cleanLines(body);
  const sentWishlist = cleanWishlist(body);
  const stale = Boolean(saved.updated_at && body.base && String(body.base) !== String(saved.updated_at));

  const lines =
    sentLines === null ? saved.lines : stale ? mergeLines(sentLines, saved.lines) : sentLines;

  const wishlist =
    sentWishlist === null
      ? saved.wishlist
      : stale
        ? [...new Set([...saved.wishlist, ...sentWishlist])].slice(0, MAX_WISHLIST)
        : sentWishlist;

  const { data: written, error } = await db
    .from('customer_bags')
    .upsert(
      { user_id: customer.id, lines, wishlist, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select('lines, wishlist, updated_at')
    .maybeSingle();

  if (error) return fail('That bag could not be saved', 500, origin);

  return reply({ bag: written, merged: stale }, origin);
});

/* A bag is per-person and changes constantly: it must never be held
   in a cache between the function and the browser. */
function reply(payload: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
  });
}
