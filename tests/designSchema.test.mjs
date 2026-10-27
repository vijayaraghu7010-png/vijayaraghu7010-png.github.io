/* Run with `npm test` (node --test, no test framework installed).

   These cover the reading of records that have been sitting in a
   customer's browser: the old schema, the hand-edited one, the one
   referring to a gift the shop stopped selling. The browser-level
   behaviour — IndexedDB, restoring after a restart — is verified in
   the real browser instead; it cannot be faked meaningfully here. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEMA_VERSION,
  assetIdsOf,
  createDesign,
  createGift,
  describeDesign,
  migrateDesign,
  validateDesign
} from '../src/lib/designSchema.js';
import { BOX_VARIANTS, getBoxVariant, getGiftKind } from '../src/data/hamperKit.js';
import { orientedBounds, positionLimits } from '../src/lib/giftBounds.js';

test('a new design is valid, and round-trips through validation unchanged in substance', () => {
  const design = createDesign({ name: 'Anniversary box' });
  const result = validateDesign(design);

  assert.equal(result.ok, true);
  assert.equal(result.repaired, false);
  assert.equal(result.design.name, 'Anniversary box');
  assert.equal(result.design.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.design.revision, 1);
});

test('a record that is not a design is refused rather than repaired into one', () => {
  for (const junk of [null, undefined, 42, 'design', [], {}, { id: '' }]) {
    assert.equal(validateDesign(junk).ok, false, `accepted ${JSON.stringify(junk)}`);
  }
});

test('a design saved by a newer version of the site is refused, not half-read', () => {
  const design = { ...createDesign(), schemaVersion: SCHEMA_VERSION + 1 };
  const result = validateDesign(design);

  assert.equal(result.ok, false);
  assert.equal(result.newer, true);
});

test('a version 1 record is migrated, keeping its colours and gift positions', () => {
  /* The shape version 1 actually wrote. */
  const old = {
    id: 'design-old',
    schemaVersion: 1,
    name: 'Old hamper',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    revision: 4,
    box: {
      variantId: 'box-medium',
      colour: 'navy',
      lining: 'blush-crinkle',
      ribbon: 'ivory',
      lidOpen: true
    },
    gifts: [
      {
        uid: 'gift-1',
        kindId: 'crochet-panda',
        quantity: 1,
        colour: '#FFFFFF',
        position: { x: 3, y: 0, z: -2 },
        rotation: [0, 1.2, 0]
      }
    ],
    message: { to: 'Asha', from: 'Ravi', body: 'Happy anniversary', fontId: 'script', showCard: true }
  };

  const migrated = migrateDesign(old);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.design.schemaVersion, SCHEMA_VERSION);

  const result = validateDesign(old);
  assert.equal(result.ok, true);
  assert.ok(result.notes.some((n) => n.kind === 'migrated'));

  /* The fields that moved are read from where they used to be. */
  assert.equal(result.design.box.boxColourId, 'navy');
  assert.equal(result.design.box.liningColourId, 'blush-crinkle');
  assert.equal(result.design.box.ribbonColourId, 'ivory');

  /* {x, y, z} became a tuple in version 2, and version 3 brought the
     rotation triple back — through version 2's single angle, which
     has to survive both hops to come out the other side. */
  assert.equal(result.design.gifts[0].position[0], 3);
  assert.equal(result.design.gifts[0].position[2], -2);
  assert.deepEqual(result.design.gifts[0].rotation, [0, 1.2, 0]);

  /* And nothing else was lost on the way. */
  assert.equal(result.design.message.body, 'Happy anniversary');
  assert.equal(result.design.revision, 4);
});

test('a version 2 record keeps its gifts, its angles and its arrangement', () => {
  /* Version 2 kept every gift on the floor of the box and turned it
     about the upright axis only. */
  const old = {
    ...createDesign({ name: 'Flat hamper' }),
    schemaVersion: 2,
    gifts: [
      {
        uid: 'gift-flat',
        kindId: 'choc-kitkat',
        quantity: 2,
        colour: '#E2231A',
        position: [4, 0, -3],
        rotationY: 0.8,
        scale: 1,
        text: '',
        assetId: null,
        addedAt: 1700000000000
      }
    ]
  };

  const result = validateDesign(old);
  assert.equal(result.ok, true);
  assert.equal(result.design.gifts.length, 1);

  const gift = result.design.gifts[0];
  assert.equal(gift.position[0], 4);
  assert.equal(gift.position[2], -3);
  assert.deepEqual(gift.rotation, [0, 0.8, 0], 'the one angle it had became the upright one');
  assert.equal(gift.quantity, 2, 'and nothing else was lost');

  /* A gift that used to sit at y = 0 now sits on the lining, which
     for a bar means its middle is half its thickness above the
     floor. It must not be left half-buried. */
  const { half, centre } = orientedBounds(getGiftKind('choc-kitkat'), {
    scale: gift.scale,
    rotation: gift.rotation
  });
  assert.ok(gift.position[1] + centre[1] - half[1] >= -1e-6, 'it is not through the floor');
});

