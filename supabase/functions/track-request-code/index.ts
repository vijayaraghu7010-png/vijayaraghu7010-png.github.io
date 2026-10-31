/* Asking to be let in to one order.

   A customer types the code on their receipt and the address they
   gave. If the two agree, a six-digit code goes to that address.

   The reply is the same either way. It does not say whether the order
   code exists, whether the address matched, or whether anything was
   sent, because an order code is a number in sequence and a reply
   that distinguishes these is a way to read the shop's order book one
   guess at a time.

   So: rate limit first, work second, and one answer always.        */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import {
  attemptKey, callerIdentity, hashToken, noteVerdict, rateLimit, sixDigitCode, NO_STORE
} from '../_shared/customer.ts';
import { emailConfigured, sendEmail, trackingCodeMessage } from '../_shared/email.ts';

const CODE_GOOD_FOR_MINUTES = 10;

/* Per caller, per order code. Six in a quarter of an hour is more
   than a person needs and far less than a search. */
const MAX_PER_WINDOW = 6;
const WINDOW_SECONDS = 900;

/* One code per order per minute, however many people ask. */
const RESEND_COOLDOWN_SECONDS = 60;

/* Per order, whoever asks and from wherever. Twelve an hour is far
   more than a person needs and bounds how often one inbox can be
   written to, regardless of what any header claims. */
const MAX_PER_ORDER_WINDOW = 12;
const ORDER_WINDOW_SECONDS = 3600;

/* The same sentence whatever happened. */
const ALWAYS = {
  ok: true,
  message: 'If that order and address match, a code is on its way. It is good for ten minutes.'
};

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
  if (!orderCode || !email) return fail('An order code and an email address, please', 400, origin);

  const db = serviceClient();

  /* Two limits, because one of them can be lied to.

     The first is per caller, and the caller is only as real as the
     header it came from - spoofable until an operator names a header
     to trust. It catches ordinary hammering and nothing cleverer.

     The second is per order code, and that cannot be forged: whoever
     is asking, they are asking about this order, and the count sits
     against the order. It is what actually stops one address being
     used as a doorbell from a thousand invented IPs. */
  const who = callerIdentity(req);
  const byCaller = await rateLimit(
    db, await attemptKey(['caller', who.value, orderCode]),
    MAX_PER_WINDOW, WINDOW_SECONDS, who.trusted
  );
  const byOrder = await rateLimit(
    db, await attemptKey(['order', orderCode]),
    MAX_PER_ORDER_WINDOW, ORDER_WINDOW_SECONDS, true
  );

  noteVerdict('track-request-code', 'caller', byCaller);
  noteVerdict('track-request-code', 'order', byOrder);

  if (!byCaller.ok || !byOrder.ok) {
    return json(
      { error: 'Too many attempts. Please wait a little and try again.' },
      429,
      origin
    );
  }

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, customer_email')
    .eq('order_code', orderCode)
    .maybeSingle();

  /* Everything from here is conditional, and none of it changes the
     reply. */
  if (order && String(order.customer_email).toLowerCase() === email) {
    /* A cooldown, so that pressing the button again does not mint a
       second code or send a second message. The rate limit above
       counts a caller's attempts; this counts the order's, which is
       what stops somebody else's inbox being used as a doorbell. */
    const { data: recent } = await db
      .from('order_lookup_codes')
      .select('created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const last = (recent ?? [])[0];
    const tooSoon =
      last && Date.now() - new Date(String(last.created_at)).getTime() < RESEND_COOLDOWN_SECONDS * 1000;

    if (!tooSoon) {
    const code = sixDigitCode();
    const emailHash = await hashToken(email);

    const { error } = await db.from('order_lookup_codes').insert({
      order_id: order.id,
      email_hash: emailHash,
      code_hash: await hashToken(code),
      expires_at: new Date(Date.now() + CODE_GOOD_FOR_MINUTES * 60_000).toISOString()
    });

    if (!error) {
      /* The key makes a repeated request one message rather than two,
         when there is ever a provider to honour it. The result is
         deliberately not reported to the caller: whether an address
         accepted a message is itself something about the address. */
      await sendEmail(
        trackingCodeMessage(email, String(order.order_code), code, `${order.id}:${emailHash}`)
      );
    }
    }
  }

  /* Whether this shop can send email at all.

     It is tempting to leave this out and always say "a code is on its
     way", but that would be a lie whenever no provider is configured,
     and the customer would sit waiting for a message nobody can send.

     Saying so reveals nothing about the order: it is a fact about the
     installation, identical for every caller and every order code,
     and it is read before any order is looked up. */
  return new Response(
    JSON.stringify({ ...ALWAYS, delivery: emailConfigured() ? 'sent' : 'unavailable' }),
    {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
    }
  );
});
