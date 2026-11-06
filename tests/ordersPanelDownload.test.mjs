import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPanel } from './harness/build.mjs';

/* An isolated harness around the REAL admin Orders panel.

   OrdersPanel.jsx, orderClient.js and supabaseClient.js are bundled
   unmodified. Only React's hooks, the icon set, the supabase-js client
   and fetch are stubbed - everything the feature itself does is the
   real code. The component function is called directly and the tree it
   returns is walked to find the Download control, so the handler under
   test is the one that ships.

   Nothing here touches the network, Supabase, or R2. */

const mod = await import(await buildPanel());
const OrdersPanel = mod.default;

const ORDER_ID = 'synthetic-order-0008';

/* ---------------------------------------------------------- plumbing */

function renderDetail({ photos, order = {}, overrides = {} } = {}) {
  // OrdersPanel's own state: rows, status, search, loading, error, openId
  globalThis.__hooks = { overrides: { 0: [], 3: false, 5: ORDER_ID }, setters: [], index: 0 };
  const panel = OrdersPanel({});
  const detailEl = find(panel, (n) => typeof n.type === 'function' && n.type.name === 'OrderDetail');
  assert.ok(detailEl, 'OrdersPanel should render OrderDetail when an order is open');

  // OrderDetail's own state, in source order:
  // 0 data, 1 error, 2 busy, 3 confirming, 4 typed, 5 note, 6 fetching,
  // 7 finishing, 8 finishTyped, 9 saving, 10 showFiles, 11 thumbs
  //
  // The per-photograph list sits behind "View files" now, so it is
  // opened here: these tests are about what the Download button does,
  // not about whether the list is expanded.
  const data = {
    order: {
      id: ORDER_ID, order_code: 'WS-FIXTURE-0008', status: 'pending',
      created_at: '2026-10-28T09:51:44Z', payment_status: 'unpaid',
      customer_name: 'PHASE2 V3 TEST', customer_email: 'phase2-v3-synthetic@example.com',
      customer_phone: '9000000000', address_line1: '1 Synthetic Street',
      city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
      photo_bytes_total: 53444, photos_deleted_at: null, notes: null, ...order
    },
    items: [], events: [], photos
  };
  globalThis.__hooks = { overrides: { 0: data, 10: true, ...overrides }, setters: [], index: 0 };
  const tree = detailEl.type(detailEl.props);
  return { tree, setters: globalThis.__hooks.setters };
}

function walk(node, visit) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  if (node.__node) {
    visit(node);
    walk(node.props && node.props.children, visit);
    return;
  }
  if (node.props) walk(node.props.children, visit);
}
function find(tree, pred) { let hit = null; walk(tree, (n) => { if (!hit && pred(n)) hit = n; }); return hit; }
function findAll(tree, pred) { const out = []; walk(tree, (n) => { if (pred(n)) out.push(n); }); return out; }

const isDownloadButton = (n) =>
  n.type === 'button' && typeof n.props['aria-label'] === 'string' &&
  n.props['aria-label'].startsWith('Download ');

const uploaded = (n) => ({
  id: `p${n}`, original_filename: `SYNTHETIC-${n}.jpg`, byte_size: 1000 + n,
  upload_status: 'uploaded', deleted_at: null, position: n
});

/* setError is state index 1, setNote 5, setFetching 6 */
const errorsFrom = (setters) => setters.filter((s) => s.index === 1 && s.value !== '').map((s) => s.value);
const notesFrom  = (setters) => setters.filter((s) => s.index === 5 && s.value !== '').map((s) => s.value);

