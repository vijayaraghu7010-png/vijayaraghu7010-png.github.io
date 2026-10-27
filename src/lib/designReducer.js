/* ===========================================================
   Every change a customer can make to a hamper, in one place.

   One reducer is the whole point of the exercise: the 3D scene, the
   panels, the price and the autosaved record all read the same
   object, so they cannot disagree about what the hamper looks like.
   Each change bumps `revision`, which is what the save queue orders
   writes by and what the checkout quotes.

   Since the studio arranges the box itself, this is also where
   packing happens. Nothing else may write a gift's position: every
   path that could invalidate the arrangement — adding, removing,
   changing a quantity or a variant, resizing, swapping the box —
   ends in either a local placement or a full repack, and both of
   those validate before they return. A position that has not been
   through the packer never reaches the scene.

   Pure. Tested in tests/designReducer.test.mjs.
   =========================================================== */

import {
  GIFT_TEXT_MAX,
  MESSAGE_MAX,
  SCALE_MAX,
  SCALE_MIN,
  boxSnapshot,
  getBoxVariant,
  getGiftKind
} from '../data/hamperKit';
import { applyPacking, packDesign, packOne, validateArrangement } from './packing';
import { createGift } from './designSchema';

const clamp = (n, min, max, fallback = min) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
};

const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';

/* ------------------------------------------------------- arranging */

/* Repack the whole box. Used when the change is big enough that
   where everything sits is in question — a different box, a gift
   taken out that might free room for one that would not fit, or the
   customer asking for it. */
function rearrange(design) {
  return applyPacking(design, packDesign(design));
}

/* Is every gift in the hamper placed, and legally?

   `validateArrangement` is the one that repeats the geometry rather
   than trusting the `placed` flags, so both are asked: a flag could
   be stale and a position could have been written by an older build
   of the studio. */
const fullyFits = (design) =>
  design.gifts.length > 0 &&
  design.gifts.every((g) => g.placed !== false) &&
  validateArrangement(design).ok;

/* Take a copy of an arrangement in which everything fitted.

   This is what makes trying a smaller box safe. The customer swaps
   a large hamper for a medium one, two gifts no longer fit, and the
   way back is not "remember what it looked like" — it is this
   record, with the box it was taken in, which the arrangement bar
   can offer to put back. */
function rememberArrangement(design) {
  if (!fullyFits(design)) return design.arrangementBackup || null;

  const variant = getBoxVariant(design.box);
  const placements = {};
  design.gifts.forEach((gift) => {
    placements[gift.uid] = { position: [...gift.position], rotation: [...gift.rotation] };
  });

  return { variantId: variant.id, dimensions: boxSnapshot(variant), placements, at: Date.now() };
}

/* Put a remembered arrangement back, box and all.

   Re-validated rather than trusted: the backup was legal when it was
   taken, and between then and now a gift could have been removed or
   resized. If it no longer holds, the box still goes back — that is
   the part the customer asked for — and the packer arranges it
   afresh. */
function restoreArrangement(design) {
  const backup = design.arrangementBackup;
  if (!backup) return design;

  const box = { ...design.box, variantId: backup.variantId, dimensions: backup.dimensions };

  const restored = {
    ...design,
    box,
    gifts: design.gifts.map((gift) => {
      const entry = backup.placements[gift.uid];
      if (!entry) return gift;
      return { ...gift, position: [...entry.position], rotation: [...entry.rotation], placed: true };
    })
  };

  if (design.gifts.some((g) => !backup.placements[g.uid]) || !validateArrangement(restored).ok) {
    return rearrange(restored);
  }

  return restored;
}

/* Put one gift down without moving anything else, and fall back to a
   full repack only if that fails.

   The order matters: shuffling a box the customer has just watched
   settle, every time they add a chocolate bar, would be worse than
   the arrangement being slightly less tight. So the cheap local
   placement is tried first and almost always wins; the repack is the
   exception, for when the box genuinely has to be reorganised to
   take the new thing. */
