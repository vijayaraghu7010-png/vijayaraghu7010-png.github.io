import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPanel } from './harness/build.mjs';

/* Downloading a whole order's photographs in one go.

   Not an archive and not a document: each picture is saved as
   itself, under the name the customer gave it. A zip had to be
   unpacked and a PDF had to be taken apart again before anything
   could be printed from it.

   The real panel is bundled; only React's hooks, the icons and the
   Supabase client are replaced. The handler under test is the one
   that ships, and what it does to the page - the links it makes and
   clicks - is watched directly. */

const mod = await import(await buildPanel());
const OrdersPanel = mod.default;

const ORDER_ID = 'synthetic-order-0011';

/* There is no DOM here, so the handler gets the smallest one that
   lets it do its job: make a link, click it, take it out again. What
   it made and what it clicked is what this watches. */
function watchAnchors() {
  const made = [];
  globalThis.document = {
    body: { appendChild() {}, removeChild() {} },
    createElement(tag) {
      if (String(tag).toLowerCase() !== 'a') return { appendChild() {}, remove() {} };
      const record = { href: '', download: '', rel: '', clicked: 0, removed: false };
      made.push(record);
      return {
        set href(v) { record.href = v; },
        get href() { return record.href; },
        set download(v) { record.download = v; },
        get download() { return record.download; },
        set rel(v) { record.rel = v; },
        click() { record.clicked++; },
        remove() { record.removed = true; }
      };
    }
  };
  return { made, restore: () => { delete globalThis.document; } };
}

/* The signed URLs come back from photos-download like any other
   admin call, so the response is stubbed at fetch. */
function mockDownloads(downloads) {
  globalThis.__session = { access_token: 'TEST-SESSION-TOKEN' };
  globalThis.window = { setTimeout: (fn) => { fn(); return 0; } };
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ downloads }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
}

function detail(photos) {
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
      photo_bytes_total: 3000, photos_deleted_at: null, notes: null, total_paise: 1000
    },
    items: [], events: [], photos
  };
  globalThis.__hooks = { overrides: { 0: data }, setters: [], index: 0 };
  return el.type(el.props);
}

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

const uploaded = (n) => ({
  id: `p${n}`, original_filename: `IMG_000${n}.jpg`, byte_size: 1000 + n,
  upload_status: 'uploaded', deleted_at: null, position: n
});

const bulkButton = (tree) =>
  find(tree, (n) => n.type === 'button' && /Download all/i.test(textOf(n)));

test('the button says how many it will save', () => {
  const tree = detail([uploaded(1), uploaded(2), uploaded(3)]);
  assert.match(textOf(bulkButton(tree)), /Download all 3 photographs/);
});

test('one photograph is not called photographs', () => {
  const tree = detail([uploaded(1)]);
  assert.match(textOf(bulkButton(tree)), /Download all 1 photograph\b/);
});

test('an order whose uploads never finished is not offered it', () => {
  const pending = { ...uploaded(1), upload_status: 'pending' };
  assert.equal(bulkButton(detail([pending])), null);
});

test('deleted photographs are not offered either', () => {
  globalThis.__hooks = { overrides: { 0: [], 3: false, 5: ORDER_ID }, setters: [], index: 0 };
  const panel = OrdersPanel({});
  const el = find(panel, (n) => typeof n.type === 'function' && n.type.name === 'OrderDetail');
  const data = {
    order: {
      id: ORDER_ID, order_code: 'WS-2026-0011', status: 'completed',
      created_at: '2026-11-05T09:00:00Z', payment_status: 'paid', customer_name: 'F',
      customer_email: 'f@example.com', customer_phone: '9', address_line1: '1', city: 'C',
      state: 'S', pincode: '600001', photo_bytes_total: 0,
      photos_deleted_at: '2026-11-05T10:00:00Z', notes: null, total_paise: 1000
    },
    items: [], events: [], photos: [uploaded(1)]
  };
  globalThis.__hooks = { overrides: { 0: data }, setters: [], index: 0 };
  assert.equal(bulkButton(el.type(el.props)), null);
});

test('every photograph gets its own download, under its own name', async () => {
  const photos = [uploaded(1), uploaded(2), uploaded(3)];
  mockDownloads(photos.map((p, i) => ({
    photo_id: p.id,
    filename: p.original_filename,
    url: `https://bucket.example.com/signed-${i}?X-Amz-Signature=SIGNED`
  })));

  const watch = watchAnchors();
  try {
    const tree = detail(photos);
    await bulkButton(tree).props.onClick();

    assert.equal(watch.made.length, 3, 'one link per photograph');
    assert.deepEqual(watch.made.map((a) => a.clicked), [1, 1, 1], 'each clicked once');
    assert.deepEqual(watch.made.map((a) => a.download),
      ['IMG_0001.jpg', 'IMG_0002.jpg', 'IMG_0003.jpg']);
    assert.ok(watch.made.every((a) => a.href.includes('X-Amz-Signature')), 'signed urls');
    assert.ok(watch.made.every((a) => a.removed), 'and taken back out of the page');
  } finally {
    watch.restore();
  }
});

test('a photograph with no url is skipped rather than downloading nothing', async () => {
  const photos = [uploaded(1), uploaded(2)];
  mockDownloads([
    { photo_id: 'p1', filename: 'IMG_0001.jpg', url: 'https://bucket.example.com/a?X-Amz-Signature=S' },
    { photo_id: 'p2', filename: 'IMG_0002.jpg', url: null }
  ]);

  const watch = watchAnchors();
  try {
    await bulkButton(detail(photos)).props.onClick();
    assert.equal(watch.made.length, 1, 'only the one that can be fetched');
  } finally {
    watch.restore();
  }
});

