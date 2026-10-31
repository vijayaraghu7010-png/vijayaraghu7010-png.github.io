import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFunction } from './harness/build.mjs';

/* An isolated harness around the REAL photos-download/index.ts.

   The function source is copied byte-for-byte (sha256 verified) and
   bundled by esbuild against mock _shared modules. Nothing here talks
   to Supabase, R2, or any network. The point is to reach the two
   branches that live testing could not: an audit insert that fails,
   and a manifest larger than the batch ceiling. */

const ORDER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
let handler;

globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: () => 'x' } };
await import(await buildFunction());
assert.ok(handler, 'the function should have registered a handler');

const S = () => globalThis.__state;

/* The mock captured this object by reference when the bundle loaded,
   so it must be mutated, never replaced. */
function reset({ photos = [], auditError = null, order = { id: ORDER, order_code: 'WS-TEST', photos_deleted_at: null } } = {}) {
  Object.assign(globalThis.__state, {
    admin: { email: 'admin@example.com' },
    order, photos, auditError, auditCalls: [], callOrder: []
  });
}

const photo = (n) => ({
  id: `photo-${n}`,
  r2_key: `orders/${ORDER}/item/photo-${n}.jpg`,
  original_filename: `synthetic-${n}.jpg`,
  content_type: 'image/jpeg',
  byte_size: 1000 + n
});

async function call(body) {
  const res = await handler(new Request('https://fn.example.com/photos-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify(body)
  }));
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

/* ---------------------------------------------------------- Test B
   An unrecorded download is worse than one that did not happen. */

test('B1 - audit insert fails: no URLs are returned', async () => {
  reset({ photos: [photo(1), photo(2)], auditError: { message: 'connection terminated', code: '57P01' } });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 500);
  assert.equal(r.json.downloads, undefined, 'no downloads array may be returned');
  assert.ok(!r.text.includes('X-Amz-Signature'), 'no signed URL may appear in the body');
  assert.ok(!r.text.includes('bucket.example.com'), 'no bucket host may appear');
  assert.ok(!r.text.includes('r2_key'), 'no r2_key may appear');
  assert.ok(!r.text.includes('orders/'), 'no object key may appear');
});

test('B2 - the audit failure leaks no database detail', async () => {
  reset({ photos: [photo(1)], auditError: { message: 'duplicate key value violates unique constraint "order_events_pkey"', code: '23505', details: 'Key (id)=(abc) already exists.', hint: 'retry' } });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 500);
  assert.equal(r.json.error, 'That download could not be recorded, so it was not issued');
  for (const leak of ['23505', 'duplicate key', 'order_events_pkey', 'already exists', 'retry', 'constraint']) {
    assert.ok(!r.text.includes(leak), `response must not contain ${leak}`);
  }
});

test('B3 - a failed request does not report success', async () => {
  reset({ photos: [photo(1)], auditError: { message: 'nope' } });
  const r = await call({ order_id: ORDER });
  assert.ok(r.status >= 400, 'status must be an error');
  assert.ok(r.json.error, 'an error message must be present');
  assert.equal(r.json.expires_in, undefined);
});

test('B4 - success returns URLs, and only after the audit row is written', async () => {
  reset({ photos: [photo(1), photo(2)] });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 200);
  assert.equal(r.json.downloads.length, 2);
  assert.equal(r.json.expires_in, 300);

  const order = S().callOrder;
  const lastPresign = order.lastIndexOf('presign');
  const insertAt = order.indexOf('insert:order_events');
  assert.ok(insertAt > -1, 'the audit row must be written');
  assert.ok(lastPresign < insertAt, 'URLs are minted, then the audit row is written, then the response is sent');

  const row = S().auditCalls[0];
  assert.equal(row.event, 'photos.downloaded');
  assert.equal(row.actor, 'admin@example.com');
  assert.deepEqual(row.detail, { count: 2 });
  assert.equal(row.order_id, ORDER);
});