function place(design, uid) {
  const gift = design.gifts.find((g) => g.uid === uid);
  if (!gift) return design;

  const placement = packOne(design, gift);

  if (placement) {
    const next = {
      ...design,
      gifts: design.gifts.map((g) =>
        g.uid === uid
          ? {
              ...g,
              position: placement.position,
              /* [0, yaw, tilt] — the same triple applyPacking writes.
                 Dropping the tilt here would stand a tumbler back up
                 at the height it was lying at, which is a gift
                 hovering through the lid. */
              rotation: [0, placement.yaw, placement.tilt || 0],
              placed: true
            }
          : g
      )
    };
    /* Everything else was already valid and has not moved, so only
       the new placement needed checking — and `packOne` has done
       that. Nothing more to do. */
    return next;
  }

  /* No room beside what is already there. Reorganise the box and see
     whether the whole set can be made to fit. */
  const repacked = rearrange(design);

  /* If the repack still cannot place this gift it stays in the
     hamper marked unplaced, which is what the panel reports and what
     stops the order going through. It is never silently dropped. */
  return repacked;
}

/* Has anything made the current arrangement illegal? Cheap enough to
   ask after a change that probably did not. */
const needsRepack = (design) =>
  design.gifts.some((g) => g.placed === false) || !validateArrangement(design).ok;

/* ---------------------------------------------------------- actions */

/* Each handled action returns a new design; the wrapper at the bottom
   stamps the revision and timestamp so no case can forget to. */
