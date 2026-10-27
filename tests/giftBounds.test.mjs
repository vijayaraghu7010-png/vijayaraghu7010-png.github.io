/* The interior of the box, and the room one gift needs inside it.
   The packer in packing.test.mjs is built on this; if the geometry
   here is wrong, every arrangement it produces is wrong with it. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LINING_CM,
  clampPosition,
  giftFitsInterior,
  interior,
  normaliseAngle,
  normaliseRotation,
  orientedBounds,
  positionLimits,
  rotationMatrix
} from '../src/lib/giftBounds.js';
import { getBoxVariant, getGiftKind } from '../src/data/hamperKit.js';

const KIND = getGiftKind('choc-ferrero'); // 18 x 4 x 4.5, no resizing
const TALL = getGiftKind('perfume-honey-oud'); // 6 x 12 x 3.6, resizable
/* 14 × 14 × 6 in — the roomiest Large. Outer 35.56 × 35.56 × 15.24
   cm, and a cavity of 34.36 × 13.64 × 34.36 once its 0.6 cm walls,
   0.6 cm base, 0.7 cm lid and 0.3 cm hinge clearance are off. */
const BOX = getBoxVariant('box-large-14x14x6');
const SMALL = getBoxVariant('box-small-8x8x4'); // cavity 19.52 x 9.06 x 19.52
const close = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

test('an angle is folded into one turn without being nudged off its value', () => {
  assert.equal(normaliseAngle(0.8), 0.8, 'an angle already in range is returned exactly');
  assert.equal(normaliseAngle(0), 0);
  assert.ok(close(normaliseAngle(-Math.PI / 2), (3 * Math.PI) / 2));
  assert.ok(normaliseAngle(Math.PI * 9.5) >= 0 && normaliseAngle(Math.PI * 9.5) < Math.PI * 2);
  assert.equal(normaliseAngle(Number.NaN), 0);
  assert.equal(normaliseAngle('sideways'), 0);
  assert.deepEqual(normaliseRotation(null), [0, 0, 0]);
  assert.deepEqual(normaliseRotation([0.2, 0.3, 0.4]), [0.2, 0.3, 0.4]);
});

test('an upright gift occupies exactly its own size, centred half its height up', () => {
  const { half, centre } = orientedBounds(KIND, { scale: 1, rotation: [0, 0, 0] });

  assert.ok(close(half[0], 9));
  assert.ok(close(half[1], 2));
  assert.ok(close(half[2], 2.25));
  assert.deepEqual(centre.map((n) => Number(n.toFixed(6))), [0, 2, 0]);
});

test('turning a gift swaps the room it needs, and moves where its middle is', () => {
  /* A quarter turn about the upright axis swaps across and along. */
  const spun = orientedBounds(KIND, { rotation: [0, Math.PI / 2, 0] });
  assert.ok(close(spun.half[0], 2.25));
  assert.ok(close(spun.half[2], 9));
  assert.ok(close(spun.half[1], 2), 'and leaves the height alone');

  /* Tipped onto its end, the 18cm length becomes the height — and
     the middle of it is no longer above the point it stands on. */
  const tipped = orientedBounds(KIND, { rotation: [0, 0, Math.PI / 2] });
  assert.ok(close(tipped.half[0], 2));
  assert.ok(close(tipped.half[1], 9));
  assert.ok(close(tipped.centre[0], -2), 'the middle swung out sideways');
  assert.ok(close(tipped.centre[1], 0));
});

test('the rotation matrix matches the euler order the scene draws with', () => {
  /* A quarter turn about Y takes +Z to +X, which is what three.js
     does for the same euler triple. If these disagree, the clamp is
     guarding a different shape from the one on screen. */
  const m = rotationMatrix([0, Math.PI / 2, 0]);
  const z = [m[0][2], m[1][2], m[2][2]];
  assert.ok(close(z[0], 1, 1e-9) && close(z[1], 0, 1e-9) && close(z[2], 0, 1e-9));
});

test('scaling only grows a gift the kit lets be scaled', () => {
  assert.ok(orientedBounds(TALL, { scale: 1.3 }).half[1] > orientedBounds(TALL, { scale: 1 }).half[1]);
  assert.ok(close(orientedBounds(KIND, { scale: 1.3 }).half[1], orientedBounds(KIND, { scale: 1 }).half[1]));
});

