/* Taking an older order into an account.

   Every order placed before accounts existed has no owner, and the
   only thing tying it to a person is an email address typed at
   checkout - which nobody verified. So an address is not a claim.
   Registering with somebody else's address must not inherit their
   orders, and this is the function that makes sure it does not.

   What is required is the same proof a guest gives: the order code,
   and a code read out of the address on the order. On top of that the
   claimant must be signed in, and their own verified address must be
   the one the order carries.

   The claim itself is one statement with `is null` in its where
   clause. Two people racing cannot both win it: the second finds
   nothing to update.                                               */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import { hashToken, requireCustomer, timingSafeEqual, NO_STORE } from '../_shared/customer.ts';

const MAX_ATTEMPTS = 5;
const NO = 'That code is not right, or it has expired. Please ask for a new one.';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const db = serviceClient();
  const customer = await requireCustomer(req, db);
  if (!customer) return fail('Please sign in again', 401, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  const orderCode = text(body.order_code, 40).toUpperCase();
  const code = text(body.code, 10);
  if (!orderCode || !code) return fail('An order code and the code we sent, please', 400, origin);

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, customer_email, user_id')
    .eq('order_code', orderCode)
    .maybeSingle();

  if (!order) return json({ error: NO }, 403, origin);

  /* The address on the order must be the customer's own verified one.
     requireCustomer has already refused an unconfirmed address, so
     this is a comparison between two things Supabase stands behind. */
  if (String(order.customer_email).toLowerCase() !== customer.email) {
    return json({ error: NO }, 403, origin);
  }

  if (order.user_id) {
    /* Already spoken for. If it is already theirs, say so plainly -
       that is not a leak, they can see it in their own history. */
    if (order.user_id === customer.id) {
      return json({ ok: true, order_code: order.order_code, already: true }, 200, origin);
    }
    return json({ error: NO }, 403, origin);
  }

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

  const emailMatches = timingSafeEqual(String(pending.email_hash), await hashToken(customer.email));
  const codeMatches = timingSafeEqual(String(pending.code_hash), await hashToken(code));

  if (!emailMatches || !codeMatches) {
    await db
      .from('order_lookup_codes')
      .update({ attempts: Number(pending.attempts) + 1 })
      .eq('id', pending.id);
    return json({ error: NO }, 403, origin);
  }

  const { data: consumed } = await db
    .from('order_lookup_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', pending.id)
    .is('consumed_at', null)
    .select('id');

  if (!consumed || consumed.length === 0) return json({ error: NO }, 403, origin);

  /* The claim. `is('user_id', null)` is what makes two of these safe
     to run at once: whichever lands second updates no rows. */
  const { data: claimed } = await db
    .from('orders')
    .update({ user_id: customer.id })
    .eq('id', order.id)
    .is('user_id', null)
    .select('id, order_code');

  if (!claimed || claimed.length === 0) {
    return json({ error: 'That order has already been added to an account.' }, 409, origin);
  }

  return new Response(
    JSON.stringify({ ok: true, order_code: claimed[0].order_code, already: false }),
    {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
    }
  );
});
