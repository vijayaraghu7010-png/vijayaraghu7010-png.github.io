import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerFunction } from './harness/build.mjs';

/* The manual UPI payment flow, run against the real functions.

   One claim runs through all of it: a customer says they sent money
   and gives a reference number and a screenshot. The thing these
   tests are really about is what that claim is NOT allowed to do -
   it must not move the order, must not be accepted twice, must not
   point at somebody else's file, and must not become 'paid' without
   an administrator saying they saw the credit.

   _shared/payments.ts is not replaced. The gate, the ownership check
   and the reference-number rules are the point of the exercise, so
   they are the shipping ones. The database and the bucket are
   doubles, and nothing here touches Supabase, R2 or a real order. */

const F = {};
for (const name of ['payments-config', 'payments-presign', 'payments-submit', 'payments-admin']) {
  const url = await buildCustomerFunction(name);
  let captured;
  globalThis.Deno = { serve: (fn) => { captured = fn; }, env: { get: (k) => globalThis.__env?.[k] } };
  await import(url);
  F[name] = captured;
  assert.ok(captured, `${name} should register a handler`);
}

const DB = () => globalThis.__db;

const ORDER_ID = 'order-pay-1';
const CODE = 'WS-2026-0101';
const TOKEN = 'a'.repeat(64);
const ADMIN = 'admin@studio.test';
const TOTAL = 99900;

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function reset({ order = {}, upi = {}, payments = [] } = {}) {
  globalThis.__db = {
    orders: [{
      id: ORDER_ID, order_code: CODE, status: 'pending', payment_status: 'unpaid',
      user_id: null, customer_name: 'A Buyer', customer_email: 'buyer@example.com',
      total_paise: TOTAL, created_at: '2026-10-01T10:00:00Z', ...order
    }],
    order_items: [], order_events: [], order_payments: payments, order_payment_events: [],
    order_tracking_tokens: [{
      id: 'tok-1', order_id: ORDER_ID, token_hash: await sha256(TOKEN),
      expires_at: new Date(Date.now() + 86400000).toISOString(), revoked_at: null
    }],
    order_lookup_codes: [], lookup_attempts: [],
    settings: [{
      key: 'payments.upi',
      value: {
        enabled: true, upi_id: 'wrappedstudio@okaxis', display_name: 'WrappedStudio',
        qr_asset: '/images/payments/upi-qr.png', apps: ['gpay', 'phonepe', 'paytm'], ...upi
      }
    }]
  };
  globalThis.__authUser = null;
  globalThis.__admin = null;
  globalThis.__dbCalls = [];
  globalThis.__noRpc = false;
  globalThis.__env = {};
  globalThis.__r2 = {};
}

async function call(name, body, { admin = null, origin = 'http://localhost:5173' } = {}) {
  globalThis.__admin = admin;
  const res = await F[name](new Request('https://functions.test/' + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body ?? {})
  }));
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* some replies are not json */ }
  return { status: res.status, json, text };
}

/* The three steps a customer takes, as one helper. The bucket is told
   the file arrived unless a test says otherwise. */
async function pay({ utr = '123456789012', method = 'gpay', arrives = true, note = '' } = {}) {
  const slot = await call('payments-presign', {
    token: TOKEN, content_type: 'image/jpeg', byte_size: 51200
  });
  if (slot.status !== 200) return { slot, submit: null };

  if (arrives) globalThis.__r2[slot.json.proof_key] = 51200;

  const submit = await call('payments-submit', {
    token: TOKEN, method, utr, note,
    proof_key: slot.json.proof_key, proof_content_type: 'image/jpeg'
  });
  return { slot, submit };
}

// ------------------------------------------------ what a claim may do

test('a submitted payment is recorded without moving the order', async () => {
  await reset();
  const { submit } = await pay();

  assert.equal(submit.status, 201, 'the claim is accepted');
  assert.equal(DB().order_payments.length, 1, 'and written down');
  assert.equal(DB().order_payments[0].status, 'submitted');

  const order = DB().orders[0];
  assert.equal(order.status, 'pending', 'the order has not moved');
  assert.equal(order.payment_status, 'unpaid', 'and is not paid');
  assert.equal(order.payment_id ?? null, null, 'no payment id is attached yet');
});

test('the amount is the order’s, not the browser’s', async () => {
  await reset();
  const slot = await call('payments-presign', {
    token: TOKEN, content_type: 'image/jpeg', byte_size: 1024
  });
  globalThis.__r2[slot.json.proof_key] = 1024;

  const submit = await call('payments-submit', {
    token: TOKEN, method: 'gpay', utr: '111111111111',
    amount_paise: 1, total_paise: 1,          // both ignored
    proof_key: slot.json.proof_key, proof_content_type: 'image/jpeg'
  });

  assert.equal(submit.status, 201);
  assert.equal(DB().order_payments[0].amount_paise, TOTAL, 'the order decides what is owed');
});

