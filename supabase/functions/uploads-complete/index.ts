/* Checking that the photographs actually arrived.

   A browser saying "done" is not evidence. This asks the bucket
   itself, key by key, and believes only what is there: an object that
   exists and whose size is the size that was reserved. Anything else
   is marked failed, and the browser is told which ones to send again.

   It is safe to call twice. A photograph already confirmed is left
   alone, so a lost reply or a retried request cannot double-count the
   order's bytes.                                                     */

import { serviceClient, json, fail, corsHeaders, text, hashToken } from '../_shared/common.ts';
import { headObject, r2Configured } from '../_shared/r2.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);
  if (!r2Configured()) return fail('Photo storage is not configured yet', 503, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  const orderId = text(body.order_id, 40);
  const token = text(body.token, 80);
  if (!orderId || !token) return fail('That upload has no order', 400, origin);

  const db = serviceClient();

  const { data: session } = await db
    .from('upload_sessions')
    .select('id, expires_at')
    .eq('order_id', orderId)
    .eq('token_hash', await hashToken(token))
    .maybeSingle();

  if (!session) return fail('That upload is not yours', 403, origin);
  if (new Date(session.expires_at) < new Date()) return fail('That upload has expired', 403, origin);

  const { data: pending } = await db
    .from('order_photos')
    .select('id, r2_key, byte_size')
    .eq('order_id', orderId)
    .eq('upload_status', 'reserved');

  const confirmed: string[] = [];
  const failed: string[] = [];

  /* A few at a time: a hundred and twenty HEADs at once is a burst the
     bucket has no reason to enjoy, and the order of them is of no
     interest. */
  const batch = 10;
  for (let i = 0; i < (pending ?? []).length; i += batch) {
    const slice = (pending ?? []).slice(i, i + batch);
    await Promise.all(
      slice.map(async (photo) => {
        try {
          const head = await headObject(photo.r2_key);
          if (head && head.size === Number(photo.byte_size)) confirmed.push(photo.id);
          else failed.push(photo.id);
        } catch {
          failed.push(photo.id);
        }
      })
    );
  }

  if (confirmed.length) {
    await db
      .from('order_photos')
      .update({ upload_status: 'uploaded', uploaded_at: new Date().toISOString() })
      .in('id', confirmed);
  }
  if (failed.length) {
    await db.from('order_photos').update({ upload_status: 'failed' }).in('id', failed);
  }

  /* The order's running total, counted from the rows that are really
     there rather than added up as we went. */
  const { data: good } = await db
    .from('order_photos')
    .select('byte_size')
    .eq('order_id', orderId)
    .eq('upload_status', 'uploaded');

  const bytes = (good ?? []).reduce((sum, r) => sum + (Number(r.byte_size) || 0), 0);
  await db.from('orders').update({ photo_bytes_total: bytes }).eq('id', orderId);

  if (confirmed.length) {
    await db.from('order_events').insert({
      order_id: orderId,
      actor: 'customer',
      event: 'photos.uploaded',
      detail: { confirmed: confirmed.length, failed: failed.length }
    });
  }

  return json(
    {
      uploaded: (good ?? []).length,
      confirmed: confirmed.length,
      failed: failed.length,
      retry: failed,
      bytes
    },
    200,
    origin
  );
});