test('nothing to download is said, not silently done', async () => {
  mockDownloads([]);
  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1)])).props.onClick();
    assert.equal(watch.made.length, 0, 'no empty downloads fired');
  } finally {
    watch.restore();
  }
});

/* ----------------------------------------------- saving to a folder

   The path Chrome actually takes. No downloads are fired at all:
   the studio picks a folder and each picture is written into it, so
   Chrome never has to be asked whether this site may save several
   files - the question it answers by stopping after the first. */

function mockFolder({ refuseMkdir = false } = {}) {
  const written = [];
  const made = [];

  const child = {
    async getFileHandle(name, opts) {
      const record = { name, create: opts?.create, bytes: null, closed: false };
      written.push(record);
      return {
        async createWritable() {
          return {
            async write(blob) { record.bytes = blob; },
            async close() { record.closed = true; }
          };
        }
      };
    }
  };

  /* What the picker hands back is the PARENT the studio chose; the
     panel makes the order's own folder inside it. */
  const folder = {
    async getDirectoryHandle(name, opts) {
      if (refuseMkdir) throw new Error('permission denied');
      made.push({ name, create: opts?.create });
      return child;
    }
  };

  return { written, made, folder };
}

function withPicker(folder, downloads) {
  globalThis.__session = { access_token: 'TEST-SESSION-TOKEN' };
  let call = 0;
  globalThis.fetch = async () => {
    call++;
    /* the first call is photos-download (JSON), the rest are bytes */
    if (call === 1) {
      return new Response(JSON.stringify({ downloads }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200, headers: { 'Content-Type': 'image/jpeg' }
    });
  };
  globalThis.window = {
    setTimeout: (fn) => { fn(); return 0; },
    showDirectoryPicker: async () => {
      if (folder === 'dismissed') throw new Error('AbortError');
      return folder;
    }
  };
}

const signed = (n) => ({
  photo_id: `p${n}`, filename: `IMG_000${n}.jpg`,
  url: `https://bucket.example.com/s${n}?X-Amz-Signature=S`
});

test('with a folder picker, every photograph is written and no download is fired', async () => {
  const { written, folder } = mockFolder();
  withPicker(folder, [signed(1), signed(2), signed(3)]);

  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1), uploaded(2), uploaded(3)])).props.onClick();

    assert.equal(watch.made.length, 0, 'no links, so nothing for Chrome to block');
    assert.deepEqual(written.map((f) => f.name),
      ['IMG_0001.jpg', 'IMG_0002.jpg', 'IMG_0003.jpg']);
    assert.ok(written.every((f) => f.create), 'created in the chosen folder');
    assert.ok(written.every((f) => f.bytes), 'each one actually written');
    assert.ok(written.every((f) => f.closed), 'and closed, or the file is empty');
  } finally {
    watch.restore();
  }
});

test('two photographs with one name do not overwrite each other', async () => {
  /* A phone hands out IMG_0001.jpg over and over. Writing the second
     over the first would lose a picture silently. */
  const { written, folder } = mockFolder();
  withPicker(folder, [
    { photo_id: 'p1', filename: 'IMG_0001.jpg', url: 'https://b/a?X-Amz-Signature=S' },
    { photo_id: 'p2', filename: 'IMG_0001.jpg', url: 'https://b/b?X-Amz-Signature=S' },
    { photo_id: 'p3', filename: 'IMG_0001.jpg', url: 'https://b/c?X-Amz-Signature=S' }
  ]);

  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1), uploaded(2), uploaded(3)])).props.onClick();
    assert.equal(new Set(written.map((f) => f.name)).size, 3, 'three distinct names');
    assert.deepEqual(written.map((f) => f.name),
      ['IMG_0001.jpg', 'IMG_0001 (2).jpg', 'IMG_0001 (3).jpg']);
  } finally {
    watch.restore();
  }
});

test('a name that could climb out of the folder is flattened', async () => {
  const { written, folder } = mockFolder();
  withPicker(folder, [
    { photo_id: 'p1', filename: '../../evil.jpg', url: 'https://b/a?X-Amz-Signature=S' }
  ]);

  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1)])).props.onClick();
    assert.equal(written.length, 1);
    assert.ok(!written[0].name.includes('/'), written[0].name);
    assert.ok(!written[0].name.startsWith('.'), written[0].name);
  } finally {
    watch.restore();
  }
});

test('dismissing the folder picker does nothing at all', async () => {
  withPicker('dismissed', [signed(1)]);
  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1)])).props.onClick();
    assert.equal(watch.made.length, 0, 'no fallback downloads behind their back');
  } finally {
    watch.restore();
  }
});

test('a folder named after the order is made, and the pictures go in it', async () => {
  const { written, made, folder } = mockFolder();
  withPicker(folder, [signed(1), signed(2)]);

  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1), uploaded(2)])).props.onClick();

    assert.deepEqual(made, [{ name: 'WS-2026-0011', create: true }],
      'one folder, named after the order');
    assert.deepEqual(written.map((f) => f.name), ['IMG_0001.jpg', 'IMG_0002.jpg']);
    assert.equal(watch.made.length, 0, 'still nothing for Chrome to block');
  } finally {
    watch.restore();
  }
});

test('a folder the browser will not make is reported, not worked around', async () => {
  const { written, folder } = mockFolder({ refuseMkdir: true });
  withPicker(folder, [signed(1)]);

  const watch = watchAnchors();
  try {
    await bulkButton(detail([uploaded(1)])).props.onClick();
    assert.equal(written.length, 0, 'nothing written');
    assert.equal(watch.made.length, 0, 'and no downloads fired instead, behind their back');
  } finally {
    watch.restore();
  }
});
