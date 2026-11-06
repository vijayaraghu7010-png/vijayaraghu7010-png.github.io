import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPanel } from './harness/build.mjs';

/* What the customer chose, as the studio reads it off the order.

   This is the instruction the order is made from, so nothing may be
   dropped. It was being shown as the shape it is stored in instead of
   as words: the raw key, and JSON.stringify for anything that was not
   a string, so a polaroid order read

     border: Classic White   photoCount: 1   photoNames: ["1000169043.png"]

   and the list carried `admin__checks`, which is a flex ROW meant for
   inline checkboxes - so on a phone the labels ran across the top
   like a table header with the values beneath them.

   These check the words, and that the row class is gone. */

const mod = await import(await buildPanel());
const OrdersPanel = mod.default;

const ORDER_ID = 'synthetic-order-0010';

function renderDetail(items) {
  globalThis.__hooks = { overrides: { 0: [], 3: false, 5: ORDER_ID }, setters: [], index: 0 };
  const panel = OrdersPanel({});
  const detailEl = find(panel, (n) => typeof n.type === 'function' && n.type.name === 'OrderDetail');
  assert.ok(detailEl, 'OrderDetail should render');

  const data = {
    order: {
      id: ORDER_ID, order_code: 'WS-2026-0028', status: 'cancelled',
      created_at: '2026-11-03T09:59:19Z', payment_status: 'unpaid',
      customer_name: 'VijayaRaghu', customer_email: 'buyer@example.com',
      customer_phone: '9000000000', address_line1: 'mullakuruchi',
      city: 'Pudukkottai', state: 'Tamil Nadu', pincode: '622001',
      photo_bytes_total: 0, photos_deleted_at: null, notes: null,
      total_paise: 12000
    },
    items, events: [], photos: []
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
function findAll(tree, pred) { const out = []; walk(tree, (n) => { if (pred(n)) out.push(n); }); return out; }

/* The harness's React does not run function components - it hands
   back the element. Config is one, and it is the thing under test, so
   it is called here and its output walked like anything else. */
function render(node) {
  if (node == null || node === false || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(render);
  if (typeof node.type === 'function') return render(node.type(node.props || {}));
  return node;
}

function textOf(node) {
  let out = '';
  const dig = (n) => {
    const r = render(n);
    if (r == null || r === false) return;
    if (typeof r === 'string' || typeof r === 'number') { out += String(r) + ' '; return; }
    if (Array.isArray(r)) { r.forEach(dig); return; }
    if (typeof r === 'object' && r.props) dig(r.props.children);
  };
  dig(node.props && node.props.children);
  return out.replace(/\s+/g, ' ').trim();
}

/* Every className in the tree, with function components rendered. */
function allClasses(node) {
  const out = [];
  const dig = (n) => {
    const r = render(n);
    if (r == null || typeof r !== 'object') return;
    if (Array.isArray(r)) { r.forEach(dig); return; }
    if (typeof r.props?.className === 'string') out.push(r.props.className);
    if (r.props) dig(r.props.children);
  };
  dig(node);
  return out;
}

/* The polaroid order from the panel, exactly as it was stored. */
const POLAROID = [{
  id: 'line-1', product_name: 'Polaroid Prints (Large)', quantity: 20,
  line_total_paise: 12000,
  config: { border: 'Classic White', photoCount: 1, photoNames: ['1000169043.png'] }
}];

const classesIn = (tree) => allClasses(tree);

test('a stored key is shown as words', () => {
  const text = textOf(renderDetail(POLAROID));
  assert.ok(text.includes('Photographs'), 'photoCount should read as Photographs');
  assert.ok(text.includes('Files'), 'photoNames should read as Files');
  assert.ok(!text.includes('photoCount'), 'the raw key should not be shown');
  assert.ok(!text.includes('photoNames'), 'the raw key should not be shown');
});

test('a list of filenames is a list, not JSON', () => {
  const text = textOf(renderDetail(POLAROID));
  assert.ok(text.includes('1000169043.png'), 'the filename is still there');
  assert.ok(!text.includes('["'), 'no JSON brackets');
  assert.ok(!text.includes('"]'), 'no JSON brackets');
});

test('nothing the customer chose is dropped', () => {
  /* The whole reason this is shown at all. */
  const text = textOf(renderDetail(POLAROID));
  for (const expected of ['Classic White', '1', '1000169043.png']) {
    assert.ok(text.includes(expected), `${expected} should still be on the order`);
  }
});

test('the config no longer borrows the inline-checkbox row', () => {
  const classes = classesIn(renderDetail(POLAROID));
  const tokens = classes.flatMap((c) => c.split(/\s+/));
  assert.ok(tokens.includes('admin__config'), 'it should have its own class');
  assert.ok(
    !classes.some((c) => c.split(/\s+/).includes('admin__checks') && !c.includes('admin__photo-list')),
    'admin__checks is a flex row and is what broke the layout on a phone'
  );
});

test('a key nobody has named still reads as words', () => {
  const text = textOf(renderDetail([{
    id: 'l', product_name: 'Something', quantity: 1, line_total_paise: 100,
    config: { someNewFieldAddedLater: 'yes', snake_case_field: 'also' }
  }]));
  assert.ok(text.includes('Some New Field Added Later'), text);
  assert.ok(text.includes('Snake case field'), text);
});

test('true and false are yes and no', () => {
  const text = textOf(renderDetail([{
    id: 'l', product_name: 'Something', quantity: 1, line_total_paise: 100,
    config: { giftWrap: true, messageCard: false }
  }]));
  assert.ok(text.includes('Yes'), text);
  assert.ok(text.includes('No'), text);
});

test('a hamper shows what is in it, not a count', () => {
  const text = textOf(renderDetail([{
    id: 'l', product_name: 'Build your own hamper', quantity: 1, line_total_paise: 90000,
    config: {
      design: {
        boxId: 'box-10-8-4',
        gifts: [
          { productId: 'crochet-panda', quantity: 2 },
          { productId: 'kitkat', quantity: 1 }
        ]
      }
    }
  }]));
  assert.ok(text.includes('crochet-panda'), 'the gifts are what gets packed');
  assert.ok(text.includes('kitkat'), text);
  assert.ok(!text.includes('2 items'), 'a count is not a packing list');
});

test('an empty config shows nothing at all', () => {
  for (const config of [null, undefined, {}, { a: '', b: null, c: [] }]) {
    const classes = classesIn(renderDetail([{
      id: 'l', product_name: 'Plain', quantity: 1, line_total_paise: 100, config
    }]));
    assert.ok(!classes.includes('admin__config'), `${JSON.stringify(config)} should render no list`);
  }
});
