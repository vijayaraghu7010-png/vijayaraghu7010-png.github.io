import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPanel } from './harness/build.mjs';

/* The two-step close-out, rendered from the real panel.

   Payment confirmed, so the studio may Complete - which clears the
   customer's photographs. Once it has shipped, the order may be
   removed outright.

   The order of the two buttons is the whole point, and it is not
   decoration: removing the row is what makes anything left in storage
   unreachable, so "Shipped" must not be offered until the
   photographs are actually gone. These walk the rendered tree and
   check exactly that.

   OrdersPanel.jsx is bundled unmodified; only React's hooks, the icon
   set and the Supabase client are stubbed. */

const mod = await import(await buildPanel());
const OrdersPanel = mod.default;

const ORDER_ID = 'synthetic-order-0009';

function renderDetail(order = {}, photos = []) {
  globalThis.__hooks = { overrides: { 0: [], 3: false, 5: ORDER_ID }, setters: [], index: 0 };
  const panel = OrdersPanel({});
  const detailEl = find(panel, (n) => typeof n.type === 'function' && n.type.name === 'OrderDetail');
  assert.ok(detailEl, 'OrderDetail should render');

  const data = {
    order: {
      id: ORDER_ID, order_code: 'WS-FIXTURE-0009', status: 'paid',
      created_at: '2026-11-01T09:00:00Z', payment_status: 'paid',
      customer_name: 'FIXTURE', customer_email: 'fixture@example.com',
      customer_phone: '9000000000', address_line1: '1 Street',
      city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
      photo_bytes_total: 1000, photos_deleted_at: null, notes: null, ...order
    },
    items: [], events: [], photos
  };
  globalThis.__hooks = { overrides: { 0: data }, setters: [], index: 0 };
  return detailEl.type(detailEl.props);
}

function walk(node, visit) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  if (node.__node) { visit(node); walk(node.props && node.props.children, visit); return; }
  if (node.props) walk(node.props.children, visit);
}
function find(tree, pred) { let hit = null; walk(tree, (n) => { if (!hit && pred(n)) hit = n; }); return hit; }

/* The visible words of a node, icons and nesting flattened away. */
function textOf(node) {
  let out = '';
  const dig = (n) => {
    if (n == null || n === false) return;
    if (typeof n === 'string' || typeof n === 'number') { out += String(n); return; }
    if (Array.isArray(n)) { n.forEach(dig); return; }
    if (typeof n === 'object' && n.props) dig(n.props.children);
  };
  dig(node.props && node.props.children);
  return out.replace(/\s+/g, ' ').trim();
}

const buttonSaying = (tree, re) =>
  find(tree, (n) => n.type === 'button' && re.test(textOf(n)));

const COMPLETE = /^Complete$/;
const SHIPPED = /Shipped/;

const livePhoto = { id: 'p1', original_filename: 'a.jpg', byte_size: 100,
                    upload_status: 'uploaded', deleted_at: null, position: 0 };

test('once payment is confirmed, Complete is offered', () => {
  const tree = renderDetail({ status: 'paid', payment_status: 'paid' }, [livePhoto]);
  assert.ok(buttonSaying(tree, COMPLETE), 'Complete should be offered on a paid order');
});

test('an order still being made may also be completed', () => {
  const tree = renderDetail({ status: 'in_progress' }, [livePhoto]);
  assert.ok(buttonSaying(tree, COMPLETE));
});

test('an unpaid order is not offered Complete', () => {
  for (const status of ['pending', 'cancelled']) {
    const tree = renderDetail({ status }, [livePhoto]);
    assert.equal(buttonSaying(tree, COMPLETE), null, `${status} should not offer Complete`);
  }
});

test('Shipped is not offered until the order is completed', () => {
  for (const status of ['pending', 'paid', 'in_progress']) {
    const tree = renderDetail({ status }, [livePhoto]);
    assert.equal(buttonSaying(tree, SHIPPED), null, `${status} should not offer Shipped`);
  }
});

test('Shipped is not offered while the photographs are still there', () => {
  /* The guard that matters. Completed, but the pictures have not gone
     - so removing the row would strand them in the bucket for ever. */
  const tree = renderDetail({ status: 'completed', photos_deleted_at: null }, [livePhoto]);
  assert.equal(buttonSaying(tree, SHIPPED), null);
});

test('once completed and cleared, Shipped is offered and Complete is not', () => {
  const tree = renderDetail(
    { status: 'completed', photos_deleted_at: '2026-11-04T10:00:00Z' },
    [{ ...livePhoto, deleted_at: '2026-11-04T10:00:00Z' }]
  );
  assert.ok(buttonSaying(tree, SHIPPED), 'Shipped should be offered');
  assert.equal(buttonSaying(tree, COMPLETE), null, 'there is nothing left to complete');
});

test('the two never appear together', () => {
  for (const order of [
    { status: 'pending' },
    { status: 'paid' },
    { status: 'in_progress' },
    { status: 'completed', photos_deleted_at: null },
    { status: 'completed', photos_deleted_at: '2026-11-04T10:00:00Z' },
    { status: 'cancelled' }
  ]) {
    const tree = renderDetail(order, [livePhoto]);
    const both = Boolean(buttonSaying(tree, COMPLETE)) && Boolean(buttonSaying(tree, SHIPPED));
    assert.equal(both, false, `${JSON.stringify(order)} offered both at once`);
  }
});

test('completing is not something a single click does', () => {
  /* The button opens a confirmation; it does not clear anybody's
     photographs on its own. */
  const tree = renderDetail({ status: 'paid' }, [livePhoto]);
  const button = buttonSaying(tree, COMPLETE);
  assert.ok(button.props.onClick, 'it is a button');
  assert.equal(
    find(tree, (n) => n.type === 'button' && /Complete and clear photos/.test(textOf(n))),
    null,
    'the confirming step should not be on screen until the button is pressed'
  );
});
