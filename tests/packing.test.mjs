/* The packer is the only thing that decides where a gift goes, so
   these are the tests that stand between a customer and a box with
   a bouquet growing through the side of it.

   Two properties are asserted again and again on purpose: nothing
   leaves the interior, and no two gifts share space. Everything
   else — ordering, determinism, honest failure — exists to serve
   those two. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPacking,
  arrangementSummary,
  giftCouldFit,
  insideInterior,
  packDesign,
  packOne,
  placementOf,
  smallestBoxFor,
  tiltsFor,
  turnsFor,
  validateArrangement
} from '../src/lib/packing.js';
import { giftsCollide, localBoxes, worldBoxes, aabbOf } from '../src/lib/collision.js';
import { createDesign, createGift } from '../src/lib/designSchema.js';
import { designReducer } from '../src/lib/designReducer.js';
import { BOX_VARIANTS, GIFT_KINDS, getBoxVariant, getGiftKind } from '../src/data/hamperKit.js';
import { interior } from '../src/lib/giftBounds.js';

const add = (design, kindId) => designReducer(design, { type: 'add-gift', kindId });

/* The roomiest hamper the shop stocks — 18 × 18 × 7 in, 45.72 ×
   45.72 × 17.78 cm outside and 43.32 × 15.48 × 43.32 usable. The
   default here because these tests are about the packer and not
   about running out of room; the tests that are about running out of
   room name a smaller box. */
const BIG = 'box-xlarge-18x18x7';
const SMALL = 'box-small-8x8x4';
const MEDIUM = 'box-medium-12x10x4';

const build = (kindIds, boxVariantId = BIG) =>
  kindIds.reduce((design, kindId) => add(design, kindId), createDesign({ boxVariantId }));

/* Everything the packing must be true of, asserted from the design
   itself rather than from what the packer said it did. */
function assertArrangementSound(design, label = '') {
  const variant = getBoxVariant(design.box);
  const room = interior(variant);

  const placed = design.gifts.filter((g) => g.placed !== false);

  placed.forEach((gift) => {
    const kind = getGiftKind(gift.kindId);
    /* Read through the same unpacking the studio uses, so the test
       cannot miss a tilt the packer applied. */
    const placement = placementOf(gift, kind);
    const bounds = aabbOf(worldBoxes(kind, placement));

    assert.ok(bounds.min[1] >= room.floor - 1e-6, `${label}${kind.name} is through the floor`);
    assert.ok(bounds.max[1] <= room.ceiling + 1e-6, `${label}${kind.name} is through the lid`);
    assert.ok(bounds.min[0] >= -room.halfX - 1e-6, `${label}${kind.name} is through the left wall`);
    assert.ok(bounds.max[0] <= room.halfX + 1e-6, `${label}${kind.name} is through the right wall`);
    assert.ok(bounds.min[2] >= -room.halfZ - 1e-6, `${label}${kind.name} is through the back wall`);
    assert.ok(bounds.max[2] <= room.halfZ + 1e-6, `${label}${kind.name} is through the front wall`);
  });

  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      const ka = getGiftKind(a.kindId);
      const kb = getGiftKind(b.kindId);
      assert.ok(
        !giftsCollide(ka, placementOf(a, ka), kb, placementOf(b, kb)),
        `${label}${ka.name} and ${kb.name} are in the same place`
      );
    }
  }

  /* And the module's own verdict must agree with all of that. */
  assert.equal(validateArrangement(design).ok, true, `${label}validateArrangement disagrees`);
}

/* ------------------------------------------------------- collision */

test('a product occupies its own boxes, not one loose box for everything', () => {
  /* A crocheted doll is a body with a smaller head on it. If every
     product shared one box, the head would claim the air beside it
     and the packer would refuse arrangements that are fine. */
  assert.equal(localBoxes(getGiftKind('crochet-panda'), 1).length, 2);
  assert.equal(localBoxes(getGiftKind('choc-kitkat'), 1).length, 1, 'a bar really is one box');

  const shapes = new Set(GIFT_KINDS.map((k) => JSON.stringify(k.proxy || null) + k.size.join(',')));
  assert.ok(shapes.size > 10, 'the kit does not use one collision shape for everything');
});

