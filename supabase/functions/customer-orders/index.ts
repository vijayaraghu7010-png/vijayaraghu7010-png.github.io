/* A signed-in customer's own orders.

   Ownership is one clause: user_id = the id Supabase gave back for
   the token this request carried. Not an id from the body - there is
   no id in the body, and if one were put there it would not be read.

   Null user_id is every order ever placed as a guest, and no query
   here can reach one, because null never equals anything.

   The reply is customerView's, field by named field.               */

import { serviceClient, json, fail, corsHeaders, text } from '../_shared/common.ts';
import { customerView, requireCustomer, NO_STORE } from '../_shared/customer.ts';

const PAGE = 20;
const MAX_PAGE = 50;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const db = serviceClient();
  const customer = await requireCustomer(req, db);
  if (!customer) return fail('Please sign in again', 401, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const orderCode = text(body.order_code, 40).toUpperCase();

  /* One order, in full. */
  if (orderCode) {
    const { data: order } = await db
      .from('orders')
      .select('id, order_code, status, created_at, updated_at, completed_at')
      .eq('user_id', customer.id)
      .eq('order_code', orderCode)
      .maybeSingle();

    /* Somebody else's order and a code that does not exist are the
       same answer. */
    if (!order) return json({ error: 'No such order' }, 404, origin);

    const { data: items } = await db
      .from('order_items')
      .select('product_name, quantity, position')
      .eq('order_id', order.id)
      .order('position');

    const { data: events } = await db
      .from('order_events')
      .select('event, created_at')
      .eq('order_id', order.id)
      .order('created_at');

    return reply({ order: customerView(order, items ?? [], events ?? []) }, origin);
  }

  /* The list. Paginated because an order history is one of the few
     things in this shop that grows without limit. */
  const limit = Math.min(Math.max(Number(body.limit) || PAGE, 1), MAX_PAGE);
  const offset = Math.max(Number(body.offset) || 0, 0);

  const { data: orders } = await db
    .from('orders')
    .select('id, order_code, status, created_at, updated_at, completed_at')
    .eq('user_id', customer.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const rows = orders ?? [];
  const ids = rows.map((o) => o.id);

  /* One query for every line rather than one per order. */
  const { data: items } = ids.length
    ? await db
        .from('order_items')
        .select('order_id, product_name, quantity, position')
        .in('order_id', ids)
        .order('position')
    : { data: [] as Record<string, unknown>[] };

  const byOrder = new Map<string, Record<string, unknown>[]>();
  for (const line of items ?? []) {
    const k = String(line.order_id);
    byOrder.set(k, [...(byOrder.get(k) ?? []), line]);
  }

  return reply(
    {
      orders: rows.map((o) => customerView(o, byOrder.get(String(o.id)) ?? [], [])),
      limit,
      offset,
      has_more: rows.length === limit
    },
    origin
  );
});

function reply(payload: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...NO_STORE }
  });
}
