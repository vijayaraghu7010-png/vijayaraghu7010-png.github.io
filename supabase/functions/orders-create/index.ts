/* Making an order.

   This is where a basket becomes a record. It runs before any money is
   asked for and before a single photograph is uploaded, because the
   photographs need an order to belong to and the uploads need
   somewhere to be counted against.

   What comes back is the order's id, the code the customer quotes, the
   total the server worked out, and a token that lets this one browser
   go on uploading to this one order. The total is the server's: if it
   differs from what the page showed, the page shows the new one and
   says so rather than taking the customer's money for the old one. */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { serviceClient, json, fail, corsHeaders, text, newToken, hashToken, getLimits, photoLimitFor } from '../_shared/common.ts';
import { priceOrder } from '../_shared/pricing.ts';
import { notifyOrderPlaced } from '../_shared/notify.ts';
import { unverifiedJwtRole } from '../_shared/customer.ts';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9+][0-9 +-]{7,19}$/;
const PIN = /^[1-9][0-9]{5}$/;

/* How long a customer may follow the order they just placed. */
const TRACKING_GOOD_FOR_DAYS = 30;

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

  const customer = (body.customer ?? {}) as Record<string, unknown>;

  const name = text(customer.name, 120);
  const email = text(customer.email, 160).toLowerCase();
  const phone = text(customer.phone, 20);
  const line1 = text(customer.address_line1, 200);
  const line2 = text(customer.address_line2, 200);
  const city = text(customer.city, 80);
  const state = text(customer.state, 80);
  const pincode = text(customer.pincode, 6);
  const notes = text(body.notes, 2000);

  /* Everything the customer must give, checked here as well as in the
     form, because a form is only a courtesy to the person filling it. */
  const missing: string[] = [];
  if (!name) missing.push('name');
  if (!EMAIL.test(email)) missing.push('email');
  if (!PHONE.test(phone)) missing.push('phone');
  if (!line1) missing.push('address');
  if (!city) missing.push('city');
  if (!state) missing.push('state');
  if (!PIN.test(pincode)) missing.push('pincode');
  if (missing.length) {
    return json({ error: 'Some details are missing or look wrong', fields: missing }, 400, origin);
  }

  const db = serviceClient();

  const priced = await priceOrder(db, (body.items ?? []) as never[]);
  if ('error' in priced) return fail(priced.error, 400, origin);

  /* Whose order this is, if anybody's.

     A signed-in customer's own token arrives in the usual header; a
     guest's request carries the publishable key instead, and that
     resolves to no user. Either is fine - an order without an account
     is still an order - so this never refuses, it only records.

     The id comes from Supabase, never from the body. Nothing a
     browser could type decides who owns an order. */
  const ownership = await ownerFrom(req, db);
  if ('stale' in ownership) {
    return fail('Your session has ended. Please sign in again, or order as a guest.', 401, origin);
  }
  const owner = ownership.id;

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      user_id: owner,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      address_line1: line1,
      address_line2: line2 || null,
      city,
      state,
      pincode,
      subtotal_paise: priced.subtotal,
      discount_paise: priced.discount,
      total_paise: priced.total,
      notes: notes || null
    })
    .select('id, order_code, total_paise')
    .single();

  if (orderError || !order) return fail('That order could not be saved', 500, origin);

  const { data: items, error: itemError } = await db
    .from('order_items')
    /* order_items holds what was bought, not why it was cheap: the
       discount is the order's and lives on the order. These two are
       worked out per line so the total can be, and are dropped here
       rather than widening a table for a figure already recorded. */
    .insert(
      priced.priced.map(({ discount_paise: _d, offer_id: _o, ...line }) => ({
        ...line,
        order_id: order.id
      }))
    )
    .select('id, product_id, product_name, customiser, position');

  if (itemError) {
    /* A half-written order is worse than none: the basket can be sent
       again, but an order with no lines would sit in the panel looking
       like something to make. */
    await db.from('orders').delete().eq('id', order.id);
    return fail('That order could not be saved', 500, origin);
  }

  const token = newToken();
  await db.from('upload_sessions').insert({
    order_id: order.id,
    token_hash: await hashToken(token),
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  });

  /* A way back to this order, for the browser that just placed it.

     It is the same thing an email would carry, and it goes to the
     same person - the one who is standing at the end of the checkout
     having typed the address themselves. Thirty days, because that is
     how long somebody might reasonably wonder where their order is.

     Only its hash is kept, as with every other token here. A guest
     with no account and no email provider configured can still follow
     their order, which is the whole point of giving it out now rather
     than waiting for a provider to be chosen. */
  const trackingToken = newToken();
  const { error: trackingError } = await db.from('order_tracking_tokens').insert({
    order_id: order.id,
    token_hash: await hashToken(trackingToken),
    expires_at: new Date(Date.now() + TRACKING_GOOD_FOR_DAYS * 24 * 60 * 60 * 1000).toISOString()
  });

  /* If the hash did not store, the link would never work. Handing one
     over anyway would be worse than handing none: the customer would
     keep a link, try it later, and be told it is not valid - which
     reads like their order has gone.

     The order itself stands. It was paid for in attention if nothing
     else, the photographs are already against it, and it can still be
     found with its code and an email address. So this does not fail
     the checkout; it just withholds a link it cannot honour, and says
     so in the log. */
  if (trackingError) {
    console.warn('[orders-create] tracking token not stored; no link will be offered');
  }

  await db.from('order_events').insert({
    order_id: order.id,
    actor: 'customer',
    event: 'order.created',
    detail: {
      lines: priced.priced.length,
      subtotal_paise: priced.subtotal,
      discount_paise: priced.discount,
      total_paise: priced.total,
      /* Which offers actually came off, so the studio can answer "why
         was this one cheaper" without guessing at what was live. */
      offers: [...new Set(priced.priced.map((l) => l.offer_id).filter(Boolean))]
    }
  });

  /* The post goes last, after everything that matters is written
     down. It is awaited so the function is not torn down mid-send,
     and it swallows its own failures - a shop that cannot send mail
     is still a shop that took the order. */
  await notifyOrderPlaced({
    id: order.id,
    order_code: order.order_code,
    customer_name: name,
    customer_email: email,
    subtotal_paise: priced.subtotal,
    discount_paise: priced.discount,
    total_paise: priced.total,
    lines: priced.priced.map((l) => ({
      product_name: l.product_name,
      quantity: l.quantity
    }))
  });

  const limits = await getLimits(db);

  return json(
    {
      order_id: order.id,
      order_code: order.order_code,
      total_paise: order.total_paise,
      upload_token: token,
      tracking_token: trackingError ? null : trackingToken,
      items: (items ?? []).map((i) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        customiser: i.customiser,
        position: i.position,
        max_photos: photoLimitFor(limits, i.customiser)
      })),
      limits: {
        max_bytes_per_photo: limits.max_bytes_per_photo,
        allowed_types: limits.allowed_types
      }
    },
    201,
    origin
  );
});

