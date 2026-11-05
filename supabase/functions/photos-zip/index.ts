/* One order's photographs, as a single file.

   The panel could already fetch them one at a time, and for an order
   of nine prints that is nine clicks, nine save dialogs and nine
   chances to put one in the wrong folder. This hands over the lot.

   It is the same claim as photos-download and checks the same things:
   an administrator by token and by allowlist, an order that exists,
   photographs that have not been deleted, and a manifest read with
   the order id already in the query so another order's rows are not
   there to be asked for.

   The archive is built here rather than in the browser on purpose.
   Zipping in the page would mean the bucket had to allow the browser
   to GET from it, and the download path has always avoided that -
   it navigates to a signed URL instead, so the bucket goes on
   allowing PUT and nothing else. Widening that for a convenience is
   the wrong trade.

   It streams. One photograph is held at a time, so a hundred of them
   cost no more memory than the largest one.                        */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { presignGet, r2Configured } from '../_shared/r2.ts';
import { zipStream, type ZipEntry } from '../_shared/zip.ts';

/* Below what the zip format would need ZIP64 for, and below what a
   browser will hold while it saves the result. An order past either
   is told plainly to use the one-at-a-time downloads rather than
   being handed something broken. */
const MOST_PHOTOS = 200;
const MOST_BYTES = 1024 * 1024 * 1024; // 1GB

const GOOD_FOR_SECONDS = 600;

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

  const { data: order } = await db
    .from('orders')
    .select('id, order_code, photos_deleted_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('No such order', 404, origin);
  if (order.photos_deleted_at) {
    return fail('Those photographs have been deleted', 409, origin);
  }

  const { data: photos } = await db
    .from('order_photos')
    .select('id, r2_key, original_filename, byte_size')
    .eq('order_id', orderId)
    .eq('upload_status', 'uploaded')
    .is('deleted_at', null)
    .order('position');

  const manifest = photos ?? [];
  if (manifest.length === 0) return fail('There is nothing here to download', 404, origin);

  if (manifest.length > MOST_PHOTOS) {
    return fail(
      `This order has ${manifest.length} photographs, which is more than one archive will take. ` +
        'Download them individually.',
      413,
      origin
    );
  }

  const total = manifest.reduce((sum, p) => sum + (Number(p.byte_size) || 0), 0);
  if (total > MOST_BYTES) {
    return fail(
      `These photographs come to ${Math.round(total / 1048576)}MB, which is too much for one ` +
        'archive. Download them individually.',
      413,
      origin
    );
  }

  /* The same last look the download and the deletion both take. Every
     key this system made starts with its own order's folder; one that
     does not is a bug, and a bug is not a reason to read something. */
  const prefix = `orders/${orderId}/`;
  if (manifest.some((p) => !String(p.r2_key).startsWith(prefix))) {
    return fail('Those photographs do not look like this order’s. Nothing was issued.', 500, origin);
  }

  /* Written before a byte goes out. A download that failed halfway is
     still an administrator having asked for somebody's photographs,
     and that is the thing the log is for. */
  await db.from('order_events').insert({
    order_id: orderId,
    actor: admin.email,
    event: 'photos.downloaded',
    detail: { count: manifest.length, bytes: total, as: 'zip' }
  });

  const entries: ZipEntry[] = manifest.map((photo) => ({
    name: String(photo.original_filename || `${photo.id}.jpg`),
    read: async () => {
      /* Signed at the moment it is needed and used immediately. The
         URL never leaves this function. */
      const url = await presignGet(
        String(photo.r2_key),
        String(photo.original_filename || 'photo.jpg'),
        GOOD_FOR_SECONDS
      );
      const res = await fetch(url);
      if (!res.ok) throw new Error(`photo ${photo.id} could not be read (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    }
  }));

  const filename = `${order.order_code}-photos.zip`;

  return new Response(zipStream(entries), {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      /* So the panel can name the saved file without parsing the
         header, which fetch does not expose by default. */
      'X-Zip-Filename': filename,
      'Access-Control-Expose-Headers': 'X-Zip-Filename',
      'Cache-Control': 'no-store, private'
    }
  });
});
