/* Recording what a customer says they paid.

   What arrives is a claim: an app, a reference number, and a picture
   of a success screen. None of it is proof. A screenshot is an image
   anybody can make and a reference number is a string anybody can
   type, so this function does exactly one thing with them - writes
   them down, against this order, where an administrator can compare
   them with the credit in the account.

   The order does not move. It stays 'pending' with payment_status
   'unpaid' until somebody at the studio says otherwise, and that
   happens in payments-admin.

   Two things are checked rather than taken on trust. The screenshot
   has to actually be in the bucket, at the size the browser said -
   the same HEAD that uploads-complete does - because a row pointing
   at nothing would waste the studio's time at the worst moment. And
   the amount is copied from the order here, not from the request, so
   a later price change cannot make an old payment look right.     */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import { requireCustomer, attemptKey, rateLimit, noteVerdict } from '../_shared/customer.ts';
import { headObject, r2Configured, deleteObject } from '../_shared/r2.ts';
import {
  normaliseUtr,
  orderFromClaim,
  paymentGate,
  paymentView,
  upiConfig,
  PROOF_TYPES,
  UPI_METHODS
} from '../_shared/payments.ts';

const MAX_PER_WINDOW = 10;
const WINDOW_SECONDS = 300;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);
  if (!r2Configured()) return fail('Payment proof storage is not configured yet', 503, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  const db = serviceClient();

  const upi = await upiConfig(db);
  if (!upi.enabled) return fail('Payment is not available yet', 503, origin);

  const customer = await requireCustomer(req, db);
  const claim = await orderFromClaim(db, body, customer?.id ?? null);
  if ('error' in claim) return fail(claim.error, claim.status, origin);
  const order = claim.order;

  const blocked = await paymentGate(db, order);
  if (blocked) return fail(blocked.error, blocked.status, origin);

  const verdict = await rateLimit(
    db,
    await attemptKey(['payment-submit', order.id]),
    MAX_PER_WINDOW,
    WINDOW_SECONDS,
    true
  );
  noteVerdict('payments-submit', 'order', verdict);
  if (!verdict.ok) {
    return json({ error: 'That has been tried a few times just now. Please wait a moment.' }, 429, origin);
  }

  const method = text(body.method, 20).toLowerCase();
  const utr = normaliseUtr(body.utr);
  const note = text(body.note, 500);
  const proofKey = text(body.proof_key, 300);
  const proofType = text(body.proof_content_type, 60).toLowerCase();

  if (!UPI_METHODS.includes(method)) return fail('Which app was that paid from?', 400, origin);
  if (!utr) {
    return fail(
      'That does not look like a UPI reference number. It is the 12-digit UTR in your payment app.',
      400,
      origin
    );
  }
  if (!PROOF_TYPES.includes(proofType)) return fail('That screenshot is not one we can read', 415, origin);

  /* The key has to be one this function could have issued, for this
     order. A browser that invents a key cannot point a payment row at
     somebody else's object. */
  if (!proofKey.startsWith(`payments/${order.id}/`) || proofKey.includes('..')) {
    return fail('That screenshot does not belong to this order', 400, origin);
  }

  const head = await headObject(proofKey).catch(() => null);
  if (!head) return fail('That screenshot did not finish uploading. Please try again.', 409, origin);

  const { data: row, error } = await db
    .from('order_payments')
    .insert({
      order_id: order.id,
      method,
      utr,
      amount_paise: order.total_paise,
      proof_r2_key: proofKey,
      proof_content_type: proofType,
      proof_byte_size: head.size,
      customer_note: note || null,
      status: 'submitted'
    })
    .select('id, status, method, utr, amount_paise, created_at, decided_at, decision_note')
    .single();

  if (error || !row) {
    /* The one error worth telling apart. A reference number already
       live against another order means at most one of the two was
       paid, and the customer should hear that now rather than after a
       day of nobody being able to find the money. 23505 is Postgres's
       unique violation. */
    const duplicate = String((error as { code?: string } | null)?.code) === '23505';

    /* Nothing points at the screenshot now, so it is removed rather
       than left in the bucket for ever. Best effort: a failed cleanup
       is not worth failing the reply over. */
    await deleteObject(proofKey).catch(() => {});

    return fail(
      duplicate
        ? 'That reference number has already been used for another order. Please check it and try again.'
        : 'That payment could not be recorded',
      duplicate ? 409 : 500,
      origin
    );
  }

  await db.from('order_payment_events').insert({
    payment_id: row.id,
    order_id: order.id,
    event: 'payment.submitted',
    actor: 'customer',
    detail: { method, amount_paise: order.total_paise }
  });

  /* The customer's own timeline. It says a payment was submitted and
     nothing more - no reference number, because order_events is read
     by the tracking page and a reference number is not a status. */
  await db.from('order_events').insert({
    order_id: order.id,
    actor: 'customer',
    event: 'payment.submitted',
    detail: { method }
  });

  return json({ payment: paymentView(row) }, 201, origin);
});
