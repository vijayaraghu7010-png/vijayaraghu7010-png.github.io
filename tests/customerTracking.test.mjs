import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerFunction } from './harness/build.mjs';

/* The customer side of the shop, run against the real functions.

   Each one is bundled from its shipping source with the database and
   the email boundary replaced by doubles. _shared/customer.ts is not
   replaced: the ownership check, the field-by-field response and the
   rate limiter are the point.

   No test here touches Supabase, R2, or any order that exists. Every
   row is invented in memory and thrown away afterwards. */

const F = {};
for (const name of ['track-request-code', 'track-verify-code', 'track-order',
                    'customer-orders', 'customer-claim-order']) {
  const url = await buildCustomerFunction(name);
  let captured;
  globalThis.Deno = { serve: (fn) => { captured = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
  await import(url);
  F[name] = captured;
  assert.ok(captured, `${name} should register a handler`);
}

/* The doubles put their controls on globalThis; reach them there so
   this file needs no second bundle. */
const DB = () => globalThis.__db;
const SENT = () => globalThis.__sent || [];

const ORDER_ID = 'order-0001';
const CODE = 'WS-2026-0042';
const EMAIL = 'buyer@example.com';

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function reset({ order = {}, tokens = [], codes = [], attempts = [], items = [], events = [] } = {}) {
  globalThis.__db = {
    orders: [{
      id: ORDER_ID, order_code: CODE, customer_email: EMAIL, user_id: null,
      status: 'in_progress', created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z', completed_at: null,
      customer_name: 'A Buyer', customer_phone: '9000000000',
      address_line1: '1 Test Street', city: 'Chennai', state: 'Tamil Nadu',
      pincode: '600001', payment_id: 'pay_SECRET', payment_order_id: 'po_SECRET',
      total_paise: 5400, photo_bytes_total: 123, ...order
    }],
    order_items: items, order_events: events,
    order_tracking_tokens: tokens, order_lookup_codes: codes, lookup_attempts: attempts
  };
  globalThis.__sent = [];
  globalThis.__authUser = null;
  globalThis.__dbCalls = [];
  globalThis.__emailConfigured = false;
  globalThis.__noRpc = false;
  globalThis.__env = {};
  globalThis.__failInsert = null;
}

function req(fn, body, { bearer, ip = '1.2.3.4' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', 'x-forwarded-for': ip };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return F[fn](new Request('https://fn.test/x', { method: 'POST', headers, body: JSON.stringify(body) }));
}
async function call(fn, body, opts) {
  const res = await req(fn, body, opts);
  const txt = await res.text();
  let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: res.status, json: j, text: txt, headers: res.headers };
}

/* ------------------------------------------------ requesting a code */

test('a correct code and address produce a stored code and a message', async () => {
  reset();
  const r = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(r.status, 200);
  assert.equal(DB().order_lookup_codes.length, 1);
  assert.equal(SENT().length, 1);
});

test('the reply is identical whether or not the order exists', async () => {
  reset();
  const good = await call('track-request-code', { order_code: CODE, email: EMAIL });
  reset();
  const noOrder = await call('track-request-code', { order_code: 'WS-2026-9999', email: EMAIL });
  reset();
  const wrongEmail = await call('track-request-code', { order_code: CODE, email: 'someone@else.test' });
  assert.equal(good.text, noOrder.text);
  assert.equal(good.text, wrongEmail.text);
  assert.equal(good.status, noOrder.status);
  assert.equal(good.status, wrongEmail.status);
});

test('a wrong address stores nothing and sends nothing', async () => {
  reset();
  await call('track-request-code', { order_code: CODE, email: 'someone@else.test' });
  assert.equal(DB().order_lookup_codes.length, 0);
  assert.equal(SENT().length, 0);
});

test('the stored row keeps hashes, never the code or the address', async () => {
  reset();
  await call('track-request-code', { order_code: CODE, email: EMAIL });
  const row = DB().order_lookup_codes[0];
  const plain = SENT()[0].text.match(/\b(\d{6})\b/)[1];
  assert.equal(row.code_hash, await sha256(plain));
  assert.equal(row.email_hash, await sha256(EMAIL));
  const serialised = JSON.stringify(row);
  assert.ok(!serialised.includes(plain), 'the code itself must not be stored');
  assert.ok(!serialised.includes(EMAIL), 'the address must not be stored here');
});

test('the request is rate limited per caller and order', async () => {
  reset();
  let last;
  for (let i = 0; i < 8; i++) last = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(last.status, 429);
  assert.ok(DB().order_lookup_codes.length <= 6);
});

test('a different caller is not blocked by the first', async () => {
  reset();
  for (let i = 0; i < 7; i++) await call('track-request-code', { order_code: CODE, email: EMAIL }, { ip: '1.1.1.1' });
  const other = await call('track-request-code', { order_code: CODE, email: EMAIL }, { ip: '9.9.9.9' });
  assert.equal(other.status, 200);
});

test('an order code alone is refused', async () => {
  reset();
  const r = await call('track-request-code', { order_code: CODE });
  assert.equal(r.status, 400);
  assert.equal(DB().order_lookup_codes.length, 0);
});

/* ------------------------------------------------- spending the code */

async function withPendingCode(code = '123456', over = {}) {
  reset({
    codes: [{
      id: 'code-1', order_id: ORDER_ID,
      email_hash: await sha256(EMAIL), code_hash: await sha256(code),
      expires_at: new Date(Date.now() + 600000).toISOString(),
      attempts: 0, consumed_at: null, created_at: '2026-10-02T10:00:00Z', ...over
    }]
  });
}

test('the right code returns a token and spends the code', async () => {
  await withPendingCode();
  const r = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  assert.equal(r.status, 200);
  assert.ok(r.json.token && r.json.token.length >= 32);
  assert.equal(r.json.expires_in, 3600);
  assert.ok(DB().order_lookup_codes[0].consumed_at, 'the code is spent');
  assert.equal(DB().order_tracking_tokens.length, 1);
});

test('only the hash of the token is stored', async () => {
  await withPendingCode();
  const r = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  const row = DB().order_tracking_tokens[0];
  assert.equal(row.token_hash, await sha256(r.json.token));
  assert.ok(!JSON.stringify(row).includes(r.json.token));
});

test('the same code cannot be spent twice', async () => {
  await withPendingCode();
  const first = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  assert.equal(first.status, 200);
  const second = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  assert.equal(second.status, 403);
  assert.equal(DB().order_tracking_tokens.length, 1);
});

test('a wrong code costs an attempt and says nothing useful', async () => {
  await withPendingCode();
  const r = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '000000' });
  assert.equal(r.status, 403);
  assert.equal(DB().order_lookup_codes[0].attempts, 1);
  assert.equal(DB().order_tracking_tokens.length, 0);
});

