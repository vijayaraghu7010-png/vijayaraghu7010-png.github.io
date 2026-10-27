/* ===========================================================
   Packing the hamper.

   The customer chooses what goes in; this decides where it goes.
   There are no direction buttons any more, so this is the only
   thing standing between a chosen gift and a box with a bouquet
   growing through the side of it.

   The method is the usual one for boxes of mixed things, and it is
   the one a person uses: put the big awkward items in first, around
   the edges, then fill the gaps with the small ones. Formally it is
   largest-first placement against a set of candidate corner points,
   each candidate validated against the walls and against everything
   already placed.

   Three properties it is written to have:

   - Deterministic. The same gifts in the same box give the same
     arrangement every time, so a saved design reopens looking like
     itself and a test can assert on it.
   - Bounded. Every loop has a ceiling, so fifty products cannot
     hang the page.
   - Honest. A gift that will not fit is reported as unplaced and
     the arrangement that was already valid is kept. Nothing is
     silently shrunk, dropped, or left sticking through a wall.

   Pure. No three.js, no browser. Tested in tests/packing.test.mjs.
   =========================================================== */

import { BOXES_BY_ROOM, getBoxVariant, getGiftKind } from '../data/hamperKit';
import {
  DEFAULT_CLEARANCE,
  TILT_ON_SIDE,
  TILT_UPRIGHT,
  aabbOf,
  giftsCollide,
  snapTilt,
  worldBoxes
} from './collision';
import { interior } from './giftBounds';

/* How many candidate points and turns one gift may be tried at
   before the packer gives up on it. Fifty products in a box of ten
   never approaches this; a pathological catalogue cannot run away
   with the main thread. */
const MAX_CANDIDATES = 160;
const MAX_ATTEMPTS_PER_GIFT = 6000;

/* The turns a gift may be placed at.

   Upright, always: a hamper is packed with bottles standing and
   bars lying flat, and tipping something over to save a centimetre
   is not what a person would do with a present. So the only freedom
   is which way it faces, and for most things that is a quarter turn
   either way. A kind can narrow it further — something round gains
   nothing from being turned, and something with a front gains
   nothing from facing the wall. */
const SQUARE_TURNS = [0, Math.PI / 2];
const NO_TURNS = [0];

/* The footprint a gift has once it is laid the way it is going to
   be laid: length and width across the floor. Laid on its side, its
   height becomes one of them. */
function plan(kind, tilt) {
  const [w, h, d] = kind.size;
  return snapTilt(tilt) ? [h, d] : [w, d];
}

export function turnsFor(kind, tilt = 0) {
  if (!kind) return NO_TURNS;
  if (Array.isArray(kind.turns)) return kind.turns;

  /* Round in plan: turning it changes nothing, so do not waste the
     attempts. Asked of the footprint rather than of the kind,
     because a tumbler is round standing up and distinctly not round
     lying down. */
  const [acrossX, acrossZ] = plan(kind, tilt);
  if (Math.abs(acrossX - acrossZ) < 0.3) return NO_TURNS;
  return SQUARE_TURNS;
}

/* Which ways up this gift may be packed, upright first.

   Upright is always allowed and always tried first: it is how a
   person packs a box, and a gift that fits standing should not be
   found lying down. Only a kind whose manifest says 'on-side' is
   ever laid over. */
export function tiltsFor(kind) {
  const allowed = kind?.orientations;
  if (!Array.isArray(allowed) || !allowed.includes('on-side')) return [TILT_UPRIGHT];
  return [TILT_UPRIGHT, TILT_ON_SIDE];
}

/* Where a gift stands so that it rests on the lining. A gift laid
   on its side has swung below its own origin, so this is what puts
   it back on the paper. */
function restingHeight(kind, scale, tilt = 0) {
  const boxes = worldBoxes(kind, { position: [0, 0, 0], yaw: 0, scale, tilt });
  const bounds = aabbOf(boxes);
  return bounds ? -bounds.min[1] : 0;
}