test('a product stands on the origin and its boxes agree with its declared size', () => {
  GIFT_KINDS.forEach((kind) => {
    const bounds = aabbOf(worldBoxes(kind, { position: [0, 0, 0], yaw: 0, scale: 1 }));
    assert.ok(bounds, `${kind.id} has no collision boxes`);
    assert.ok(bounds.min[1] >= -1e-6, `${kind.id} hangs below its own origin`);
    assert.ok(bounds.max[1] <= kind.size[1] + 1e-6, `${kind.id} is taller than it says`);
    assert.ok(bounds.max[0] <= kind.size[0] / 2 + 1e-6, `${kind.id} is wider than it says`);
    assert.ok(bounds.max[2] <= kind.size[2] / 2 + 1e-6, `${kind.id} is deeper than it says`);
  });
});

test('two gifts in the same place collide, and two apart do not', () => {
  const kind = getGiftKind('choc-ferrero');
  const here = { position: [0, 2, 0], yaw: 0, scale: 1 };

  assert.equal(giftsCollide(kind, here, kind, here), true, 'the same spot');
  assert.equal(
    giftsCollide(kind, here, kind, { position: [30, 2, 0], yaw: 0, scale: 1 }),
    false,
    'half a metre apart'
  );
});

test('turning a gift changes what it collides with', () => {
  /* The Ferrero box is 18 x 4.5. Side by side across the box they
     are clear of each other; turn one and they are not. */
  const kind = getGiftKind('choc-ferrero');
  const a = { position: [0, 2, 0], yaw: 0, scale: 1 };
  const b = { position: [0, 2, 7], yaw: 0, scale: 1 };

  assert.equal(giftsCollide(kind, a, kind, b), false, 'both lying the same way');
  assert.equal(
    giftsCollide(kind, a, kind, { ...b, yaw: Math.PI / 2 }),
    true,
    'one turned across the other'
  );
});

test('gifts are turned about the vertical, and only laid down when the manifest allows it', () => {
  GIFT_KINDS.forEach((kind) => {
    turnsFor(kind).forEach((yaw) => {
      assert.ok(Number.isFinite(yaw), `${kind.id} has a turn that is not a number`);
    });
    tiltsFor(kind).forEach((tilt) => {
      assert.ok(tilt === 0 || Math.abs(Math.abs(tilt) - Math.PI / 2) < 1e-9, `${kind.id}: odd tilt`);
    });
    assert.equal(tiltsFor(kind)[0], 0, `${kind.id} is not tried upright first`);
  });

  /* Something round in plan gains nothing from being turned —
     standing up. Lying down it is a cylinder across the box, and
     then which way it points matters a great deal. */
  const tumbler = getGiftKind('drink-tumbler-bamboo');
  assert.deepEqual(turnsFor(tumbler, 0), [0]);
  assert.equal(turnsFor(tumbler, -Math.PI / 2).length, 2);
  assert.equal(turnsFor(getGiftKind('magazine')).length, 2, 'a rectangle may be turned');

  /* Almost nothing is laid over. A bouquet on its side is not a
     bouquet. */
  assert.deepEqual(tiltsFor(getGiftKind('mini-bouquet')), [0]);
  assert.equal(tiltsFor(tumbler).length, 2, 'a tall tumbler is packed lying down');
});

test('a quarter turn onto the side swaps a gift height for its length, exactly', () => {
  const kind = getGiftKind('drink-tumbler-bamboo'); // 8 x 18 x 8
  const upright = aabbOf(worldBoxes(kind, { position: [0, 0, 0], yaw: 0, scale: 1 }));
  const down = aabbOf(worldBoxes(kind, { position: [0, 0, 0], yaw: 0, tilt: -Math.PI / 2, scale: 1 }));

  const size = (b) => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const [uw, uh, ud] = size(upright);
  const [dw, dh, dd] = size(down);

  /* No trigonometry, so no dust: 18 cm tall becomes 18 cm long and
     the 8.28 cm barrel becomes 8.28 cm tall, to the last bit. */
  assert.equal(dw, uh);
  assert.equal(dh, uw);
  assert.equal(dd, ud);
});