test('the customer is never told who decided, or where the file went', async () => {
  await reset();
  const { submit } = await pay();
  assert.ok(!submit.text.includes('payments/'), 'no bucket key reaches the browser');
  for (const leak of ['decided_by', 'proof_r2_key', ADMIN]) {
    assert.ok(!submit.text.includes(leak), `the reply must not contain ${leak}`);
  }
});

test('a screenshot that never arrived is refused', async () => {
  await reset();
  const { submit } = await pay({ arrives: false });
  assert.equal(submit.status, 409);
  assert.equal(DB().order_payments.length, 0, 'nothing is recorded pointing at nothing');
});

test('a proof key from another order is refused', async () => {
  await reset();
  globalThis.__r2['payments/someone-else/forged.jpg'] = 1024;

  const submit = await call('payments-submit', {
    token: TOKEN, method: 'gpay', utr: '222222222222',
    proof_key: 'payments/someone-else/forged.jpg', proof_content_type: 'image/jpeg'
  });

  assert.equal(submit.status, 400);
  assert.equal(DB().order_payments.length, 0);
});

test('a reference number that is not one is refused', async () => {
  await reset();
  /* Spaces are forgiven - banks print the number in groups of four -
     and everything else is not. The alphabet is deliberately loose,
     because a few rails use letters; what is refused is anything that
     could be a path, a fragment of markup or a query. */
  for (const utr of ['', 'abc', 'ab/../cd', '<script>x</script>', '1234;drop', 'e'.repeat(41)]) {
    const { submit } = await pay({ utr });
    assert.equal(submit.status, 400, `${utr || '(empty)'} should not be accepted`);
  }
  assert.equal(DB().order_payments.length, 0);

  const spaced = await pay({ utr: '1234 5678 9012' });
  assert.equal(spaced.submit.status, 201, 'a number copied with spaces in it is still a number');
  assert.equal(DB().order_payments[0].utr, '123456789012', 'and is stored without them');
});

test('a second claim is refused while one is being checked', async () => {
  await reset();
  await pay({ utr: '333333333333' });

  const again = await pay({ utr: '444444444444' });
  assert.equal(again.slot.status, 409, 'and refused before a file is uploaded');
  assert.equal(DB().order_payments.length, 1);
});

test('a cancelled order takes no payment', async () => {
  await reset({ order: { status: 'cancelled' } });
  const { slot } = await pay();
  assert.equal(slot.status, 409);
  assert.equal(DB().order_payments.length, 0);
});

test('an order already paid takes no payment', async () => {
  await reset({ order: { status: 'paid', payment_status: 'paid' } });
  const { slot } = await pay();
  assert.equal(slot.status, 409);
});

test('a token that is not this order’s reaches nothing', async () => {
  await reset();
  const slot = await call('payments-presign', {
    token: 'b'.repeat(64), content_type: 'image/jpeg', byte_size: 1024
  });
  assert.equal(slot.status, 403);
});

// ------------------------------------------------- where to pay

test('while payment is off, no address is given out', async () => {
  await reset({ upi: { enabled: false } });

  const config = await call('payments-config', {});
  assert.equal(config.json.upi.enabled, false);
  assert.ok(!config.text.includes('okaxis'), 'a disabled UPI ID is not sent to a browser');

  const slot = await call('payments-presign', {
    token: TOKEN, content_type: 'image/jpeg', byte_size: 1024
  });
  assert.equal(slot.status, 503, 'and nothing can be submitted against it');
});

test('a UPI id with no address behind it is not enabled', async () => {
  await reset({ upi: { enabled: true, upi_id: '' } });
  const config = await call('payments-config', {});
  assert.equal(config.json.upi.enabled, false, 'enabled with nowhere to pay is not enabled');
});

test('the payment page is told the amount and the state', async () => {
  await reset();
  const config = await call('payments-config', { token: TOKEN });
  assert.equal(config.json.order.amount_paise, TOTAL);
  assert.equal(config.json.order.order_code, CODE);
  assert.equal(config.json.payment, null, 'nothing submitted yet');
});

// ------------------------------------------------- the decision

test('only an administrator may decide', async () => {
  await reset();
  await pay();
  const id = DB().order_payments[0].id;

  const refused = await call('payments-admin', { action: 'decide', payment_id: id, decision: 'verify' });
  assert.equal(refused.status, 403);
  assert.equal(DB().orders[0].status, 'pending', 'and nothing moved');
});

