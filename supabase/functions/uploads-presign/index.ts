/* Handing out somewhere to put a photograph.

   The browser says what it is about to upload - the name, the type,
   the size - and gets back one URL per file, each good for one key,
   one method and fifteen minutes. The files themselves go straight
   from the customer's device to the bucket: they do not pass through
   this function, which is what makes a hundred and twenty originals
   practical.

   Every limit is applied here, against the database's own count of
   what this order already holds. A browser that asks twice, or asks
   for a hundred slots in an order that has three left, gets the same
   answer either way: no.                                           */

import {
  serviceClient,
  json,
  fail,
  corsHeaders,
  text,
  hashToken,
  getLimits,
  photoLimitFor
} from '../_shared/common.ts';
import { presignPut, r2Configured } from '../_shared/r2.ts';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  if (!r2Configured()) {
    return fail('Photo storage is not configured yet', 503, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  const orderId = text(body.order_id, 40);
  const token = text(body.token, 80);
  const photos = Array.isArray(body.photos) ? (body.photos as Record<string, unknown>[]) : [];

  if (!orderId || !token) return fail('That upload has no order', 400, origin);
  if (photos.length === 0) return fail('Nothing to upload', 400, origin);
  if (photos.length > 60) return fail('Ask for fewer at a time', 400, origin);

  const db = serviceClient();

  /* The token is how this browser proves the order is its own. There
     are no customer accounts, so this is the whole of the claim: hold
     the token, and only for as long as the order is still pending. */
  const { data: session } = await db
    .from('upload_sessions')
    .select('id, order_id, expires_at')
    .eq('order_id', orderId)
    .eq('token_hash', await hashToken(token))
    .maybeSingle();

  if (!session) return fail('That upload is not yours', 403, origin);
  if (new Date(session.expires_at) < new Date()) return fail('That upload has expired', 403, origin);

  const { data: order } = await db
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('That order is gone', 404, origin);
  if (order.status !== 'pending') {
    return fail('That order is no longer taking photographs', 409, origin);
  }

  const limits = await getLimits(db);

  const { data: items } = await db
    .from('order_items')
    .select('id, customiser')
    .eq('order_id', orderId);
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));

  /* What the order already holds. Reserved rows count: a slot handed
     out a minute ago may be uploading right now, and giving the same
     room away twice is how a limit stops being one. */
  const { data: existing } = await db
    .from('order_photos')
    .select('order_item_id, byte_size')
    .eq('order_id', orderId)
    .neq('upload_status', 'failed');

  const countByItem = new Map<string, number>();
  let bytesSoFar = 0;
  let countSoFar = 0;
  for (const row of existing ?? []) {
    countSoFar += 1;
    bytesSoFar += Number(row.byte_size) || 0;
    const key = String(row.order_item_id);
    countByItem.set(key, (countByItem.get(key) ?? 0) + 1);
  }

  const rows: Record<string, unknown>[] = [];
  const planned: { key: string; content_type: string }[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const itemId = text(photo.order_item_id, 40);
    const filename = text(photo.filename, 300) || `photo-${i + 1}`;
    const contentType = text(photo.content_type, 60).toLowerCase();
    const size = Math.floor(Number(photo.byte_size));

    const item = itemById.get(itemId);
    if (!item) return fail(`Photo ${i + 1} does not belong to this order`, 400, origin);

    if (!limits.allowed_types.includes(contentType)) {
      return fail(`${filename}: that is not a photograph we can print`, 415, origin);
    }
    if (!Number.isFinite(size) || size <= 0) {
      return fail(`${filename}: that file is empty`, 400, origin);
    }
    if (size > limits.max_bytes_per_photo) {
      const mb = Math.round(limits.max_bytes_per_photo / 1048576);
      return fail(`${filename}: each photograph must be under ${mb} MB`, 413, origin);
    }

    const allowed = photoLimitFor(limits, item.customiser);
    const used = countByItem.get(itemId) ?? 0;
    if (used + 1 > allowed) {
      return fail(`That item takes ${allowed} photographs at most`, 409, origin);
    }
    countByItem.set(itemId, used + 1);

    countSoFar += 1;
    bytesSoFar += size;
    if (countSoFar > limits.max_photos_per_order) {
      return fail(`An order takes ${limits.max_photos_per_order} photographs at most`, 409, origin);
    }
    if (bytesSoFar > limits.max_bytes_per_order) {
      return fail('That is more than one order can carry', 413, origin);
    }

    /* The key is made here, from identifiers the customer never chose.
       A filename is kept as a label and is never part of a path. */
    const photoId = crypto.randomUUID();
    const key = `orders/${orderId}/${itemId}/${photoId}.${EXT[contentType]}`;

    rows.push({
      id: photoId,
      order_id: orderId,
      order_item_id: itemId,
      r2_key: key,
      original_filename: filename,
      content_type: contentType,
      byte_size: size,
      upload_status: 'reserved',
      position: used
    });
    planned.push({ key, content_type: contentType });
  }

  const { error } = await db.from('order_photos').insert(rows);
  if (error) return fail('Those photographs could not be reserved', 500, origin);

  const uploads = await Promise.all(
    rows.map(async (row, i) => ({
      photo_id: row.id,
      order_item_id: row.order_item_id,
      filename: row.original_filename,
      url: await presignPut(planned[i].key, planned[i].content_type, 900)
    }))
  );

  return json({ uploads, expires_in: 900 }, 200, origin);
});