test('the tilt a saved record carries means the same thing it meant when it was written', () => {
  /* A design is stored with its angles folded into [0, 2π), so the
     packer's −π/2 comes back as 3π/2. The two have to describe the
     same box or a reopened hamper is a different shape. */
  const kind = getGiftKind('drink-tumbler-leather');
  const written = { position: [0, 4.5, 0], yaw: 0, tilt: -Math.PI / 2, scale: 1 };
  const readBack = placementOf(
    { position: [0, 4.5, 0], rotation: [0, 0, (3 * Math.PI) / 2], scale: 1 },
    kind
  );

  assert.deepEqual(aabbOf(worldBoxes(kind, written)), aabbOf(worldBoxes(kind, readBack)));
});

test('the smallest box for a gift is the one with the least room, not the shortest quote', () => {
  /* An 18 × 13 × 3 is the longest hamper in the catalogue and holds
     a good deal less than a 14 × 14 × 6, so "smallest" has to mean
     usable volume. */
  const magazine = getGiftKind('magazine'); // 15 x 3 x 21
  const needs = smallestBoxFor(magazine);
  assert.ok(needs, 'a magazine fits something');
  assert.equal(giftCouldFit(magazine, needs), true);

  /* And nothing smaller does. */
  BOX_VARIANTS.filter((v) => v.usable.reduce((a, b) => a * b, 1) < needs.usable.reduce((a, b) => a * b, 1)).forEach(
    (v) => assert.equal(giftCouldFit(magazine, v), false, `${v.id} should be too small`)
  );

  /* The bouquet stands 14 cm, and only the deepest hamper the shop
     stocks has the headroom. */
  assert.equal(smallestBoxFor(getGiftKind('mini-bouquet')).id, 'box-xlarge-18x18x7');
});

/* -------------------------------------------------------- placing */

test('one gift is placed inside the box, standing on the lining', () => {
  /* Named, not defaulted: a 12cm perfume bottle does not stand under
     the lid of a 4-inch-deep Medium hamper, and that is the
     catalogue being what it is rather than the packer failing. */
  const design = add(createDesign({ boxVariantId: BIG }), 'perfume-honey-oud');
  assert.equal(design.gifts.length, 1);
  assert.equal(design.gifts[0].placed, true);
  assertArrangementSound(design);

  const kind = getGiftKind('perfume-honey-oud');
  const bounds = aabbOf(worldBoxes(kind, placementOf(design.gifts[0], kind)));
  assert.ok(Math.abs(bounds.min[1]) < 1e-6, 'its underside is on the floor of the box');
});

test('several gifts are packed without any of them touching', () => {
  const design = build([
    'mini-bouquet',
    'magazine',
    'choc-ferrero',
    'perfume-honey-oud',
    'crochet-panda',
    'choc-kitkat'
  ]);

  assert.equal(design.gifts.length, 6);
  assert.equal(arrangementSummary(design).ok, true, 'everything was placed');
  assertArrangementSound(design);
});

test('every kind in the kit can be packed on its own into some box', () => {
  GIFT_KINDS.forEach((kind) => {
    const variant = smallestBoxFor(kind, 1);
    assert.ok(variant, `${kind.id} fits no box at all`);
    assert.ok(BOX_VARIANTS.includes(variant), `${kind.id} was offered a box the shop does not stock`);

    const design = add(createDesign({ boxVariantId: variant.id }), kind.id);
    assert.equal(design.gifts[0].placed, true, `${kind.id} could not be placed in the ${variant.id}`);
    assertArrangementSound(design, `${kind.id}: `);
  });
});

test('awkward shapes pack together — a bouquet, a frame, a bottle and a doll', () => {
  const design = build(['mini-bouquet', 'photo-frame', 'perfume-honey-oud', 'crochet-batman']);
  assertArrangementSound(design);
});

test('packing is deterministic: the same gifts give the same arrangement', () => {
  const kinds = ['magazine', 'choc-ferrero', 'crochet-turtle', 'choc-silk', 'beauty-mars-gloss'];
  const once = build(kinds);
  const twice = build(kinds);

  assert.deepEqual(
    once.gifts.map((g) => [g.kindId, g.position, g.rotation]),
    twice.gifts.map((g) => [g.kindId, g.position, g.rotation])
  );
});