test('verifying marks the order paid and says who did it', async () => {
  await reset();
  await pay({ utr: '555555555555' });
  const id = DB().order_payments[0].id;

  const done = await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'verify' },
    { admin: ADMIN }
  );

  assert.equal(done.status, 200);
  assert.equal(done.json.order_status, 'paid');

  const payment = DB().order_payments[0];
  assert.equal(payment.status, 'verified');
  assert.equal(payment.decided_by, ADMIN, 'a decision has a decider');
  assert.ok(payment.decided_at, 'and a time');

  const order = DB().orders[0];
  assert.equal(order.status, 'paid');
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.payment_provider, 'upi');
  assert.equal(order.payment_id, '555555555555');

  assert.ok(DB().order_events.some((e) => e.event === 'order.paid' && e.actor === ADMIN),
    'the order’s own history records it');
  assert.ok(DB().order_payment_events.some((e) => e.event === 'payment.verified'),
    'and so does the payment’s');
});

test('a decision cannot be made twice', async () => {
  await reset();
  await pay();
  const id = DB().order_payments[0].id;

  await call('payments-admin', { action: 'decide', payment_id: id, decision: 'verify' }, { admin: ADMIN });
  const again = await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'reject', note: 'changed my mind' },
    { admin: ADMIN }
  );

  assert.equal(again.status, 409);
  assert.equal(DB().order_payments[0].status, 'verified', 'the first decision stands');
});

test('rejecting needs a reason and leaves the order alone', async () => {
  await reset();
  await pay();
  const id = DB().order_payments[0].id;

  const bare = await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'reject' },
    { admin: ADMIN }
  );
  assert.equal(bare.status, 400, 'a refusal without a reason is no use to the customer');

  const given = await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'reject', note: 'Nothing with that reference arrived.' },
    { admin: ADMIN }
  );

  assert.equal(given.status, 200);
  assert.equal(DB().order_payments[0].status, 'rejected');
  assert.equal(DB().orders[0].status, 'pending', 'the order stays where it was');
  assert.equal(DB().orders[0].payment_status, 'unpaid');
});

test('a rejected claim lets the customer try again', async () => {
  await reset();
  await pay({ utr: '666666666666' });
  const id = DB().order_payments[0].id;
  await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'reject', note: 'Wrong reference.' },
    { admin: ADMIN }
  );

  const second = await pay({ utr: '777777777777' });
  assert.equal(second.submit.status, 201, 'a refusal is not the end of the order');
  assert.equal(DB().order_payments.length, 2, 'and the first attempt is kept');
});

test('a payment for the wrong amount is not verified', async () => {
  await reset();
  await pay();
  DB().orders[0].total_paise = TOTAL + 50000;      // the studio corrected the price

  const id = DB().order_payments[0].id;
  const done = await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'verify' },
    { admin: ADMIN }
  );

  assert.equal(done.status, 409);
  assert.equal(DB().orders[0].status, 'pending');
});

test('the customer’s reason for refusal reaches them, the admin’s name does not', async () => {
  await reset();
  await pay();
  const id = DB().order_payments[0].id;
  await call(
    'payments-admin',
    { action: 'decide', payment_id: id, decision: 'reject', note: 'Please check the reference.' },
    { admin: ADMIN }
  );

  const seen = await call('payments-config', { token: TOKEN });
  assert.equal(seen.json.payment.status, 'rejected');
  assert.equal(seen.json.payment.note, 'Please check the reference.');
  assert.ok(!seen.text.includes(ADMIN), 'an administrator’s address must never reach a customer');
});

test('the studio’s UPI details cannot be set by a stranger', async () => {
  await reset({ upi: { enabled: false, upi_id: '' } });
  const refused = await call('payments-admin', {
    action: 'save_config',
    upi: { enabled: true, upi_id: 'thief@bank', display_name: 'Not The Studio' }
  });
  assert.equal(refused.status, 403);
  assert.equal(DB().settings[0].value.upi_id, '', 'nothing was changed');
});

test('payment cannot be switched on with nowhere to pay', async () => {
  await reset({ upi: { enabled: false, upi_id: '' } });
  const bare = await call(
    'payments-admin',
    { action: 'save_config', upi: { enabled: true, upi_id: '', display_name: '' } },
    { admin: ADMIN }
  );
  assert.equal(bare.status, 400);

  const bad = await call(
    'payments-admin',
    { action: 'save_config', upi: { enabled: true, upi_id: 'not an upi id', display_name: 'X' } },
    { admin: ADMIN }
  );
  assert.equal(bad.status, 400, 'a typed address is caught before a customer sees it');
});

test('the QR image must be the shop’s own file', async () => {
  await reset();
  const bad = await call(
    'payments-admin',
    {
      action: 'save_config',
      upi: {
        enabled: true, upi_id: 'studio@okaxis', display_name: 'WrappedStudio',
        qr_asset: 'https://elsewhere.example.com/qr.png'
      }
    },
    { admin: ADMIN }
  );
  assert.equal(bad.status, 400, 'a payment page must not load a QR code from another server');
});
