/* The studio's side of a manual payment.

   Four things happen here and all of them need an administrator:
   listing what is waiting, looking at one submission's screenshot,
   deciding it, and setting the UPI details the shop shows.

   The deciding is the part that matters. It is the only place in this
   system where an order becomes paid, and it is deliberately a person
   pressing a button after opening their banking app - not a rule, not
   a webhook, not an inference from a screenshot. Everything the
   customer sent is a claim; this is where somebody takes
   responsibility for having checked it.

   A decision is recorded twice: on the submission itself, with the
   name of whoever made it, and in the payment's own append-only
   history. Rejections are kept exactly as verifications are.      */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { presignGet, r2Configured } from '../_shared/r2.ts';
import { upiConfig, UPI_METHODS } from '../_shared/payments.ts';

/* A UPI address: a handle, an at sign, a provider. Deliberately not
   clever - the only thing that proves a UPI ID is right is somebody
   sending a rupee to it - but enough to catch a typed email address
   or a half-pasted string. */
const UPI_ID = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z][a-zA-Z0-9.\-_]{1,32}$/;

const PROOF_GOOD_FOR = 300;

const DECISIONS: Record<string, { status: string; event: string }> = {
  verify: { status: 'verified', event: 'payment.verified' },
  reject: { status: 'rejected', event: 'payment.rejected' },
  correction: { status: 'correction_requested', event: 'payment.correction_requested' }
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const db = serviceClient();
  const admin = await requireAdmin(req, db);
  if (!admin) return fail('Not an administrator', 403, origin);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* no body is a plain listing */
  }

  const action = text(body.action, 20) || 'list';

  switch (action) {
    case 'list':
      return await list(db, body, origin);
    case 'proof':
      return await proof(db, body, admin.email, origin);
    case 'decide':
      return await decide(db, body, admin.email, origin);
    case 'config':
      return json({ upi: await upiConfig(db) }, 200, origin);
    case 'save_config':
      return await saveConfig(db, body, admin.email, origin);
    default:
      return fail('That is not something this does', 400, origin);
  }
});

// --------------------------------------------------------- the queue

async function list(db: ReturnType<typeof serviceClient>, body: Record<string, unknown>, origin: string | null) {
  const status = text(body.status, 30);
  const orderId = text(body.order_id, 40);
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);

  let query = db
    .from('order_payments')
    .select(
      'id, order_id, method, utr, amount_paise, status, customer_note, ' +
        'decided_by, decided_at, decision_note, created_at, proof_content_type, proof_byte_size',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (orderId) query = query.eq('order_id', orderId);

  const { data: payments, count, error } = await query;
  if (error) return fail('Those payments could not be read', 500, origin);

  /* Which order each one is for. The panel shows a code and a name,
     not a uuid, and a payment with no order to point at is not worth
     showing at all. */
  const ids = [...new Set((payments ?? []).map((p) => p.order_id))];
  const orders = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const { data } = await db
      .from('orders')
      .select('id, order_code, status, payment_status, customer_name, customer_email, total_paise')
      .in('id', ids);
    for (const o of data ?? []) orders.set(String(o.id), o);
  }

  return json(
    {
      payments: (payments ?? []).map((p) => ({ ...p, order: orders.get(String(p.order_id)) ?? null })),
      total: count ?? 0
    },
    200,
    origin
  );
}

// ------------------------------------------------------ the screenshot

/* A URL for one payment screenshot, good for five minutes.

   Scoped by the payment row, so nothing outside order_payments can be
   asked for, and checked against the payments/ prefix on the way out
   for the same reason photos-download checks its own: a key that does
   not look like one this system made is a bug, and a bug is not a
   reason to sign a URL. */
async function proof(
  db: ReturnType<typeof serviceClient>,
  body: Record<string, unknown>,
  who: string,
  origin: string | null
) {
  if (!r2Configured()) return fail('Payment proof storage is not configured yet', 503, origin);

  const paymentId = text(body.payment_id, 40);
  if (!paymentId) return fail('Which payment?', 400, origin);

  const { data: payment } = await db
    .from('order_payments')
    .select('id, order_id, proof_r2_key, proof_content_type, utr')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) return fail('No such payment', 404, origin);

  if (!String(payment.proof_r2_key).startsWith(`payments/${payment.order_id}/`)) {
    return fail('That screenshot does not look like this payment’s. Nothing was issued.', 500, origin);
  }

  const url = await presignGet(
    String(payment.proof_r2_key),
    `payment-${payment.utr}.${String(payment.proof_content_type).split('/')[1] || 'jpg'}`,
    PROOF_GOOD_FOR
  );

  /* Not written to order_payment_events. That table's event list is
     the four things that can happen to a payment, and looking at a
     screenshot is not one of them; squeezing it in under one of the
     other names would make the history say something untrue. A
     payment screenshot is also not a customer's photograph - the
     reason photos-download records every look is that it hands over
     somebody's wedding pictures, and this hands over a picture of a
     transfer the studio is owed. So: the log, and nothing else. */
  console.log(`[payments-admin] proof for ${paymentId} issued to ${who}`);

  return json({ url, expires_in: PROOF_GOOD_FOR }, 200, origin);
}

// --------------------------------------------------------- the decision