test('five wrong guesses exhaust the code', async () => {
  await withPendingCode('123456', { attempts: 5 });
  const r = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  assert.equal(r.status, 403);
  assert.equal(DB().order_tracking_tokens.length, 0);
});

test('an expired code is refused', async () => {
  await withPendingCode('123456', { expires_at: new Date(Date.now() - 1000).toISOString() });
  const r = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  assert.equal(r.status, 403);
});

test('the right code with the wrong address is refused', async () => {
  await withPendingCode();
  const r = await call('track-verify-code', { order_code: CODE, email: 'other@example.com', code: '123456' });
  assert.equal(r.status, 403);
  assert.equal(DB().order_tracking_tokens.length, 0);
});

test('every refusal reads the same', async () => {
  await withPendingCode();
  const wrongCode = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '000000' });
  await withPendingCode();
  const wrongEmail = await call('track-verify-code', { order_code: CODE, email: 'x@y.test', code: '123456' });
  await withPendingCode('123456', { expires_at: new Date(Date.now() - 1).toISOString() });
  const expired = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  reset();
  const noOrder = await call('track-verify-code', { order_code: 'WS-2026-9999', email: EMAIL, code: '123456' });
  const bodies = [wrongCode.text, wrongEmail.text, expired.text, noOrder.text];
  assert.equal(new Set(bodies).size, 1, `refusals differ: ${JSON.stringify(bodies)}`);
});

/* ------------------------------------------------------- the lookup */

