/* ===========================================================
   The shape of a saved hamper design, and the rules for reading
   one back.

   A design record is data that has been sitting in somebody's
   browser, possibly for months, possibly edited by hand through
   devtools. Nothing here trusts it: every field is checked, every
   id is looked up against the kit and the catalogue, and anything
   unrecognised is dropped with a note rather than thrown away
   silently. The one thing never done is discarding a record that
   could still be read — a customer's half-built hamper is work.

   Pure functions only, no browser APIs: this module is what the
   tests in tests/ exercise.
   =========================================================== */

import {
  BOX_COLOURS,
  CARD_FONTS,
  DEFAULT_BOX_VARIANT,
  GIFT_TEXT_MAX,
  LINING_COLOURS,
  MATERIALS,
  MESSAGE_MAX,
  RIBBON_COLOURS,
  RIBBON_STYLES,
  SCALE_MAX,
  SCALE_MIN,
  boxSnapshot,
  getBoxVariant,
  getGiftKind
} from '../data/hamperKit';
import { clampPosition, normaliseRotation } from './giftBounds';
import { giftCouldFit, smallestBoxFor } from './packing';

export const SCHEMA_VERSION = 5;

/* Version 1 shipped with a single `colour` on the box and gifts whose
   position was an object rather than a tuple. Version 2 kept gifts
   on the floor of the box and turned them about one axis only.
   Version 3 let a customer place and turn gifts by hand. Version 4
   had the studio arrange the box, with three boxes whose sizes were
   round numbers chosen for the demonstration. All four are still
   read — a version 3 design is re-arranged by the packer when it is
   opened, which is the only honest thing to do with positions that
   were never validated against the rules the studio now enforces,
   and a version 4 design is moved onto the real catalogue sizes,
   which is the subject of the 4 → 5 step below. */
export const OLDEST_READABLE = 1;

const ids = (list) => list.map((x) => x.id);

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function text(value, max) {
  if (typeof value !== 'string') return '';
  /* Control characters are stripped: they are never typed on purpose
     and they break both the canvas text and the order email. */
  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function tuple3(value, fallback) {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback];
  const out = value.map((n) => (Number.isFinite(Number(n)) ? Number(n) : null));
  return out.some((n) => n === null) ? [...fallback] : out;
}

/* A short, collision-resistant id. Not a security token — it only has
   to be unique inside one browser's database. */
export function newId(prefix) {
  const rand =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(36).padStart(2, '0'))
          .join('')
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/* The last arrangement that fitted, as read off disk.

   It carries the box it was taken in, because that is the whole
   point of it: the arrangement worth recovering is usually the one
   from before the customer tried a smaller box, and restoring it
   has to put that box back as well. Anything not exactly right is
   dropped rather than repaired — it is a convenience, and a
   half-understood one would move gifts to places that were never
   validated. Restoring it re-validates regardless. */
function readBackup(raw, _variantId, gifts) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.variantId !== 'string' || !raw.variantId) return null;
  if (!raw.placements || typeof raw.placements !== 'object') return null;
  if (!gifts.length) return null;

  const uids = new Set(gifts.map((g) => g.uid));
  const placements = {};
  let count = 0;

  Object.entries(raw.placements).forEach(([uid, entry]) => {
    if (!uids.has(uid) || !entry || typeof entry !== 'object') return;
    const position = tuple3(entry.position, [0, 0, 0]);
    const rotation = normaliseRotation(tuple3(entry.rotation, [0, 0, 0]));
    placements[uid] = { position, rotation };
    count += 1;
  });

  if (count !== gifts.length) return null;

  const variant = getBoxVariant({ variantId: raw.variantId, dimensions: raw.dimensions });

  return {
    variantId: variant.id,
    dimensions: boxSnapshot(variant),
    placements,
    at: Number.isFinite(Number(raw.at)) ? Number(raw.at) : null
  };
}

