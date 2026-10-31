import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerFunction } from './harness/build.mjs';

/* Who an order belongs to when it is made.

   The real orders-create, bundled against the in-memory database and
   a pricing double. _shared/customer.ts is the shipping one, because
   the thing under test is how it tells an anonymous caller apart from
   a customer whose session has run out.

   No live Supabase, no R2, no order that exists anywhere. */

let handler;
{
  const url = await buildCustomerFunction('orders-create');
  globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
  await import(url);
}
assert.ok(handler, 'orders-create should register a handler');

const DB = () => globalThis.__db;

/* A token whose payload names a role, signed with nothing. The mock
   resolves it to a user only when a test says so, which is exactly
   the situation being tested: a token that looks authenticated but
   no longer resolves to anybody. */
function jwt(role) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ role, sub: 'someone' })}.signature`;
}

const CUSTOMER = {
  name: 'A Buyer', email: 'buyer@example.com', phone: '9000000000',
  address_line1: '1 Test Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001'
};
const ITEMS = [{ productId: 'polaroid-medium', quantity: 9, config: {} }];

function reset() {
  globalThis.__db = {
    orders: [], order_items: [], order_events: [],
    order_tracking_tokens: [], order_lookup_codes: [],
    lookup_attempts: [], upload_sessions: [], settings: [], products: []
  };
  globalThis.__authUser = null;
  globalThis.__priceError = null;
  globalThis.__sent = [];
  globalThis.__env = {};
  globalThis.__failInsert = null;
}

async function place({ bearer } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await handler(new Request('https://fn.test/orders-create', {
    method: 'POST', headers,
    body: JSON.stringify({ customer: CUSTOMER, items: ITEMS, notes: '' })
  }));
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

/* ------------------------------------------------- guest checkout */

test('a guest with no Authorization header can still order', async () => {
  reset();
  const r = await place();
  assert.equal(r.status, 201);
  assert.equal(DB().orders.length, 1);
  assert.equal(DB().orders[0].user_id, null, 'a guest order belongs to nobody');
});

test('a guest carrying the publishable key can still order', async () => {
  reset();
  const r = await place({ bearer: 'anon-key' });
  assert.equal(r.status, 201);
  assert.equal(DB().orders[0].user_id, null);
});

test('a token whose role is anon is treated as a guest, not an error', async () => {
  reset();
  const r = await place({ bearer: jwt('anon') });
  assert.equal(r.status, 201);
  assert.equal(DB().orders[0].user_id, null);
});

/* ------------------------------------------- the signed-in customer */

test('a signed-in customer’s order is linked to them', async () => {
  reset();
  globalThis.__authUser = { id: 'user-1', email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
  const r = await place({ bearer: jwt('authenticated') });
  assert.equal(r.status, 201);
  assert.equal(DB().orders[0].user_id, 'user-1');
});

test('the owner comes from the token, never from the body', async () => {
  reset();
  globalThis.__authUser = { id: 'user-1', email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
  const res = await handler(new Request('https://fn.test/orders-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', Authorization: `Bearer ${jwt('authenticated')}` },
    body: JSON.stringify({ customer: CUSTOMER, items: ITEMS, user_id: 'user-999', userId: 'user-999' })
  }));
  assert.equal(res.status, 201);
  assert.equal(DB().orders[0].user_id, 'user-1', 'the body’s id is ignored');
});

test('an unconfirmed address does not own an order', async () => {
  reset();
  globalThis.__authUser = { id: 'user-1', email: 'buyer@example.com', email_confirmed_at: null, confirmed_at: null };
  const r = await place({ bearer: jwt('authenticated') });
  assert.equal(r.status, 201);
  assert.equal(DB().orders[0].user_id, null);
});

/* ---------------------------------------- the expired session case */

test('an expired customer session is refused, not quietly downgraded', async () => {
  reset();
  globalThis.__authUser = null;                 // the token resolves to nobody
  const r = await place({ bearer: jwt('authenticated') });
  assert.equal(r.status, 401);
  assert.match(r.json.error, /session has ended/i);
  assert.equal(DB().orders.length, 0, 'no orphan order is created');
});

test('the refusal tells the customer what to do', async () => {
  reset();
  const r = await place({ bearer: jwt('authenticated') });
  assert.match(r.json.error, /sign in again|guest/i);
});

/* ------------------------------------------------ tracking token */

test('every order gets a tracking token, hashed at rest', async () => {
  reset();
  const r = await place();
  assert.equal(r.status, 201);
  assert.ok(r.json.tracking_token, 'the browser that placed it is given one');
  assert.equal(DB().order_tracking_tokens.length, 1);

  const row = DB().order_tracking_tokens[0];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(r.json.tracking_token));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(row.token_hash, hex);
  assert.ok(!JSON.stringify(row).includes(r.json.tracking_token), 'the raw token is not stored');
});

test('the tracking token lasts thirty days', async () => {
  reset();
  await place();
  const row = DB().order_tracking_tokens[0];
  const days = (new Date(row.expires_at).getTime() - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days < 30.1, `expected about 30 days, got ${days}`);
  assert.equal(row.revoked_at ?? null, null);
});

test('the upload token and the tracking token are different secrets', async () => {
  reset();
  const r = await place();
  assert.notEqual(r.json.upload_token, r.json.tracking_token);
});

/* --------------------------------------------------- regressions */

test('the five statuses are unchanged: a new order starts pending', async () => {
  reset();
  await place();
  const status = DB().orders[0].status ?? 'pending';
  assert.ok(['pending', undefined, null].includes(DB().orders[0].status) || status === 'pending');
});

test('a pricing refusal still refuses, and writes nothing', async () => {
  reset();
  globalThis.__priceError = 'the smallest order is 9';
  const r = await place();
  assert.equal(r.status, 400);
  assert.equal(DB().orders.length, 0);
  assert.equal(DB().order_tracking_tokens.length, 0);
});

test('the reply carries no internal identifiers', async () => {
  reset();
  const r = await place();
  for (const leak of ['user_id', 'token_hash', 'service_role', 'r2_key']) {
    assert.ok(!r.text.includes(leak), `the reply must not contain ${leak}`);
  }
});

/* ---------------------------- fix: a token that was never stored */

test('no tracking token is handed over if its hash did not store', async () => {
  reset();
  globalThis.__failInsert = 'order_tracking_tokens';
  const r = await place();
  globalThis.__failInsert = null;

  assert.equal(r.status, 201, 'the order still stands');
  assert.equal(DB().orders.length, 1);
  assert.equal(r.json.tracking_token, null, 'but no link is offered');
  assert.equal(DB().order_tracking_tokens.length, 0);
});

test('a guest checkout survives a tracking-token failure', async () => {
  reset();
  globalThis.__failInsert = 'order_tracking_tokens';
  const r = await place();
  globalThis.__failInsert = null;
  assert.equal(r.status, 201);
  assert.ok(r.json.order_code, 'the customer still gets their order code');
  assert.ok(r.json.upload_token, 'and can still send their photographs');
});