let opened = [];
function mockFetch(responder) {
  globalThis.fetch = async (url, init) => responder(url, init);
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test.beforeEach(() => {
  opened = [];
  globalThis.__session = { access_token: 'TEST-SESSION-TOKEN' };
  globalThis.window = {
    open: (url, target, features) => { opened.push({ url, target, features }); return { closed: false }; },
    location: { assign: () => { throw new Error('download() must not navigate this tab'); } }
  };
});

async function clickDownload({ photos = [uploaded(1)], responder, open } = {}) {
  if (responder) mockFetch(responder);
  if (open) globalThis.window.open = open;
  const { tree, setters } = renderDetail({ photos });
  const btn = find(tree, isDownloadButton);
  assert.ok(btn, 'a Download button should be rendered');
  await btn.props.onClick();
  return { setters, errors: errorsFrom(setters), notes: notesFrom(setters), tree };
}

/* ------------------------------------------------------------ A8 */

test('A8 - only eligible uploaded, non-deleted photographs offer a download', () => {
  const photos = [
    uploaded(1),
    { id: 'p2', original_filename: 'reserved.jpg', byte_size: 10, upload_status: 'reserved', deleted_at: null },
    { id: 'p3', original_filename: 'failed.jpg', byte_size: 10, upload_status: 'failed', deleted_at: null },
    { id: 'p4', original_filename: 'deleted.jpg', byte_size: 10, upload_status: 'uploaded', deleted_at: '2026-10-28T00:00:00Z' }
  ];
  const { tree } = renderDetail({ photos });
  const buttons = findAll(tree, isDownloadButton).map((b) => b.props['aria-label']);
  assert.deepEqual(buttons, ['Download SYNTHETIC-1.jpg'],
    'reserved, failed and deleted photographs must offer no download');
});

test('A8b - an order whose photographs are deleted offers no downloads at all', () => {
  const { tree } = renderDetail({
    photos: [uploaded(1)],
    order: { photos_deleted_at: '2026-10-28T00:00:00Z' }
  });
  assert.equal(findAll(tree, isDownloadButton).length, 0);
});

/* ------------------------------------------------------------ A7 */

test('A7 - a successful response opens the signed URL safely and claims nothing', async () => {
  const signed = 'https://bucket.example.test/orders/x/y/z.jpg?X-Amz-Signature=FAKESIG';
  const { errors, notes } = await clickDownload({
    responder: async () => jsonResponse(200, {
      downloads: [{ photo_id: 'p1', filename: 'SYNTHETIC-1.jpg', url: signed, expires_at: '2026-10-28T10:00:00Z' }],
      expires_in: 300
    })
  });
  assert.equal(opened.length, 1, 'exactly one window should be opened');
  assert.equal(opened[0].url, signed, 'the signed URL must be the one issued');
  assert.equal(opened[0].target, '_blank');
  assert.ok(opened[0].features.includes('noopener'), 'noopener must be retained');
  assert.ok(opened[0].features.includes('noreferrer'), 'noreferrer must be retained');
  assert.deepEqual(errors, [], 'no error on success');
  assert.deepEqual(notes, [], 'the UI must not claim the photograph arrived');
});

test('A7b - the panel stays on the same order (no navigation)', async () => {
  // window.location.assign throws if called; reaching the end proves it was not.
  await clickDownload({
    responder: async () => jsonResponse(200, { downloads: [{ photo_id: 'p1', filename: 'f.jpg', url: 'https://x.test/a?X-Amz-Signature=S' }], expires_in: 300 })
  });
  assert.equal(opened.length, 1);
});

/* ------------------------------------------------------------ A6 */

test('A6 - a blocked pop-up is reported, naming the file and the remedy', async () => {
  const { errors, notes } = await clickDownload({
    responder: async () => jsonResponse(200, { downloads: [{ photo_id: 'p1', filename: 'SYNTHETIC-1.jpg', url: 'https://x.test/a?X-Amz-Signature=S' }], expires_in: 300 }),
    open: () => null
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /blocked the download window/i);
  assert.match(errors[0], /SYNTHETIC-1\.jpg/);
  assert.match(errors[0], /pop-ups/i);
  assert.deepEqual(notes, [], 'a blocked window is not a success');
});

test('A6b - window.open returning false is also treated as blocked', async () => {
  const { errors } = await clickDownload({
    responder: async () => jsonResponse(200, { downloads: [{ photo_id: 'p1', filename: 'SYNTHETIC-1.jpg', url: 'https://x.test/a?X-Amz-Signature=S' }], expires_in: 300 }),
    open: () => false
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /blocked/i);
});

/* ------------------------------------------------------------ A1 */

test('A1 - an expired session is reported and nothing is opened', async () => {
  globalThis.__session = null;                       // supabase has no session
  const { errors, notes } = await clickDownload({ responder: async () => jsonResponse(200, {}) });
  assert.equal(opened.length, 0, 'no window may open without a session');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /session has ended|sign in again/i);
  assert.deepEqual(notes, []);
});

test('A1b - HTTP 401 is reported safely', async () => {
  const { errors } = await clickDownload({
    responder: async () => jsonResponse(401, { code: 'UNAUTHORIZED_INVALID_JWT_FORMAT', message: 'Invalid JWT' })
  });
  assert.equal(opened.length, 0);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].length > 0);
});

