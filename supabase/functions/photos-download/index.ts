/* Giving the studio its own customer's photographs back.

   Everything else in the shop puts photographs in or takes them away.
   This is the one thing that reads them, and it is the only reason an
   original is worth keeping: an order cannot be printed from a row in
   a database.

   It will not run unless all of these hold:

     - the caller is an administrator, by token and by allowlist
     - the order exists
     - its photographs have not been deleted
     - every photograph asked for belongs to this order

   That last one is not a check so much as a consequence. The manifest
   is read with the order id already in the query, so a photo id from
   somebody else's order is not refused - it is simply not there to
   ask about. A check can be forgotten in a later edit; a query that
   cannot see the other rows cannot be.

   What crosses the wire is a URL good for five minutes, for one
   object, for reading only. The key it was made from does not: the
   browser never learns where in the bucket anything lives, which is
   the same rule the orders panel already follows.                 */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { presignGet, r2Configured } from '../_shared/r2.ts';

/* One order's worth at a time. The panel asks for one photograph per
   click, so this ceiling is only here to stop a malformed request
   from signing three hundred URLs nobody wanted. */
const MOST_AT_ONCE = 200;
const GOOD_FOR_SECONDS = 300;

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
  if (!orderId) return fail('Which order', 400, origin);

  const wanted = Array.isArray(body.photo_ids)
    ? (body.photo_ids as unknown[]).map((id) => text(id, 40)).filter(Boolean)
    : null;

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, photos_deleted_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('No such order', 404, origin);
  if (order.photos_deleted_at) {
    return fail('Those photographs have been deleted', 409, origin);
  }

  /* Scoped by the order from the start. Nothing belonging to another
     order is in this result to be asked for. */
  const { data: photos } = await db
    .from('order_photos')
    .select('id, r2_key, original_filename, content_type, byte_size')
    .eq('order_id', orderId)
    .eq('upload_status', 'uploaded')
    .is('deleted_at', null)
    .order('position');

  let manifest = photos ?? [];
  if (wanted) {
    const asked = new Set(wanted);
    manifest = manifest.filter((p) => asked.has(String(p.id)));
  }

  if (manifest.length === 0) {
    return fail('There is nothing here to download', 404, origin);
  }
  if (manifest.length > MOST_AT_ONCE) {
    return fail(`Ask for ${MOST_AT_ONCE} at a time at most`, 400, origin);
  }

  /* The same last look that the deletion takes. Every key this system
     made starts with its own order's folder; one that does not is a
     bug, and a bug is not a reason to hand out a URL. */
  const prefix = `orders/${orderId}/`;
  if (manifest.some((p) => !String(p.r2_key).startsWith(prefix))) {
    return fail('Those photographs do not look like this order’s. Nothing was issued.', 500, origin);
  }

  const expiresAt = new Date(Date.now() + GOOD_FOR_SECONDS * 1000).toISOString();

  const downloads = await Promise.all(
    manifest.map(async (photo) => ({
      photo_id: photo.id,
      filename: photo.original_filename,
      content_type: photo.content_type,
      byte_size: photo.byte_size,
      url: await presignGet(photo.r2_key, photo.original_filename, GOOD_FOR_SECONDS),
      expires_at: expiresAt
    }))
  );

  /* Who looked, and when. Reading somebody's photographs is worth a
     line in the history even though it changes nothing: if the
     question is ever asked, the answer should be in the order. The
     URLs themselves are not recorded - they are the one part of this
     that must not be written down.

     If the record cannot be written, nothing is handed over. An
     unrecorded download is worse than a download that did not happen:
     the first leaves a customer's photographs read with no trace of
     who read them, and the second is an administrator clicking again.
     The URLs minted above are simply dropped - they were never shown
     to anybody, and they expire on their own.

     What the caller is told is that it could not be recorded. Why the
     insert failed stays here: the panel has no use for a database
     error, and anybody else has no business reading one.          */
  const { error: auditError } = await db.from('order_events').insert({
    order_id: orderId,
    event: 'photos.downloaded',
    actor: admin.email,
    detail: { count: downloads.length }
  });

  if (auditError) {
    return fail('That download could not be recorded, so it was not issued', 500, origin);
  }

  return json({ downloads, expires_in: GOOD_FOR_SECONDS }, 200, origin);
});