async function decide(
  db: ReturnType<typeof serviceClient>,
  body: Record<string, unknown>,
  who: string,
  origin: string | null
) {
  const paymentId = text(body.payment_id, 40);
  const decision = DECISIONS[text(body.decision, 20)];
  const note = text(body.note, 500);

  if (!paymentId || !decision) return fail('Which payment, and what was decided?', 400, origin);

  /* A rejection should say why. The customer reads this note and has
     to know what to do instead. */
  if (decision.status !== 'verified' && !note) {
    return fail('Say why, so the customer knows what to send instead', 400, origin);
  }

  const { data: payment } = await db
    .from('order_payments')
    .select('id, order_id, status, utr, amount_paise, method')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) return fail('No such payment', 404, origin);
  if (payment.status !== 'submitted') {
    return fail(`That payment was already ${payment.status}`, 409, origin);
  }

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, status, payment_status, total_paise')
    .eq('id', payment.order_id)
    .maybeSingle();

  if (!order) return fail('That payment has no order', 404, origin);

  /* The amount is compared again here. The administrator is looking
     at a credit in a bank account; if the order's total has moved
     since the submission, the two numbers on their screen are not
     about the same thing and verifying would be a guess. */
  if (decision.status === 'verified' && Number(payment.amount_paise) !== Number(order.total_paise)) {
    return fail(
      `This order now totals ${order.total_paise} paise but the payment was for ${payment.amount_paise}. ` +
        'Ask for a correction rather than verifying.',
      409,
      origin
    );
  }

  const now = new Date().toISOString();

  /* Guarded on the status it was read with, so two administrators
     pressing at once cannot both decide it. */
  const { data: updated, error } = await db
    .from('order_payments')
    .update({
      status: decision.status,
      decided_by: who,
      decided_at: now,
      decision_note: note || null
    })
    .eq('id', paymentId)
    .eq('status', 'submitted')
    .select('id, status')
    .maybeSingle();

  if (error || !updated) return fail('That decision could not be recorded', 409, origin);

  await db.from('order_payment_events').insert({
    payment_id: paymentId,
    order_id: order.id,
    event: decision.event,
    actor: who,
    detail: { note: note || null, amount_paise: payment.amount_paise }
  });

  /* Only a verification moves the order, and only out of pending.
     Everything else leaves it exactly where it was.

     The status the order had is taken once, before anything is
     written, and every decision below is made against that copy. A
     row read a moment ago is a photograph of the past; asking it
     again after an update would be asking the new state whether it
     was the old one. */
  const was = order.status;
  let orderStatus = was;

  if (decision.status === 'verified') {
    const patch: Record<string, unknown> = {
      payment_status: 'paid',
      payment_provider: 'upi',
      payment_id: payment.utr
    };
    if (was === 'pending') patch.status = 'paid';

    const { error: orderError } = await db
      .from('orders')
      .update(patch)
      .eq('id', order.id)
      .eq('status', was);

    if (orderError) {
      return fail('The payment was recorded but the order could not be updated', 500, origin);
    }

    if (was === 'pending') orderStatus = 'paid';

    await db.from('order_events').insert({
      order_id: order.id,
      actor: who,
      event: 'order.paid',
      detail: { method: payment.method, amount_paise: payment.amount_paise }
    });
  } else {
    /* The customer's timeline gets the same event name the payment's
       own history got, so the two never tell different stories. The
       note travels with it: it is the studio's words to this
       customer, and it is the whole reason they are being told. */
    await db.from('order_events').insert({
      order_id: order.id,
      actor: who,
      event: decision.event,
      detail: { reason: note || null }
    });
  }

  return json(
    { payment_id: paymentId, status: decision.status, order_status: orderStatus },
    200,
    origin
  );
}

// ------------------------------------------------------- where to pay

async function saveConfig(
  db: ReturnType<typeof serviceClient>,
  body: Record<string, unknown>,
  who: string,
  origin: string | null
) {
  const incoming = (body.upi ?? {}) as Record<string, unknown>;

  const upiId = text(incoming.upi_id, 80);
  const displayName = text(incoming.display_name, 80);
  const qrAsset = text(incoming.qr_asset, 200);
  const enabled = incoming.enabled === true;

  const apps = Array.isArray(incoming.apps)
    ? (incoming.apps as unknown[]).map((a) => text(a, 20).toLowerCase()).filter((a) => UPI_METHODS.includes(a))
    : [];

  if (upiId && !UPI_ID.test(upiId)) {
    return fail('That does not look like a UPI ID. They look like name@bank.', 400, origin);
  }

  /* Turning payment on with nothing to pay into would put a blank
     where a customer expects an address. */
  if (enabled && (!upiId || !displayName)) {
    return fail('A UPI ID and the name it shows are both needed before payment can be turned on', 400, origin);
  }

  /* A local asset path, not a URL. The QR image is a file in the
     shop's own public folder; anything else would let the panel point
     a payment page at somebody else's server. */
  if (qrAsset && !/^\/images\/[A-Za-z0-9._\-\/]+$/.test(qrAsset)) {
    return fail('The QR image must be a file in /images/', 400, origin);
  }

  const value = {
    enabled,
    upi_id: upiId,
    display_name: displayName,
    qr_asset: qrAsset,
    apps: apps.length ? apps : ['gpay', 'phonepe', 'paytm']
  };

  const { error } = await db
    .from('settings')
    .upsert({ key: 'payments.upi', value }, { onConflict: 'key' });

  if (error) return fail('Those details could not be saved', 500, origin);

  console.log(`[payments-admin] upi details saved by ${who}; enabled=${enabled}`);

  return json({ upi: value }, 200, origin);
}
