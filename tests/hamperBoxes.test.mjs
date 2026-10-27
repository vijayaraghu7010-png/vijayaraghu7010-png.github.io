/* The hamper dimensions, which everything else is measured against.

   If the conversion is wrong, or the outer-to-inner sum is wrong, or
   a stocked size has drifted outside its published range, then every
   arrangement the packer produces is confidently wrong — it will
   have validated a gift against an interior the box does not have.
   So these are asserted against the catalogue figures directly
   rather than against anything the app computed. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOXES_BY_ROOM,
  BOX_VARIANTS,
  DEFAULT_BOX_VARIANT,
  HAMPER_CATEGORIES,
  INCH_CM,
  boxSnapshot,
  boxesInCategory,
  cm,
  getBoxVariant,
  usableVolume,
  variantFromSnapshot,
  withinRange
} from '../src/data/hamperBoxes.js';
import { interior } from '../src/lib/giftBounds.js';
import { createDesign, migrateDesign, validateDesign } from '../src/lib/designSchema.js';

const close = (a, b, within = 1e-9) => Math.abs(a - b) <= within;

test('an inch is 2.54 cm, and the conversion is exact to the hundredth', () => {
  assert.equal(INCH_CM, 2.54);
  assert.equal(cm(6), 15.24);
  assert.equal(cm(4), 10.16);
  assert.equal(cm(2), 5.08);
  assert.equal(cm(18), 45.72);

  /* Binary floating point does not always give the figure back
     cleanly, and a stray 15.240000000000002 is the same number but
     not something to print in a readout or write into a saved
     record. Every converted figure comes back at no more than two
     decimals — a hundredth of a centimetre, far finer than anything
     here is known to. */
  assert.equal(cm(13), 33.02);

  BOX_VARIANTS.forEach((variant) => {
    variant.outer.forEach((n) => {
      assert.equal(n, Number(n.toFixed(2)), `${variant.id} carries float dust: ${n}`);
    });
  });
});

test('the four categories are the published ones, with their published ranges', () => {
  assert.deepEqual(
    HAMPER_CATEGORIES.map((c) => c.label),
    ['Small', 'Medium', 'Large', 'Extra-Large']
  );

  const ranges = {
    small: { min: [6, 4, 2], max: [8, 8, 4] },
    medium: { min: [10, 8, 4], max: [12, 10, 4] },
    large: { min: [14, 9, 4], max: [14, 14, 6] },
    xlarge: { min: [18, 13, 3], max: [18, 18, 7] }
  };

  HAMPER_CATEGORIES.forEach((category) => {
    assert.deepEqual(category.rangeIn, ranges[category.id], category.id);
  });
});

test('every size the shop offers is inside its own published range', () => {
  BOX_VARIANTS.forEach((variant) => {
    assert.equal(withinRange(variant.categoryId, variant.inches), true, variant.id);
  });

  /* And out-of-range sizes really are rejected, so the check above is
     doing something. */
  assert.equal(withinRange('small', [9, 8, 4]), false, 'too long for a Small');
  assert.equal(withinRange('medium', [12, 10, 6]), false, 'too deep for a Medium');
  assert.equal(withinRange('large', [14, 14, 7]), false, 'too deep for a Large');
  assert.equal(withinRange('xlarge', [18, 18, 8]), false, 'too deep for an Extra-Large');
  assert.equal(withinRange('small', [5, 4, 2]), false, 'shorter than the minimum');
});

test('both ends of every range are stocked, so the published size can be bought', () => {
  HAMPER_CATEGORIES.forEach((category) => {
    const sizes = boxesInCategory(category.id);
    assert.ok(sizes.length >= 2, `${category.id} offers no choice of size`);

    const quoted = sizes.map((v) => v.inches.join('x'));
    assert.ok(quoted.includes(category.rangeIn.min.join('x')), `${category.id} does not stock its minimum`);
    assert.ok(quoted.includes(category.rangeIn.max.join('x')), `${category.id} does not stock its maximum`);
  });
});

