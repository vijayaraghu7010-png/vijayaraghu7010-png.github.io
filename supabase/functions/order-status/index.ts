/* Moving an order along.

   An order goes pending → paid → in_progress → completed, and may be
   cancelled before it is completed. Nothing goes backwards from
   completed: that is the state the deletion of a customer's
   photographs depends on, and letting it be set and unset would make
   the one safeguard that matters negotiable.

   Marking an order completed does not touch its photographs. Deleting
   them is a separate, deliberate act with its own function.        */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { notifyStatusChange } from '../_shared/notify.ts';

/* 'paid' may go straight to 'completed'. Most orders here are made
   and sent in one sitting, and the studio closes them from the
   payment screen rather than walking an order through a stage it
   never really sat in. 'in_progress' is still there for the ones
   that do. */
const ALLOWED: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const db = serviceClient();
  const admin = await requireAdmin(req, db);
  if (!admin) return fail('Not an administrator', 403, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  const orderId = text(body.order_id, 40);
  const next = text(body.status, 20);
  if (!orderId || !next) return fail('Which order, and to what?', 400, origin);

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, status, customer_email')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('No such order', 404, origin);

  if (order.status === next) {
    return json({ order_id: order.id, status: next, changed: false }, 200, origin);
  }

  if (!ALLOWED[order.status]?.includes(next)) {
    return fail(`An order cannot go from ${order.status} to ${next}`, 409, origin);
  }

  const patch: Record<string, unknown> = { status: next };
  if (next === 'completed') patch.completed_at = new Date().toISOString();

  const { error } = await db.from('orders').update(patch).eq('id', orderId).eq('status', order.status);
  if (error) return fail('That order could not be updated', 500, origin);

  await db.from('order_events').insert({
    order_id: orderId,
    actor: admin.email,
    event: `order.${next}`,
    detail: { from: order.status }
  });

  /* After the move is written down, never before: a customer told
     their order is being made, when the update then failed, is worse
     than a customer told nothing. */
  await notifyStatusChange({
    id: orderId,
    order_code: order.order_code,
    customer_email: order.customer_email,
    status: next
  });

  return json({ order_id: orderId, status: next, changed: true }, 200, origin);
});
