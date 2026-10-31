/* What the panel shows.

   Reading orders is the one thing an administrator could do straight
   from the browser - the select policies allow it - but it is done
   here instead, so that every privileged operation in the shop goes
   through the same door and is refused in the same way. Nothing is
   returned until the caller's own token has been exchanged for an
   email and that email has been found in the admins table.        */

import { serviceClient, json, fail, corsHeaders, text, requireAdmin } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const db = serviceClient();
  const admin = await requireAdmin(req, db);
  if (!admin) return fail('Not an administrator', 403, origin);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* no body is a plain listing */
  }

  const orderId = text(body.order_id, 40);

  // ------------------------------------------------------- one order

  if (orderId) {
    const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return fail('No such order', 404, origin);

    const [{ data: items }, { data: photos }, { data: events }] = await Promise.all([
      db.from('order_items').select('*').eq('order_id', orderId).order('position'),
      db
        .from('order_photos')
        .select('id, order_item_id, original_filename, content_type, byte_size, upload_status, position, deleted_at')
        .eq('order_id', orderId)
        .order('position'),
      db.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
    ]);

    /* The keys are deliberately not here. The panel has no use for
       them, and a key is the one piece of this that points at a
       customer's photograph. */
    return json({ order, items: items ?? [], photos: photos ?? [], events: events ?? [] }, 200, origin);
  }

  // --------------------------------------------------------- listing

  const status = text(body.status, 20);

  /* The search goes into a PostgREST .or() filter as a string, which
     is the one place in this function where what the browser typed
     becomes part of a query expression rather than a bound value. A
     comma or a bracket in it would be read as filter syntax - a second
     condition, a new group - not as text to match. None of the three
     columns searched (an order code, a name, an email) ever contains
     one, so they are turned into spaces before the value is used. That
     closes the injection without narrowing any real search.

     This is defence in depth: the endpoint is already behind
     requireAdmin, and PostgREST parameterises the SQL underneath, so
     nothing here could reach another table or break out into SQL. It
     is tidied because an admin should not be able to turn their own
     search box into a 500, and because an unescaped value in a filter
     string should not exist to be reasoned about later. */
  const search = text(body.search, 80).replace(/[,()]/g, ' ').trim();

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const offset = Math.max(Number(body.offset) || 0, 0);

  let query = db
    .from('orders')
    .select(
      'id, order_code, status, payment_status, customer_name, customer_email, customer_phone, ' +
        'city, state, total_paise, photo_bytes_total, photos_deleted_at, created_at, completed_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(
      `order_code.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return fail('Those orders could not be read', 500, origin);

  /* How many photographs each order holds, for the list's own column. */
  const ids = (data ?? []).map((o) => o.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: photos } = await db
      .from('order_photos')
      .select('order_id')
      .in('order_id', ids)
      .is('deleted_at', null);
    for (const p of photos ?? []) counts.set(p.order_id, (counts.get(p.order_id) ?? 0) + 1);
  }

  return json(
    {
      orders: (data ?? []).map((o) => ({ ...o, photo_count: counts.get(o.id) ?? 0 })),
      total: count ?? 0,
      limit,
      offset
    },
    200,
    origin
  );
});