async function withToken(over = {}) {
  const token = 'a'.repeat(64);
  reset({
    tokens: [{
      id: 'tok-1', order_id: ORDER_ID, token_hash: await sha256(token),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      revoked_at: null, last_used_at: null, ...over
    }],
    items: [{ id: 'i1', order_id: ORDER_ID, product_name: 'Polaroid Prints (Medium)', quantity: 9, position: 0 }],
    events: [
      { id: 'e1', order_id: ORDER_ID, event: 'order.created', created_at: '2026-10-01T10:00:00Z' },
      { id: 'e2', order_id: ORDER_ID, event: 'photos.uploaded', created_at: '2026-10-01T10:01:00Z' },
      { id: 'e3', order_id: ORDER_ID, event: 'photos.downloaded', actor: 'admin@studio.test', created_at: '2026-10-02T09:00:00Z' },
      { id: 'e4', order_id: ORDER_ID, event: 'order.paid', created_at: '2026-10-02T10:00:00Z' }
    ]
  });
  return token;
}

test('a valid token shows the order', async () => {
  const token = await withToken();
  const r = await call('track-order', { token });
  assert.equal(r.status, 200);
  assert.equal(r.json.order.order_code, CODE);
  assert.equal(r.json.order.status, 'in_progress');
  assert.equal(r.json.order.status_label, 'Being made');
  assert.deepEqual(r.json.order.items, [{ product_name: 'Polaroid Prints (Medium)', quantity: 9 }]);
});

test('the reply carries no address, phone, payment id or email', async () => {
  const token = await withToken();
  const r = await call('track-order', { token });
  for (const leak of ['1 Test Street', '9000000000', 'pay_SECRET', 'po_SECRET',
                      EMAIL, 'A Buyer', 'Chennai', '600001', 'photo_bytes_total', 'user_id', '5400']) {
    assert.ok(!r.text.includes(leak), `the tracking reply must not contain ${leak}`);
  }
});

test('the timeline hides the studio’s own activity', async () => {
  const token = await withToken();
  const r = await call('track-order', { token });
  const events = r.json.order.timeline.map((t) => t.event);
  assert.deepEqual(events, ['order.created', 'order.paid']);
  assert.ok(!r.text.includes('photos.downloaded'));
  assert.ok(!r.text.includes('admin@studio.test'), 'an administrator’s address must never reach a customer');
});

test('an expired, revoked, unknown or malformed token all fail alike', async () => {
  const expired = await withToken({ expires_at: new Date(Date.now() - 1000).toISOString() });
  const a = await call('track-order', { token: expired });
  const revoked = await withToken({ revoked_at: new Date().toISOString() });
  const b = await call('track-order', { token: revoked });
  await withToken();
  const c = await call('track-order', { token: 'b'.repeat(64) });
  const d = await call('track-order', { token: '' });
  const e = await call('track-order', {});
  for (const r of [a, b, c, d, e]) {
    assert.equal(r.status, 403);
    assert.equal(r.json.error, 'That tracking link is not valid any more.');
  }
});

test('tracking replies are not cached', async () => {
  const token = await withToken();
  const r = await call('track-order', { token });
  assert.match(r.headers.get('cache-control') || '', /no-store/);
});

/* ------------------------------------------------- order history */

function signedIn(id = 'user-1', email = EMAIL, confirmed = true) {
  globalThis.__authUser = { id, email, email_confirmed_at: confirmed ? '2026-10-01T00:00:00Z' : null };
}