/* Does this placement sit entirely inside the usable interior? */
export function insideInterior(kind, variant, placement) {
  const room = interior(variant);
  const bounds = aabbOf(worldBoxes(kind, placement));
  if (!bounds) return false;

  /* No extra margin here: `interior` has already taken the lining
     off every inside face, and that is the gap. Asking for a second
     one would make the corners of the box unreachable, which in a
     22cm box is most of the useful space. A gift may rest against
     the lining; it may not press through it. */
  return (
    bounds.min[0] >= -room.halfX - 1e-6 &&
    bounds.max[0] <= room.halfX + 1e-6 &&
    bounds.min[2] >= -room.halfZ - 1e-6 &&
    bounds.max[2] <= room.halfZ + 1e-6 &&
    bounds.min[1] >= room.floor - 1e-6 &&
    bounds.max[1] <= room.ceiling + 1e-6
  );
}

/* Could this gift fit the box at all, in the best case — alone, in
   its roomiest turn? Asked before the packer bothers trying, so the
   panel can say "needs the large box" rather than "did not fit". */
export function giftCouldFit(kind, variant, scale = 1) {
  if (!kind || !variant) return false;

  return tiltsFor(kind).some((tilt) =>
    turnsFor(kind, tilt).some((yaw) =>
      insideInterior(kind, variant, {
        position: [0, restingHeight(kind, scale, tilt), 0],
        yaw,
        tilt,
        scale
      })
    )
  );
}

/* The smallest box the shop stocks that could hold this gift at
   all, for the panel's copy. Searched by how much room a box really
   offers rather than by how large it is quoted: an 18 × 13 × 3 is
   the longest box in the catalogue and holds a good deal less than
   a 14 × 14 × 6.

   "Could hold it at all" means alone, in its roomiest orientation.
   A box that would take the gift on its own may still be too full
   of other things, which is a different sentence for the panel to
   say. */
export function smallestBoxFor(kind, scale = 1) {
  if (!kind) return null;
  return BOXES_BY_ROOM.find((variant) => giftCouldFit(kind, variant, scale)) || null;
}

/* Which gift goes in first.

   Largest first, by the floor it covers rather than by volume: what
   makes a hamper hard to pack is area, not air. A tall thin bottle
   is easy to place late; a wide flat magazine is not. Ties break on
   height and then on the order they were added, which is what makes
   the whole thing deterministic. */
function packingOrder(gifts) {
  return [...gifts]
    .map((gift, index) => ({ gift, index }))
    .sort((a, b) => {
      const ka = getGiftKind(a.gift.kindId);
      const kb = getGiftKind(b.gift.kindId);
      if (!ka || !kb) return 0;

      const areaA = ka.size[0] * ka.size[2] * (ka.supportsScale ? a.gift.scale : 1) ** 2;
      const areaB = kb.size[0] * kb.size[2] * (kb.supportsScale ? b.gift.scale : 1) ** 2;
      if (Math.abs(areaA - areaB) > 0.01) return areaB - areaA;

      const hA = ka.size[1] * (ka.supportsScale ? a.gift.scale : 1);
      const hB = kb.size[1] * (kb.supportsScale ? b.gift.scale : 1);
      if (Math.abs(hA - hB) > 0.01) return hB - hA;

      return a.index - b.index;
    })
    .map((row) => row.gift);
}

/* Where the next gift might go.

   The corners of the floor to begin with, then, as things are put
   down, the corners beside and behind what is already there — the
   extreme-point method. Keeping the candidates on the edges of
   placed items is what makes the arrangement look packed rather
   than scattered, and it is far cheaper than sweeping a grid.

   Candidates are sorted so the packer works from the back of the
   box forwards and from the outside in, which is how a hamper is
   filled by hand and leaves the middle free for the last items. */
