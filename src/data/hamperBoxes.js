/* ===========================================================
   The hampers the shop actually sells, in real-world sizes.

   Four categories, each with a published range, and inside each
   range a short list of sizes that can be ordered. The ranges are
   the shop's own catalogue; the sizes below are the ones within
   them that are stocked.

   Everything downstream of this file works in centimetres. The
   catalogue is quoted in inches because that is how the boxes are
   sold, so the inch figures are the stored truth and the metric
   ones are derived from them exactly — 1 in = 2.54 cm, no rounding.
   A size quoted as "6 × 4 × 2 inches" is therefore
   15.24 × 10.16 × 5.08 cm, and that is what the 3D box is built at.

   ---------------------------------------------------------------
   OUTER versus INNER, which is the thing this file exists to keep
   straight.

   The catalogue figures are the OUTSIDE of the box. A gift does not
   get that space. It gets what is left after the walls, the base,
   the lid slab, the hinge travel and the paper lining, and that is
   computed from the construction below rather than guessed at.

   The construction numbers are ASSUMPTIONS. Nobody has measured a
   box. They are plausible for rigid gift boxes of each size — card
   gets thicker as the box gets bigger — and they are collected in
   one place so that a real specification can replace them without
   touching anything else. `assumed: true` is carried on every one
   of them so the interface can say so rather than present a
   computed interior as a measurement.
   =========================================================== */

/* The only conversion in the app. */
export const INCH_CM = 2.54;

export const inchesToCm = (n) => Number(n) * INCH_CM;

/* Exact, and then cleaned of binary-float dust: 6 × 2.54 is
   15.240000000000002, which is the same number but looks like a
   mistake in a readout and in a saved record. Two decimals is a
   hundredth of a centimetre — far finer than anything here is
   known to. */
export const cm = (inches) => Math.round(inchesToCm(inches) * 100) / 100;

/* ------------------------------------------------- construction

   What the box is made of, per category. All distances in cm.

   wall    one side wall, taken off each of the two opposite sides
   base    the floor slab the lining sits on
   lid     the lid slab, which lives inside the quoted outer height
   lining  the crinkle paper: under the gifts and up the sides
   hinge   travel the hinge needs under the closed lid, so the lid
           does not shut onto the tallest gift

   Usable height is the outer height less the base, the lid, the
   hinge clearance and the lining. */
const CONSTRUCTION = {
  small: { wall: 0.4, base: 0.4, lid: 0.5, lining: 0.3, hinge: 0.2, assumed: true },
  medium: { wall: 0.5, base: 0.5, lid: 0.6, lining: 0.4, hinge: 0.2, assumed: true },
  large: { wall: 0.6, base: 0.6, lid: 0.7, lining: 0.5, hinge: 0.3, assumed: true },
  xlarge: { wall: 0.7, base: 0.7, lid: 0.8, lining: 0.5, hinge: 0.3, assumed: true }
};

/* ---------------------------------------------------- categories

   `rangeIn` is [min L, min W, min H] to [max L, max W, max H] in
   inches, straight from the catalogue. `guideItems` is the
   catalogue's own rough guide to how much goes in — a guide and
   nothing more. What actually fits is decided by the packer in
   src/lib/packing.js, against the interior computed below, every
   time. Nothing here promises a count. */
export const HAMPER_CATEGORIES = [
  {
    id: 'small',
    label: 'Small',
    rangeIn: { min: [6, 4, 2], max: [8, 8, 4] },
    guideItems: [2, 3],
    guide: 'about 2–3 small gifts'
  },
  {
    id: 'medium',
    label: 'Medium',
    rangeIn: { min: [10, 8, 4], max: [12, 10, 4] },
    guideItems: [4, 6],
    guide: 'about 4–6 gifts'
  },
  {
    id: 'large',
    label: 'Large',
    rangeIn: { min: [14, 9, 4], max: [14, 14, 6] },
    guideItems: [7, 10],
    guide: 'about 7–10 gifts'
  },
  {
    id: 'xlarge',
    label: 'Extra-Large',
    rangeIn: { min: [18, 13, 3], max: [18, 18, 7] },
    guideItems: [10, 14],
    guide: '10 or more, depending on their size'
  }
];

export const getCategory = (id) => HAMPER_CATEGORIES.find((c) => c.id === id) || null;

/* Is this size inside its category's published range? Every entry
   in the table below is checked against this when the module loads,
   so an out-of-range size cannot be added by accident. */
