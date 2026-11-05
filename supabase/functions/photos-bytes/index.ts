/* One photograph's bytes, handed to the panel.

   The panel saves a whole order into a folder the administrator
   picks, which means the page itself has to hold each picture for a
   moment before writing it. It cannot read them from the bucket
   directly: that would mean letting a browser GET from R2, and the
   download path has always avoided exactly that - it navigates to a
   signed URL instead, so the bucket goes on allowing PUT and nothing
   else. Widening the bucket to save a click is the wrong trade, so
   the bytes come through here.

   The claim is the one photos-download checks, because it is the
   same claim: an administrator by token and by allowlist, an order
   that exists, photographs that have not been deleted, and a
   manifest read with the order id already in the query - so a photo
   id from another order is not refused so much as absent.         */

import { serviceClient, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { presignGet, r2Configured } from '../_shared/r2.ts';

const GOOD_FOR_SECONDS = 120;

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
  const photoId = text(body.photo_id, 40);
  if (!orderId || !photoId) return fail('Which order, and which photograph', 400, origin);

  const { data: order } = await db
    .from('orders')
    .select('id, photos_deleted_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('No such order', 404, origin);
  if (order.photos_deleted_at) return fail('Those photographs have been deleted', 409, origin);

  /* Scoped by the order from the start, so another order's row is
     not here to be asked for. */
  const { data: photo } = await db
    .from('order_photos')
    .select('id, r2_key, original_filename, content_type')
    .eq('order_id', orderId)
    .eq('id', photoId)
    .eq('upload_status', 'uploaded')
    .is('deleted_at', null)
    .maybeSingle();

  if (!photo) return fail('No such photograph on this order', 404, origin);

  /* The same last look the download and the deletion both take. */
  if (!String(photo.r2_key).startsWith(`orders/${orderId}/`)) {
    return fail('That photograph does not look like this order’s.', 500, origin);
  }

  const name = String(photo.original_filename || `${photo.id}.jpg`);
  const url = await presignGet(String(photo.r2_key), name, GOOD_FOR_SECONDS);
  const upstream = await fetch(url);

  if (!upstream.ok || !upstream.body) {
    return fail(`That photograph could not be read (${upstream.status})`, 502, origin);
  }

  /* Streamed through rather than buffered: a 25MB photograph should
     not have to sit in this function's memory on its way past. */
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': String(photo.content_type || 'application/octet-stream'),
      'Cache-Control': 'no-store, private'
    }
  });
});
