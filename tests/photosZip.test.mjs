import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildCustomerFunction, buildShared } from './harness/build.mjs';

/* One order's photographs, as a single file.

   Two things are worth proving and they are different in kind.

   The archive has to be a real archive. A zip this shop wrote that
   only this shop can open is worse than no zip at all - it goes to
   somebody's Windows machine to be printed from. So the writer's
   output is handed to Python's zipfile, which is not our code and
   does check CRCs, and the members are read back out of it.

   The function has to be as careful as the download it replaces:
   an administrator, an order that exists, photographs that have not
   been deleted, and nothing from anybody else's order. */

const { zipStream, uniqueNames, crc32 } = await import(await buildShared('zip'));

const enc = (s) => new TextEncoder().encode(s);

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/* Python, because an archive checked only by the thing that wrote it
   is not checked. Returns [{name, size, data}] with CRCs verified. */
function readBackWithPython(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-zip-'));
  const zipPath = path.join(dir, 'out.zip');
  fs.writeFileSync(zipPath, buffer);

  const script = `
import json, sys, zipfile
p = sys.argv[1]
with zipfile.ZipFile(p) as z:
    bad = z.testzip()
    if bad is not None:
        print(json.dumps({"corrupt": bad})); raise SystemExit
    out = [{"name": i.filename, "size": i.file_size, "method": i.compress_type,
            "data": z.read(i.filename).decode("utf-8", "replace")} for i in z.infolist()]
print(json.dumps({"entries": out}))
`;
  const stdout = execFileSync('python', ['-c', script, zipPath], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.corrupt, undefined, `zip is corrupt at ${parsed.corrupt}`);
  return parsed.entries;
}

/* ------------------------------------------------------- the writer */

test('the archive opens, and every member comes back as it went in', async () => {
  const buffer = await collect(
    zipStream([
      { name: 'one.jpg', read: async () => enc('the first photograph') },
      { name: 'two.jpg', read: async () => enc('the second') },
      { name: 'three.jpg', read: async () => enc('') }
    ])
  );

  const entries = readBackWithPython(buffer);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((e) => e.name), ['one.jpg', 'two.jpg', 'three.jpg']);
  assert.equal(entries[0].data, 'the first photograph');
  assert.equal(entries[1].data, 'the second');
  assert.equal(entries[2].size, 0, 'an empty member is still a member');
});

test('photographs are stored, not deflated', async () => {
  /* A JPEG is compressed already; deflating it again spends time to
     make it very slightly bigger. */
  const buffer = await collect(zipStream([{ name: 'a.jpg', read: async () => enc('x'.repeat(5000)) }]));
  const [entry] = readBackWithPython(buffer);
  assert.equal(entry.method, 0, 'compress_type 0 is store');
});

test('two photographs with one name both survive', async () => {
  /* Phones hand out IMG_0001.jpg over and over. Two members with one
     name is an archive that unpacks to one file. */
  const buffer = await collect(
    zipStream([
      { name: 'IMG_0001.jpg', read: async () => enc('first') },
      { name: 'IMG_0001.jpg', read: async () => enc('second') },
      { name: 'IMG_0001.jpg', read: async () => enc('third') }
    ])
  );

  const entries = readBackWithPython(buffer);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((e) => e.data), ['first', 'second', 'third']);
  assert.equal(new Set(entries.map((e) => e.name)).size, 3, 'three distinct names');
});

test('a filename cannot climb out of the folder it unpacks into', async () => {
  const names = uniqueNames(['../../etc/passwd', 'a/b/c.jpg', 'C:\\Windows\\evil.jpg', '....//x.jpg']);
  for (const name of names) {
    assert.ok(!name.includes('/'), `${name} still has a separator`);
    assert.ok(!name.includes('\\'), `${name} still has a separator`);
    assert.ok(!name.startsWith('.'), `${name} still starts with a dot`);
  }
});

test('an accented name survives the round trip', async () => {
  const buffer = await collect(
    zipStream([{ name: 'café ☕.png', read: async () => enc('bytes') }])
  );
  const [entry] = readBackWithPython(buffer);
  assert.equal(entry.name, 'café ☕.png');
});

test('a name that is nothing still becomes something', () => {
  assert.deepEqual(uniqueNames(['', null, undefined]).length, 3);
  for (const name of uniqueNames(['', null, undefined])) assert.ok(name.length > 0);
});

test('the checksum is the ordinary CRC-32', () => {
  /* The known answer for "123456789", which is how every CRC-32
     implementation is checked. */
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('a hundred members all come back', async () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({
    name: `photo-${i}.jpg`,
    read: async () => enc(`contents of ${i}`)
  }));
  const back = readBackWithPython(await collect(zipStream(entries)));
  assert.equal(back.length, 100);
  assert.equal(back[99].data, 'contents of 99');
});