test('a gift that is no longer offered is dropped and reported, and the rest of the hamper survives', () => {
  const design = createDesign();
  design.gifts = [
    createGift('crochet-panda'),
    { ...createGift('choc-kitkat'), kindId: 'unicorn-horn' },
    createGift('perfume-honey-oud')
  ];

  const result = validateDesign(design);

  assert.equal(result.ok, true);
  assert.equal(result.design.gifts.length, 2, 'the two real gifts are kept');
  assert.deepEqual(
    result.design.gifts.map((g) => g.kindId),
    ['crochet-panda', 'perfume-honey-oud']
  );
  assert.ok(result.notes.some((n) => n.kind === 'gift-unknown' && n.kindId === 'unicorn-horn'));
});

test('values edited by hand in devtools are clamped rather than trusted', () => {
  const design = createDesign();
  design.gifts = [
    {
      ...createGift('crochet-panda'),
      quantity: 9999,
      scale: 40,
      colour: 'javascript:alert(1)',
      position: [9999, 500, -9999],
      rotation: [Number.NaN, Infinity, 'sideways'],
      text: 'x'.repeat(5000)
    }
  ];
  design.box.boxColourId = 'not-a-colour';
  design.box.ribbonStyleId = '<script>';
  design.name = 'n'.repeat(500);

  const result = validateDesign(design);
  const gift = result.design.gifts[0];
  const variant = getBoxVariant(result.design.box.variantId);
  const limits = positionLimits(getGiftKind('crochet-panda'), variant, {
    scale: gift.scale,
    rotation: gift.rotation
  });

  assert.equal(result.ok, true);
  assert.equal(gift.quantity, 3, 'clamped to the kind’s maximum');
  assert.ok(gift.scale <= 1.35 && gift.scale >= 0.8);
  assert.match(gift.colour, /^#[0-9a-f]{6}$/i, 'a non-colour falls back to a palette colour');
  assert.ok(gift.position[0] <= limits.x[1] + 1e-6, 'pulled inside the side wall');
  assert.ok(gift.position[2] >= limits.z[0] - 1e-6, 'pulled inside the end wall');
  assert.ok(gift.position[1] <= limits.y[1] + 1e-6, 'pulled back under the lid');
  assert.ok(gift.position.every((n) => Number.isFinite(n)), 'and every coordinate is a real number');
  assert.deepEqual(gift.rotation, [0, 0, 0], 'NaN, Infinity and a word all become real angles');
  /* A crochet panda supports neither text nor a photo, so neither is
     kept. */
  assert.equal(gift.text, '');
  assert.equal(gift.assetId, null);
  assert.equal(result.design.box.boxColourId, 'burgundy');
  assert.equal(result.design.box.ribbonStyleId, 'cross-bow');
  assert.equal(result.design.name.length, 60);
});

test('control characters are stripped from customer text', () => {
  const design = createDesign();
  design.message.body = 'Hello\u0000\u001b[31m there';
  design.gifts = [{ ...createGift('photo-frame'), text: 'For\u0007 you' }];

  const result = validateDesign(design);
  assert.equal(result.design.message.body, 'Hello[31m there');
  assert.equal(result.design.gifts[0].text, 'For you');
});

test('duplicate gift uids are made unique, so two gifts can never share an identity', () => {
  const design = createDesign();
  const gift = createGift('crochet-panda');
  design.gifts = [gift, { ...createGift('perfume-honey-oud'), uid: gift.uid }];

  const result = validateDesign(design);
  const uids = result.design.gifts.map((g) => g.uid);
  assert.equal(new Set(uids).size, 2);
});

test('a photo reference is only kept on a gift that can show one', () => {
  const design = createDesign();
  design.gifts = [
    { ...createGift('photo-frame'), assetId: 'asset-1' },
    { ...createGift('crochet-panda'), assetId: 'asset-2' }
  ];

  const result = validateDesign(design);
  assert.equal(result.design.gifts[0].assetId, 'asset-1');
  assert.equal(result.design.gifts[1].assetId, null);
  assert.deepEqual(assetIdsOf(result.design), ['asset-1']);
});

test('over-capacity is reported, never silently fixed by deleting gifts', () => {
  const small = BOX_VARIANTS[0];
  const design = createDesign({ boxVariantId: small.id });
  design.gifts = Array.from({ length: small.capacity + 2 }, () => createGift('crochet-panda'));

  const result = validateDesign(design);
  assert.equal(result.ok, true);
  assert.equal(result.design.gifts.length, small.capacity + 2, 'nothing was thrown away');
  assert.ok(result.notes.some((n) => n.kind === 'over-capacity' && n.by === 2));
});

test('a design describes itself for the bag and the saved list', () => {
  const design = createDesign();
  design.gifts = [createGift('crochet-panda'), { ...createGift('choc-kitkat'), quantity: 2 }];
  design.message.body = 'See you soon';

  const text = describeDesign(design);
  assert.match(text, /3 items/);
  assert.match(text, /ribbon/);
  assert.match(text, /message card/);
});