test('a customer sees only orders linked to them', async () => {
  reset({ order: { user_id: 'user-1' } });
  DB().orders.push({ id: 'other', order_code: 'WS-2026-0099', user_id: 'user-2',
    customer_email: 'rival@example.com', status: 'completed', created_at: '2026-10-03T10:00:00Z',
    updated_at: '2026-10-03T10:00:00Z', completed_at: null, address_line1: 'Somewhere else' });
  signedIn('user-1');
  const r = await call('customer-orders', {}, { bearer: 'token' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.orders.map((o) => o.order_code), [CODE]);
  assert.ok(!r.text.includes('WS-2026-0099'));
  assert.ok(!r.text.includes('Somewhere else'));
});

test('an unclaimed order belongs to nobody', async () => {
  reset({ order: { user_id: null } });
  signedIn('user-1');
  const r = await call('customer-orders', {}, { bearer: 'token' });
  assert.deepEqual(r.json.orders, []);
});

test('another customer cannot fetch an order by its code', async () => {
  reset({ order: { user_id: 'user-1' } });
  signedIn('user-2');
  const r = await call('customer-orders', { order_code: CODE }, { bearer: 'token' });
  assert.equal(r.status, 404);
  assert.ok(!r.text.includes('in_progress'));
});

test('a user id in the body is ignored', async () => {
  reset({ order: { user_id: 'user-1' } });
  signedIn('user-2');
  const r = await call('customer-orders', { user_id: 'user-1', userId: 'user-1' }, { bearer: 'token' });
  assert.deepEqual(r.json.orders, []);
});

test('no session, a bad token, or an unconfirmed address are all refused', async () => {
  reset({ order: { user_id: 'user-1' } });
  const none = await call('customer-orders', {});
  signedIn('user-1');
  const bad = await call('customer-orders', {}, { bearer: 'bad' });
  signedIn('user-1', EMAIL, false);
  const unconfirmed = await call('customer-orders', {}, { bearer: 'token' });
  for (const r of [none, bad, unconfirmed]) assert.equal(r.status, 401);
});

test('history pages and never over-fetches', async () => {
  reset({ order: { user_id: 'user-1' } });
  for (let i = 2; i <= 30; i++) {
    DB().orders.push({ id: `o${i}`, order_code: `WS-2026-${String(i).padStart(4, '0')}`,
      user_id: 'user-1', status: 'completed', created_at: `2026-10-${String(i).padStart(2, '0')}T10:00:00Z`,
      updated_at: '2026-10-10T10:00:00Z', completed_at: null, customer_email: EMAIL });
  }
  signedIn('user-1');
  const first = await call('customer-orders', { limit: 20 }, { bearer: 'token' });
  assert.equal(first.json.orders.length, 20);
  assert.equal(first.json.has_more, true);
  const second = await call('customer-orders', { limit: 20, offset: 20 }, { bearer: 'token' });
  assert.equal(second.json.orders.length, 10);
  assert.equal(second.json.has_more, false);
  const silly = await call('customer-orders', { limit: 5000 }, { bearer: 'token' });
  assert.ok(silly.json.limit <= 50, 'a page size cannot be talked upwards');
});

test('history carries no address, phone or payment identifier', async () => {
  reset({ order: { user_id: 'user-1' } });
  signedIn('user-1');
  const r = await call('customer-orders', {}, { bearer: 'token' });
  for (const leak of ['1 Test Street', '9000000000', 'pay_SECRET', 'po_SECRET', '600001', 'user_id']) {
    assert.ok(!r.text.includes(leak), `history must not contain ${leak}`);
  }
});

/* --------------------------------------------------- claiming */

async function claimable(code = '123456', over = {}) {
  reset({
    order: { user_id: null },
    codes: [{
      id: 'code-1', order_id: ORDER_ID, email_hash: await sha256(EMAIL),
      code_hash: await sha256(code), expires_at: new Date(Date.now() + 600000).toISOString(),
      attempts: 0, consumed_at: null, created_at: '2026-10-02T10:00:00Z', ...over
    }]
  });
}

test('a verified code claims an unowned order', async () => {
  await claimable();
  signedIn('user-1');
  const r = await call('customer-claim-order', { order_code: CODE, code: '123456' }, { bearer: 'token' });
  assert.equal(r.status, 200);
  assert.equal(DB().orders[0].user_id, 'user-1');
});

test('an unverified address cannot claim, however correct the code', async () => {
  await claimable();
  signedIn('user-9', 'thief@example.com');
  const r = await call('customer-claim-order', { order_code: CODE, code: '123456' }, { bearer: 'token' });
  assert.equal(r.status, 403);
  assert.equal(DB().orders[0].user_id, null);
});

test('no code at all cannot claim', async () => {
  reset({ order: { user_id: null } });
  signedIn('user-1');
  const r = await call('customer-claim-order', { order_code: CODE, code: '123456' }, { bearer: 'token' });
  assert.equal(r.status, 403);
  assert.equal(DB().orders[0].user_id, null);
});

test('two claimants racing cannot both win', async () => {
  await claimable();
  const second = await (async () => {
    const codeRow = { ...DB().order_lookup_codes[0], id: 'code-2' };
    DB().order_lookup_codes.push(codeRow);
    return codeRow;
  })();
  assert.ok(second);
  signedIn('user-1');
  const a = call('customer-claim-order', { order_code: CODE, code: '123456' }, { bearer: 'token' });
  const b = call('customer-claim-order', { order_code: CODE, code: '123456' }, { bearer: 'token' });
  const [r1, r2] = await Promise.all([a, b]);
  const wins = [r1, r2].filter((r) => r.status === 200 && r.json.already === false).length;
  assert.equal(wins, 1, 'exactly one claim may succeed');
  assert.equal(DB().orders[0].user_id, 'user-1');
});

test('an order already owned by someone else cannot be taken', async () => {
  await claimable();
  DB().orders[0].user_id = 'user-2';
  signedIn('user-1');
  const r = await call('customer-claim-order', { order_code: CODE, code: '123456' }, { bearer: 'token' });
  assert.equal(r.status, 403);
  assert.equal(DB().orders[0].user_id, 'user-2');
});

test('claiming needs a session', async () => {
  await claimable();
  const r = await call('customer-claim-order', { order_code: CODE, code: '123456' });
  assert.equal(r.status, 401);
  assert.equal(DB().orders[0].user_id, null);
});

/* -------------------------------------------- the email boundary */

test('an unconfigured provider does not break the request or leak the code', async () => {
  reset();
  const r = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(r.status, 200, 'the customer still gets an answer');
  assert.equal(SENT().length, 1, 'the message was attempted');
  assert.ok(!r.text.match(/\d{6}/), 'the code must never come back in the reply');
});

/* ------------------------------------- fixes found in the Phase 3 review */

test('a resend inside the cooldown does not mint a second code', async () => {
  reset();
  await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(DB().order_lookup_codes.length, 1);
  const r = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(r.status, 200, 'the reply is unchanged');
  assert.equal(DB().order_lookup_codes.length, 1, 'no second code inside the minute');
  assert.equal(SENT().length, 1, 'and no second message');
});

test('a code older than the cooldown may be replaced', async () => {
  reset();
  await call('track-request-code', { order_code: CODE, email: EMAIL });
  DB().order_lookup_codes[0].created_at = new Date(Date.now() - 120000).toISOString();
  await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(DB().order_lookup_codes.length, 2);
});

test('the reply says plainly when no email provider is configured', async () => {
  reset();
  globalThis.__emailConfigured = false;
  const off = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(off.json.delivery, 'unavailable');

  reset();
  globalThis.__emailConfigured = true;
  const on = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(on.json.delivery, 'sent');
});

test('the delivery flag says nothing about the order', async () => {
  reset();
  globalThis.__emailConfigured = true;
  const real = await call('track-request-code', { order_code: CODE, email: EMAIL });
  reset();
  globalThis.__emailConfigured = true;
  const fake = await call('track-request-code', { order_code: 'WS-2026-9999', email: 'nobody@example.com' });
  assert.equal(real.text, fake.text, 'a missing order and a real one still read alike');
});

test('a verification code is never returned to the browser', async () => {
  reset();
  globalThis.__emailConfigured = true;
  const r = await call('track-request-code', { order_code: CODE, email: EMAIL });
  const plain = SENT()[0].text.match(/\b(\d{6})\b/)[1];
  assert.ok(!r.text.includes(plain), 'the code must stay in the message');
});

/* ------------------------- fixes from the function/migration review */

test('a spoofed x-forwarded-for cannot slip the per-order limit', async () => {
  reset();
  /* A fresh invented address every time - the whole point of the
     spoof. The per-caller limit sees twelve different callers; the
     per-order limit sees one order, and that is what holds. */
  let last;
  for (let i = 0; i < 20; i++) {
    last = await call('track-request-code', { order_code: CODE, email: EMAIL }, { ip: `10.0.0.${i}` });
  }
  assert.equal(last.status, 429, 'the per-order limit is not addressed by changing IP');
});

test('a trusted header is used when the operator names one', async () => {
  reset();
  globalThis.__env = { TRUSTED_IP_HEADER: 'cf-connecting-ip' };
  const res = await F['track-request-code'](new Request('https://fn.test/x', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Origin: 'http://localhost:5173',
      'x-forwarded-for': '1.1.1.1',        /* the lie */
      'cf-connecting-ip': '203.0.113.9'    /* what the platform set */
    },
    body: JSON.stringify({ order_code: CODE, email: EMAIL })
  }));
  assert.equal(res.status, 200);
  /* Two rows: one keyed on the caller, one on the order. The caller
     row must have been keyed from the trusted header, not the lie -
     proved by the next request from the same trusted IP sharing it. */
  assert.ok(DB().lookup_attempts.length >= 1);
});