/* ------------------------------------------------------- new design */

export function createDesign({ name = 'My hamper', boxVariantId = DEFAULT_BOX_VARIANT } = {}) {
  const now = Date.now();
  const variant = getBoxVariant(boxVariantId);

  return {
    id: newId('design'),
    schemaVersion: SCHEMA_VERSION,
    name: text(name, 60) || 'My hamper',
    createdAt: now,
    updatedAt: now,
    /* Bumped on every change. The save queue uses it to make sure an
       autosave that started earlier can never land on top of a newer
       one, and the checkout uses it to name the exact version ordered. */
    revision: 1,
    lastSavedAt: null,
    box: {
      variantId: variant.id,
      /* The size, in full, travelling with the design. The id is a
         lookup into today's catalogue; this is what the hamper was
         actually built at, so reopening it in a year cannot quietly
         give the customer a different box. */
      dimensions: boxSnapshot(variant),
      boxColourId: 'burgundy',
      boxMaterialId: 'matte',
      liningColourId: 'cream-crinkle',
      ribbonColourId: 'gold',
      ribbonStyleId: 'cross-bow',
      lidOpen: true
    },
    gifts: [],
    /* The last arrangement in which everything fitted, kept so that
       trying a smaller box is recoverable. Written by the reducer,
       never by a panel. */
    arrangementBackup: null,
    message: { to: '', from: '', body: '', fontId: 'script', showCard: false },
    camera: null,
    editing: { selectedGiftUid: null },
    /* What the customer was last shown. Display only — the price is
       always recomputed from the catalogue before it is charged. */
    pricing: null
  };
}

