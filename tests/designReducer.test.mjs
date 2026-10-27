import test from 'node:test';
import assert from 'node:assert/strict';

import { designReducer, isCosmetic } from '../src/lib/designReducer.js';
import { createDesign, createGift, validateDesign } from '../src/lib/designSchema.js';
import { BOX_VARIANTS, GIFT_KINDS, getBoxVariant, getGiftKind, giftUnitPrice } from '../src/data/hamperKit.js';
import { arrangementSummary, giftCouldFit, smallestBoxFor, validateArrangement } from '../src/lib/packing.js';

const add = (design, kindId) => designReducer(design, { type: 'add-gift', kindId });

const SMALL = 'box-small-8x8x4';
const BIG = 'box-xlarge-18x18x7';

test('every real change bumps the revision, which is what orders saves', () => {
  let design = createDesign();
  assert.equal(design.revision, 1);

  design = add(design, 'crochet-panda');
  assert.equal(design.revision, 2);

  design = designReducer(design, { type: 'box', patch: { boxColourId: 'navy' } });
  assert.equal(design.revision, 3);

  design = designReducer(design, { type: 'message', patch: { body: 'hello' } });
  assert.equal(design.revision, 4);
});

test('selecting and moving the camera do not count as unsaved work', () => {
  let design = add(createDesign(), 'crochet-panda');
  const before = design.revision;

  design = designReducer(design, { type: 'select', uid: design.gifts[0].uid });
  design = designReducer(design, { type: 'camera', camera: { position: [1, 2, 3], target: [0, 0, 0] } });

  assert.equal(design.revision, before, 'the revision is unchanged');
  assert.equal(design.editing.selectedGiftUid, design.gifts[0].uid, 'but the change was still applied');
  assert.ok(isCosmetic('select') && isCosmetic('camera'));
});

test('a change the reducer refuses returns the very same object, so nothing is written', () => {
  const design = createDesign();
  const same = designReducer(design, { type: 'add-gift', kindId: 'no-such-gift' });
  assert.equal(same, design);

  const withGift = add(design, 'crochet-panda');
  assert.equal(designReducer(withGift, { type: 'remove-gift', uid: 'gift-nope' }), withGift);
});

test('a box cannot be filled past the most separate gifts it will take', () => {
  /* The ceiling is a safety limit rather than a capacity claim —
     whether six things fit a 6 × 4 × 2 in box is the packer's answer
     and almost always no. What is asserted here is that the reducer
     stops accepting gifts at the limit, and that it does so by
     refusing rather than by discarding. */
  const small = BOX_VARIANTS[0];
  let design = createDesign({ boxVariantId: small.id });

  const kinds = [
    'crochet-panda',
    'choc-ferrero',
    'choc-kitkat',
    'choc-silk',
    'beauty-mars-gloss',
    'magazine',
    'photo-frame',
    'polaroid-pack'
  ];
  kinds.forEach((kindId) => {
    design = add(design, kindId);
  });

  assert.ok(kinds.length > small.capacity, 'the test offers more than the box will take');
  assert.equal(design.gifts.length, small.capacity);
});

test('adding a second of the same plain gift raises its quantity instead of stacking a mesh', () => {
  let design = add(createDesign(), 'choc-ferrero');
  design = add(design, 'choc-ferrero');

  assert.equal(design.gifts.length, 1);
  assert.equal(design.gifts[0].quantity, 2);

  /* And never past what the kit allows. */
  design = add(design, 'choc-ferrero');
  assert.equal(design.gifts[0].quantity, 2, 'the Ferrero box tops out at 2');
});

test('a gift that carries a photo or text stays its own entry, so two photos never share one', () => {
  let design = add(createDesign(), 'polaroid-pack');
  design = add(design, 'polaroid-pack');

  assert.equal(design.gifts.length, 2);
  assert.notEqual(design.gifts[0].uid, design.gifts[1].uid);
});

test('scale only applies to gifts that support it, and never to nothing', () => {
  let design = add(createDesign(), 'perfume-honey-oud'); // supportsScale
  design = add(design, 'choc-ferrero'); // does not

  const [perfume, ferrero] = design.gifts;
  design = designReducer(design, { type: 'gift', uid: perfume.uid, patch: { scale: 1.3 } });
  design = designReducer(design, { type: 'gift', uid: ferrero.uid, patch: { scale: 1.3 } });

  assert.equal(design.gifts[0].scale, 1.3);
  assert.equal(design.gifts[1].scale, 1, 'left alone');

  /* Nothing can make a gift vanish or turn inside out. */
  [0, -2, NaN, Infinity].forEach((bad) => {
    const next = designReducer(design, { type: 'gift', uid: perfume.uid, patch: { scale: bad } });
    assert.ok(next.gifts[0].scale > 0 && Number.isFinite(next.gifts[0].scale), `scale ${bad} was refused`);
  });

  assert.ok(getGiftKind('perfume-honey-oud').supportsScale && !getGiftKind('choc-ferrero').supportsScale);
});