/* ----------------------------------------------------- the function */

const url = await buildCustomerFunction('photos-zip');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
await import(url);
assert.ok(handler, 'photos-zip should register a handler');

const ORDER_ID = 'order-0001';

function reset({ order = {}, photos = null, admin = 'studio@example.com' } = {}) {
  globalThis.__db = {
    orders: [{
      id: ORDER_ID, order_code: 'WS-2026-0042', photos_deleted_at: null, ...order
    }],
    order_photos: photos ?? [
      { id: 'p1', order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/a.jpg`,
        original_filename: 'a.jpg', byte_size: 10, upload_status: 'uploaded',
        deleted_at: null, position: 0 },
      { id: 'p2', order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/b.jpg`,
        original_filename: 'b.jpg', byte_size: 10, upload_status: 'uploaded',
        deleted_at: null, position: 1 }
    ],
    order_events: []
  };
  globalThis.__admin = admin;
  globalThis.__env = {};
  globalThis.__r2 = {};
  /* The R2 double notes the calls it was asked to sign; this file
     uses the database double, which does not set that up. */
  globalThis.__state = { callOrder: [] };
  /* The bucket, reached through the signed URL the function makes. */
  globalThis.fetch = async () => new Response(enc('photo bytes'), { status: 200 });
}

const ask = (body = {}) =>
  handler(new Request('https://shop.test/photos-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://wrappedstudio.in' },
    body: JSON.stringify({ order_id: ORDER_ID, ...body })
  }));

test('an administrator gets a zip, named after the order', async () => {
  reset();
  const res = await ask();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/zip');
  assert.match(res.headers.get('Content-Disposition'), /WS-2026-0042-photos\.zip/);
  assert.equal(res.headers.get('X-Zip-Filename'), 'WS-2026-0042-photos.zip');

  const entries = readBackWithPython(Buffer.from(await res.arrayBuffer()));
  assert.deepEqual(entries.map((e) => e.name), ['a.jpg', 'b.jpg']);
  assert.equal(entries[0].data, 'photo bytes');
});

test('it is not an administrator who may do this', async () => {
  reset({ admin: null });
  assert.equal((await ask()).status, 403);
});

test('deleted photographs are not handed back', async () => {
  reset({ order: { photos_deleted_at: '2026-11-04T10:00:00Z' } });
  assert.equal((await ask()).status, 409);
});

test('an order with nothing confirmed has nothing to send', async () => {
  reset({ photos: [
    { id: 'p1', order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/a.jpg`, original_filename: 'a.jpg',
      byte_size: 10, upload_status: 'pending', deleted_at: null, position: 0 }
  ] });
  assert.equal((await ask()).status, 404);
});

test('a key belonging somewhere else stops the whole archive', async () => {
  reset({ photos: [
    { id: 'p1', order_id: ORDER_ID, r2_key: 'orders/another-order/a.jpg', original_filename: 'a.jpg',
      byte_size: 10, upload_status: 'uploaded', deleted_at: null, position: 0 }
  ] });
  assert.equal((await ask()).status, 500);
});

test('an order too big for one archive is told so, not handed a broken one', async () => {
  const many = Array.from({ length: 201 }, (_, i) => ({
    id: `p${i}`, order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/${i}.jpg`,
    original_filename: `${i}.jpg`, byte_size: 10, upload_status: 'uploaded',
    deleted_at: null, position: i
  }));
  reset({ photos: many });
  const res = await ask();
  assert.equal(res.status, 413);
  assert.match((await res.json()).error, /individually/);
});

test('too many bytes is also refused', async () => {
  reset({ photos: [
    { id: 'p1', order_id: ORDER_ID, r2_key: `orders/${ORDER_ID}/a.jpg`, original_filename: 'a.jpg',
      byte_size: 2 * 1024 * 1024 * 1024, upload_status: 'uploaded', deleted_at: null, position: 0 }
  ] });
  assert.equal((await ask()).status, 413);
});

test('the request is written into the order history before anything is sent', async () => {
  reset();
  await ask();
  const events = globalThis.__db.order_events;
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'photos.downloaded');
  assert.equal(events[0].actor, 'studio@example.com');
  assert.equal(events[0].detail.as, 'zip');
  assert.equal(events[0].detail.count, 2);
});

test('an unknown order, a missing id and a bad body are refused', async () => {
  reset();
  assert.equal((await ask({ order_id: 'nope' })).status, 404);
  assert.equal((await ask({ order_id: '' })).status, 400);

  const bad = await handler(new Request('https://shop.test/photos-zip', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json'
  }));
  assert.equal(bad.status, 400);
});

test('anything but POST is refused', async () => {
  reset();
  assert.equal((await handler(new Request('https://shop.test/photos-zip', { method: 'GET' }))).status, 405);
});
