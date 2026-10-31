/* Showing one order's progress to whoever holds the token.

   The token is the whole of the claim, so it is checked properly:
   it must exist, not be revoked, and not have expired. Only its hash
   is ever compared, because only its hash was ever stored.

   What comes back is built by customerView out of named fields. The
   order row it was read from holds a delivery address, a phone
   number and payment identifiers; none of them are in the reply, and
   none can arrive in it later by someone adding a column.

   This token reads a status. It does not download a photograph, does
   not change anything, and cannot reach another order.             */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import {
  attemptKey, customerView, hashToken, noteVerdict, rateLimit, NO_STORE
} from '../_shared/customer.ts';
import { paymentView } from '../_shared/payments.ts';

const NO = 'That tracking link is not valid any more.';

/* Generous: a customer refreshing a page should never meet this. */
const MAX_PER_WINDOW = 60;
const WINDOW_SECONDS = 300;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  const token = text(body.token, 200);
  if (!token) return json({ error: NO }, 403, origin);

  const db = serviceClient();
  const tokenHash = await hashToken(token);

  /* Guessing a token is not the worry - it is thirty-two random
     bytes. What this bounds is somebody replaying one link very
     fast, which costs four reads and a write each time.

     The key is the token's own hash, not the caller's address, so it
     is one of the limits no header can slip. A caller with no token
     never reaches this line. */
  const verdict = await rateLimit(db, await attemptKey(['track', tokenHash]), MAX_PER_WINDOW, WINDOW_SECONDS, true);
  noteVerdict('track-order', 'token', verdict);

  if (!verdict.ok) {
    return json({ error: 'That link has been opened a lot just now. Please wait a moment.' }, 429, origin);
  }

  const { data: row } = await db
    .from('order_tracking_tokens')
    .select('id, order_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!row) return json({ error: NO }, 403, origin);
  if (row.revoked_at) return json({ error: NO }, 403, origin);
  if (new Date(String(row.expires_at)) < new Date()) return json({ error: NO }, 403, origin);

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, status, payment_status, created_at, updated_at, completed_at')
    .eq('id', row.order_id)
    .maybeSingle();

  if (!order) return json({ error: NO }, 403, origin);

  const { data: items } = await db
    .from('order_items')
    .select('product_name, quantity, position')
    .eq('order_id', order.id)
    .order('position');

  const { data: events } = await db
    .from('order_events')
    .select('event, created_at')
    .eq('order_id', order.id)
    .order('created_at');

  /* The most recent payment attempt, if there has been one. Named
     fields only, through paymentView - the row it comes from holds a
     bucket key and the name of whoever decided it, and neither is any
     of a customer's business. */
  const { data: payments } = await db
    .from('order_payments')
    .select('status, method, utr, amount_paise, created_at, decided_at, decision_note')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1);

  /* Useful for spotting a shared link later. Best effort: a tracking
     page should not fail because a timestamp did not save. */
  await db
    .from('order_tracking_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id);

  /* payment_status, so the page knows whether to offer the payment
     link, and the customer's own last submission so a refusal can say
     why. The order's total is deliberately still not here: this reply
     has never carried it, and the payment page asks for it separately
     with the same token. */
  const view = {
    ...customerView(order, items ?? [], events ?? []),
    payment_status: order.payment_status,
    payment: paymentView(payments?.[0] ?? null)
  };

  return new Response(JSON.stringify({ order: view }), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
  });
});