export function createGift(kindId, { position, colour, variantId } = {}) {
  const kind = getGiftKind(kindId);
  if (!kind) return null;

  return {
    uid: newId('gift'),
    kindId: kind.id,
    productId: kind.productId || null,
    variantId: variantId || kind.variants?.[0]?.id || null,
    quantity: 1,
    colour: colour || kind.colours?.[0] || '#F3E7DA',
    position: position ? [...position] : [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    /* Set by the packer. A gift that could not be fitted stays in
       the hamper with this false, so it is visible in the list, in
       the price and in the warning — never quietly dropped. */
    placed: true,
    text: '',
    assetId: null,
    addedAt: Date.now()
  };
}

/* ------------------------------------------------------- migration */

/* Each step takes a record at version n and returns one at n + 1.
   Nothing is deleted on the way through: a field that moved is read
   from where it used to be. */
const MIGRATIONS = {
  1: (old) => {
    const box = old.box || {};
    return {
      ...old,
      schemaVersion: 2,
      box: {
        ...box,
        /* v1 kept one `colour` for the whole box and had no material */
        boxColourId: box.boxColourId || box.colour || 'burgundy',
        boxMaterialId: box.boxMaterialId || 'matte',
        liningColourId: box.liningColourId || box.lining || 'cream-crinkle',
        ribbonColourId: box.ribbonColourId || box.ribbon || 'gold',
        ribbonStyleId: box.ribbonStyleId || 'cross-bow'
      },
      gifts: (old.gifts || []).map((g) => ({
        ...g,
        /* v1 stored {x, y, z} and a full rotation triple */
        position: Array.isArray(g.position)
          ? g.position
          : [g.position?.x ?? 0, g.position?.y ?? 0, g.position?.z ?? 0],
        rotationY: Number.isFinite(Number(g.rotationY))
          ? g.rotationY
          : Number(Array.isArray(g.rotation) ? g.rotation[1] : 0) || 0
      }))
    };
  }
  ,
  /* Version 4's three boxes were 22 × 16 × 12, 28 × 20 × 16 and
     34 × 26 × 20 cm — round numbers picked to demonstrate the
     studio, not sizes the shop sells. Version 5 is built on the real
     catalogue, where the categories keep their names and the boxes
     are a good deal shallower: the deepest hamper the shop stocks is
     7 inches outside.

     So each old box becomes a real one of the same name — the
     roomiest size in that category, which is the closest the
     catalogue comes and the kindest to a hamper that was packed in
     the old one. The gifts are kept exactly as they are and the
     packer is run over the design when it is opened; anything that
     no longer fits comes back flagged, which is what the
     arrangement bar then explains. Nothing is resized and nothing
     is removed. */
  4: (old) => {
    const box = old.box || {};
    const MOVED = {
      'box-small': 'box-small-8x8x4',
      'box-medium': 'box-medium-12x10x4',
      'box-large': 'box-large-14x14x6'
    };

    return {
      ...old,
      schemaVersion: 5,
      box: {
        ...box,
        variantId: MOVED[box.variantId] || box.variantId,
        /* Deliberately absent: a v4 record has no dimensions of its
           own to preserve, so the snapshot is taken from the
           catalogue size it has just been moved onto. */
        dimensions: null
      },
      arrangementBackup: null
    };
  },
  3: (old) => ({
    ...old,
    schemaVersion: 4,
    /* Version 3 positions were arranged by hand, and the studio no
       longer offers that. They are kept as they are here and the
       packer is run over the design when it is loaded, so a design
       saved before this change opens tidy rather than opening with
       two gifts inside each other. */
    gifts: (old.gifts || []).map((g) => ({ ...g, placed: g.placed !== false }))
  }),
  2: (old) => ({
    ...old,
    schemaVersion: 3,
    gifts: (old.gifts || []).map((g) => {
      const p = Array.isArray(g.position) ? g.position : [0, 0, 0];
      return {
        ...g,
        /* v2 gifts all stood on the lining, and the middle slot of
           the tuple was never anything but zero. */
        position: [Number(p[0]) || 0, 0, Number(p[2]) || 0],
        /* v2 turned a gift about the upright axis only. */
        rotation: [0, Number(g.rotationY) || 0, 0]
      };
    })
  })
};

export function migrateDesign(record) {
  let current = record;
  let steps = 0;

  while (Number(current?.schemaVersion) < SCHEMA_VERSION) {
    const from = Number(current.schemaVersion);
    const step = MIGRATIONS[from];
    if (!step) return { ok: false, reason: `no migration from schema ${from}` };
    current = step(current);
    /* A migration that does not advance the version would spin here. */
    if (Number(current?.schemaVersion) <= from || (steps += 1) > 20) {
      return { ok: false, reason: 'migration did not advance the schema version' };
    }
  }

  return { ok: true, design: current, migrated: current !== record };
}

/* ------------------------------------------------------ validation */

/* Reads a record into a design this app can render, and says what it
   had to change. `ok: false` is reserved for a record that is not a
   design at all — anything else is repaired and flagged. */
export function validateDesign(record) {
  const notes = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, reason: 'not a design record', notes };
  }
  if (typeof record.id !== 'string' || !record.id) {
    return { ok: false, reason: 'the record has no id', notes };
  }

  const version = Number(record.schemaVersion);
  if (!Number.isInteger(version) || version < OLDEST_READABLE) {
    return { ok: false, reason: `unreadable schema version ${record.schemaVersion}`, notes };
  }
  if (version > SCHEMA_VERSION) {
    /* Saved by a newer build of the site — probably another tab that
       has already reloaded. Refusing is right: guessing at fields we
       do not know would lose them on the next save. */
    return {
      ok: false,
      reason: 'this design was saved by a newer version of the site',
      newer: true,
      notes
    };
  }

  let working = record;
  if (version < SCHEMA_VERSION) {
    const result = migrateDesign(record);
    if (!result.ok) return { ok: false, reason: result.reason, notes };
    working = result.design;
    notes.push({ kind: 'migrated', from: version, to: SCHEMA_VERSION });
  }

  const box = working.box || {};
  const variant = getBoxVariant(box);

  /* Three outcomes, and they are not the same thing.

     The id names a size the shop still stocks — nothing to say.

     The id is gone but the design carried its dimensions, so the
     hamper is rebuilt at exactly the size it was made at and the
     customer is told it can no longer be ordered. The box does not
     change shape.

     The id is gone and there are no dimensions to fall back on, so
     there is nothing to do but open it in the default box and say
     so. */
  if (box.variantId && variant.id !== box.variantId) {
    notes.push({ kind: 'box-variant-missing', was: box.variantId, now: variant.id });
  } else if (box.variantId && variant.stocked === false) {
    notes.push({
      kind: 'box-size-unstocked',
      was: box.variantId,
      sizeLabel: variant.sizeLabel
    });
  }

  const gifts = [];
  const seen = new Set();

  (Array.isArray(working.gifts) ? working.gifts : []).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;

    const kind = getGiftKind(raw.kindId);
    if (!kind) {
      /* The item is gone from the kit. The rest of the hamper still
         loads and the customer is told which one vanished. */
      notes.push({ kind: 'gift-unknown', kindId: String(raw.kindId || 'unnamed') });
      return;
    }

    const uid = typeof raw.uid === 'string' && raw.uid && !seen.has(raw.uid) ? raw.uid : newId('gift');
    seen.add(uid);

    const variantIds = ids(kind.variants || []);

    const scale = kind.supportsScale ? clamp(raw.scale, SCALE_MIN, SCALE_MAX, 1) : 1;
    const rotation = normaliseRotation(tuple3(raw.rotation, [0, 0, 0]));

    gifts.push({
      uid,
      kindId: kind.id,
      productId: kind.productId || null,
      variantId: variantIds.length ? oneOf(raw.variantId, variantIds, variantIds[0]) : null,
      quantity: clamp(raw.quantity, 1, kind.maxQty || 1, 1),
      colour: /^#[0-9a-f]{6}$/i.test(String(raw.colour)) ? String(raw.colour) : kind.colours?.[0] || '#F3E7DA',
      /* Kept inside the box it is sitting in, at the angle and size
         it is sitting there at. This is also what repairs a design
         whose box was swapped for a smaller one, and a gift that was
         saved standing up in a box that has since lost the headroom
         for it. */
      position: clampPosition(tuple3(raw.position, [0, 0, 0]), kind, variant, { scale, rotation }),
      rotation,
      scale,
      placed: raw.placed !== false,
      text: kind.supportsText ? text(raw.text, kind.textMax || GIFT_TEXT_MAX) : '',
      assetId: kind.supportsPhoto && typeof raw.assetId === 'string' && raw.assetId ? raw.assetId : null,
      addedAt: Number.isFinite(Number(raw.addedAt)) ? Number(raw.addedAt) : Date.now()
    });
  });

  const overCapacity = gifts.length - variant.capacity;
  if (overCapacity > 0) {
    notes.push({ kind: 'over-capacity', by: overCapacity, capacity: variant.capacity });
  }

  /* A design whose box was swapped down — or one written before the
     studio moved onto the real catalogue sizes — can hold something
     that will not go into this box in any orientation. Reported, not
     removed: it is the customer's gift, and the answer is a bigger
     box.

     Asked of the packer rather than of the angle the gift happens to
     be stored at, because the stored angle may simply be the one it
     had in the old box. What matters is whether there is any way to
     get it in at all. */
  const wontFit = gifts.filter((g) => !giftCouldFit(getGiftKind(g.kindId), variant, g.scale));
  if (wontFit.length) {
    notes.push({
      kind: 'too-tall',
      gifts: wontFit.map((g) => getGiftKind(g.kindId).name),
      boxLabel: variant.label,
      sizeLabel: variant.sizeLabel,
      needs: wontFit
        .map((g) => smallestBoxFor(getGiftKind(g.kindId), g.scale))
        .filter(Boolean)
        .map((v) => v.sizeLabel)
    });
  }

  const msg = working.message || {};
  const now = Date.now();

  const design = {
    id: working.id,
    schemaVersion: SCHEMA_VERSION,
    name: text(working.name, 60) || 'My hamper',
    createdAt: Number.isFinite(Number(working.createdAt)) ? Number(working.createdAt) : now,
    updatedAt: Number.isFinite(Number(working.updatedAt)) ? Number(working.updatedAt) : now,
    revision: Math.max(1, Math.round(Number(working.revision)) || 1),
    lastSavedAt: Number.isFinite(Number(working.lastSavedAt)) ? Number(working.lastSavedAt) : null,
    box: {
      variantId: variant.id,
      /* Taken from the variant the design has just been resolved to,
         whether that came from the catalogue or from the design's own
         snapshot. Either way the record that goes back to disk says
         in centimetres what box this is, and with what construction
         the interior was worked out. */
      dimensions: boxSnapshot(variant),
      boxColourId: oneOf(box.boxColourId, ids(BOX_COLOURS), 'burgundy'),
      boxMaterialId: oneOf(box.boxMaterialId, ids(MATERIALS), 'matte'),
      liningColourId: oneOf(box.liningColourId, ids(LINING_COLOURS), 'cream-crinkle'),
      ribbonColourId: oneOf(box.ribbonColourId, ids(RIBBON_COLOURS), 'gold'),
      ribbonStyleId: oneOf(box.ribbonStyleId, ids(RIBBON_STYLES), 'cross-bow'),
      lidOpen: box.lidOpen !== false
    },
    gifts,
    message: {
      to: text(msg.to, 60),
      from: text(msg.from, 60),
      body: text(msg.body, MESSAGE_MAX),
      fontId: oneOf(msg.fontId, ids(CARD_FONTS), 'script'),
      showCard: Boolean(msg.showCard)
    },
    camera:
      working.camera && Array.isArray(working.camera.position)
        ? {
            position: tuple3(working.camera.position, [34, 26, 40]),
            target: tuple3(working.camera.target, [0, 4, 0])
          }
        : null,
    editing: {
      selectedGiftUid: gifts.some((g) => g.uid === working.editing?.selectedGiftUid)
        ? working.editing.selectedGiftUid
        : null
    },
    /* Read back only in the shape the reducer writes, and only for
       the box it was taken in: a backup from a different box would
       put gifts where that box had room and this one does not. The
       reducer checks the uids too before it offers to restore. */
    arrangementBackup: readBackup(working.arrangementBackup, variant.id, gifts),
    pricing: working.pricing && typeof working.pricing === 'object' ? working.pricing : null,
    /* Set by the checkout once an order has been raised against this
       exact revision. Never written by the editor. */
    orderedAs: working.orderedAs && typeof working.orderedAs === 'object' ? working.orderedAs : null
  };

  return { ok: true, design, notes, repaired: notes.length > 0 };
}

/* Every asset id a design refers to — what the orphan sweep keeps. */
export function assetIdsOf(design) {
  return (design?.gifts || []).map((g) => g.assetId).filter(Boolean);
}

/* A one-line description, for the saved list, the bag and the order. */
export function describeDesign(design) {
  if (!design) return '';
  const variant = getBoxVariant(design.box);
  const count = design.gifts.reduce((n, g) => n + g.quantity, 0);
  const parts = [`${variant.label} · ${variant.sizeLabel}`];
  parts.push(count ? `${count} item${count === 1 ? '' : 's'}` : 'empty so far');
  const ribbon = RIBBON_COLOURS.find((r) => r.id === design.box.ribbonColourId);
  if (design.box.ribbonStyleId !== 'none' && ribbon) parts.push(`${ribbon.label.toLowerCase()} ribbon`);
  if (design.message.body.trim()) parts.push('message card');
  return parts.join(' · ');
}
