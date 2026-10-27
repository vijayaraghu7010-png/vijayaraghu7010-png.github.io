/* Removing a customer's photographs, once and for good.

   This is the only thing in the shop that destroys anything, so it is
   the most careful thing in the shop. It will not run unless all four
   of these hold:

     - the caller is an administrator, by token and by allowlist
     - the order is completed
     - its photographs have not already been deleted
     - the administrator has typed the order's own code

   It deletes exactly the keys recorded in order_photos for this one
   order. It does not list the bucket and it does not delete by prefix:
   an object the manifest does not know about is not ours to remove,
   and a prefix is one bad string away from somebody else's order. The
   studio's own catalogue images are in a different place entirely and
   are never reachable from here.

   What stays: the order, the customer, the lines, the prices, the
   history. A sale that happened goes on having happened.           */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { deleteObject, headObject, r2Configured } from '../_shared/r2.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);
  if (!r2Configured()) return fail('Photo storage is not configured yet', 503, origin);

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
    .select('id, order_code, status, photos_deleted_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('No such order', 404, origin);

  if (order.status !== 'completed') {
    return fail('Only a completed order can have its photographs deleted', 409, origin);
  }
  if (order.photos_deleted_at) {
    return fail('Those photographs have already been deleted', 409, origin);
  }
  if (typed.toUpperCase() !== String(order.order_code).toUpperCase()) {
    return fail('That is not this order’s code', 400, origin);
  }

  const { data: photos } = await db
    .from('order_photos')
    .select('id, r2_key')
    .eq('order_id', orderId)
    .is('deleted_at', null);

  const manifest = photos ?? [];

  /* A last check that every key really belongs to this order. The keys
     were made by this system and should all start with the order's own
     folder; one that does not is a bug, and a bug is not a reason to
     delete something. */
  const prefix = `orders/${orderId}/`;
  const stray = manifest.filter((p) => !String(p.r2_key).startsWith(prefix));
  if (stray.length) {
    return fail('Those photographs do not look like this order’s. Nothing was deleted.', 500, origin);
  }

  const deleted: string[] = [];
  const stuck: string[] = [];

  const batch = 10;
  for (let i = 0; i < manifest.length; i += batch) {
    const slice = manifest.slice(i, i + batch);
    await Promise.all(
      slice.map(async (photo) => {
        try {
          await deleteObject(photo.r2_key);
          /* Asked, and then checked. "Gone" is a claim worth
             verifying when it is the thing being promised. */
          const still = await headObject(photo.r2_key);
          if (still) stuck.push(photo.id);
          else deleted.push(photo.id);
        } catch {
          stuck.push(photo.id);
        }
      })
    );
  }

  const now = new Date().toISOString();
  if (deleted.length) {
    await db.from('order_photos').update({ deleted_at: now }).in('id', deleted);
  }

  /* The order is only marked clear when nothing is left behind. If one
     object would not go, the panel keeps showing the order as holding
     photographs, which is the truth. */
  const complete = stuck.length === 0;
  if (complete) {
    await db.from('orders').update({ photos_deleted_at: now, photo_bytes_total: 0 }).eq('id', orderId);
  }

  await db.from('order_events').insert({
    order_id: orderId,
    actor: admin.email,
    event: complete ? 'photos.deleted' : 'photos.delete_partial',
    detail: { deleted: deleted.length, remaining: stuck.length }
  });

  return json(
    { order_id: orderId, deleted: deleted.length, remaining: stuck.length, complete },
    complete ? 200 : 207,
    origin
  );
});