test('B5 - the audit row never records a URL', async () => {
  reset({ photos: [photo(1)] });
  await call({ order_id: ORDER });
  const serialised = JSON.stringify(S().auditCalls);
  assert.ok(!serialised.includes('X-Amz-Signature'));
  assert.ok(!serialised.includes('bucket.example.com'));
  assert.ok(!serialised.includes('r2_key'));
});

test('B6 - a refused request writes no audit row at all', async () => {
  reset({ photos: [photo(1)], order: { id: ORDER, order_code: 'WS-TEST', photos_deleted_at: '2026-10-28T00:00:00Z' } });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 409);
  assert.equal(S().auditCalls.length, 0, 'a refusal is not a download and must not be logged as one');
});

/* ---------------------------------------------------------- Test C
   The batch ceiling. */

const many = (n) => Array.from({ length: n }, (_, i) => photo(i + 1));

test('C1 - exactly 200 eligible photographs are allowed', async () => {
  reset({ photos: many(200) });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 200);
  assert.equal(r.json.downloads.length, 200);
});

test('C2 - 201 eligible photographs are refused, and nothing is issued', async () => {
  reset({ photos: many(201) });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /200 at a time at most/);
  assert.equal(r.json.downloads, undefined);
  assert.ok(!r.text.includes('X-Amz-Signature'));
});

test('C3 - the ceiling cannot be bypassed by naming 201 ids explicitly', async () => {
  reset({ photos: many(201) });
  const r = await call({ order_id: ORDER, photo_ids: many(201).map((p) => p.id) });
  assert.equal(r.status, 400);
  assert.equal(r.json.downloads, undefined);
});

test('C4 - duplicate ids collapse rather than multiplying URLs', async () => {
  reset({ photos: [photo(1), photo(2)] });
  const r = await call({ order_id: ORDER, photo_ids: ['photo-1', 'photo-1', 'photo-1', 'photo-2'] });
  assert.equal(r.status, 200);
  assert.equal(r.json.downloads.length, 2, 'one URL per photograph, not one per id');
  assert.deepEqual(r.json.downloads.map((d) => d.photo_id).sort(), ['photo-1', 'photo-2']);
});

test('C5 - an empty photo_ids array asks for nothing and gets nothing', async () => {
  reset({ photos: [photo(1), photo(2)] });
  const r = await call({ order_id: ORDER, photo_ids: [] });
  assert.equal(r.status, 404);
  assert.equal(r.json.downloads, undefined);
});

test('C6 - malformed ids are harmless', async () => {
  reset({ photos: [photo(1)] });
  for (const ids of [[null], [''], ['   '], [{}], [[]], [123456], ['x'.repeat(5000)], [undefined]]) {
    const r = await call({ order_id: ORDER, photo_ids: ids });
    assert.ok(r.status === 404 || r.status === 200, `unexpected ${r.status} for ${JSON.stringify(ids)}`);
    if (r.status === 200) assert.ok(r.json.downloads.every((d) => d.photo_id === 'photo-1'));
    assert.ok(!r.text.includes('r2_key'));
  }
});

test('C7 - a mixture issues URLs only for this order’s own photographs', async () => {
  reset({ photos: [photo(1), photo(2)] });
  const r = await call({ order_id: ORDER, photo_ids: ['photo-1', 'photo-999', 'not-a-uuid', ''] });
  assert.equal(r.status, 200);
  assert.equal(r.json.downloads.length, 1);
  assert.equal(r.json.downloads[0].photo_id, 'photo-1');
});

test('C8 - a stray key refuses the whole batch, however large', async () => {
  const rows = many(50);
  rows[25].r2_key = 'orders/some-other-order/item/stolen.jpg';
  reset({ photos: rows });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 500);
  assert.equal(r.json.downloads, undefined);
  assert.ok(!r.text.includes('stolen.jpg'), 'the offending key must not be echoed back');
});

test('C9 - no response ever carries r2_key or a bucket path', async () => {
  reset({ photos: many(3) });
  const r = await call({ order_id: ORDER });
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes('"r2_key"'));
  for (const d of r.json.downloads) {
    assert.deepEqual(Object.keys(d).sort(),
      ['byte_size', 'content_type', 'expires_at', 'filename', 'photo_id', 'url'].sort());
  }
});