/* ------------------------------------------------------------ A2 */

test('A2 - HTTP 403 shows the server message and opens nothing', async () => {
  const { errors, notes } = await clickDownload({
    responder: async () => jsonResponse(403, { error: 'Not an administrator' })
  });
  assert.equal(opened.length, 0);
  assert.deepEqual(errors, ['Not an administrator']);
  assert.deepEqual(notes, []);
});

/* ------------------------------------------------------------ A3 */

test('A3 - HTTP 500 is shown without internal detail', async () => {
  const { errors } = await clickDownload({
    responder: async () => jsonResponse(500, { error: 'That download could not be recorded, so it was not issued' })
  });
  assert.equal(opened.length, 0);
  assert.deepEqual(errors, ['That download could not be recorded, so it was not issued']);
});

/* ------------------------------------------------------------ A4 */

test('A4 - a rejected fetch does not claim success', async () => {
  const { errors, notes } = await clickDownload({
    responder: async () => { throw new TypeError('Failed to fetch'); }
  });
  assert.equal(opened.length, 0);
  assert.equal(errors.length, 1);
  assert.deepEqual(notes, []);
});

test('A4b - an unreadable body still yields an error, not a crash', async () => {
  const { errors } = await clickDownload({
    responder: async () => new Response('<html>gateway timeout</html>', { status: 504 })
  });
  assert.equal(opened.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /504|failed/i);
});

test('A4c - a 200 with no downloads array is an error, not a silent no-op', async () => {
  const { errors, notes } = await clickDownload({ responder: async () => jsonResponse(200, { downloads: [] }) });
  assert.equal(opened.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /could not be fetched/i);
  assert.deepEqual(notes, []);
});

/* ------------------------------------------------------------ A5 */

test('A5 - an expired URL reported by the server is surfaced accurately', async () => {
  const { errors, notes } = await clickDownload({
    responder: async () => jsonResponse(409, { error: 'Those photographs have been deleted' })
  });
  assert.equal(opened.length, 0);
  assert.deepEqual(errors, ['Those photographs have been deleted']);
  assert.deepEqual(notes, [], 'nothing claims the photograph was downloaded');
});

/* ------------------------------------------------------------ A9 */

test('A9 - sensitive values in an error payload never reach the admin', async () => {
  const nasty = {
    error: 'That download could not be recorded, so it was not issued',
    r2_key: 'orders/example/photo.jpg',
    signed_url: 'https://bucket.example.test/orders/example/photo.jpg?X-Amz-Signature=FAKESIG&X-Amz-Credential=FAKEKEY',
    detail: 'duplicate key value violates unique constraint "order_events_pkey"',
    hint: 'retry the transaction',
    credentials: { access_key_id: 'FAKEACCESSKEYID', secret: 'FAKESECRET' }
  };
  const { errors } = await clickDownload({ responder: async () => jsonResponse(500, nasty) });
  assert.equal(opened.length, 0);
  assert.equal(errors.length, 1);
  const shown = errors[0];
  for (const leak of ['orders/example/photo.jpg', 'X-Amz-Signature', 'FAKESIG', 'X-Amz-Credential',
                      'FAKEACCESSKEYID', 'FAKESECRET', 'order_events_pkey', 'duplicate key',
                      'retry the transaction', 'r2_key']) {
    assert.ok(!shown.includes(leak), `the admin must not be shown: ${leak}`);
  }
  assert.equal(shown, nasty.error, 'only the server’s own safe sentence is shown');
});

test('A9b - a malicious filename in a success payload is not executed as markup', async () => {
  const signed = 'https://x.test/a?X-Amz-Signature=S';
  await clickDownload({
    photos: [{ ...uploaded(1), original_filename: '<img src=x onerror=alert(1)>.jpg' }],
    responder: async () => jsonResponse(200, { downloads: [{ photo_id: 'p1', filename: 'f.jpg', url: signed }], expires_in: 300 })
  });
  assert.equal(opened.length, 1, 'the filename is data, rendered as text by React');
});

/* --------------------------------------------------- busy state */

test('A10 - the button reports fetching and clears it on every path', async () => {
  const { setters } = await clickDownload({
    responder: async () => { throw new TypeError('Failed to fetch'); }
  });
  const fetching = setters.filter((s) => s.index === 6).map((s) => s.value);
  assert.deepEqual(fetching, ['p1', null], 'set while in flight, cleared in finally');
});