test('the usable interior is the cavity less its lining', () => {
  const room = interior(BOX);
  const [cavityX, cavityY, cavityZ] = BOX.size;
  const lining = BOX.construction.lining;

  assert.ok(close(room.halfX, cavityX / 2 - lining));
  assert.ok(close(room.halfZ, cavityZ / 2 - lining));
  assert.equal(room.floor, 0);
  assert.ok(close(room.ceiling, cavityY - lining));

  /* And the cavity is the quoted outer box less what it is built
     from, so the chain from catalogue to collision boundary is one
     sum with no spare constants in it. */
  assert.ok(close(cavityX, BOX.outer[0] - BOX.construction.wall * 2));
  assert.ok(
    close(
      cavityY,
      BOX.outer[1] - BOX.construction.base - BOX.construction.lid - BOX.construction.hinge
    )
  );
  assert.ok(close(room.ceiling, BOX.usable[1]));
  assert.ok(close(room.halfX * 2, BOX.usable[0]));

  /* LINING_CM is only a fallback for a box with no construction of
     its own; a catalogue box uses its own figure. */
  assert.ok(Number.isFinite(LINING_CM));
});

test('a gift placed at its limit is touching the wall, not through it and not short of it', () => {
  const limits = positionLimits(KIND, BOX, { scale: 1, rotation: [0, 0, 0] });
  const room = interior(BOX);
  const { half, centre } = orientedBounds(KIND, { scale: 1, rotation: [0, 0, 0] });

  assert.ok(close(limits.x[1] + centre[0] + half[0], room.halfX), 'right at the right-hand wall');
  assert.ok(close(limits.x[0] + centre[0] - half[0], -room.halfX), 'left at the left-hand wall');
  assert.ok(close(limits.z[1] + centre[2] + half[2], room.halfZ));
  assert.ok(close(limits.y[0] + centre[1] - half[1], room.floor), 'resting on the lining');
  assert.ok(close(limits.y[1] + centre[1] + half[1], room.ceiling), 'and just under the lid');
});

test('clamping pulls a position back inside on every axis at once', () => {
  const clamped = clampPosition([999, 999, -999], KIND, BOX);
  const limits = positionLimits(KIND, BOX);

  assert.ok(close(clamped[0], limits.x[1]));
  assert.ok(close(clamped[1], limits.y[1]));
  assert.ok(close(clamped[2], limits.z[0]));
});

test('a position already inside the box is left exactly as it is', () => {
  const inside = [2, 3, -4];
  assert.deepEqual(clampPosition(inside, KIND, BOX), inside);
});

test('nothing a customer can type produces a position that is not a number', () => {
  [
    [NaN, NaN, NaN],
    [Infinity, -Infinity, 0],
    ['left', null, undefined],
    null,
    'nowhere'
  ].forEach((junk) => {
    const clamped = clampPosition(junk, KIND, BOX);
    assert.equal(clamped.length, 3);
    clamped.forEach((n) => assert.ok(Number.isFinite(n), `${JSON.stringify(junk)} gave ${n}`));
  });
});

test('a gift too big for the box is centred rather than thrown at a wall', () => {
  /* A 20cm-deep frame in a small box whose cavity is 19.52cm across:
     the range has no width, so both ends of it are the same place,
     and that place is the middle. */
  const frame = getGiftKind('photo-frame');
  const small = SMALL;

  assert.equal(giftFitsInterior(frame, small), false);
  const limits = positionLimits(frame, small);
  assert.ok(close(limits.z[0], limits.z[1]), 'the range has collapsed');

  const clamped = clampPosition([99, 0, 99], frame, small);
  clamped.forEach((n) => assert.ok(Number.isFinite(n)));
  assert.ok(close(clamped[2], limits.z[0]));
});

test('a gift fits the interior until it is turned or grown past it', () => {
  assert.equal(giftFitsInterior(KIND, BOX), true, '18cm across a 34.36cm cavity');
  assert.equal(giftFitsInterior(KIND, SMALL), true, 'and a 19.52cm one, just');

  /* Tipped on its end the Ferrero box is 18cm tall, which is more
     headroom than any hamper the shop stocks has: the deepest is
     7 inches outside and 15.48cm usable. */
  assert.equal(giftFitsInterior(KIND, SMALL, { rotation: [0, 0, Math.PI / 2] }), false);
  assert.equal(giftFitsInterior(KIND, BOX, { rotation: [0, 0, Math.PI / 2] }), false);
  assert.equal(
    giftFitsInterior(KIND, getBoxVariant('box-xlarge-18x18x7'), { rotation: [0, 0, Math.PI / 2] }),
    false,
    '18cm on its end does not go under even the deepest lid'
  );
});