export function withinRange(categoryId, inches) {
  const category = getCategory(categoryId);
  if (!category) return false;
  const { min, max } = category.rangeIn;
  return inches.every((n, i) => n >= min[i] - 1e-9 && n <= max[i] + 1e-9);
}

/* ------------------------------------------------- stocked sizes

   `in` is [length, width, height] in inches. The 3D scene maps
   length to X, height to Y and width to Z.

   The minimum and the maximum of every range is stocked, with one
   or two steps between, which is what the size selector offers.

   Prices are the shop's, and like every other price in the studio
   they are placeholders until Admin → Products is filled in. They
   rise with the box, which is the only property anything depends
   on. */
const SIZES = [
  { category: 'small', in: [6, 4, 2], price: 349 },
  { category: 'small', in: [7, 6, 3], price: 429 },
  { category: 'small', in: [8, 8, 4], price: 529 },

  { category: 'medium', in: [10, 8, 4], price: 699 },
  { category: 'medium', in: [11, 9, 4], price: 769 },
  { category: 'medium', in: [12, 10, 4], price: 849 },

  { category: 'large', in: [14, 9, 4], price: 999 },
  { category: 'large', in: [14, 12, 5], price: 1149 },
  { category: 'large', in: [14, 14, 6], price: 1299 },

  { category: 'xlarge', in: [18, 13, 3], price: 1399 },
  { category: 'xlarge', in: [18, 16, 5], price: 1599 },
  { category: 'xlarge', in: [18, 18, 7], price: 1799 }
];

/* A hard ceiling on how many separate gifts one box may hold.

   Not a capacity claim — whether four things fit is the packer's
   answer, not this number's. It is here so that a box cannot be
   filled with sixty items that the packer then has to try to
   arrange on the main thread. Set well above the catalogue's guide
   for each category. */
const MAX_ITEMS = { small: 6, medium: 12, large: 20, xlarge: 30 };

/* ------------------------------------------------- the derivation

   One box, from its outer size and its construction. This is the
   whole of the outer-to-inner sum, written once.

   `outer`  the quoted box, [X, Y, Z] = [length, height, width] cm
   `inner`  the cavity inside the walls, base and lid — structural
   `size`   the same cavity, and the name the rest of the studio
            knows it by: everything that packs or draws a gift
            measures against the cavity and then takes the lining
            off itself, in src/lib/giftBounds.js
   `usable` what a gift really gets: the cavity less the lining

   A degenerate size — walls thicker than the box — cannot happen
   with the table above, but the clamps are here so that an edited
   construction can only ever produce an empty box rather than a
   negative one. */
export function deriveBox({ id, categoryId, inches, price, construction }) {
  const [lengthIn, widthIn, heightIn] = inches;

  const outer = [cm(lengthIn), cm(heightIn), cm(widthIn)];
  const build = construction;

  const inner = [
    Math.max(0, outer[0] - build.wall * 2),
    Math.max(0, outer[1] - build.base - build.lid - build.hinge),
    Math.max(0, outer[2] - build.wall * 2)
  ];

  const usable = [
    Math.max(0, inner[0] - build.lining * 2),
    Math.max(0, inner[1] - build.lining),
    Math.max(0, inner[2] - build.lining * 2)
  ];

  const category = getCategory(categoryId);

  return {
    id,
    categoryId,
    label: `${category.label} hamper`,
    /* The catalogue's own words for the size, used in menus. */
    sizeLabel: `${lengthIn} × ${widthIn} × ${heightIn} in`,
    blurb: `${outer[0]} × ${outer[2]} × ${outer[1]} cm — ${category.guide}`,
    price,
    inches: [lengthIn, widthIn, heightIn],
    outer,
    inner,
    usable,
    /* What the packer and the scene read. The cavity, not the
       outside of the box: a gift lives in the cavity. */
    size: inner,
    construction: build,
    capacity: MAX_ITEMS[categoryId],
    guideItems: category.guideItems,
    guide: category.guide,
    /* True of every box built from the table; false for one
       reconstructed from a saved design whose size is no longer
       stocked. */
    stocked: true
  };
}

const sizeId = (categoryId, inches) => `box-${categoryId}-${inches.join('x')}`;

export const BOX_VARIANTS = SIZES.map((row) =>
  deriveBox({
    id: sizeId(row.category, row.in),
    categoryId: row.category,
    inches: row.in,
    price: row.price,
    construction: CONSTRUCTION[row.category]
  })
);

