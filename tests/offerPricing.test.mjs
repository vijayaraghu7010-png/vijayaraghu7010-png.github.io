import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPricing } from './harness/build.mjs';
import { lineDiscount } from '../src/utils/offers.js';

/* What a customer is actually charged.

   The shop shows a discounted price in three places - the card, the
   customiser and the bag - and until now the server that prices the
   order knew nothing about offers at all, so an order shown at ₹43.20
   was recorded at ₹54. These tests are about the two agreeing.

   The real _shared/pricing.ts is bundled and run against an in-memory
   catalogue. No Supabase, no network: `db` is a few arrays behind the
   same `.from().select()` shape the module calls. */

const pricing = await import(await buildPricing());
const { priceOrder } = pricing;

const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const PRODUCTS = [
  { id: 'polaroid-medium', slug: 'polaroid-prints-medium', name: 'Polaroid Prints (Medium)',
    category: 'polaroid', price: 6, min_qty: 9, customiser: 'polaroid', published: true },
  { id: 'frame-couple-eye', slug: 'couple-eye-frame', name: 'Couple Eye Frame',
    category: 'frame', price: 400, min_qty: null, customiser: 'frame', published: true }
];

const VARIANTS = [
  { id: 'frame-couple-eye-frame-a4', kind: 'frame-size', parent_product_id: 'frame-couple-eye',
    label: 'A4', price_paise: 45000, active: true }
];

/* Only the two calls priceOrder makes. */
function makeDb(offers) {
  return {
    from(table) {
      return {
        select() {
          if (table === 'products') return Promise.resolve({ data: PRODUCTS });
          if (table === 'price_variants') return Promise.resolve({ data: VARIANTS });
          if (table === 'offers') return Promise.resolve({ data: offers });
          return Promise.resolve({ data: [] });
        }
      };
    }
  };
}

const offer = (over = {}) => ({
  id: 'offer-1',
  code: null,
  title: 'Diwali',
  discount_type: 'percent',
  value: 20,
  applies_to: { scope: 'all' },
  min_order: 0,
  max_discount: null,
  starts_at: null,
  ends_at: null,
  active: true,
  ...over
});

const price = (offers, lines) => priceOrder(makeDb(offers), lines);

const NINE_PRINTS = [{ productId: 'polaroid-medium', quantity: 9, config: {} }];

test('with no offer, an order costs what the catalogue says', async () => {
  const out = await price([], NINE_PRINTS);
  assert.equal(out.subtotal, 5400);
  assert.equal(out.discount, 0);
  assert.equal(out.total, 5400);
});

test('a live automatic offer comes off the total', async () => {
  const out = await price([offer()], NINE_PRINTS);
  assert.equal(out.subtotal, 5400);
  assert.equal(out.discount, 1080); /* 20% of ₹6, nine times */
  assert.equal(out.total, 4320);
});

test('the server charges what the bag showed', async () => {
  /* The bag's own arithmetic, from the shipping browser module. */
  const clientOffer = {
    id: 'offer-1', code: null, discountType: 'percent', value: 20,
    appliesTo: { scope: 'all' }, minOrder: 0, maxDiscount: null,
    startsAt: null, endsAt: null, active: true
  };
  const product = { id: 'polaroid-medium', slug: 'polaroid-prints-medium', price: 6, category: 'polaroid' };
  const bag = lineDiscount({ productId: 'polaroid-medium', unitPrice: 6, quantity: 9 }, product, [clientOffer]);
  const bagPayable = Math.round((6 * 9 - bag.saved) * 100);

  const out = await price([offer()], NINE_PRINTS);
  assert.equal(out.total, bagPayable, 'server total and bag total must agree to the paise');
});

test('the line keeps its gross total, so the discount is never taken twice', async () => {
  const out = await price([offer()], NINE_PRINTS);
  const line = out.priced[0];
  assert.equal(line.unit_price_paise, 600);
  assert.equal(line.line_total_paise, 5400, 'the line is gross');
  assert.equal(line.discount_paise, 1080, 'what came off is recorded separately');
  assert.equal(line.line_total_paise - line.discount_paise, out.total);
});

