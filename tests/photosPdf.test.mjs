import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildCustomerFunction, buildShared } from './harness/build.mjs';

/* One order's photographs, as a single PDF.

   A zip made the studio unpack something before it could see
   anything. A PDF opens, scrolls and prints, which is what these
   pictures are for.

   The thing worth proving is that the file is a real PDF and that
   the photographs inside it are the photographs that went in - a
   print taken from this is a print the customer paid for. So the
   bytes are checked against the shop's own JPEGs, not merely against
   the code that wrote them, and the structure is read back out of
   the file rather than assumed. */

const { buildPdf, jpegInfo } = await import(await buildShared('pdf'));

const enc = (s) => new TextEncoder().encode(s);
const jpeg = (f) => new Uint8Array(fs.readFileSync(`public/images/${f}`));
const latin = (bytes) => Buffer.from(bytes).toString('latin1');

/* --------------------------------------------------- the JPEG reader */

test('a real JPEG gives up its size and colour', () => {
  const info = jpegInfo(jpeg('p-rosy-harmony.jpg'));
  assert.deepEqual(info, { width: 1086, height: 1448, components: 3 });
});

test('anything that is not a JPEG is refused rather than guessed at', () => {
  for (const bad of [new Uint8Array(0), new Uint8Array([1, 2, 3, 4]), enc('not an image')]) {
    assert.equal(jpegInfo(bad), null);
  }
});

/* -------------------------------------------------------- the file */

test('the file is a PDF, and says how many pages it has', () => {
  const pdf = latin(buildPdf('WS-2026-0042 photographs', [
    { name: 'a.jpg', bytes: jpeg('p-rosy-harmony.jpg') },
    { name: 'b.jpg', bytes: jpeg('p-memory-bloom.jpg') }
  ]));

  assert.ok(pdf.startsWith('%PDF-'), 'starts with the header');
  assert.ok(pdf.trimEnd().endsWith('%%EOF'), 'ends with the trailer');
  assert.match(pdf, /\/Count 2\b/);
  assert.match(pdf, /xref/);
  assert.match(pdf, /trailer/);
  assert.match(pdf, /\/Title \(WS-2026-0042 photographs\)/);
});

test('the photograph in the file is the photograph that went in', () => {
  /* The whole point of not re-encoding. A print from this file has
     to be a print from the original. */
  const source = jpeg('p-golden-smiles.jpg');
  const pdf = Buffer.from(buildPdf('t', [{ name: 'g.jpg', bytes: source }]));

  assert.ok(pdf.includes(Buffer.from(source)), 'the original bytes are in there untouched');
  assert.match(latin(pdf), /\/Filter \/DCTDecode/, 'carried as a JPEG, not decoded');
});

test('a page is the size of its own picture, so nothing is cropped', () => {
  const pdf = latin(buildPdf('t', [{ name: 'a.jpg', bytes: jpeg('p-rosy-harmony.jpg') }]));
  assert.match(pdf, /\/MediaBox \[0 0 1086 1448\]/);
});

test('a picture that could not be read gets a page saying so', () => {
  /* Dropping it would leave the studio thinking the order had fewer
     photographs than it does. */
  const pdf = latin(buildPdf('t', [
    { name: 'good.jpg', bytes: jpeg('p-rosy-harmony.jpg') },
    { name: 'missing.heic', bytes: null, problem: 'storage answered 404' }
  ]));

  assert.match(pdf, /\/Count 2\b/, 'still two pages');
  assert.match(pdf, /\(missing\.heic\)/, 'named');
  assert.match(pdf, /storage answered 404/, 'and why');
});

test('a name with brackets in it cannot break the file', () => {
  /* ( ) and \\ end a string in a PDF. A filename carrying one would
     corrupt everything after it. */
  const pdf = latin(buildPdf('t', [
    { name: 'IMG (2) \\ "quoted".heic', bytes: null, problem: 'not a JPEG' }
  ]));

  assert.ok(pdf.trimEnd().endsWith('%%EOF'), 'the file still closes properly');
  assert.match(pdf, /IMG \\\(2\\\) \\\\ "quoted"\.heic/, 'the brackets are escaped');
});

test('an order of one and an order of many both come out whole', () => {
  for (const n of [1, 5, 20]) {
    const photos = Array.from({ length: n }, (_, i) => ({
      name: `p${i}.jpg`, bytes: jpeg('p-memory-bloom.jpg')
    }));
    const pdf = latin(buildPdf('t', photos));
    assert.match(pdf, new RegExp(`/Count ${n}\\b`));
    assert.equal((pdf.match(/\/Subtype \/Image/g) || []).length, n);
    assert.ok(pdf.trimEnd().endsWith('%%EOF'));
  }
});