function apply(design, action) {
  switch (action.type) {
    case 'replace':
      /* Opening a saved design, or restoring one. Not a mutation of
         the current one, so the revision is the stored one. */
      return action.design;

    case 'rename':
      return { ...design, name: clean(action.name, 60) };

    case 'box': {
      const next = { ...design.box, ...action.patch };

      /* A different box is a different interior, so the whole
         arrangement is worked out again — against the new box's real
         usable volume, which is where every collision boundary comes
         from. A gift that fitted the large box and does not fit the
         small one comes back marked unplaced rather than being
         deleted: it is the customer's gift, and the answer is a
         bigger box or one fewer gift.

         The arrangement that was valid a moment ago is kept first,
         so the swap is recoverable. */
      if (action.patch.variantId && action.patch.variantId !== design.box.variantId) {
        const variant = getBoxVariant({ variantId: action.patch.variantId });
        const backup = rememberArrangement(design);

        return rearrange({
          ...design,
          /* The dimensions are re-snapshotted from the size that was
             chosen, so the record never carries one box's id beside
             another box's measurements. */
          box: { ...next, variantId: variant.id, dimensions: boxSnapshot(variant) },
          arrangementBackup: backup
        });
      }

      return { ...design, box: next };
    }

    case 'lid':
      return { ...design, box: { ...design.box, lidOpen: Boolean(action.open) } };

    case 'rearrange':
      return rearrange({ ...design, arrangementBackup: rememberArrangement(design) });

    case 'restore-arrangement':
      return restoreArrangement(design);

    case 'add-gift': {
      const kind = getGiftKind(action.kindId);
      if (!kind) return design;

      const variant = getBoxVariant(design.box);
      if (design.gifts.length >= variant.capacity) return design;

      /* Another of something already in the box raises its quantity
         rather than stacking a second identical mesh in the lid. */
      const already = design.gifts.find((g) => g.kindId === kind.id && g.variantId === (action.variantId || null));
      if (already && already.quantity < (kind.maxQty || 1) && !kind.supportsPhoto && !kind.supportsText) {
        const raised = {
          ...design,
          gifts: design.gifts.map((g) => (g.uid === already.uid ? { ...g, quantity: g.quantity + 1 } : g)),
          editing: { ...design.editing, selectedGiftUid: already.uid }
        };
        /* Quantity is drawn as extra copies beside the first, so the
           space it needs has changed. */
        return place(raised, already.uid);
      }

      const gift = createGift(kind.id, { variantId: action.variantId });
      if (!gift) return design;

      const added = {
        ...design,
        gifts: [...design.gifts, gift],
        editing: { ...design.editing, selectedGiftUid: gift.uid }
      };

      return place(added, gift.uid);
    }

    case 'remove-gift': {
      const gifts = design.gifts.filter((g) => g.uid !== action.uid);
      if (gifts.length === design.gifts.length) return design;

      const without = {
        ...design,
        gifts,
        editing: {
          ...design.editing,
          selectedGiftUid: design.editing.selectedGiftUid === action.uid ? null : design.editing.selectedGiftUid
        }
      };

      /* Taking something out never makes the rest invalid, so the
         gifts that are already placed are left exactly where the
         customer has watched them settle. The one reason to repack
         is that the room just freed might take a gift that did not
         fit before. */
      return needsRepack(without) ? rearrange(without) : without;
    }

    case 'gift': {
      const gift = design.gifts.find((g) => g.uid === action.uid);
      if (!gift) return design;
      const kind = getGiftKind(gift.kindId);
      const patch = action.patch || {};

      const next = { ...gift };
      let resized = false;

      if ('scale' in patch && kind?.supportsScale) {
        next.scale = clamp(patch.scale, SCALE_MIN, SCALE_MAX, gift.scale);
        resized = next.scale !== gift.scale;
      }
      if ('quantity' in patch) {
        next.quantity = clamp(patch.quantity, 1, kind?.maxQty || 1, gift.quantity);
        resized = resized || next.quantity !== gift.quantity;
      }
      if ('colour' in patch && /^#[0-9a-f]{6}$/i.test(String(patch.colour))) next.colour = patch.colour;
      if ('variantId' in patch && (kind?.variants || []).some((v) => v.id === patch.variantId)) {
        next.variantId = patch.variantId;
      }
      if ('text' in patch && kind?.supportsText) next.text = clean(patch.text, kind.textMax || GIFT_TEXT_MAX);
      if ('assetId' in patch && kind?.supportsPhoto) next.assetId = patch.assetId || null;

      const updated = { ...design, gifts: design.gifts.map((g) => (g.uid === action.uid ? next : g)) };

      /* Anything that changed how much room the gift needs is placed
         again before it is allowed to stand. */
      return resized ? place(updated, action.uid) : updated;
    }

    case 'message':
      return {
        ...design,
        message: {
          ...design.message,
          ...('to' in action.patch ? { to: clean(action.patch.to, 60) } : null),
          ...('from' in action.patch ? { from: clean(action.patch.from, 60) } : null),
          ...('body' in action.patch ? { body: clean(action.patch.body, MESSAGE_MAX) } : null),
          ...('fontId' in action.patch ? { fontId: action.patch.fontId } : null),
          ...('showCard' in action.patch ? { showCard: Boolean(action.patch.showCard) } : null)
        }
      };

    case 'select':
      return { ...design, editing: { ...design.editing, selectedGiftUid: action.uid || null } };

    case 'camera':
      return { ...design, camera: action.camera };

    /* What the customer is being shown, noted for the saved list. Not
       a price: the real one is recomputed from the catalogue. */
    case 'pricing-shown':
      return { ...design, pricing: action.pricing };

    case 'ordered':
      return { ...design, orderedAs: action.orderedAs };

    default:
      return design;
  }
}

/* Changes that do not alter the hamper itself must not make the
   indicator claim unsaved work — but they are still worth storing, so
   reopening lands on the same view and the same selection. They just
   do not bump the revision. */
const COSMETIC = new Set(['select', 'camera', 'pricing-shown']);

export function designReducer(design, action) {
  const next = apply(design, action);
  if (next === design) return design;

  if (action.type === 'replace') return next;

  if (COSMETIC.has(action.type)) return { ...next, updatedAt: Date.now() };

  return {
    ...next,
    /* Every change that leaves the hamper packed and fitting becomes
       the arrangement to come back to. One that leaves something
       unplaced keeps whatever the last good one was, which is the
       only time it is any use. */
    arrangementBackup: rememberArrangement(next),
    revision: (Number(design.revision) || 1) + 1,
    updatedAt: Date.now()
  };
}

export const isCosmetic = (type) => COSMETIC.has(type);
