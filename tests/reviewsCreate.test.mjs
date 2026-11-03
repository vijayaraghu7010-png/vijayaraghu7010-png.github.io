import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerFunction } from './harness/build.mjs';

/* Writing a review, now that the browser cannot do it itself.

   The old arrangement was an INSERT from the page under the anon
   role, with every check in React. The publishable key is in the
   bundle, so those checks were advice: one curl command could file
   any number of reviews, at any rating, against any product id.

   These tests run the real function and ask the questions that
   matter - does it refuse a rating outside one to five, does it
   refuse a product the shop does not sell, does it stop a flood, and
   when it does accept, does the row it writes carry exactly what was
   sent. Nothing here touches Supabase. */

const url = await buildCustomerFunction('reviews-create');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
await import(url);
assert.ok(handler, 'reviews-create should register a handler');

const PRODUCT = 'poster-pink-aesthetic-kit';

function reset() {
  globalThis.__db = {
    products: [{ id: PRODUCT, name: 'A poster' }],
    reviews: [],
    lookup_attempts: []
  };
  globalThis.__env = {};
  globalThis.__noRpc = false;
  globalThis.__failInsert = null;
}

const post = (body, headers = {}) =>
  handler(new Request('https://shop.test/reviews-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://wrappedstudio.in', ...headers },
    body: JSON.stringify(body)
  }));

const GOOD = { product_id: PRODUCT, rating: 5, name: 'Asha', text: 'Lovely print, arrived quickly.' };

test('a good review is written, and carries what was sent', async () => {
  reset();
  const res = await post(GOOD);
  assert.equal(res.status, 201);

  const { review } = await res.json();
  assert.equal(review.product_id, PRODUCT);
  assert.equal(review.rating, 5);
  assert.equal(review.name, 'Asha');
  assert.equal(review.text, 'Lovely print, arrived quickly.');
  assert.equal(globalThis.__db.reviews.length, 1);
});

test('a rating outside one to five is refused', async () => {
  for (const rating of [0, 6, -3, 99, 'five', null]) {
    reset();
    const res = await post({ ...GOOD, rating });
    assert.equal(res.status, 400, `rating ${JSON.stringify(rating)} should be refused`);
    assert.equal(globalThis.__db.reviews.length, 0);
  }
});

test('a review with nothing written in it is refused', async () => {
  reset();
  const res = await post({ ...GOOD, text: '   ' });
  assert.equal(res.status, 400);
  assert.equal(globalThis.__db.reviews.length, 0);
});

test('a review against a product the shop does not sell is refused', async () => {
  reset();
  const res = await post({ ...GOOD, product_id: 'no-such-product' });
  assert.equal(res.status, 404);
  assert.equal(globalThis.__db.reviews.length, 0);
});

test('a missing name becomes a customer rather than an empty byline', async () => {
  reset();
  const res = await post({ ...GOOD, name: '   ' });
  assert.equal(res.status, 201);
  assert.equal(globalThis.__db.reviews[0].name, 'A customer');
});

test('an over-long name and body are cut to what the columns take', async () => {
  reset();
  const res = await post({ ...GOOD, name: 'n'.repeat(500), text: 't'.repeat(5000) });
  assert.equal(res.status, 201);
  assert.equal(globalThis.__db.reviews[0].name.length, 80);
  assert.equal(globalThis.__db.reviews[0].text.length, 2000);
});

test('one caller cannot write reviews without end', async () => {
  reset();
  const statuses = [];
  for (let i = 0; i < 9; i++) {
    statuses.push((await post(GOOD, { 'x-forwarded-for': '203.0.113.9' })).status);
  }
  assert.ok(statuses.includes(429), `a flood should be stopped, got ${statuses.join(',')}`);
  assert.ok(
    globalThis.__db.reviews.length < 9,
    'the rate limit should stop rows being written, not just change the answer'
  );
});

test('one product cannot be buried from many addresses', async () => {
  reset();
  const statuses = [];
  /* A fresh address every time, which is what somebody doing this
     would do. The per-caller limit never trips; the per-product one
     has to. */
  for (let i = 0; i < 25; i++) {
    statuses.push((await post(GOOD, { 'x-forwarded-for': `198.51.100.${i}` })).status);
  }
  assert.ok(statuses.includes(429), `a flood from many addresses should be stopped, got ${statuses.join(',')}`);
});

test('anything but POST is refused', async () => {
  reset();
  const res = await handler(new Request('https://shop.test/reviews-create', { method: 'GET' }));
  assert.equal(res.status, 405);
});

test('an unreadable body is refused rather than crashing', async () => {
  reset();
  const res = await handler(new Request('https://shop.test/reviews-create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json'
  }));
  assert.equal(res.status, 400);
});
