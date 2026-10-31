/* Spending the code, and getting a way in.

   What comes back is a tracking token, good for an hour, for this one
   order. The code is spent whether or not it was right: five wrong
   guesses end it, and a right one ends it immediately, so no code can
   be used twice.

   As with asking for it, the failures are one sentence. Wrong code,
   expired code, no such order, address that does not match - all the
   same, because telling them apart is telling a stranger something.  */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import {
  attemptKey, callerIdentity, hashToken, newToken, noteVerdict, rateLimit, timingSafeEqual, NO_STORE
} from '../_shared/customer.ts';

const MAX_ATTEMPTS = 5;
const TOKEN_GOOD_FOR_MINUTES = 60;
const MAX_PER_WINDOW = 10;
const WINDOW_SECONDS = 900;
const MAX_PER_ORDER_WINDOW = 15;

const NO = 'That code is not right, or it has expired. Please ask for a new one.';

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

  const orderCode = text(body.order_code, 40).toUpperCase();
  const email = text(body.email, 200).toLowerCase();
  const code = text(body.code, 10);
  if (!orderCode || !email || !code) return fail('An order code, an address and the code, please', 400, origin);

  const db = serviceClient();

  /* Per caller, which can be lied to, and per order, which cannot.
     The real guard against guessing is the attempt counter on the
     code row itself, a few lines below; these two only keep the
     noise down. */
  const who = callerIdentity(req);
  const byCaller = await rateLimit(
    db, await attemptKey(['caller', who.value, orderCode]),
    MAX_PER_WINDOW, WINDOW_SECONDS, who.trusted
  );
  const byOrder = await rateLimit(
    db, await attemptKey(['verify', orderCode]),
    MAX_PER_ORDER_WINDOW, WINDOW_SECONDS, true
  );

  noteVerdict('track-verify-code', 'caller', byCaller);
  noteVerdict('track-verify-code', 'order', byOrder);

  if (!byCaller.ok || !byOrder.ok) {
    return json({ error: 'Too many attempts. Please wait a little and try again.' }, 429, origin);
  }

  const { data: order } = await db
    .from('orders')
    .select('id, order_code')
    .eq('order_code', orderCode)
    .maybeSingle();

  if (!order) return json({ error: NO }, 403, origin);

  /* The newest code still unspent. An older one is simply not
     considered: asking again replaces the last request. */
  const { data: rows } = await db
    .from('order_lookup_codes')
    .select('id, email_hash, code_hash, expires_at, attempts, consumed_at')
    .eq('order_id', order.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const pending = (rows ?? [])[0];
  if (!pending) return json({ error: NO }, 403, origin);

  if (new Date(String(pending.expires_at)) < new Date()) return json({ error: NO }, 403, origin);
  if (Number(pending.attempts) >= MAX_ATTEMPTS) return json({ error: NO }, 403, origin);

  const emailMatches = timingSafeEqual(String(pending.email_hash), await hashToken(email));
  const codeMatches = timingSafeEqual(String(pending.code_hash), await hashToken(code));

  if (!emailMatches || !codeMatches) {
    /* A guess costs an attempt whichever half was wrong. */
    await db
      .from('order_lookup_codes')
      .update({ attempts: Number(pending.attempts) + 1 })
      .eq('id', pending.id);
    return json({ error: NO }, 403, origin);
  }

  /* Issue first, then spend.

     The other way round cost the customer their code whenever the
     token could not be written: it was already marked consumed, so
     they had to ask for another and wait out the cooldown for a
     failure that was ours.

     Doing it this way, a failed insert leaves the code untouched and
     they can simply try again. The race is still closed, because
     spending the code is the conditional step: two requests carrying
     the same code both mint a token, but only one can move
     consumed_at from null, and the loser revokes the token it made
     before it answers. Revoked rather than deleted - a token that
     briefly existed is worth a trace, and track-order refuses a
     revoked one. */
  const token = newToken();
  const { data: issued, error } = await db
    .from('order_tracking_tokens')
    .insert({
      order_id: order.id,
      token_hash: await hashToken(token),
      expires_at: new Date(Date.now() + TOKEN_GOOD_FOR_MINUTES * 60_000).toISOString()
    })
    .select('id');

  if (error || !issued || issued.length === 0) {
    return fail('That could not be completed. Please try again.', 500, origin);
  }

  const { data: consumed } = await db
    .from('order_lookup_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', pending.id)
    .is('consumed_at', null)
    .select('id');

  if (!consumed || consumed.length === 0) {
    await db
      .from('order_tracking_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', issued[0].id);
    return json({ error: NO }, 403, origin);
  }

  return new Response(
    JSON.stringify({ token, expires_in: TOKEN_GOOD_FOR_MINUTES * 60, order_code: order.order_code }),
    {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
    }
  );
});
