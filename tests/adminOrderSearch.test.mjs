import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerFunction } from './harness/build.mjs';

/* The order search, and what it may put in a filter.

   admin-orders searches three columns with a single PostgREST .or()
   expression built as a string. That is the one place in the function
   where what the browser typed becomes filter syntax rather than a
   bound value, so a comma or a bracket in the search would be read as
   a new condition or a group.

   The mock records the exact expression handed to .or(). The template
   joins its three conditions with two commas of its own; a payload
   that reaches the filter unsanitised would add more. So the test is
   simple: however many commas and brackets the search contains, the
   expression still has exactly the template's two commas and no
   brackets. The real columns - an order code, a name, an email -
   never contain those characters, so nothing legitimate is lost. */

const url = await buildCustomerFunction('admin-orders');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
await import(url);
assert.ok(handler, 'admin-orders should register a handler');

function reset() {
  globalThis.__db = {
    orders: [{
      id: 'o1', order_code: 'WS-2026-0001', status: 'pending', payment_status: 'unpaid',
      customer_name: 'A Buyer', customer_email: 'buyer@example.com', customer_phone: '9000000000',
      city: 'Chennai', state: 'Tamil Nadu', total_paise: 5400, photo_bytes_total: 0,
      photos_deleted_at: null, created_at: '2026-10-01T10:00:00Z', completed_at: null
    }],
    order_items: [], order_photos: [], order_events: [], settings: [], admins: []
  };
  globalThis.__orCalls = [];
  globalThis.__env = {};
}

async function search(term, { admin = 'admin@studio.test' } = {}) {
  globalThis.__admin = admin;
  const res = await handler(new Request('https://functions.test/admin-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ search: term })
  }));
  return { status: res.status, or: globalThis.__orCalls.find((c) => c.table === 'orders')?.expr ?? null };
}

const commas = (s) => (s.match(/,/g) || []).length;

test('a plain search reaches the filter unchanged', async () => {
  reset();
  const { status, or } = await search('WS-2026');
  assert.equal(status, 200);
  assert.ok(or.includes('WS-2026'), 'the term is searched');
  assert.equal(commas(or), 2, 'only the template’s own two commas');
  assert.ok(!/[()]/.test(or), 'no brackets');
});

test('a comma cannot inject another condition', async () => {
  reset();
  const { or } = await search('a,status.eq.paid');
  assert.equal(commas(or), 2, 'the payload’s comma was stripped, not passed through');
  assert.ok(!or.includes('a,status'), 'the injected condition is broken up');
});

test('brackets cannot inject a group', async () => {
  reset();
  const { or } = await search('x)or(id.not.is.null');
  assert.ok(!/[()]/.test(or), 'every bracket is gone');
  assert.equal(commas(or), 2);
});

test('a payload of nothing but filter syntax searches for nothing', async () => {
  reset();
  const { status, or } = await search(',,,(((,,,');
  assert.equal(status, 200, 'the request is still handled');
  assert.equal(or, null, 'it sanitises to empty, so no filter is built at all');
});

test('email dots and hyphens still work', async () => {
  reset();
  const { status, or } = await search('a.buyer-01@example.com');
  assert.equal(status, 200);
  assert.ok(or.includes('a.buyer-01@example.com'), 'a real email is searched intact');
  assert.equal(commas(or), 2);
});

test('the search is still behind the admin door', async () => {
  reset();
  const { status, or } = await search('anything', { admin: null });
  assert.equal(status, 403, 'no admin, no listing');
  assert.equal(or, null, 'the query is never built');
});
