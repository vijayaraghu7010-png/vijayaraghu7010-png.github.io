# The hamper's real-world dimensions

What size each hamper is, where those figures come from, how the
usable interior is worked out, and which parts of it are assumptions.

Everything described here lives in **`src/data/hamperBoxes.js`**. It is
the only place a box dimension is written down; the packer, the 3D
scene, the panels, the price and the saved record all read it.

## Read this first: the construction is assumed, not measured

The outer sizes are the catalogue's and are exact. The **interior is
computed**, from a wall, base, lid, hinge and lining thickness that
**nobody has measured**. They are plausible figures for rigid gift
boxes of each size, collected in one table so a real manufacturing
specification can replace them without touching anything else.

Every box carries `construction.assumed === true`, the studio's box
panel says so in as many words, and no interior figure is ever
presented as a measurement. Do not quote the inside dimensions to a
customer as exact until a box has been measured.

Prices are placeholders too, like every other price in the studio —
see `HAMPER-MODELS.md`.

## The four categories

The ranges are the shop's published ones. A size outside its
category's range cannot be offered: `hamperBoxes.js` checks every row
against `withinRange` when the module loads and throws if one drifts.

| Category | Range (inches) | Range (cm) | Guide |
| --- | --- | --- | --- |
| Small | 6 × 4 × 2 → 8 × 8 × 4 | 15.24 × 10.16 × 5.08 → 20.32 × 20.32 × 10.16 | about 2–3 small gifts |
| Medium | 10 × 8 × 4 → 12 × 10 × 4 | 25.4 × 20.32 × 10.16 → 30.48 × 25.4 × 10.16 | about 4–6 gifts |
| Large | 14 × 9 × 4 → 14 × 14 × 6 | 35.56 × 22.86 × 10.16 → 35.56 × 35.56 × 15.24 | about 7–10 gifts |
| Extra-Large | 18 × 13 × 3 → 18 × 18 × 7 | 45.72 × 33.02 × 7.62 → 45.72 × 45.72 × 17.78 | 10 or more |

**The guides are guides.** Nothing in the code treats them as a
capacity. Whether four things fit is answered by the packer in
`src/lib/packing.js`, against the usable interior, every time. The one
count that is enforced is `capacity` — a hard ceiling on how many
separate gifts one box may hold (6 / 12 / 20 / 30), there so a design
cannot be filled with sixty items the packer then has to arrange on
the main thread.

## The sizes stocked

Both ends of every range, with a step or two between:

| Category | Sizes (inches) |
| --- | --- |
| Small | 6 × 4 × 2, 7 × 6 × 3, 8 × 8 × 4 |
| Medium | 10 × 8 × 4, 11 × 9 × 4, 12 × 10 × 4 |
| Large | 14 × 9 × 4, 14 × 12 × 5, 14 × 14 × 6 |
| Extra-Large | 18 × 13 × 3, 18 × 16 × 5, 18 × 18 × 7 |

Their ids are `box-<category>-<L>x<W>x<H>`, e.g. `box-medium-12x10x4`,
which is the default.

## Units

Centimetres, everywhere, internally. The inch figures are the stored
truth, because that is how the boxes are sold, and the metric ones are
derived exactly at 1 in = 2.54 cm and then cleaned to two decimals —
a stray `15.240000000000002` is the same number and not something to
put in a readout or a saved record.

The gift manifest is in centimetres too, by definition: the models are
built from primitives in this repository at the sizes written in
`src/data/hamperKit.js`, not exported from a modelling tool. A kind
whose model later arrives as an asset in other units declares
`sourceUnits` and `unitScale`, and `size` stays what it always was —
the product's real size in centimetres. `giftManifest(kind)` is the
one reader of all of this, so there is never a second conversion.

## Outer to inner

One sum, in `deriveBox`:

```
outer      the catalogue size:  [length, height, width] cm
inner      the structural cavity, inside the box:
             length  = outer length − 2 × wall
             width   = outer width  − 2 × wall
             height  = outer height − base − lid − hinge
usable     what a gift actually gets:
             length  = inner length − 2 × lining
             width   = inner width  − 2 × lining
             height  = inner height − lining      (paper underneath only)
```

The assumed construction, per category, in cm:

| Category | wall | base | lid | lining | hinge |
| --- | --- | --- | --- | --- | --- |
| Small | 0.4 | 0.4 | 0.5 | 0.3 | 0.2 |
| Medium | 0.5 | 0.5 | 0.6 | 0.4 | 0.2 |
| Large | 0.6 | 0.6 | 0.7 | 0.5 | 0.3 |
| Extra-Large | 0.7 | 0.7 | 0.8 | 0.5 | 0.3 |

`hinge` covers the hinge travel and the lid's locating lip together —
the depth the lid intrudes into the cavity when it is shut. It is
taken off the usable height, which is what guarantees a closed lid
cannot touch the tallest gift standing in the box.

`variant.size` is the **cavity**, and that is what the rest of the
studio knows a box by. `interior()` in `src/lib/giftBounds.js` takes
the lining off it and returns the collision boundary; a gift's own
origin is the point it stands on, and the scene stands it on top of
the lining, which is why the headroom loses one lining thickness and
not two.

