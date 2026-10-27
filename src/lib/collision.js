/* ===========================================================
   What space a product actually takes up, and whether two
   products are in the same place.

   Two decisions shape everything here.

   The first is about which ways up a gift may be. Almost always
   just the one: a hamper is packed with bottles standing up and
   bars lying flat, and tipping a perfume bottle onto its side to
   win a centimetre is not something a person packing a real box
   would do. A few things — a tall tumbler — really are packed
   lying down, and those kinds say so in the manifest.

   So a gift has a yaw, freely, and a tilt that is only ever a
   quarter turn about Z: upright, or laid on its side. A quarter
   turn is an exact permutation of the box's axes rather than a
   rotation, so after the tilt is applied every box is still
   upright-with-a-yaw. That keeps the collision test what it was:
   a 2D separating-axis test across the floor plus an interval
   overlap up the wall — cheap, and exact rather than conservative.

   The second is that a product is not one box. A crocheted doll is
   a body with a smaller head on it; a bouquet is a narrow cone with
   a wide spray of flowers above it. Wrapping either in a single box
   claims space it does not use, and in a box this size that is the
   difference between a gift fitting and the packer giving up. So a
   kind may declare several boxes, and the test is run over the
   pairs of them.

   Pure. No three.js. Tested in tests/packing.test.mjs.
   =========================================================== */

import { SCALE_MAX, SCALE_MIN } from '../data/hamperKit';

/* The box a product gets when it has not said otherwise: its whole
   declared size, sitting on the origin. Written as fractions of
   `size` so a kind's proxy survives the kind being re-measured.

   [centre x, centre y, centre z, half x, half y, half z] */
export const DEFAULT_PROXY = [[0, 0.5, 0, 0.5, 0.5, 0.5]];

/* How much air a product wants around it. Gifts in a hamper do touch,
   but packing them edge to edge looks like a shipping carton rather
   than a present, and leaves no room for the tissue. A kind may ask
   for more — something fragile, or something with a bow that the
   collision boxes do not describe. */
export const DEFAULT_CLEARANCE = 0.4;

const clampScale = (kind, scale) =>
  kind?.supportsScale ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, Number(scale) || 1)) : 1;

/* The quarter turns about Z a gift may be laid at. Snapped, because
   the exact permutation below is only exact at a quarter turn, and a
   saved record carrying 1.5707964 rather than Math.PI / 2 must not
   quietly become a rotation nobody is testing against. */
export const TILT_UPRIGHT = 0;
export const TILT_ON_SIDE = -Math.PI / 2;

export function snapTilt(angle) {
  const raw = Number(angle);
  if (!Number.isFinite(raw)) return 0;

  /* Folded to the nearer side of the turn before it is snapped. A
     saved record keeps its angles in [0, 2π), so the quarter turn
     the packer wrote as −π/2 comes back as 3π/2 — the same rotation,
     and a different sign. Snapping that without folding it first
     would lay the gift over the other way, which is a visibly
     different box of a different height. */
  const turn = Math.PI * 2;
  let v = raw % turn;
  if (v < 0) v += turn;
  if (v > Math.PI) v -= turn;

  if (Math.abs(v) < Math.PI / 4) return 0;
  return v < 0 ? -Math.PI / 2 : Math.PI / 2;
}

/* Lay a box over by a quarter turn about Z.

   Rz(θ) sends (x, y) to (x cos θ − y sin θ, x sin θ + y cos θ). At
   θ = −π/2 that is (y, −x), and at +π/2 it is (−y, x) — so the x
   and y half-extents swap and the centre moves with them. Written
   out rather than run through a matrix because at a quarter turn
   there is no trigonometry to do and no float dust to accumulate:
   a 9 cm tumbler laid down is exactly 9 cm tall afterwards.

   The result sits below the floor, since the gift was standing on
   its origin and is now lying across it. Nothing re-grounds it
   here — the packer lifts a gift to its resting height, and that is
   computed from these boxes. */
function tiltBox({ centre, half }, tilt) {
  if (!tilt) return { centre, half };

  const swapped = [half[1], half[0], half[2]];

  return tilt < 0
    ? { centre: [centre[1], -centre[0], centre[2]], half: swapped }
    : { centre: [-centre[1], centre[0], centre[2]], half: swapped };
}

/* The boxes one gift occupies, in its own space, at the size it is
   drawn and the way up it is laid. Still unyawed. */
export function localBoxes(kind, scale = 1, tilt = 0) {
  if (!kind) return [];
  const factor = clampScale(kind, scale);
  const [w, h, d] = kind.size.map((n) => n * factor);
  const proxy = Array.isArray(kind.proxy) && kind.proxy.length ? kind.proxy : DEFAULT_PROXY;
  const lay = snapTilt(tilt);

  return proxy.map(([cx, cy, cz, hx, hy, hz]) =>
    tiltBox({ centre: [cx * w, cy * h, cz * d], half: [hx * w, hy * h, hz * d] }, lay)
  );
}

