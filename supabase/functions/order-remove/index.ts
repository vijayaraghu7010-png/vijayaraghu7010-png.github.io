/* Taking an order off the books entirely.

   This destroys more than anything else here. The row goes, and with
   it - by cascade - the lines, the history, the photograph manifest,
   the payments, the tracking tokens and the lookup codes. The
   customer's tracking link stops working. There is no undo and no
   copy kept.

   So it will not run unless all of these hold:

     - the caller is an administrator, by token and by allowlist
     - the order is completed
     - its photographs are already gone
     - nothing is left in the bucket that only this row could find
     - the administrator has typed the order's own code

   The third and fourth matter more than they look. Every object in
   R2 is reachable only through the keys recorded against this order;
   delete the row first and those files are unreachable for ever,
   paid for monthly, and belonging to a customer who was told their
   photographs would be removed. So the bucket is emptied first and
   checked, and the row is deleted only if nothing is left behind.

   What survives is one line in admin_audit, written before the
   delete, naming what was removed and who removed it. It holds no
   address and no photograph - an order code, a date and a total. A
   shop should be able to say that a sale existed even once the
   details of it have been cleared away.                            */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { deleteObject, headObject, r2Configured } from '../_shared/r2.ts';

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
  const typed = text(body.confirm_code, 40);
  if (!orderId || !typed) return fail('Which order, and type its code to confirm', 400, origin);

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, status, photos_deleted_at, total_paise, shipping_paise, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('No such order', 404, origin);

  if (order.status !== 'completed') {
    return fail('Only a completed order can be removed', 409, origin);
  }
  if (typed.toUpperCase() !== String(order.order_code).toUpperCase()) {
    return fail('That is not this order’s code', 400, origin);
  }

  /* The photographs must already have been dealt with. Removing the
     order is the step that makes them unreachable, so it may not be
     the step that strands them. */
  if (!order.photos_deleted_at) {
    return fail(
      'Complete this order first — its photographs have to be cleared before it can be removed',
      409,
      origin
    );
  }

  const { data: livePhotos } = await db
    .from('order_photos')
    .select('id')
    .eq('order_id', orderId)
    .is('deleted_at', null);

  if ((livePhotos ?? []).length > 0) {
    return fail(
      'Some photographs from this order are still in storage. Clear them before removing it.',
      409,
      origin
    );
  }

  /* The payment screenshots. These are not in order_photos and were
     never covered by photos-delete, so without this they would be the
     one thing left in the bucket with nothing left to find them by. */
  const { data: payments } = await db
    .from('order_payments')
    .select('id, proof_r2_key')
    .eq('order_id', orderId);

  const proofs = (payments ?? []).filter((p) => p.proof_r2_key);
  let proofsRemoved = 0;

  if (proofs.length) {
    if (!r2Configured()) {
      return fail('Photo storage is not reachable, so nothing was removed', 503, origin);
    }

    const stuck: string[] = [];
    for (const proof of proofs) {
      const key = String(proof.proof_r2_key);
      /* The same rule photos-delete follows: a key that does not look
         like ours is a bug, and a bug is not a reason to delete
         something. */
      if (!key.startsWith('payments/')) {
        return fail('A payment file does not look like this shop’s. Nothing was removed.', 500, origin);
      }
      try {
        await deleteObject(key);
        if (await headObject(key)) stuck.push(key);
        else proofsRemoved++;
      } catch {
        stuck.push(key);
      }
    }

    /* A refusal, not a partial success: nothing has been removed, and
       the order is deliberately kept so those files are still
       findable. 409 rather than 207 for that reason - 207 would say
       some of this worked, and none of it did. */
    if (stuck.length) {
      return fail(
        `${stuck.length} payment file(s) would not delete, so the order has been left alone.`,
        409,
        origin
      );
    }
  }

  /* Written before the delete, because order_events goes with the
     row and this is the only thing that will remember. */
  await db.from('admin_audit').insert({
    actor: admin.email,
    action: 'order.removed',
    entity: 'order',
    entity_id: orderId,
    payload: {
      order_code: order.order_code,
      placed_at: order.created_at,
      total_paise: order.total_paise,
      shipping_paise: order.shipping_paise ?? 0,
      payment_proofs_removed: proofsRemoved
    }
  });

  const { error } = await db.from('orders').delete().eq('id', orderId);
  if (error) return fail('That order could not be removed', 500, origin);

  console.log(`[order-remove] ${order.order_code} removed by ${admin.email}`);

  return json(
    { removed: true, order_code: order.order_code, payment_proofs_removed: proofsRemoved },
    200,
    origin
  );
});