/* The signed-in customer behind this request, or null.

   Everything about it is forgiving except what it believes. A missing
   header, the publishable key, an expired token, an address nobody
   confirmed - all of them are simply "no account", and the order is
   made anyway. What it will not do is take anybody's word for an id. */
async function ownerFrom(
  req: Request,
  db: SupabaseClient
): Promise<{ id: string | null } | { stale: true }> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { id: null };

  const token = auth.slice(7);

  try {
    const { data, error } = await db.auth.getUser(token);
    if (!error && data?.user?.id) {
      if (!data.user.email_confirmed_at && !data.user.confirmed_at) return { id: null };
      return { id: data.user.id };
    }

    /* The token did not resolve to anybody. Two very different things
       look like this.

       A guest's request carries the publishable key, whose role is
       'anon'. There is no account, there was never meant to be one,
       and the order is made as a guest - which is the ordinary case.

       A customer whose session has expired carries a token whose role
       is 'authenticated'. Treating that as a guest would quietly make
       an order they cannot later find in their own history, while the
       page they are looking at still shows them signed in. So it is
       refused instead, and they are told to sign in again.

       The role is read without checking the signature, which is
       harmless: it decides which refusal to give, never whether
       anybody is trusted. */
    if (unverifiedJwtRole(token) === 'authenticated') return { stale: true };
    return { id: null };
  } catch {
    return { id: null };
  }
}
