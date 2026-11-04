import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerFunction } from './harness/build.mjs';

/* Taking an order off the books.

   This destroys more than anything else in the shop, so what is worth
   testing is not the happy path but every way it is supposed to say
   no. The one that matters most is storage: every file in the bucket
   is reachable only through keys recorded against this order, so
   deleting the row before the files are gone strands them for ever -
   paid for monthly, belonging to a customer who was told their
   photographs had been removed.

   No Supabase and no R2: the database is the in-memory one and the
   bucket is a map of key to size. */

const url = await buildCustomerFunction('order-remove');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
await import(url);
assert.ok(handler, 'order-remove should register a handler');

const ORDER_ID = 'order-0001';
const CODE = 'WS-2026-0042';

function reset({ order = {}, photos = [], payments = [], bucket = {}, admin = 'studio@example.com' } = {}) {
  globalThis.__db = {
    orders: [{
      id: ORDER_ID, order_code: CODE, status: 'completed',
      photos_deleted_at: '2026-11-04T10:00:00Z',
      total_paise: 15000, shipping_paise: 6000,
      created_at: '2026-11-01T10:00:00Z', ...order
    }],
    order_photos: photos,
    order_payments: payments,
    admin_audit: []
  };
  globalThis.__r2 = { ...bucket };
  globalThis.__admin = admin;
  globalThis.__env = {};
}

const remove = (body = {}) =>
  handler(new Request('https://shop.test/order-remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://wrappedstudio.in' },
    body: JSON.stringify({ order_id: ORDER_ID, confirm_code: CODE, ...body })
  }));

const orders = () => globalThis.__db.orders;
const audit = () => globalThis.__db.admin_audit;

test('a completed order whose photographs are gone is removed', async () => {
  reset();
  const res = await remove();
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.removed, true);
  assert.equal(body.order_code, CODE);
  assert.equal(orders().length, 0, 'the row should be gone');
});

test('it is not an administrator who may do this', async () => {
  reset({ admin: null });
  const res = await remove();
  assert.equal(res.status, 403);
  assert.equal(orders().length, 1, 'nothing removed');
});

test('an order that is not completed is left alone', async () => {
  for (const status of ['pending', 'paid', 'in_progress', 'cancelled']) {
    reset({ order: { status } });
    const res = await remove();
    assert.equal(res.status, 409, `${status} should be refused`);
    assert.equal(orders().length, 1);
  }
});

test('an order whose photographs are still there is left alone', async () => {
  /* The guard that matters. Removing the row is what makes the files
     unreachable, so it may not be the step that strands them. */
  reset({ order: { photos_deleted_at: null } });
  const res = await remove();
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /Complete this order first/);
  assert.equal(orders().length, 1);
});

test('a stray undeleted photograph row stops it, even if the order says they are gone', async () => {
  reset({ photos: [{ id: 'p1', order_id: ORDER_ID, deleted_at: null }] });
  const res = await remove();
  assert.equal(res.status, 409);
  assert.equal(orders().length, 1);
});

test('the wrong code removes nothing', async () => {
  reset();
  for (const typed of ['', 'WS-2026-0043', 'yes', 'DELETE']) {
    reset();
    const res = await remove({ confirm_code: typed });
    assert.ok(res.status === 400, `"${typed}" should be refused`);
    assert.equal(orders().length, 1);
  }
});

test('the code is accepted whatever case it is typed in', async () => {
  reset();
  const res = await remove({ confirm_code: CODE.toLowerCase() });
  assert.equal(res.status, 200);
});

test('the payment screenshot goes too, since nothing else could find it', async () => {
  reset({
    payments: [{ id: 'pay1', order_id: ORDER_ID, proof_r2_key: 'payments/abc.jpg' }],
    bucket: { 'payments/abc.jpg': 1234 }
  });

  const res = await remove();
  assert.equal(res.status, 200);
  assert.equal((await res.json()).payment_proofs_removed, 1);
  assert.equal(globalThis.__r2['payments/abc.jpg'], undefined, 'the file should be gone');
  assert.equal(orders().length, 0);
});

test('a payment file that will not delete stops the whole thing', async () => {
  /* The bucket mock deletes by removing the key, so a key that is put
     back is one that would not go. Driven by leaving the delete to
     fail: here the file simply stays, which headObject then finds. */
  reset({
    payments: [{ id: 'pay1', order_id: ORDER_ID, proof_r2_key: 'payments/stuck.jpg' }],
    bucket: { 'payments/stuck.jpg': 1 }
  });

  const realDelete = globalThis.__r2;
  /* Make the delete a no-op by freezing the bucket entry back in. */
  globalThis.__r2 = new Proxy(realDelete, {
    deleteProperty() { return true; } /* pretend it went, but leave it */
  });

  const res = await remove();
  assert.ok(res.status >= 400, 'a file left behind must stop the removal');
  assert.equal(orders().length, 1, 'the order is kept so the file is still findable');
});

test('a payment key that is not ours is refused rather than deleted', async () => {
  reset({
    payments: [{ id: 'pay1', order_id: ORDER_ID, proof_r2_key: 'orders/somebody-else/photo.jpg' }],
    bucket: { 'orders/somebody-else/photo.jpg': 1 }
  });

  const res = await remove();
  assert.equal(res.status, 500);
  assert.equal(orders().length, 1);
  assert.equal(globalThis.__r2['orders/somebody-else/photo.jpg'], 1, 'nothing touched');
});

test('what the order was is written down before it stops existing', async () => {
  reset();
  await remove();

  assert.equal(audit().length, 1, 'one audit line');
  const line = audit()[0];
  assert.equal(line.action, 'order.removed');
  assert.equal(line.entity, 'order');
  assert.equal(line.actor, 'studio@example.com');
  assert.equal(line.payload.order_code, CODE);
  assert.equal(line.payload.total_paise, 15000);

  /* A record that a sale happened, not a copy of the customer. */
  const text = JSON.stringify(line);
  for (const leaked of ['address', 'customer_email', 'customer_phone', 'pincode']) {
    assert.ok(!text.includes(leaked), `the audit line should not carry ${leaked}`);
  }
});

test('an unknown order, a missing id and a bad body are all refused', async () => {
  reset();
  assert.equal((await remove({ order_id: 'nope' })).status, 404);
  assert.equal((await remove({ order_id: '' })).status, 400);

  const bad = await handler(new Request('https://shop.test/order-remove', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json'
  }));
  assert.equal(bad.status, 400);
  assert.equal(orders().length, 1);
});

test('anything but POST is refused', async () => {
  reset();
  const res = await handler(new Request('https://shop.test/order-remove', { method: 'GET' }));
  assert.equal(res.status, 405);
  assert.equal(orders().length, 1);
});