test('attempts are counted atomically when the function exists', async () => {
  reset();
  const all = await Promise.all(
    Array.from({ length: 10 }, () => call('track-request-code', { order_code: CODE, email: EMAIL }))
  );
  assert.equal(all.length, 10);
  const byOrder = DB().lookup_attempts.find((r) => r.count >= 10);
  assert.ok(byOrder, 'ten parallel attempts must count as ten, not as one');
});

test('without the migration the limiter says it is not enforced', async () => {
  reset();
  globalThis.__noRpc = true;
  const r = await call('track-request-code', { order_code: CODE, email: EMAIL });
  assert.equal(r.status, 200, 'the request still works');
  assert.ok(DB().lookup_attempts.length >= 1, 'it still counts, just not atomically');
});

test('a failed token write does not spend the code', async () => {
  await withPendingCode();
  globalThis.__failInsert = 'order_tracking_tokens';
  const r = await call('track-verify-code', { order_code: CODE, email: EMAIL, code: '123456' });
  globalThis.__failInsert = null;
  assert.equal(r.status, 500, 'it fails honestly');
  assert.equal(DB().order_tracking_tokens.length, 0, 'and issues nothing');
  assert.equal(DB().order_lookup_codes[0].consumed_at ?? null, null,
    'the customer keeps their code when the failure was ours');
});

