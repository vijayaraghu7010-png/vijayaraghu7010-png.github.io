/* ===========================================================
   Where a gift is allowed to be.

   The interior of the box, as a volume, and what one gift occupies
   inside it. The packer in src/lib/packing.js does the arranging;
   this is the geometry it and the schema both measure against, so
   that a design read back off disk is judged by exactly the same
   rules that placed it in the first place.

   The maths is an oriented box against an axis-aligned one. A gift
   is modelled standing on its own origin: its local box spans
   y from 0 to h, and x and z from -w/2..w/2 and -d/2..d/2. Turning
   it rotates about that origin — the point it stands on — so the
   rotated box's middle moves, which is why the vertical clamp below
   is not simply `0 .. innerHeight - h`.

   Pure. No three.js, no browser. Tested in tests/giftBounds.test.mjs.
   =========================================================== */

import { SCALE_MAX, SCALE_MIN } from '../data/hamperKit';

/* The crinkle paper a gift stands on, and the paper up the sides.
   Only a fallback: every box in src/data/hamperBoxes.js carries its
   own lining thickness in its construction, and that is what is
   used. This is what a box reconstructed from an odd saved record
   gets if its construction is missing. */
export const LINING_CM = 0.4;

const TAU = Math.PI * 2;

/* Folded into one turn, but only when it is outside one.

   The obvious `((v % TAU) + TAU) % TAU` is not used, because for an
   angle that is already in range it returns a different float: 0.8
   comes back as 0.7999999999999998. That difference is invisible on
   screen and very visible in a saved record and a test. */
export const normaliseAngle = (a) => {
  const v = Number(a);
  if (!Number.isFinite(v)) return 0;
  if (v >= 0 && v < TAU) return v;
  const wrapped = v % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
};

const num = (n, fallback = 0) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
};

export function clampNumber(n, min, max, fallback = min) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, v));
}

/* A rotation triple is always three finite numbers, each folded into
   one turn so a saved design does not accumulate 400 radians of spin. */
export function normaliseRotation(rotation) {
  const r = Array.isArray(rotation) ? rotation : [0, 0, 0];
  return [normaliseAngle(r[0]), normaliseAngle(r[1]), normaliseAngle(r[2])];
}

/* Rotation matrix for an XYZ-ordered euler triple, row-major.
   Matches three.js's default euler order, which is what the scene
   applies — the two must agree or the clamp guards a different shape
   from the one on screen. */
export function rotationMatrix([rx, ry, rz]) {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  return [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy]
  ];
}

const applyMatrix = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
];

/* The size a gift is actually drawn at. Scale only applies to kinds
   that allow it, so a resized record of a kind that does not cannot
   quietly grow the thing. */
export function giftExtent(kind, scale = 1) {
  if (!kind) return [3, 3, 3];
  const factor = kind.supportsScale ? clampNumber(scale, SCALE_MIN, SCALE_MAX, 1) : 1;
  const [w, h, d] = kind.size;
  return [w * factor, h * factor, d * factor];
}

/* The axis-aligned box that a turned gift really occupies, and where
   its middle sits relative to the point it stands on.

   `half` is half-extents in world axes; `centre` is the offset from
   the gift's origin to the middle of that box. For an upright gift
   that is [0, h/2, 0]; turned onto its side it is not. */
export function orientedBounds(kind, { scale = 1, rotation = [0, 0, 0] } = {}) {
  const [w, h, d] = giftExtent(kind, scale);
  const m = rotationMatrix(normaliseRotation(rotation));

  /* |R| · halfExtents is the standard AABB of an oriented box. */
  const local = [w / 2, h / 2, d / 2];
  const half = [0, 1, 2].map((row) =>
    Math.abs(m[row][0]) * local[0] + Math.abs(m[row][1]) * local[1] + Math.abs(m[row][2]) * local[2]
  );

  return { half, centre: applyMatrix(m, [0, h / 2, 0]), size: [w, h, d] };
}

/* The air inside the box: half-widths across and along, and the
   headroom under the lid.

   `variant.size` is the structural cavity — the box's outer
   dimensions less its walls, base, lid slab and hinge travel, all
   of which src/data/hamperBoxes.js has already taken off. What is
   left to take off here is the lining, and the lining alone: paper
   under the gift and paper up each of the four sides.

   The floor is zero because a gift's own origin is the point it
   stands on, and the scene stands it on top of the lining. So the
   headroom is the cavity less the one lining thickness beneath it,
   not less two. */
export function interior(variant) {
  const [w, h, d] = variant.size;
  const lining = Number.isFinite(Number(variant.construction?.lining))
    ? Number(variant.construction.lining)
    : LINING_CM;

  return {
    halfX: Math.max(0, w / 2 - lining),
    halfZ: Math.max(0, d / 2 - lining),
    floor: 0,
    ceiling: Math.max(0, h - lining),
    lining
  };
}

/* The range each coordinate of a gift's origin may take.

   A gift too big for the box in some direction gets a zero-width
   range centred on 0 rather than an inverted one, so clamping it is
   still defined and it lands in the middle instead of jumping to a
   wall. */
export function positionLimits(kind, variant, { scale = 1, rotation = [0, 0, 0] } = {}) {
  const room = interior(variant);
  const { half, centre } = orientedBounds(kind, { scale, rotation });

  const span = (limit, extent, offset) => {
    const reach = limit - extent;
    if (reach <= 0) return [-offset, -offset];
    return [-reach - offset, reach - offset];
  };

  const [minX, maxX] = span(room.halfX, half[0], centre[0]);
  const [minZ, maxZ] = span(room.halfZ, half[2], centre[2]);

  /* Vertically the floor and the lid are not symmetrical, so this one
     is written out rather than shared with the span helper. */
  const minY = room.floor + half[1] - centre[1];
  const maxY = room.ceiling - half[1] - centre[1];

  return {
    x: [minX, maxX],
    y: minY > maxY ? [(minY + maxY) / 2, (minY + maxY) / 2] : [minY, maxY],
    z: [minZ, maxZ]
  };
}

/* Does this gift fit inside this box at all, at the size and angle
   it is being drawn? Answered separately from clamping because the
   panel needs to say so in words. */
export function giftFitsInterior(kind, variant, { scale = 1, rotation = [0, 0, 0] } = {}) {
  const room = interior(variant);
  const { half } = orientedBounds(kind, { scale, rotation });
  return half[0] <= room.halfX && half[2] <= room.halfZ && half[1] * 2 <= room.ceiling - room.floor;
}

/* Pull a position back inside the box. The one function every mover
   goes through. */
export function clampPosition(position, kind, variant, { scale = 1, rotation = [0, 0, 0] } = {}) {
  const limits = positionLimits(kind, variant, { scale, rotation });
  const p = Array.isArray(position) ? position : [0, 0, 0];

  return [
    clampNumber(num(p[0]), limits.x[0], limits.x[1], 0),
    clampNumber(num(p[1]), limits.y[0], limits.y[1], limits.y[0]),
    clampNumber(num(p[2]), limits.z[0], limits.z[1], 0)
  ];
}