test('the big awkward things are placed before the small ones', () => {
  /* Not an arbitrary preference: a magazine put down last has
     nowhere to go, while a lip gloss always does. The ordering is
     visible in where they end up — the magazine takes an edge. */
  const design = build(['beauty-mars-gloss', 'crochet-panda', 'magazine']);
  const magazine = design.gifts.find((g) => g.kindId === 'magazine');
  const room = interior(getBoxVariant(design.box));
  const bounds = aabbOf(worldBoxes(getGiftKind('magazine'), placementOf(magazine, getGiftKind('magazine'))));

  const touchesAnEdge =
    Math.abs(bounds.min[0] + room.halfX) < 1.2 ||
    Math.abs(bounds.max[0] - room.halfX) < 1.2 ||
    Math.abs(bounds.min[2] + room.halfZ) < 1.2 ||
    Math.abs(bounds.max[2] - room.halfZ) < 1.2;

  assert.ok(touchesAnEdge, 'the largest item was packed against a wall');
  assertArrangementSound(design);
});

/* ------------------------------------------------- honest failure */

test('a gift too big for the box is reported, not shrunk and not dropped', () => {
  /* The bouquet stands 14cm; an 8 × 8 × 4 in box has 8.76cm of
     headroom over its lining. */
  const design = add(createDesign({ boxVariantId: SMALL }), 'mini-bouquet');

  assert.equal(design.gifts.length, 1, 'it is still in the hamper');
  assert.equal(design.gifts[0].placed, false, 'and it is marked as not fitting');
  assert.equal(design.gifts[0].scale, 1, 'nothing was shrunk to make it fit');

  const summary = arrangementSummary(design);
  assert.equal(summary.ok, false);
  assert.equal(summary.unplaced.length, 1);
});

test('a box filled past what it can hold keeps the arrangement it had', () => {
  let design = createDesign({ boxVariantId: SMALL });
  const big = ['magazine', 'photo-frame', 'mini-bouquet'];

  big.forEach((kindId) => {
    const before = design;
    design = add(design, kindId);
    /* Whatever happened, what was already placed is still sound. */
    assertArrangementSound(design, `${kindId}: `);
    assert.ok(design.gifts.length >= before.gifts.length, 'nothing was thrown away');
  });
});

test('a gift that would not fit before is picked up once room is made', () => {
  /* A 12 × 10 × 4 in hamper is 28.68 × 23.6 cm of usable floor. A
     magazine is 15 × 21 and an A4 frame is 15 × 20: either one on
     its own is comfortable, and there is no way to lay both. */
  let design = build(['photo-frame', 'magazine'], MEDIUM);

  const frame = () => design.gifts.find((g) => g.kindId === 'photo-frame');
  assert.equal(frame().placed, false, 'there was genuinely no room for it');

  const magazine = design.gifts.find((g) => g.kindId === 'magazine');
  design = designReducer(design, { type: 'remove-gift', uid: magazine.uid });

  assert.equal(frame().placed, true, 'taking the magazine out made room, and the repack noticed');
  assertArrangementSound(design);
});

/* -------------------------------------------------- rearrangement */

test('a bigger box takes gifts that the smaller one could not', () => {
  let design = createDesign({ boxVariantId: SMALL });
  design = add(design, 'mini-bouquet');
  assert.equal(design.gifts[0].placed, false);

  design = designReducer(design, { type: 'box', patch: { variantId: BIG } });
  assert.equal(design.gifts[0].placed, true, 'the extra-large box took it');
  assertArrangementSound(design);
});

test('swapping down to a smaller box keeps every gift and flags what no longer fits', () => {
  let design = build(['mini-bouquet', 'magazine', 'choc-kitkat']);
  assert.equal(arrangementSummary(design).ok, true);

  design = designReducer(design, { type: 'box', patch: { variantId: SMALL } });

  assert.equal(design.gifts.length, 3, 'nothing was deleted');
  assert.equal(arrangementSummary(design).ok, false, 'and the problem is reported');
  /* Whatever is still standing in the box is legally placed. */
  assertArrangementSound(design);

  /* And the box it was packed in is still on record, so the swap can
     be undone. */
  assert.equal(design.arrangementBackup.variantId, BIG);
  const back = designReducer(design, { type: 'restore-arrangement' });
  assert.equal(back.box.variantId, BIG);
  assert.equal(arrangementSummary(back).ok, true, 'and everything fits again');
  assertArrangementSound(back);
});