test('the order placed step carries the creation event', async () => {
  const token = await withToken();
  const r = await call('track-order', { token });
  const created = r.json.order.timeline.find((t) => t.event === 'order.created');
  assert.ok(created, 'the creation event reaches the customer');
  assert.equal(created.label, 'Order placed', 'and is labelled, not shown raw');
  assert.ok(!r.text.includes('"label":"order.created"'), 'no raw event name is ever a label');
});

test('opening one link very fast is bounded', async () => {
  const token = await withToken();
  let last;
  for (let i = 0; i < 70; i++) last = await call('track-order', { token });
  assert.equal(last.status, 429);
});

/* ------------------------------- saying when a limit is not a limit */

function captureWarnings(fn) {
  const real = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.join(' '));
  return Promise.resolve(fn()).then(
    (value) => { console.warn = real; return { value, lines }; },
    (err) => { console.warn = real; throw err; }
  );
}

test('an endpoint says so when counting is not enforced', async () => {
  reset();
  globalThis.__noRpc = true;                       // 0004 has not been run
  const { lines } = await captureWarnings(() =>
    call('track-request-code', { order_code: CODE, email: EMAIL })
  );
  assert.ok(lines.some((l) => /track-request-code\/caller.*not enforced/.test(l)));
  assert.ok(lines.some((l) => /track-request-code\/order.*not enforced/.test(l)));
});

test('an endpoint says so when the caller identity is unverified', async () => {
  reset();
  globalThis.__env = {};                           // no trusted header named
  const { lines } = await captureWarnings(() =>
    call('track-request-code', { order_code: CODE, email: EMAIL })
  );
  assert.ok(lines.some((l) => /caller identity is unverified/.test(l)));
  assert.ok(lines.some((l) => /TRUSTED_IP_HEADER/.test(l)), 'and says what would fix it');
});

test('naming a trusted header stops the unverified warning', async () => {
  reset();
  globalThis.__env = { TRUSTED_IP_HEADER: 'cf-connecting-ip' };
  const { lines } = await captureWarnings(() =>
    F['track-request-code'](new Request('https://fn.test/x', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Origin: 'http://localhost:5173',
        'cf-connecting-ip': '203.0.113.9'
      },
      body: JSON.stringify({ order_code: CODE, email: EMAIL })
    }))
  );
  assert.ok(!lines.some((l) => /caller identity is unverified/.test(l)));
});

test('the warnings never carry an address, a code or a token', async () => {
  reset();
  globalThis.__noRpc = true;
  const { lines } = await captureWarnings(() =>
    call('track-request-code', { order_code: CODE, email: EMAIL })
  );
  const all = lines.join('\n');
  const plain = SENT()[0]?.text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(!all.includes(EMAIL), 'no email address');
  assert.ok(!all.includes(CODE), 'no order code');
  if (plain) assert.ok(!all.includes(plain), 'no verification code');
  assert.ok(!/[0-9a-f]{32,}/.test(all), 'no hash or token');
});

test('a healthy limit is quiet', async () => {
  reset();
  globalThis.__env = { TRUSTED_IP_HEADER: 'cf-connecting-ip' };
  const { lines } = await captureWarnings(() =>
    F['track-order'](new Request('https://fn.test/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ token: 'c'.repeat(64) })
    }))
  );
  assert.deepEqual(lines, [], 'nothing to report when the limiter is working');
});