Worked, for the brief's own examples:

| Size | Outer (cm) | Cavity (cm) | Usable (cm) |
| --- | --- | --- | --- |
| 6 × 4 × 2 in | 15.24 × 10.16 × 5.08 | 14.44 × 9.36 × 3.98 | 13.84 × 8.76 × 3.68 |
| 8 × 8 × 4 in | 20.32 × 20.32 × 10.16 | 19.52 × 19.52 × 9.06 | 18.92 × 18.92 × 8.76 |
| 12 × 10 × 4 in | 30.48 × 25.4 × 10.16 | 29.48 × 24.4 × 8.86 | 28.68 × 23.6 × 8.46 |
| 18 × 18 × 7 in | 45.72 × 45.72 × 17.78 | 44.32 × 44.32 × 15.98 | 43.32 × 43.32 × 15.48 |

## The 3D box is the real box

`src/hamper/scene/HamperBox.jsx` draws one unit per centimetre and cuts
every part out of the quoted outer box: a base slab, four walls inside
the footprint, the crinkle lining, the lid slab flush with the body, a
locating lip **inside** the walls rather than over them, and two
hinges along the back seam. A closed 8 × 8 × 4 hamper is therefore
exactly 20.32 × 20.32 × 10.16 cm and not a millimetre more.

Nothing is scaled per axis to flatter the viewport. The **camera**
moves instead (`HamperScene.jsx`): the distance is set from the box's
own diagonal, the orbit limits come from it too, and when the size
changes the direction the customer is looking from is kept exactly
while only the reach is rescaled. A camera restored from a saved
design keeps its angle and has its distance pulled into range, because
the box it was framed against may not be this one.

## What fits, and orientations

`packDesign` places the largest footprints first against candidate
corner points, validating every candidate against the usable interior
and against everything already placed. For each gift it tries, in
order: upright at each permitted turn, then — only if the manifest
says `orientations: ['upright', 'on-side']` — laid over at each turn.

A tilt is always a quarter turn about Z, which is an exact permutation
of a box's axes rather than a rotation, so after it is applied every
collision box is upright-with-a-yaw again and the test stays the exact
2D separating-axis one. A gift stores it as `rotation = [0, yaw, tilt]`;
an XYZ euler with no X term is `Ry · Rz`, which is the yaw applied
after the tilt, and that is exactly what the scene draws.

Only the two tumblers declare `on-side` today. They are the only
products in the catalogue that would really be packed lying down, and
the taller of them (18 cm) fits no hamper the shop stocks standing up.

## Known limits of the catalogue

Real hampers are shallow — the deepest the shop sells is 7 inches
outside, 15.48 cm usable — and several products are consequently
fussy:

- **Handmade bouquet** (14 cm tall) fits **only** 18 × 18 × 7 in. It
  is not laid down: a bouquet on its side is not a bouquet.
- **Bella Vita Honey Oud** (12 cm) needs 14 × 14 × 6 in or larger.
- **Tumbler with bamboo lid** (18 cm) fits nothing standing up, and is
  packed lying down from 8 × 8 × 4 in upwards.
- **Tumbler with leather sleeve** (15 cm) stands only in
  18 × 18 × 7 in, and lies down from 14 × 14 × 6 in.
- A **Medium** hamper is 4 inches deep in every stocked size, so it
  takes chocolate, prints, polaroids and flat things, and very little
  that stands up.

The studio says all of this in the interface — the catalogue card
names the smallest size that would take the gift, and the arrangement
bar names it again for anything it could not fit — so none of it is a
dead end for a customer. But it is worth knowing before the product
sizes or the box range are next changed.

## Saved designs

A design stores `box.variantId` **and** `box.dimensions`: the category,
the inches, the outer centimetres, the unit, and the construction the
interior was computed with. The id is a lookup into today's catalogue;
the dimensions are what the hamper was actually built at.

So a size the shop stops stocking does not silently become a different
box. It is rebuilt from the snapshot at exactly its own dimensions,
`stocked` comes back `false`, the studio says it cannot be ordered, and
the checkout refuses it. The gifts, the positions and the finish are
untouched.

Schema version **5** added this. A version 4 design — the three
demonstration boxes of 22 × 16 × 12, 28 × 20 × 16 and 34 × 26 × 20 cm
— is migrated onto the roomiest real size in the category of the same
name, and the packer is run over it on opening. Anything that no
longer fits comes back flagged, never deleted.

Swapping box size keeps `arrangementBackup`: the last arrangement in
which everything fitted, with the box it was taken in. The arrangement
bar offers it back ("Back to the 18 × 18 × 7 in box"), and restoring
re-validates rather than trusting it.

## Tests

`tests/hamperBoxes.test.mjs` covers the conversion, the ranges, the
outer-to-inner sum, the join to `interior()`, the snapshot round-trip
and the version 4 migration. `tests/packing.test.mjs` covers the
orientations and the exactness of a quarter turn. `npm test` runs
everything.
