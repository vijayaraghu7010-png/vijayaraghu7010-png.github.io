import test from 'node:test';
import assert from 'node:assert/strict';

import { entriesForStep, OWN_EVENT, stepStateFor, TRACK_STEPS } from '../src/lib/orderProgress.js';
import { telHref, whatsappNumber, whatsappHref } from '../src/utils/phone.js';

/* What the tracking page shows, and the one number the studio types.

   Both of these were places where the right data existed and the
   page threw it away. track-order has always sent the payment
   events; the timeline looked only for `order.<step>` and so dropped
   every one of them. The panel has always had a `contact.phone`
   field; the footer read a hardcoded constant and so never saw it. */

const TIMELINE = [
  { event: 'order.created', label: 'Order placed', at: '2026-11-03T08:37:59Z' },
  { event: 'payment.submitted', label: 'Payment submitted', at: '2026-11-03T08:39:51Z' },
  { event: 'payment.rejected', label: 'Payment could not be confirmed', at: '2026-11-03T08:40:00Z' },
  { event: 'order.paid', label: 'Payment received', at: '2026-11-03T08:42:01Z' },
  /* Not a customer-facing event, and never sent - here to prove
     nothing is shown just because it is in the list. */
  { event: 'photos.downloaded', label: 'photos.downloaded', at: '2026-11-03T09:00:00Z' }
];

test('a payment that was submitted is shown, not dropped', () => {
  const paid = entriesForStep('paid', TIMELINE).map((e) => e.event);
  assert.ok(paid.includes('payment.submitted'), 'the customer must see that the studio has their details');
});

test('a payment that was refused is shown, not dropped', () => {
  const paid = entriesForStep('paid', TIMELINE).map((e) => e.event);
  assert.ok(paid.includes('payment.rejected'), 'a refusal the customer must act on cannot be silent');
});

test('payment entries sit under the payment step and nowhere else', () => {
  for (const step of ['pending', 'in_progress', 'completed']) {
    const events = entriesForStep(step, TIMELINE).map((e) => e.event);
    assert.ok(
      events.every((e) => !e.startsWith('payment.')),
      `${step} should carry no payment entries, got ${events.join(',')}`
    );
  }
});

test('an event no step claims is shown nowhere', () => {
  const everywhere = TRACK_STEPS.flatMap((s) => entriesForStep(s.id, TIMELINE)).map((e) => e.event);
  assert.ok(!everywhere.includes('photos.downloaded'));
});

test('every step has an event of its own, and it is one the step claims', () => {
  for (const step of TRACK_STEPS) {
    const own = OWN_EVENT[step.id];
    assert.ok(own, `${step.id} should name its own event`);
    const claimed = entriesForStep(step.id, [{ event: own, label: step.label, at: 'x' }]);
    assert.equal(claimed.length, 1, `${step.id} should claim ${own}`);
  }
});

test('an ordinary order still shows one bare time per step', () => {
  const plain = [{ event: 'order.created', label: 'Order placed', at: 'x' }];
  const entries = entriesForStep('pending', plain);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].event, OWN_EVENT.pending, 'so the label is not repeated under its own heading');
});

test('a cancelled order is not walked further along the line', () => {
  for (const step of TRACK_STEPS) {
    assert.equal(stepStateFor('cancelled', step.id), 'cancelled');
  }
});

/* ------------------------------------------------- the studio's number */

test('a number typed with spaces still dials', () => {
  assert.equal(telHref('+91 99406 41271'), 'tel:+919940641271');
  assert.equal(telHref('099406-41271'), 'tel:09940641271');
  assert.equal(telHref('(044) 2345 6789'), 'tel:04423456789');
});

test('WhatsApp gets digits only, and always a country code', () => {
  assert.equal(whatsappNumber('+91 99406 41271'), '919940641271');
  /* Ten digits is a bare Indian mobile; wa.me fails quietly without
     the code, which is the failure this exists to prevent. */
  assert.equal(whatsappNumber('99406 41271'), '919940641271');
  assert.equal(whatsappHref('+91 99406 41271'), 'https://wa.me/919940641271');
});

test('an empty number produces no link at all, rather than a broken one', () => {
  for (const blank of ['', '   ', null, undefined, 'not a number']) {
    assert.equal(telHref(blank), '');
    assert.equal(whatsappNumber(blank), '');
    assert.equal(whatsappHref(blank), '');
  }
});