/* Every stocked size is inside its own published range. Checked here
   rather than in a test, because a size that is out of range is a
   box the shop cannot supply and shipping it would be worse than
   failing the build. */
BOX_VARIANTS.forEach((variant) => {
  if (!withinRange(variant.categoryId, variant.inches)) {
    throw new Error(`${variant.id} is outside the published ${variant.categoryId} range`);
  }
});

/* The example in the brief, and a sensible middle: 12 × 10 × 4 in. */
export const DEFAULT_BOX_VARIANT = 'box-medium-12x10x4';

export const boxesInCategory = (categoryId) =>
  BOX_VARIANTS.filter((v) => v.categoryId === categoryId);

/* How much room a box actually offers, for ordering boxes by size.
   The cavity volume less the lining, which is the only measure that
   answers "is this one bigger than that one" — the quoted outer
   figures do not, because an 18 × 13 × 3 is longer and roomier
   across than a 14 × 14 × 6 and holds considerably less. */
export const usableVolume = (variant) =>
  variant.usable[0] * variant.usable[1] * variant.usable[2];

/* Stocked sizes, smallest usable volume first. What "the smallest
   box that would take this gift" is searched over. */
export const BOXES_BY_ROOM = [...BOX_VARIANTS].sort((a, b) => usableVolume(a) - usableVolume(b));

/* ------------------------------------------- saved designs

   What a design stores about its box, beyond the id. The id alone
   is not enough: a size the shop later stops stocking would
   otherwise come back as a silently different box, and a customer's
   hamper would change shape on being reopened. So the dimensions
   travel with the design and the id is treated as a lookup, not as
   the truth. */
export function boxSnapshot(variant) {
  return {
    categoryId: variant.categoryId,
    inches: [...variant.inches],
    outerCm: [...variant.outer],
    unit: 'cm',
    construction: { ...variant.construction }
  };
}

const finite3 = (value) =>
  Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(Number(n)) && Number(n) > 0)
    ? value.map(Number)
    : null;

/* Rebuild a box from a saved snapshot, for a size that is no longer
   stocked. The design keeps the dimensions it was built at and the
   interface says the size cannot be ordered — which is the honest
   answer, and better than resizing somebody's hamper for them. */
export function variantFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const inches = finite3(snapshot.inches);
  const category = getCategory(snapshot.categoryId);
  if (!inches || !category) return null;

  const build = { ...CONSTRUCTION[category.id], ...(snapshot.construction || {}), assumed: true };
  for (const key of ['wall', 'base', 'lid', 'lining', 'hinge']) {
    const v = Number(build[key]);
    build[key] = Number.isFinite(v) && v >= 0 ? v : CONSTRUCTION[category.id][key];
  }

  const variant = deriveBox({
    id: sizeId(category.id, inches),
    categoryId: category.id,
    inches,
    price: Number.isFinite(Number(snapshot.price)) ? Number(snapshot.price) : null,
    construction: build
  });

  return { ...variant, stocked: false };
}

/* ------------------------------------------------------- lookup

   Takes an id, or a whole design's `box` — which is what every
   caller in the studio has to hand, and the only form that can
   honour a saved snapshot.

   Order of preference: the stocked size the id names; the size the
   snapshot describes; the default. A design is never left without a
   box to draw. */
export function getBoxVariant(idOrBox) {
  const box = typeof idOrBox === 'string' || !idOrBox ? { variantId: idOrBox } : idOrBox;

  const stocked = BOX_VARIANTS.find((v) => v.id === box.variantId);
  if (stocked) return stocked;

  const fromSnapshot = variantFromSnapshot(box.dimensions);
  if (fromSnapshot) return fromSnapshot;

  return BOX_VARIANTS.find((v) => v.id === DEFAULT_BOX_VARIANT) || BOX_VARIANTS[0];
}

/* ----------------------------------------------------- readouts */

const round1 = (n) => Math.round(n * 10) / 10;

export const formatCm = (triple) => `${triple[0]} × ${triple[2]} × ${triple[1]} cm`;

/* The interior, for the interface. Rounded to a millimetre and
   labelled as computed, never as measured: it is the outer size
   less a construction nobody has verified. */
export function describeInterior(variant) {
  return {
    cavity: `${round1(variant.inner[0])} × ${round1(variant.inner[2])} × ${round1(variant.inner[1])} cm`,
    usable: `${round1(variant.usable[0])} × ${round1(variant.usable[2])} × ${round1(variant.usable[1])} cm`,
    assumed: variant.construction.assumed === true
  };
}

export default BOX_VARIANTS;
