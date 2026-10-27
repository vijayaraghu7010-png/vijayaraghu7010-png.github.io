import test from 'node:test';
import assert from 'node:assert/strict';

import { priceDesign, pricingDrift } from '../src/lib/designPricing.js';
import { createDesign, createGift } from '../src/lib/designSchema.js';
import { getBoxVariant, giftUnitPrice, getGiftKind } from '../src/data/hamperKit.js';
import { getProductById } from '../src/data/products.js';

test('the box is always a line, so an empty hamper still has a price', () => {
  const design = createDesign();
  const pricing = priceDesign(design, []);
  const variant = getBoxVariant(design.box.variantId);

  assert.equal(pricing.lines.length, 1);
  assert.equal(pricing.subtotal, variant.price);
  assert.equal(pricing.payable, variant.price);
  assert.deepEqual(pricing.problems, []);
});

test('a price in the saved record is ignored — the catalogue is what counts', () => {
  const design = createDesign();
  design.gifts = [createGift('crochet-panda')];
  /* What a tampered or stale record might claim. */
  design.pricing = { subtotal: 1, payable: 1, computedAt: 0 };

  const pricing = priceDesign(design, []);
  const expected = getBoxVariant(design.box.variantId).price + giftUnitPrice(getGiftKind('crochet-panda'));

  assert.equal(pricing.payable, expected);
  assert.notEqual(pricing.payable, 1);

  /* And the difference is reported rather than hidden. */
  const drift = pricingDrift(design, pricing);
  assert.equal(drift.was, 1);
  assert.equal(drift.now, expected);
});

test('quantity multiplies, and the chosen option is named on the line', () => {
  const design = createDesign();
  design.gifts = [{ ...createGift('crochet-animals', { variantId: 'bunny-pink' }), quantity: 2 }];

  const unit = giftUnitPrice(getGiftKind('crochet-animals'), 'bunny-pink');
  const pricing = priceDesign(design, []);

  assert.equal(pricing.subtotal, getBoxVariant(design.box.variantId).price + unit * 2);
  assert.match(pricing.lines[1].label, /Pink bunny/);
});

/* No product in the kit currently costs more in one option than
   another, so the surcharge path has nothing real to exercise it.
   It is still live code that a future option would go through, so
   it is tested directly on a kind made up for the purpose rather
   than left uncovered. */
test('an option that costs more adds its surcharge to the unit price', () => {
  const kind = {
    id: 'made-up',
    price: 200,
    variants: [
      { id: 'plain', label: 'Plain' },
      { id: 'fancy', label: 'Fancy', priceDelta: 75 }
    ]
  };

  assert.equal(giftUnitPrice(kind, 'plain'), 200);
  assert.equal(giftUnitPrice(kind, 'fancy'), 275);
  assert.equal(giftUnitPrice(kind, 'no-such-option'), 200);
});

test('a gift that is a shop product is priced from the catalogue, not from the kit', () => {
  const design = createDesign();
  design.gifts = [createGift('polaroid-pack')];

  const product = getProductById('polaroid-medium');
  const kind = getGiftKind('polaroid-pack');
  const pricing = priceDesign(design, []);

  /* Nine prints at the catalogue's per-print price. */
  assert.equal(pricing.lines[1].total, product.price * kind.productQuantity);
  assert.equal(pricing.lines[1].productId, 'polaroid-medium');
});

test('quantity beyond what the kit allows is clamped in the price too', () => {
  const design = createDesign();
  design.gifts = [{ ...createGift('choc-ferrero'), quantity: 500 }];

  const pricing = priceDesign(design, []);
  assert.equal(pricing.lines[1].quantity, getGiftKind('choc-ferrero').maxQty);
});

test('an unknown gift is reported as a problem rather than priced at zero', () => {
  const design = createDesign();
  design.gifts = [{ ...createGift('crochet-panda'), kindId: 'ghost-gift' }];

  const pricing = priceDesign(design, []);
  assert.equal(pricing.lines.length, 1, 'only the box');
  assert.equal(pricing.problems.length, 1);
  assert.equal(pricing.problems[0].reason, 'no-longer-offered');
});

test('an automatic hamper offer comes off the total, exactly as it would in the shop', () => {
  const design = createDesign();
  design.gifts = [createGift('crochet-panda')];

  const offers = [
    {
      id: 'offer-1',
      title: 'Diwali 10% off',
      active: true,
      discountType: 'percent',
      value: 10,
      appliesTo: { scope: 'category', value: 'hamper' }
    }
  ];

  const plain = priceDesign(design, []);
  const discounted = priceDesign(design, offers);

  assert.equal(discounted.subtotal, plain.subtotal);
  assert.equal(discounted.savings, Math.round(plain.subtotal * 0.1 * 100) / 100);
  assert.equal(discounted.payable, plain.subtotal - discounted.savings);
  assert.equal(discounted.offer.title, 'Diwali 10% off');
});

test('an offer that needs a code is not applied on its own', () => {
  const design = createDesign();
  design.gifts = [createGift('crochet-panda')];

  const pricing = priceDesign(design, [
    {
      id: 'offer-coded',
      code: 'SECRET20',
      active: true,
      discountType: 'percent',
      value: 20,
      appliesTo: { scope: 'all' }
    }
  ]);

  assert.equal(pricing.savings, 0);
  assert.equal(pricing.offer, null);
});

test('an offer for another category leaves the hamper alone', () => {
  const design = createDesign();
  design.gifts = [createGift('crochet-panda')];

  const pricing = priceDesign(design, [
    {
      id: 'offer-bouquet',
      active: true,
      discountType: 'percent',
      value: 50,
      appliesTo: { scope: 'category', value: 'bouquet' }
    }
  ]);

  assert.equal(pricing.savings, 0);
});

test('an expired offer does not apply', () => {
  const design = createDesign();
  design.gifts = [createGift('crochet-panda')];

  const pricing = priceDesign(design, [
    {
      id: 'offer-old',
      active: true,
      discountType: 'percent',
      value: 25,
      endsAt: '2020-01-01',
      appliesTo: { scope: 'all' }
    }
  ]);

  assert.equal(pricing.savings, 0);
});

test('a price that has not moved reports no drift', () => {
  const design = createDesign();
  const pricing = priceDesign(design, []);
  design.pricing = { payable: pricing.payable };

  assert.equal(pricingDrift(design, pricing), null);
});