test('an offer that has not started yet takes nothing off', async () => {
  const out = await price([offer({ starts_at: iso(Date.now() + 4 * HOUR) })], NINE_PRINTS);
  assert.equal(out.discount, 0);
  assert.equal(out.total, 5400);
});

test('an offer that has finished takes nothing off', async () => {
  const out = await price([offer({ ends_at: iso(Date.now() - HOUR) })], NINE_PRINTS);
  assert.equal(out.discount, 0);
});

test('a paused offer takes nothing off', async () => {
  const out = await price([offer({ active: false })], NINE_PRINTS);
  assert.equal(out.discount, 0);
});

test('a coded offer is nobody\'s discount, so the server does not apply it', async () => {
  /* Nothing in the shop can enter a code. An offer with one must not
     become automatic at checkout. */
  const out = await price([offer({ code: 'DIWALI' })], NINE_PRINTS);
  assert.equal(out.discount, 0);
});

test('a minimum order is measured against the line', async () => {
  const under = await price([offer({ min_order: 100 })], NINE_PRINTS); /* ₹54 < ₹100 */
  assert.equal(under.discount, 0);

  const over = await price([offer({ min_order: 50 })], NINE_PRINTS); /* ₹54 >= ₹50 */
  assert.equal(over.discount, 1080);
});

test('a maximum discount caps what can come off', async () => {
  const out = await price([offer({ max_discount: 5 })], NINE_PRINTS);
  assert.equal(out.discount, 500, 'capped at ₹5, not ₹10.80');
  assert.equal(out.total, 4900);
});

test('a flat offer takes its rupees off every unit', async () => {
  const out = await price([offer({ discount_type: 'flat', value: 2 })], NINE_PRINTS);
  assert.equal(out.discount, 1800); /* ₹2 off each of nine */
});

test('nothing may take more off than the thing costs', async () => {
  const out = await price([offer({ discount_type: 'flat', value: 999 })], NINE_PRINTS);
  assert.equal(out.discount, 5400);
  assert.equal(out.total, 0);
});

test('offers do not stack: the one that saves most wins', async () => {
  const out = await price(
    [offer({ id: 'small', value: 10 }), offer({ id: 'big', value: 25 })],
    NINE_PRINTS
  );
  assert.equal(out.discount, 1350); /* 25%, not 35% */
  assert.equal(out.priced[0].offer_id, 'big');
});

test('a category offer reaches a sized line, which the cart used to miss', async () => {
  /* The cart files this under an id no catalogue has. The server
     knows the product behind the variant, so the category matches. */
  const out = await price(
    [offer({ applies_to: { scope: 'category', value: 'frame' } })],
    [{ productId: 'frame-couple-eye-frame-a4', quantity: 1, config: { size: 'A4' } }]
  );
  assert.equal(out.subtotal, 45000);
  assert.equal(out.discount, 9000);
  assert.equal(out.total, 36000);
});

test('a category offer leaves other categories alone', async () => {
  const out = await price(
    [offer({ applies_to: { scope: 'category', value: 'frame' } })],
    NINE_PRINTS
  );
  assert.equal(out.discount, 0);
});

test('a product offer matches by slug or by id', async () => {
  const bySlug = await price(
    [offer({ applies_to: { scope: 'product', value: 'polaroid-prints-medium' } })],
    NINE_PRINTS
  );
  assert.equal(bySlug.discount, 1080);

  const byId = await price(
    [offer({ applies_to: { scope: 'product', value: 'polaroid-medium' } })],
    NINE_PRINTS
  );
  assert.equal(byId.discount, 1080);
});

test('a discount never makes an order worth less than nothing', async () => {
  const out = await price([offer({ value: 100 })], NINE_PRINTS);
  assert.equal(out.total, 0);
  assert.ok(out.discount <= out.subtotal);
});
