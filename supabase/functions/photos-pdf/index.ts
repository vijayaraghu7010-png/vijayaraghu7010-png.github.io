/* One order's photographs, as a single PDF.

   This replaces the zip. A zip is a container the studio has to
   unpack before it can see anything; a PDF opens, scrolls and
   prints, which is what these pictures are for.

   Nothing is re-encoded. Each JPEG goes in exactly as the customer
   uploaded it, so a print taken from this file is a print taken from
   the original, and the pages are each the size of their own picture
   so nothing is cropped or rotated.

   The claim it checks is the one photos-download checks, because it
   is the same claim: an administrator by token and by allowlist, an
   order that exists, photographs that have not been deleted, and a
   manifest read with the order id already in the query so another
   order's rows are not there to ask about.                        */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';
import { presignGet, r2Configured } from '../_shared/r2.ts';
import { buildPdf, type PdfPhoto } from '../_shared/pdf.ts';

/* The whole file is assembled in memory before it is sent, so this is
   bounded by what the function may hold rather than by the format.
   An order past it is told to use the one-at-a-time downloads. */
const MOST_PHOTOS = 150;
const MOST_BYTES = 180 * 1024 * 1024;

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
      `This order has ${manifest.length} photographs, which is more than one file will take. ` +
        'Download them individually.',
      413,
      origin
    );
  }

  const total = manifest.reduce((sum, p) => sum + (Number(p.byte_size) || 0), 0);
  if (total > MOST_BYTES) {
    return fail(
      `These photographs come to ${Math.round(total / 1048576)}MB, which is too much for one ` +
        'file. Download them individually.',
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
     still an administrator having asked for somebody's photographs. */
  await db.from('order_events').insert({
    order_id: orderId,
    actor: admin.email,
    event: 'photos.downloaded',
    detail: { count: manifest.length, bytes: total, as: 'pdf' }
  });

  /* Fetched one at a time rather than all at once: a hundred parallel
     reads of a bucket is how a function runs out of sockets, and the
     pages have to be in order anyway. A picture that will not come
     back gets a page saying so instead of failing the whole file -
     the studio can still print the rest of the order. */
  const pages: PdfPhoto[] = [];
  for (const photo of manifest) {
    const name = String(photo.original_filename || `${photo.id}.jpg`);
    try {
      const url = await presignGet(String(photo.r2_key), name, GOOD_FOR_SECONDS);
      const res = await fetch(url);
      if (!res.ok) {
        pages.push({ name, bytes: null, problem: `storage answered ${res.status}` });
        continue;
      }
      pages.push({ name, bytes: new Uint8Array(await res.arrayBuffer()) });
    } catch (e) {
      pages.push({ name, bytes: null, problem: (e as Error).message.slice(0, 80) });
    }
  }

  const filename = `${order.order_code}-photos.pdf`;
  const pdf = buildPdf(`${order.order_code} photographs`, pages);

  return new Response(pdf, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Pdf-Filename': filename,
      'Access-Control-Expose-Headers': 'X-Pdf-Filename',
      'Cache-Control': 'no-store, private'
    }
  });
});