test('a variant is only accepted if the kit offers it', () => {
  let design = add(createDesign(), 'crochet-animals');
  const uid = design.gifts[0].uid;

  design = designReducer(design, { type: 'gift', uid, patch: { variantId: 'cat' } });
  assert.equal(design.gifts[0].variantId, 'cat');

  design = designReducer(design, { type: 'gift', uid, patch: { variantId: 'free-pony' } });
  assert.equal(design.gifts[0].variantId, 'cat', 'unchanged');
});

test('removing a gift clears it from the selection', () => {
  let design = add(createDesign(), 'crochet-panda');
  const uid = design.gifts[0].uid;
  assert.equal(design.editing.selectedGiftUid, uid);

  design = designReducer(design, { type: 'remove-gift', uid });
  assert.equal(design.editing.selectedGiftUid, null);
  assert.equal(design.gifts.length, 0);
});

test('replacing the design (opening a saved one) does not bump its revision', () => {
  const saved = { ...createDesign({ name: 'Saved' }), revision: 12 };
  const design = designReducer(add(createDesign(), 'crochet-panda'), { type: 'replace', design: saved });

  assert.equal(design.revision, 12);
  assert.equal(design.name, 'Saved');
});

test('a gift taller than the box is kept and flagged, not thrown away', () => {
  /* The bouquet stands 14cm; the small box is 12cm inside. The
     catalogue panel disables it there and says which box it needs,
     so this path is the backstop rather than the normal route — and
     the backstop keeps the customer's choice and reports it rather
     than dropping it on the floor. */
  const small = createDesign({ boxVariantId: SMALL });
  const added = designReducer(small, { type: 'add-gift', kindId: 'mini-bouquet' });

  assert.equal(added.gifts.length, 1, 'it is in the hamper');
  assert.equal(added.gifts[0].placed, false, 'and marked as not fitting');
  assert.equal(added.gifts[0].scale, 1, 'nothing was shrunk to force it in');
  assert.equal(arrangementSummary(added).ok, false);

  const big = createDesign({ boxVariantId: BIG });
  assert.equal(add(big, 'mini-bouquet').gifts.length, 1, 'accepted by a box tall enough for it');

  const bouquet = getGiftKind('mini-bouquet');
  assert.equal(giftCouldFit(bouquet, getBoxVariant(SMALL)), false);
  assert.equal(giftCouldFit(bouquet, getBoxVariant(BIG)), true);
  /* 14cm standing, and only the deepest hamper the shop stocks has
     the headroom for it. */
  assert.equal(smallestBoxFor(bouquet).id, BIG);
});

test('every gift in the kit fits at least one box, and the kit is priceable', () => {
  /* A gift no box can hold would sit in the panel permanently
     disabled, which is a data mistake rather than a design choice. */
  GIFT_KINDS.forEach((kind) => {
    assert.ok(smallestBoxFor(kind), `${kind.id} does not fit any box`);
    assert.ok(giftUnitPrice(kind) !== null && giftUnitPrice(kind) > 0, `${kind.id} has no price`);
    assert.ok(kind.size.every((n) => n > 0), `${kind.id} has a zero dimension`);
    assert.ok((kind.maxQty || 1) >= 1);
  });
});

test('a box swapped down for a smaller one keeps the gift and says it will not fit', () => {
  let design = createDesign({ boxVariantId: BIG });
  design = add(design, 'mini-bouquet');
  design = designReducer(design, { type: 'box', patch: { variantId: SMALL } });

  assert.equal(design.gifts.length, 1, 'the bouquet is still in the hamper');

  const result = validateDesign(design);
  assert.equal(result.ok, true);
  const note = result.notes.find((n) => n.kind === 'too-tall');
  assert.ok(note, 'the mismatch is reported');
  assert.deepEqual(note.gifts, ['Handmade bouquet']);
  assert.equal(result.design.gifts.length, 1, 'and still not deleted');
});

test('every kind in the kit names a model and says how far it can be trusted', () => {
  const allowed = new Set(['approximate', 'placeholder', 'verified']);
  GIFT_KINDS.forEach((kind) => {
    assert.ok(kind.model, `${kind.id} names no model`);
    assert.ok(allowed.has(kind.reconstructionStatus), `${kind.id} has no reconstruction status`);
    assert.ok(kind.category, `${kind.id} is in no category`);
    /* Nothing may claim to be verified: none of them has been
       measured against the real object. */
    assert.notEqual(kind.reconstructionStatus, 'verified', `${kind.id} claims to be verified`);
  });
});

test('createGift makes a gift the reducer and the schema both recognise', () => {
  const gift = createGift('crochet-panda');
  assert.equal(gift.rotation.length, 3);
  assert.equal(gift.position.length, 3);
  assert.equal(gift.scale, 1);
  assert.equal(createGift('no-such-kind'), null);
});