function candidatePoints(placed, room, gap) {
  const points = [
    [-room.halfX, -room.halfZ],
    [room.halfX, -room.halfZ],
    [-room.halfX, room.halfZ],
    [room.halfX, room.halfZ],
    [0, -room.halfZ],
    [0, room.halfZ],
    [-room.halfX, 0],
    [room.halfX, 0],
    [0, 0]
  ];

  placed.forEach(({ bounds }) => {
    /* Offset outward by the clearance, so a candidate beside a
       placed gift is the first legal spot rather than one that
       touches it. Without this every "beside" candidate is rejected
       by the very gap it was meant to leave, and the packer can
       only ever place things where they happen to clear by luck. */
    const left = bounds.min[0] - gap;
    const right = bounds.max[0] + gap;
    const back = bounds.min[2] - gap;
    const front = bounds.max[2] + gap;
    const midX = (bounds.min[0] + bounds.max[0]) / 2;
    const midZ = (bounds.min[2] + bounds.max[2]) / 2;

    points.push(
      [right, back],
      [right, front],
      [left, back],
      [left, front],
      [right, midZ],
      [left, midZ],
      [midX, front],
      [midX, back]
    );
  });

  /* Deduplicated to the millimetre: the same corner is generated by
     several neighbours and trying it four times costs four times as
     much for the same answer. */
  const seen = new Set();
  const unique = [];
  for (let i = 0; i < points.length && unique.length < MAX_CANDIDATES; i += 1) {
    const key = `${Math.round(points[i][0] * 10)}:${Math.round(points[i][1] * 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(points[i]);
  }

  return unique.sort((a, b) => {
    /* back of the box first, then outward from the middle */
    if (Math.abs(a[1] - b[1]) > 0.05) return a[1] - b[1];
    return Math.abs(b[0]) - Math.abs(a[0]);
  });
}

/* Which side of the candidate point the gift is put down on.

   A point is an edge, and an edge has two sides: a gift can sit
   with its left against it or with its right against it. Trying
   only one of them — insetting towards the middle of the box, as
   the obvious version does — means a gift can never be placed to
   the left of something, which loses half the free space in the
   box. So all four combinations are tried. */
const ANCHORS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1]
];

/* Try to put one gift down without moving anything already placed. */
function placeOne(gift, kind, variant, placed) {
  const room = interior(variant);
  const scale = kind.supportsScale ? gift.scale : 1;

  const gap =
    (kind.clearance ?? DEFAULT_CLEARANCE) +
    placed.reduce((most, other) => Math.max(most, other.kind.clearance ?? DEFAULT_CLEARANCE), 0);

  const points = candidatePoints(placed, room, gap);

  let attempts = 0;

  /* Upright before laid down, and for each way up every turn and
     every candidate: a gift that fits standing is never found on
     its side. */
  const tilts = tiltsFor(kind);

  for (let i = 0; i < tilts.length; i += 1) {
    const tilt = tilts[i];
    const y = restingHeight(kind, scale, tilt);
    const turns = turnsFor(kind, tilt);

    for (let t = 0; t < turns.length; t += 1) {
      const yaw = turns[t];
      const reach = aabbOf(worldBoxes(kind, { position: [0, y, 0], yaw, tilt, scale }));
      if (!reach) return null;

      const halfX = (reach.max[0] - reach.min[0]) / 2;
      const halfZ = (reach.max[2] - reach.min[2]) / 2;

      for (let p = 0; p < points.length; p += 1) {
        for (let a = 0; a < ANCHORS.length; a += 1) {
          if ((attempts += 1) > MAX_ATTEMPTS_PER_GIFT) return null;

          const [sx, sz] = ANCHORS[a];
          const placement = {
            position: [points[p][0] + sx * halfX, y, points[p][1] + sz * halfZ],
            yaw,
            tilt,
            scale
          };

          if (!insideInterior(kind, variant, placement)) continue;

          const clashes = placed.some((other) =>
            giftsCollide(kind, placement, other.kind, other.placement)
          );
          if (clashes) continue;

          return placement;
        }
      }
    }
  }

  return null;
}

/* How a gift that is already in the box is standing, read off its
   record. The one place the stored rotation triple is unpacked into
   what the collision test wants, so no caller has to remember which
   slot the tilt is in. */
export function placementOf(gift, kind) {
  return {
    position: gift.position,
    yaw: Number(gift.rotation?.[1]) || 0,
    tilt: snapTilt(gift.rotation?.[2]),
    scale: kind?.supportsScale ? gift.scale : 1
  };
}

const placedEntry = (gift, kind, placement) => ({
  uid: gift.uid,
  kind,
  placement,
  bounds: aabbOf(worldBoxes(kind, placement))
});

/* ---------------------------------------------------------- packing */

/* Arrange these gifts in this box, from nothing.

   Returns a placement for every gift it could place and a list of
   the ones it could not, with the reason. Never throws, never
   returns a placement it has not validated. */
export function packDesign(design) {
  const variant = getBoxVariant(design.box);
  const ordered = packingOrder(design.gifts);

  const placed = [];
  const placements = {};
  const unplaced = [];

  ordered.forEach((gift) => {
    const kind = getGiftKind(gift.kindId);
    if (!kind) {
      unplaced.push({ uid: gift.uid, kindId: gift.kindId, reason: 'unknown' });
      return;
    }

    const scale = kind.supportsScale ? gift.scale : 1;

    if (!giftCouldFit(kind, variant, scale)) {
      unplaced.push({ uid: gift.uid, kindId: gift.kindId, reason: 'too-big-for-box' });
      return;
    }

    const placement = placeOne(gift, kind, variant, placed);
    if (!placement) {
      unplaced.push({ uid: gift.uid, kindId: gift.kindId, reason: 'no-room' });
      return;
    }

    placements[gift.uid] = placement;
    placed.push(placedEntry(gift, kind, placement));
  });

  return { placements, unplaced, variantId: variant.id };
}

/* Put one gift down without disturbing the others.

   The cheap path, and the one taken almost always: adding a gift to
   a box that is already arranged should not shuffle everything the
   customer has watched settle. Returns null when there is no room,
   and the caller then decides whether a full repack is worth it. */
export function packOne(design, gift) {
  const variant = getBoxVariant(design.box);
  const kind = getGiftKind(gift.kindId);
  if (!kind) return null;

  const scale = kind.supportsScale ? gift.scale : 1;
  if (!giftCouldFit(kind, variant, scale)) return null;

  const placed = design.gifts
    .filter((g) => g.uid !== gift.uid && g.placed !== false)
    .map((g) => {
      const k = getGiftKind(g.kindId);
      return k ? placedEntry(g, k, placementOf(g, k)) : null;
    })
    .filter(Boolean);

  return placeOne(gift, kind, variant, placed);
}

/* ------------------------------------------------------- validation */

/* Is this arrangement actually legal?

   Run over a design that came off disk, and after any change that
   could have invalidated it. This is the check that decides whether
   a design may be saved as final and whether it may be ordered, so
   it repeats the work rather than trusting a flag. */
export function validateArrangement(design) {
  const variant = getBoxVariant(design.box);
  const problems = [];

  const live = design.gifts
    .filter((g) => g.placed !== false)
    .map((g) => {
      const kind = getGiftKind(g.kindId);
      return kind ? { gift: g, kind, placement: placementOf(g, kind) } : null;
    })
    .filter(Boolean);

  live.forEach((entry) => {
    if (!insideInterior(entry.kind, variant, entry.placement)) {
      problems.push({ uid: entry.gift.uid, kindId: entry.kind.id, reason: 'outside-box' });
    }
  });

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      if (giftsCollide(live[i].kind, live[i].placement, live[j].kind, live[j].placement)) {
        problems.push({
          uid: live[i].gift.uid,
          other: live[j].gift.uid,
          kindId: live[i].kind.id,
          otherKindId: live[j].kind.id,
          reason: 'overlap'
        });
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

/* Apply a packing result to a design's gifts.

   A gift the packer could not place keeps the position it had and
   is marked `placed: false`. It stays in the hamper, in the list and
   in the price, flagged — which is the honest thing to do with
   something the customer chose. */
export function applyPacking(design, result) {
  const unplacedIds = new Set(result.unplaced.map((u) => u.uid));

  return {
    ...design,
    gifts: design.gifts.map((gift) => {
      const placement = result.placements[gift.uid];
      if (!placement) {
        return unplacedIds.has(gift.uid) ? { ...gift, placed: false } : gift;
      }
      return {
        ...gift,
        position: placement.position,
        /* [0, yaw, tilt]: an XYZ euler with no X term is Ry · Rz, so
           the scene draws the tilt first and then the turn, which is
           the order the collision boxes were built in. */
        rotation: [0, placement.yaw, placement.tilt || 0],
        placed: true
      };
    })
  };
}

/* Everything the panels need to say about how the packing went. */
export function arrangementSummary(design) {
  const unplaced = design.gifts.filter((g) => g.placed === false);
  return {
    total: design.gifts.length,
    placed: design.gifts.length - unplaced.length,
    unplaced,
    ok: unplaced.length === 0
  };
}
