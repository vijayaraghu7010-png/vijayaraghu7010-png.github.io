/* Leaving a review.

   This used to be an INSERT straight from the browser. The shop's
   publishable key is in the bundle, as it is meant to be, so the
   policy that let the shop write a review let anybody write one:
   unlimited, with any rating, against any product id, from a single
   curl command. Every check - one to five stars, a line of text, a
   name - was in React, which is to say it was advice.

   The checks now happen here, where they cannot be skipped, and the
   writing is done by the service role. The anon role has no INSERT
   on reviews any more.

   What this does not claim to be: proof that a human wrote it, or
   that they bought the thing. The caller's address is the only handle
   there is without accounts, and the shop's own notes about
   X-Forwarded-For apply - it is a cost, not a wall. Tying a review to
   a real order, or holding new ones for the studio to approve, are
   the two controls that would actually settle it, and both are
   decisions about how the shop should work rather than bugs.     */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import { attemptKey, callerIdentity, noteVerdict, rateLimit, NO_STORE } from '../_shared/customer.ts';

/* Enough for somebody writing up a few things they bought, far less
   than a flood. Counted per caller and, separately, per product, so
   one product cannot be buried however many addresses are used. */
const MAX_PER_CALLER = 5;
const CALLER_WINDOW_SECONDS = 3600;

const MAX_PER_PRODUCT = 20;
const PRODUCT_WINDOW_SECONDS = 3600;

/* The same limits the column checks carry, so a refusal is a sentence
   rather than a Postgres error. */
const NAME_MAX = 80;
const TEXT_MAX = 2000;

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

  const productId = text(body.product_id, 120);
  const rating = Math.round(Number(body.rating));
  const name = text(body.name, NAME_MAX) || 'A customer';
  const reviewText = text(body.text, TEXT_MAX);

  if (!productId) return fail('Which product is this about?', 400, origin);
  if (!(rating >= 1 && rating <= 5)) return fail('Pick between one and five stars', 400, origin);
  if (!reviewText) return fail('Please write a line or two', 400, origin);

  const db = serviceClient();

  /* The product has to be one the shop actually sells. Without this
     a review could be filed against any string at all, and the rows
     would sit in the table for ever being counted by nothing. */
  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle();

  if (!product) return fail('That product could not be found', 404, origin);

  const who = callerIdentity(req);
  const byCaller = await rateLimit(
    db, await attemptKey(['review-caller', who.value]),
    MAX_PER_CALLER, CALLER_WINDOW_SECONDS, who.trusted
  );
  const byProduct = await rateLimit(
    db, await attemptKey(['review-product', productId]),
    MAX_PER_PRODUCT, PRODUCT_WINDOW_SECONDS, true
  );

  noteVerdict('reviews-create', 'caller', byCaller);
  noteVerdict('reviews-create', 'product', byProduct);

  if (!byCaller.ok || !byProduct.ok) {
    return json(
      { error: 'That is a lot of reviews just now. Please try again a little later.' },
      429,
      origin
    );
  }

  const { data: row, error } = await db
    .from('reviews')
    .insert({ product_id: productId, rating, name, text: reviewText })
    .select('id, product_id, rating, name, text, created_at')
    .maybeSingle();

  if (error || !row) return fail('That review could not be saved', 500, origin);

  return new Response(JSON.stringify({ review: row }), {
    status: 201,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
  });
});
