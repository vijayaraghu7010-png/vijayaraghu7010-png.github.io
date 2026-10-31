/* Somewhere to put the payment screenshot.

   One URL, one key, one method, fifteen minutes - the same bargain
   uploads-presign makes for photographs, and for the same reason: the
   file goes from the customer's phone to the bucket without passing
   through here.

   The key always begins with payments/. That is not a convention,
   it is the structural guarantee 0005 relies on: photos-delete only
   ever removes keys recorded in order_photos and refuses any key
   outside its own order's orders/ folder, so a payment proof cannot
   be reached by the photo deletion that runs when an order completes.

   Nothing is written to the database here. The row is created by
   payments-submit, which checks the bucket first.                  */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import { requireCustomer, attemptKey, rateLimit, noteVerdict } from '../_shared/customer.ts';
import { presignPut, r2Configured } from '../_shared/r2.ts';
import {
  orderFromClaim,
  paymentGate,
  upiConfig,
  PROOF_EXT,
  PROOF_MAX_BYTES,
  PROOF_TYPES
} from '../_shared/payments.ts';

/* A customer needs one of these per attempt, and an attempt is a
   person typing a reference number off their banking app. Ten in five
   minutes is generous for that and useless for anything else. */
const MAX_PER_WINDOW = 10;
const WINDOW_SECONDS = 300;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  if (!r2Configured()) {
    return fail('Payment proof storage is not configured yet', 503, origin);
  }

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
    await attemptKey(['payment-presign', order.id]),
    MAX_PER_WINDOW,
    WINDOW_SECONDS,
    true
  );
  noteVerdict('payments-presign', 'order', verdict);
  if (!verdict.ok) {
    return json(
      { error: 'That has been tried a few times just now. Please wait a moment.' },
      429,
      origin
    );
  }

  const contentType = text(body.content_type, 60).toLowerCase();
  const size = Math.floor(Number(body.byte_size));

  if (!PROOF_TYPES.includes(contentType)) {
    return fail('That file is not a screenshot we can read', 415, origin);
  }
  if (!Number.isFinite(size) || size <= 0) return fail('That file is empty', 400, origin);
  if (size > PROOF_MAX_BYTES) {
    return fail(`A screenshot must be under ${Math.round(PROOF_MAX_BYTES / 1048576)} MB`, 413, origin);
  }

  /* Made here, out of identifiers the customer never chose. A filename
     is not part of a path, ever. */
  const key = `payments/${order.id}/${crypto.randomUUID()}.${PROOF_EXT[contentType]}`;

  return json(
    {
      proof_key: key,
      url: await presignPut(key, contentType, 900),
      expires_in: 900,
      amount_paise: order.total_paise
    },
    200,
    origin
  );
});