/* ---------------------------------------------------- the function */

const url = await buildCustomerFunction('photos-pdf');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
await import(url);
assert.ok(handler, 'photos-pdf should register a handler');

const ORDER_ID = 'order-0001';
const PHOTO = jpeg('p-rosy-harmony.jpg');

function reset({ order = {}, photos = null, admin = 'studio@example.com', fetchOk = true } = {}) {
  globalThis.__db = {
    orders: [{ id: ORDER_ID, order_code: 'WS-2026-0042', photos_deleted_at: null, ...order }],
    order_photos: photos ?? [
      { id: 'p1', order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/a.jpg`,
        original_filename: 'a.jpg', byte_size: PHOTO.length, upload_status: 'uploaded',
        deleted_at: null, position: 0 }
    ],
    order_events: []
  };
  globalThis.__admin = admin;
  globalThis.__env = {};
  globalThis.__r2 = {};
  globalThis.__state = { callOrder: [] };
  globalThis.fetch = async () =>
    fetchOk ? new Response(PHOTO, { status: 200 }) : new Response('nope', { status: 404 });
}

const ask = (body = {}) =>
  handler(new Request('https://shop.test/photos-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://wrappedstudio.in' },
    body: JSON.stringify({ order_id: ORDER_ID, ...body })
  }));

test('an administrator gets a PDF named after the order', async () => {
  reset();
  const res = await ask();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/pdf');
  assert.match(res.headers.get('Content-Disposition'), /WS-2026-0042-photos\.pdf/);
  assert.equal(res.headers.get('X-Pdf-Filename'), 'WS-2026-0042-photos.pdf');

  const body = Buffer.from(await res.arrayBuffer());
  assert.ok(latin(body).startsWith('%PDF-'));
  assert.ok(body.includes(Buffer.from(PHOTO)), 'the real photograph is inside');
});

test('a photograph the bucket will not give back does not lose the file', async () => {
  reset({ fetchOk: false });
  const res = await ask();
  assert.equal(res.status, 200, 'the rest of the order is still printable');
  assert.match(latin(Buffer.from(await res.arrayBuffer())), /could not be included/);
});

test('it is not an administrator who may do this', async () => {
  reset({ admin: null });
  assert.equal((await ask()).status, 403);
});

test('deleted photographs are not handed back', async () => {
  reset({ order: { photos_deleted_at: '2026-11-05T10:00:00Z' } });
  assert.equal((await ask()).status, 409);
});

test('a key belonging to another order stops the whole file', async () => {
  reset({ photos: [
    { id: 'p1', order_id: ORDER_ID, r2_key: 'orders/somebody-else/a.jpg', original_filename: 'a.jpg',
      byte_size: 10, upload_status: 'uploaded', deleted_at: null, position: 0 }
  ] });
  assert.equal((await ask()).status, 500);
});

test('an order with nothing confirmed has nothing to send', async () => {
  reset({ photos: [
    { id: 'p1', order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/a.jpg`, original_filename: 'a.jpg',
      byte_size: 10, upload_status: 'pending', deleted_at: null, position: 0 }
  ] });
  assert.equal((await ask()).status, 404);
});

test('too many photographs is refused, not half-answered', async () => {
  reset({ photos: Array.from({ length: 151 }, (_, i) => ({
    id: `p${i}`, order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/${i}.jpg`,
    original_filename: `${i}.jpg`, byte_size: 10, upload_status: 'uploaded',
    deleted_at: null, position: i
  })) });
  const res = await ask();
  assert.equal(res.status, 413);
  assert.match((await res.json()).error, /individually/);
});

test('the request is written into the order history before anything is sent', async () => {
  reset();
  await ask();
  const [event] = globalThis.__db.order_events;
  assert.equal(event.event, 'photos.downloaded');
  assert.equal(event.actor, 'studio@example.com');
  assert.equal(event.detail.as, 'pdf');
});

test('an unknown order, a missing id, a bad body and a GET are all refused', async () => {
  reset();
  assert.equal((await ask({ order_id: 'nope' })).status, 404);
  assert.equal((await ask({ order_id: '' })).status, 400);
  assert.equal((await handler(new Request('https://shop.test/photos-pdf', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json'
  }))).status, 400);
  assert.equal((await handler(new Request('https://shop.test/photos-pdf', { method: 'GET' }))).status, 405);
});
