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

/* ------------------------------------------------------- delivery

   The bag shows a shipping figure before the order exists, and the
   server works the same figure out again when it is placed. Two
   implementations of one sum is two chances to disagree about what
   somebody owes, so these check the browser's copy against the rules
   the server's copy follows - including the one that matters, which
   is that a free-delivery threshold is read after the offer. */

const { shippingFor, shippingIsFree, awayFromFreeShipping, normaliseShipping } =
  await import('../src/utils/shipping.js');

const ON = (over = {}) => ({ enabled: true, flat_paise: 6000, free_above_paise: null, note: '', ...over });

test('delivery is not charged until the studio turns it on', () => {
  assert.equal(shippingFor({ enabled: false, flat_paise: 6000 }, 540), 0);
  assert.equal(shippingFor(null, 540), 0);
  assert.equal(shippingFor(undefined, 540), 0);
});

test('a flat charge is returned in rupees', () => {
  assert.equal(shippingFor(ON(), 540), 60);
});

test('charging switched on with no amount charges nothing', () => {
  assert.equal(shippingFor(ON({ flat_paise: 0 }), 540), 0);
  assert.equal(normaliseShipping({ enabled: true, flat_paise: 0 }).enabled, false);
});

test('the threshold is read against what is owed, not what it was', () => {
  const config = ON({ free_above_paise: 5000 });
  assert.equal(shippingFor(config, 54), 0, 'ClearS ₹50');
  assert.equal(shippingFor(config, 43.2), 60, 'after a 20% offer it does not');
  assert.equal(shippingIsFree(config, 54), true);
  assert.equal(shippingIsFree(config, 43.2), false);
});

test('the nudge says how much more is needed, and nothing when there is none', () => {
  const config = ON({ free_above_paise: 100000 });
  assert.equal(awayFromFreeShipping(config, 400), 600);
  assert.equal(awayFromFreeShipping(config, 1000), 0, 'already earned');
  assert.equal(awayFromFreeShipping(ON(), 400), 0, 'no threshold set');
  assert.equal(awayFromFreeShipping({ enabled: false }, 400), 0, 'not charging at all');
});

test('a threshold of zero is no threshold, not free for everybody', () => {
  assert.equal(normaliseShipping(ON({ free_above_paise: 0 })).free_above_paise, null);
  assert.equal(shippingFor(ON({ free_above_paise: 0 }), 1), 60);
});

test('a malformed row charges nothing rather than guessing', () => {
  for (const bad of [{}, { enabled: true }, { enabled: 'yes', flat_paise: 'lots' }, { flat_paise: -1 }]) {
    assert.equal(shippingFor(bad, 540), 0);
  }
});
