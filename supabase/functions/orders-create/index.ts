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

import { serviceClient, json, fail, corsHeaders, text, newToken, hashToken, getLimits, photoLimitFor } from '../_shared/common.ts';
import { priceOrder } from '../_shared/pricing.ts';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9+][0-9 +-]{7,19}$/;
const PIN = /^[1-9][0-9]{5}$/;

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

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      address_line1: line1,
      address_line2: line2 || null,
      city,
      state,
      pincode,
      subtotal_paise: priced.subtotal,
      total_paise: priced.subtotal,
      notes: notes || null
    })
    .select('id, order_code, total_paise')
    .single();

  if (orderError || !order) return fail('That order could not be saved', 500, origin);

  const { data: items, error: itemError } = await db
    .from('order_items')
    .insert(priced.priced.map((line) => ({ ...line, order_id: order.id })))
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

  await db.from('order_events').insert({
    order_id: order.id,
    actor: 'customer',
    event: 'order.created',
    detail: { lines: priced.priced.length, total_paise: priced.subtotal }
  });

  const limits = await getLimits(db);

  return json(
    {
      order_id: order.id,
      order_code: order.order_code,
      total_paise: order.total_paise,
      upload_token: token,
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
