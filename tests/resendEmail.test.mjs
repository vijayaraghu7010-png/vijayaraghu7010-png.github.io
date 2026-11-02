import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEmail } from './harness/build.mjs';

/* Automatic post, and the rule about what may be in it.

   The real _shared/email.ts with _shared/resend.ts behind it,
   bundled. Deno's env and fetch are the only things this test
   supplies, so the branching and the wording under test are the ones
   that will go out. Nothing here reaches Resend: fetch is a function
   written below. */

const env = new Map();
globalThis.Deno = { env: { get: (k) => env.get(k) } };

let sent = [];
const realFetch = globalThis.fetch;

function respondWith(status, payload = {}) {
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
}

const email = await import(await buildEmail());

test.beforeEach(() => {
  env.clear();
  sent = [];
});

test.after(() => {
  globalThis.fetch = realFetch;
});

const LINES = [
  { product_name: 'Polaroid Prints (Medium)', quantity: 9 },
  { product_name: 'Boho Botanical Pair', quantity: 1 }
];

const NOTE = { to: 'a@b.com', subject: 's', text: 't', idempotency_key: 'k' };

// ------------------------------------------------------- the boundary

test('with no provider set, nothing is sent and it says so', async () => {
  const out = await email.sendEmail(NOTE);
  assert.equal(out.delivered, false);
  assert.equal(out.provider, 'none');
  assert.equal(out.retryable, true);
});

test('a provider nobody wrote is named, not silently ignored', async () => {
  env.set('EMAIL_PROVIDER', 'pigeon');
  const out = await email.sendEmail(NOTE);
  assert.equal(out.delivered, false);
  assert.match(out.reason, /not implemented/);
  assert.equal(out.retryable, false);
});

// -------------------------------------------------------- the sending

test('resend is given the message, the key and the From address', async () => {
  env.set('EMAIL_PROVIDER', 'resend');
  env.set('RESEND_API_KEY', 're_test');
  env.set('EMAIL_FROM', 'WrappedStudio <orders@wrappedstudio.in>');
  respondWith(200, { id: 'abc' });

  const out = await email.sendEmail({
    to: 'customer@example.com',
    subject: 'Hello',
    text: 'Body',
    idempotency_key: 'order-1'
  });

  assert.equal(out.delivered, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.from, 'WrappedStudio <orders@wrappedstudio.in>');
  assert.deepEqual(sent[0].body.to, ['customer@example.com']);
  assert.equal(
    sent[0].init.headers['Idempotency-Key'],
    'order-1',
    'the same request retried must not send the customer two of them'
  );
  assert.equal(sent[0].init.headers.Authorization, 'Bearer re_test');
});

test('without an api key nothing is attempted', async () => {
  env.set('EMAIL_PROVIDER', 'resend');
  respondWith(200);
  const out = await email.sendEmail(NOTE);
  assert.equal(out.delivered, false);
  assert.match(out.reason, /RESEND_API_KEY/);
  assert.equal(sent.length, 0);
});

test('an unverified From domain is not retried, a rate limit is', async () => {
  env.set('EMAIL_PROVIDER', 'resend');
  env.set('RESEND_API_KEY', 're_test');

  respondWith(403, { message: 'domain is not verified' });
  const refused = await email.sendEmail(NOTE);
  assert.equal(refused.delivered, false);
  assert.equal(refused.retryable, false, 'retrying repeats the same mistake');
  assert.match(refused.reason, /not verified/);

  respondWith(429, {});
  const limited = await email.sendEmail(NOTE);
  assert.equal(limited.retryable, true);
});

test('a network failure is reported, never thrown', async () => {
  env.set('EMAIL_PROVIDER', 'resend');
  env.set('RESEND_API_KEY', 're_test');
  globalThis.fetch = async () => {
    throw new Error('offline');
  };

  const out = await email.sendEmail(NOTE);
  assert.equal(out.delivered, false);
  assert.equal(out.retryable, true);
});

// -------------------------------------------------------- the wording

test('the order confirmation names what was bought and what it cost', () => {
  const m = email.orderPlacedMessage(
    'customer@example.com',
    'WS-2026-0042',
    LINES,
    { subtotal_paise: 5400, discount_paise: 162, total_paise: 5238 },
    'https://wrappedstudio.in/track/abc',
    'k'
  );
  assert.match(m.subject, /WS-2026-0042/);
  assert.match(m.text, /9 x Polaroid Prints \(Medium\)/);
  assert.match(m.text, /52\.38/);
  assert.match(m.text, /Discount: -/);
  assert.match(m.text, /wrappedstudio\.in\/track\/abc/);
});

test('a discount is named only when there was one', () => {
  const m = email.orderPlacedMessage(
    'c@e.com',
    'WS-1',
    LINES,
    { subtotal_paise: 5400, discount_paise: 0, total_paise: 5400 },
    'https://x/y',
    'k'
  );
  assert.doesNotMatch(m.text, /Discount/, 'a "Discount 0" line invites the question of why not');
});

test('the studio alert carries no postal address or telephone number', () => {
  const m = email.studioAlertMessage('studio@x.com', 'WS-1', 'Vedhaashree', LINES, 5238, 'k');
  assert.match(m.text, /Vedhaashree/);
  assert.match(m.subject, /52\.38/);
  assert.doesNotMatch(m.text, /\b\d{6}\b/, 'no pincode');
  assert.doesNotMatch(m.text, /\b\d{10}\b/, 'no phone number');
});

test('every status a customer is told about has words written for it', () => {
  for (const status of ['paid', 'in_progress', 'completed', 'cancelled']) {
    const m = email.orderStatusMessage('c@e.com', 'WS-1', status, 'https://x/y', 'k');
    assert.ok(m, `${status} should be announced`);
    assert.match(m.text, /WS-1/);
  }
});

test('a status with no words written is not announced at all', () => {
  assert.equal(
    email.orderStatusMessage('c@e.com', 'WS-1', 'pending', 'https://x/y', 'k'),
    null,
    'better silence than emailing somebody the word "pending"'
  );
});

test('a refused payment says what to do next', () => {
  const m = email.paymentMessage('c@e.com', 'WS-1', 'rejected', 'https://x/y', 'k');
  assert.match(m.text, /reply/i);
  assert.match(m.text, /Nothing has been taken/);
});

test('a lookup message still says nothing about the order', () => {
  /* The older, stricter rule, unchanged: this goes to an address
     somebody typed into a form, not to the address on the order. */
  const m = email.trackingCodeMessage('typed@example.com', 'WS-1', '123456', 'k');
  assert.doesNotMatch(m.text, /Polaroid/);
  assert.doesNotMatch(m.text, /Total/);
});