test('asking for a rearrangement keeps every gift and leaves a sound box', () => {
  const design = build(['magazine', 'choc-ferrero', 'crochet-panda', 'perfume-honey-oud']);
  const after = designReducer(design, { type: 'rearrange' });

  assert.equal(after.gifts.length, design.gifts.length);
  assertArrangementSound(after);
});

test('removing a gift leaves the others where the customer watched them settle', () => {
  const design = build(['magazine', 'choc-ferrero', 'crochet-panda']);
  const panda = design.gifts.find((g) => g.kindId === 'crochet-panda');
  const before = design.gifts.filter((g) => g.uid !== panda.uid).map((g) => [...g.position]);

  const after = designReducer(design, { type: 'remove-gift', uid: panda.uid });

  assert.deepEqual(
    after.gifts.map((g) => [...g.position]),
    before,
    'nothing was shuffled for no reason'
  );
  assertArrangementSound(after);
});

test('resizing a gift packs it again rather than letting it grow into its neighbour', () => {
  let design = build(['mini-bouquet', 'perfume-honey-oud', 'magazine']);
  const bottle = design.gifts.find((g) => g.kindId === 'perfume-honey-oud');

  design = designReducer(design, { type: 'gift', uid: bottle.uid, patch: { scale: 1.35 } });

  assert.equal(design.gifts.find((g) => g.uid === bottle.uid).scale, 1.35);
  assertArrangementSound(design);
});

test('raising a quantity packs it again, because the extra copies take room', () => {
  let design = build(['choc-kitkat', 'magazine', 'mini-bouquet']);
  const bar = design.gifts.find((g) => g.kindId === 'choc-kitkat');

  design = designReducer(design, { type: 'gift', uid: bar.uid, patch: { quantity: 3 } });

  assert.equal(design.gifts.find((g) => g.uid === bar.uid).quantity, 3);
  assertArrangementSound(design);
});

/* ------------------------------------------------------ guard rails */

test('validateArrangement catches a design that has been edited by hand', () => {
  const design = build(['choc-ferrero', 'magazine']);
  assert.equal(validateArrangement(design).ok, true);

  /* What a tampered record in devtools looks like. */
  const stacked = {
    ...design,
    gifts: design.gifts.map((g) => ({ ...g, position: [0, g.position[1], 0] }))
  };
  const result = validateArrangement(stacked);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.reason === 'overlap'));

  const outside = { ...design, gifts: design.gifts.map((g) => ({ ...g, position: [90, 0, 0] })) };
  assert.ok(validateArrangement(outside).problems.some((p) => p.reason === 'outside-box'));
});

test('packing a crowded box finishes quickly enough not to freeze a page', () => {
  const variant = getBoxVariant(BIG);
  const design = {
    ...createDesign({ boxVariantId: BIG }),
    /* Well past what a box may hold, so the packer does the most
       work it will ever be asked to do. */
    gifts: Array.from({ length: variant.capacity * 4 }, (_, i) =>
      createGift(GIFT_KINDS[i % GIFT_KINDS.length].id)
    )
  };

  const started = Date.now();
  const packed = applyPacking(design, packDesign(design));
  const took = Date.now() - started;

  assert.ok(took < 2000, `packing took ${took}ms`);
  assert.equal(packed.gifts.length, design.gifts.length, 'nothing was dropped');
  assertArrangementSound(packed);
});

test('packOne never returns a placement it has not checked', () => {
  const design = build(['magazine', 'photo-frame', 'choc-ferrero']);
  const variant = getBoxVariant(design.box);

  GIFT_KINDS.forEach((kind) => {
    const placement = packOne(design, createGift(kind.id));
    if (!placement) return;
    assert.ok(insideInterior(kind, variant, placement), `${kind.id} was offered a spot outside the box`);
  });
});
