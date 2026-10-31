/* What the payment page needs to draw itself.

   Two things come back: where to pay, and what this order owes. The
   first is public by design - a UPI ID is printed on a shop counter
   and the QR code is a picture of it - and the second is behind the
   same tracking token that the order's own page uses.

   The amount is the server's, read from the order on every request.
   A page that was left open while the studio corrected a price will
   ask again before it shows anybody a QR code.

   Nothing here writes. The studio's own details are set in the panel,
   which goes through payments-admin.                               */

import { serviceClient, json, fail, corsHeaders } from '../_shared/common.ts';
import { requireCustomer, NO_STORE } from '../_shared/customer.ts';
import { orderFromClaim, paymentView, upiConfig } from '../_shared/payments.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* No body is a plain "where would I pay, if I were paying". */
  }

  const db = serviceClient();
  const upi = await upiConfig(db);

  /* The address is only worth giving out when payment is actually on.
     While it is off the page says so, and has nothing to show that
     could be mistaken for an instruction to send money. */
  const where = upi.enabled
    ? {
        enabled: true,
        upi_id: upi.upi_id,
        display_name: upi.display_name,
        qr_asset: upi.qr_asset,
        apps: upi.apps
      }
    : { enabled: false, apps: upi.apps };

  if (!body || (!body.token && !body.order_id)) {
    return new Response(JSON.stringify({ upi: where }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
    });
  }

  const customer = await requireCustomer(req, db);
  const claim = await orderFromClaim(db, body, customer?.id ?? null);
  if ('error' in claim) return json({ error: claim.error, upi: where }, claim.status, origin);

  const order = claim.order;

  /* The most recent attempt, whatever became of it. A rejected one
     still matters: it is how the customer learns why, and what to do
     instead. */
  const { data: payments } = await db
    .from('order_payments')
    .select('status, method, utr, amount_paise, created_at, decided_at, decision_note')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1);

  return new Response(
    JSON.stringify({
      upi: where,
      order: {
        order_code: order.order_code,
        status: order.status,
        payment_status: order.payment_status,
        amount_paise: order.total_paise
      },
      payment: paymentView(payments?.[0] ?? null)
    }),
    {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
    }
  );
});