/* The same boxes, turned and put down in the hamper.

   The tilt is applied first and leaves every box upright again, so
   `yaw` is the only rotation left: each box keeps its own
   half-extents and carries a turned centre. The axes it is tested
   against come from the yaw, not from the box.

   This is the same composition the scene draws — a gift's stored
   rotation is [0, yaw, tilt], and an XYZ euler with no X term is
   Ry · Rz, which is the yaw applied after the tilt. */
export function worldBoxes(kind, { position = [0, 0, 0], yaw = 0, scale = 1, tilt = 0 } = {}) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  return localBoxes(kind, scale, tilt).map(({ centre, half }) => ({
    centre: [
      position[0] + centre[0] * cos + centre[2] * sin,
      position[1] + centre[1],
      position[2] + -centre[0] * sin + centre[2] * cos
    ],
    half,
    yaw
  }));
}

/* The upright box that contains all of them — the broad phase, and
   also what the interior check uses. */
export function aabbOf(boxes) {
  if (!boxes.length) return null;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  boxes.forEach(({ centre, half, yaw }) => {
    const cos = Math.abs(Math.cos(yaw));
    const sin = Math.abs(Math.sin(yaw));
    /* A box turned about the upright axis reaches further across the
       floor than its own half-extents; up the wall it does not. */
    const reach = [half[0] * cos + half[2] * sin, half[1], half[0] * sin + half[2] * cos];

    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], centre[i] - reach[i]);
      max[i] = Math.max(max[i], centre[i] + reach[i]);
    }
  });

  return { min, max };
}

/* The whole of one gift, as one upright box. */
export function giftAabb(kind, placement) {
  return aabbOf(worldBoxes(kind, placement));
}

const aabbApart = (a, b, gap) =>
  a.max[0] + gap <= b.min[0] ||
  b.max[0] + gap <= a.min[0] ||
  a.max[1] + gap <= b.min[1] ||
  b.max[1] + gap <= a.min[1] ||
  a.max[2] + gap <= b.min[2] ||
  b.max[2] + gap <= a.min[2];

/* Two boxes, turned about the upright axis, with a gap between them.

   Up the wall they are plain intervals. Across the floor it is a
   separating-axis test on four axes — the two boxes' own, and that
   is the whole of it for rectangles. If any axis separates them by
   more than the gap, they are apart. */
function boxesApart(a, b, gap) {
  /* up the wall */
  if (a.centre[1] + a.half[1] + gap <= b.centre[1] - b.half[1]) return true;
  if (b.centre[1] + b.half[1] + gap <= a.centre[1] - a.half[1]) return true;

  const dx = b.centre[0] - a.centre[0];
  const dz = b.centre[2] - a.centre[2];

  const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2];

  for (let i = 0; i < axes.length; i += 1) {
    const ax = Math.cos(axes[i]);
    const az = -Math.sin(axes[i]);

    /* How far each box reaches along this axis. */
    const reach = (box) => {
      const c = Math.cos(box.yaw);
      const s = -Math.sin(box.yaw);
      /* the box's own two floor axes, projected */
      const u = Math.abs(ax * c + az * s);
      const v = Math.abs(ax * -s + az * c);
      return box.half[0] * u + box.half[2] * v;
    };

    const distance = Math.abs(dx * ax + dz * az);
    if (distance >= reach(a) + reach(b) + gap) return true;
  }

  return false;
}

/* Do these two placed gifts share space?

   The upright box is tried first and settles most pairs in a few
   comparisons. Only a pair that survives it is measured box by box,
   which is where a doll's head stops claiming the air beside its
   body. */
export function giftsCollide(aKind, aPlacement, bKind, bPlacement, { clearance } = {}) {
  const gap =
    clearance ??
    Math.max(aKind?.clearance ?? DEFAULT_CLEARANCE, bKind?.clearance ?? DEFAULT_CLEARANCE);

  const aBoxes = worldBoxes(aKind, aPlacement);
  const bBoxes = worldBoxes(bKind, bPlacement);
  if (!aBoxes.length || !bBoxes.length) return false;

  if (aabbApart(aabbOf(aBoxes), aabbOf(bBoxes), gap)) return false;

  for (let i = 0; i < aBoxes.length; i += 1) {
    for (let j = 0; j < bBoxes.length; j += 1) {
      if (!boxesApart(aBoxes[i], bBoxes[j], gap)) return true;
    }
  }

  return false;
}

/* How deeply two gifts overlap, for reporting rather than for
   deciding. Zero when they are clear of each other. */
export function overlapDepth(aKind, aPlacement, bKind, bPlacement) {
  const a = giftAabb(aKind, aPlacement);
  const b = giftAabb(bKind, bPlacement);
  if (!a || !b) return 0;

  const spans = [0, 1, 2].map((i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]));
  return spans.some((n) => n <= 0) ? 0 : Math.min(...spans);
}