test('the geometry is the catalogue size in centimetres, to the worked examples', () => {
  /* The four examples given with the brief, in [length, width,
     height] cm. The scene reads these as [X, Z, Y]. */
  const expected = {
    'box-small-6x4x2': [15.24, 10.16, 5.08],
    'box-small-8x8x4': [20.32, 20.32, 10.16],
    'box-medium-12x10x4': [30.48, 25.4, 10.16],
    'box-xlarge-18x18x7': [45.72, 45.72, 17.78]
  };

  Object.entries(expected).forEach(([id, [length, width, height]]) => {
    const variant = getBoxVariant(id);
    assert.equal(variant.id, id, `${id} is not stocked`);
    assert.equal(variant.outer[0], length, `${id} length`);
    assert.equal(variant.outer[2], width, `${id} width`);
    assert.equal(variant.outer[1], height, `${id} height`);
  });
});

test('the interior is the outer box less what the box is made of', () => {
  BOX_VARIANTS.forEach((variant) => {
    const [outerX, outerY, outerZ] = variant.outer;
    const b = variant.construction;

    /* Across and along: one wall off each of the two opposite
       sides. */
    assert.ok(close(variant.inner[0], outerX - b.wall * 2), `${variant.id} length`);
    assert.ok(close(variant.inner[2], outerZ - b.wall * 2), `${variant.id} width`);

    /* Up: the base, the lid slab and the hinge travel all live
       inside the quoted outer height. */
    assert.ok(close(variant.inner[1], outerY - b.base - b.lid - b.hinge), `${variant.id} height`);

    /* And then the lining, which is the last thing between the
       cavity and the gift. */
    assert.ok(close(variant.usable[0], variant.inner[0] - b.lining * 2), `${variant.id} usable length`);
    assert.ok(close(variant.usable[2], variant.inner[2] - b.lining * 2), `${variant.id} usable width`);
    assert.ok(close(variant.usable[1], variant.inner[1] - b.lining), `${variant.id} usable height`);

    /* Nothing is zero or inverted, and nothing claims more room than
       the box it came out of. */
    variant.usable.forEach((n, i) => {
      assert.ok(n > 0, `${variant.id} has no usable dimension ${i}`);
      assert.ok(n < variant.outer[i], `${variant.id} usable ${i} exceeds the outer box`);
    });

    /* The construction is an assumption and says so. */
    assert.equal(variant.construction.assumed, true, `${variant.id} presents its build as measured`);
  });
});

test('the interior the packer is given is the one the catalogue implies', () => {
  /* The one join that matters: giftBounds is where every collision
     boundary comes from, and it must land on the same figures as the
     derivation above. */
  BOX_VARIANTS.forEach((variant) => {
    const room = interior(variant);
    assert.ok(close(room.halfX * 2, variant.usable[0]), `${variant.id} across`);
    assert.ok(close(room.halfZ * 2, variant.usable[2]), `${variant.id} along`);
    assert.ok(close(room.ceiling, variant.usable[1]), `${variant.id} up`);
    assert.equal(room.floor, 0);
  });
});

test('boxes are ordered by the room they really offer, not by how large they are quoted', () => {
  for (let i = 1; i < BOXES_BY_ROOM.length; i += 1) {
    assert.ok(
      usableVolume(BOXES_BY_ROOM[i]) >= usableVolume(BOXES_BY_ROOM[i - 1]),
      'BOXES_BY_ROOM is not sorted'
    );
  }

  /* The case that makes the ordering necessary: the longest hamper
     in the catalogue is not the roomiest. */
  const long = getBoxVariant('box-xlarge-18x13x3');
  const deep = getBoxVariant('box-large-14x14x6');
  assert.ok(long.outer[0] > deep.outer[0], 'the Extra-Large is longer');
  assert.ok(usableVolume(long) < usableVolume(deep), 'and holds less');
});

test('every stocked size has a distinct id and a price that rises with the box', () => {
  assert.equal(new Set(BOX_VARIANTS.map((v) => v.id)).size, BOX_VARIANTS.length);
  BOX_VARIANTS.forEach((v) => assert.ok(v.price > 0, `${v.id} has no price`));

  HAMPER_CATEGORIES.forEach((category) => {
    const sizes = boxesInCategory(category.id);
    for (let i = 1; i < sizes.length; i += 1) {
      assert.ok(sizes[i].price > sizes[i - 1].price, `${category.id} prices do not rise with size`);
    }
  });

  assert.ok(
    BOX_VARIANTS.some((v) => v.id === DEFAULT_BOX_VARIANT),
    'the default size is not one the shop stocks'
  );
});

