import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPanel } from './harness/build.mjs';

/* Downloading a whole order's photographs.

   One archive, from one click. A single download started by somebody
   pressing something is the one thing Chrome never argues about,
   which is why the panel does not fire a run of them instead.

   The real panel is bundled; only React's hooks, the icons and the
   Supabase client are replaced. What the handler does to the page -
   the link it makes, what it is called, and that it cleans up after
   itself - is watched directly. */

const mod = await import(await buildPanel());
const OrdersPanel = mod.default;

const ORDER_ID = 'synthetic-order-0011';

/* There is no DOM here, so the handler gets the smallest one that
   lets it do its job: make a link, click it, take it out again. */
function watchAnchors() {
  const made = [];
  globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} };
  globalThis.document = {
    body: { appendChild() {}, removeChild() {} },
    createElement(tag) {
      if (String(tag).toLowerCase() !== 'a') return { appendChild() {}, remove() {} };
      const record = { href: '', download: '', clicked: 0, removed: false };
      made.push(record);
      return {
        set href(v) { record.href = v; }, get href() { return record.href; },
        set download(v) { record.download = v; }, get download() { return record.download; },
        click() { record.clicked++; },
        remove() { record.removed = true; }
      };
    }
  };
  return { made, restore: () => { delete globalThis.document; } };
}

/* photos-zip answers with the finished file. */
function mockZip({ fail = false } = {}) {
  globalThis.__session = { access_token: 'TEST-SESSION-TOKEN' };
  globalThis.window = { setTimeout: (fn) => { fn(); return 0; } };
  globalThis.fetch = async () =>
    fail
      ? new Response(JSON.stringify({ error: 'nope' }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        })
      : new Response(new Uint8Array([0x50, 0x4b, 3, 4]), {
          status: 200,
          headers: { 'Content-Type': 'application/zip', 'X-Zip-Filename': 'WS-2026-0011-photos.zip' }
        });
}

const uploaded = (n) => ({
  id: `p${n}`, original_filename: `IMG_000${n}.jpg`, byte_size: 1000 + n,
  upload_status: 'uploaded', deleted_at: null, position: n
});

function walk(node, visit) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  if (node.__node) { visit(node); walk(node.props && node.props.children, visit); return; }
  if (node.props) walk(node.props.children, visit);
}
function find(tree, pred) { let hit = null; walk(tree, (n) => { if (!hit && pred(n)) hit = n; }); return hit; }

function textOf(node) {
  let out = '';
  const dig = (n) => {
    if (n == null || n === false) return;
    if (typeof n === 'string' || typeof n === 'number') { out += String(n) + ' '; return; }
    if (Array.isArray(n)) { n.forEach(dig); return; }
    if (typeof n === 'object' && n.props) dig(n.props.children);
  };
  dig(node.props && node.props.children);
  return out.replace(/\s+/g, ' ').trim();
}

function detail(photos, order = {}) {
  globalThis.__hooks = { overrides: { 0: [], 3: false, 5: ORDER_ID }, setters: [], index: 0 };
  const panel = OrdersPanel({});
  const el = find(panel, (n) => typeof n.type === 'function' && n.type.name === 'OrderDetail');
  assert.ok(el, 'OrderDetail should render');

  const data = {
    order: {
      id: ORDER_ID, order_code: 'WS-2026-0011', status: 'paid',
      created_at: '2026-11-05T09:00:00Z', payment_status: 'paid',
      customer_name: 'FIXTURE', customer_email: 'f@example.com', customer_phone: '9000000000',
      address_line1: '1 Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
      photo_bytes_total: 3000, photos_deleted_at: null, notes: null, total_paise: 1000,
      ...order
    },
    items: [], events: [], photos
  };
  globalThis.__hooks = { overrides: { 0: data }, setters: [], index: 0 };
  return el.type(el.props);
}

const bulkButton = (tree) =>
  find(tree, (n) => n.type === 'button' && /Download all/i.test(textOf(n)));

test('the button says how many it will save, and that it is an archive', () => {
  assert.match(textOf(bulkButton(detail([uploaded(1), uploaded(2), uploaded(3)]))),
    /Download all 3 photographs \(ZIP\)/);
});

test('one photograph is not called photographs', () => {
  assert.match(textOf(bulkButton(detail([uploaded(1)]))), /Download all 1 photograph \(ZIP\)/);
});

test('an order whose uploads never finished is not offered it', () => {
  assert.equal(bulkButton(detail([{ ...uploaded(1), upload_status: 'pending' }])), null);
});

test('deleted photographs are not offered either', () => {
  assert.equal(bulkButton(detail([uploaded(1)], { photos_deleted_at: '2026-11-05T10:00:00Z' })), null);
});

test('the archive is saved under the name the server gave it', async () => {
  mockZip();
  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1), uploaded(2)])).props.onClick();
    assert.equal(watch.made.length, 1, 'one download, not one per photograph');
    assert.equal(watch.made[0].download, 'WS-2026-0011-photos.zip');
    assert.equal(watch.made[0].clicked, 1);
    assert.ok(watch.made[0].removed, 'the link is taken back out of the page');
  } finally {
    watch.restore();
  }
});

test('a refusal downloads nothing rather than an empty file', async () => {
  mockZip({ fail: true });
  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1)])).props.onClick();
    assert.equal(watch.made.length, 0);
  } finally {
    watch.restore();
  }
});