/* ------------------------------------------- saved designs */

test('a design carries its dimensions, not only the id of a size', () => {
  const design = createDesign({ boxVariantId: 'box-medium-12x10x4' });
  const snap = design.box.dimensions;

  assert.equal(snap.categoryId, 'medium');
  assert.deepEqual(snap.inches, [12, 10, 4]);
  assert.deepEqual(snap.outerCm, [30.48, 10.16, 25.4]);
  assert.equal(snap.unit, 'cm');
  assert.equal(snap.construction.wall > 0, true);

  /* And validation writes it back rather than dropping it. */
  const result = validateDesign(design);
  assert.equal(result.ok, true);
  assert.deepEqual(result.design.box.dimensions, snap);
});

test('a size the shop has stopped stocking keeps its own dimensions', () => {
  /* A hamper built at 9 × 7 × 3 in — not in the catalogue, and not
     something the studio would offer today. The design must come
     back at exactly that size, flagged as unorderable, rather than
     quietly becoming a different box. */
  const design = createDesign();
  const record = {
    ...design,
    box: {
      ...design.box,
      variantId: 'box-small-9x7x3',
      dimensions: {
        categoryId: 'small',
        inches: [9, 7, 3],
        outerCm: [22.86, 7.62, 17.78],
        unit: 'cm',
        construction: { wall: 0.4, base: 0.4, lid: 0.5, lining: 0.3, hinge: 0.2 }
      }
    }
  };

  const rebuilt = variantFromSnapshot(record.box.dimensions);
  assert.equal(rebuilt.stocked, false);
  assert.deepEqual(rebuilt.inches, [9, 7, 3]);
  assert.equal(rebuilt.outer[0], 22.86);

  const result = validateDesign(record);
  assert.equal(result.ok, true, 'the design is still readable');
  assert.deepEqual(result.design.box.dimensions.inches, [9, 7, 3], 'at the size it was built at');
  assert.ok(
    result.notes.some((n) => n.kind === 'box-size-unstocked'),
    'and the customer is told it cannot be ordered'
  );
});

test('a snapshot with nothing usable in it falls back rather than inventing a box', () => {
  [null, {}, { categoryId: 'small' }, { inches: [1, 2] }, { categoryId: 'nope', inches: [8, 8, 4] }].forEach(
    (junk) => {
      assert.equal(variantFromSnapshot(junk), null, JSON.stringify(junk));
    }
  );

  const fallback = getBoxVariant({ variantId: 'box-gone', dimensions: null });
  assert.equal(fallback.id, DEFAULT_BOX_VARIANT);
});

test('a version 4 design is moved onto a real catalogue size, keeping its gifts', () => {
  /* Version 4 sold three boxes whose sizes were round numbers chosen
     for the demonstration. Each becomes the roomiest size in the
     category of the same name, which is the closest the real
     catalogue comes. */
  const moved = {
    'box-small': 'box-small-8x8x4',
    'box-medium': 'box-medium-12x10x4',
    'box-large': 'box-large-14x14x6'
  };

  Object.entries(moved).forEach(([was, now]) => {
    const old = {
      id: 'design-old',
      schemaVersion: 4,
      name: 'An old hamper',
      box: {
        variantId: was,
        boxColourId: 'navy',
        boxMaterialId: 'satin',
        liningColourId: 'ivory-satin',
        ribbonColourId: 'gold',
        ribbonStyleId: 'cross-bow',
        lidOpen: true
      },
      gifts: [
        {
          uid: 'gift-1',
          kindId: 'choc-kitkat',
          quantity: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          placed: true
        }
      ],
      message: { to: '', from: '', body: '', fontId: 'script', showCard: false }
    };

    const migrated = migrateDesign(old);
    assert.equal(migrated.ok, true, was);
    assert.equal(migrated.design.box.variantId, now, was);
    assert.equal(migrated.design.box.boxColourId, 'navy', 'the finish survived');

    const result = validateDesign(old);
    assert.equal(result.ok, true);
    assert.equal(result.design.box.variantId, now);
    assert.equal(result.design.gifts.length, 1, 'the gift survived');
    assert.deepEqual(result.design.box.dimensions, boxSnapshot(getBoxVariant(now)));
  });
});
