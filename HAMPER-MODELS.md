# The hamper's 3D products

How the build-your-own hamper draws the things that go in it, and how
to add another one.

## Read this first: prices are placeholders

Every one of the twenty photographed products carries a **made-up
price**. They were put in so the studio has something to total, at the
owner's instruction. They are not quotes, and no price was supplied
with the photographs.

They live in `src/data/hamperItems.js` as ordinary catalogue products,
which means they are edited where every other price is edited —
**Admin → Products** — and the studio picks the change up without a
deploy. Correct them before the shop takes an order.

## What the models are, honestly

There is no Blender and no image-to-3D service in this project, so
nothing here was reconstructed from the photographs automatically.
Each product is **procedural geometry**: primitives assembled to match
the silhouette, proportions and colours in its photograph, with the
product's own packaging artwork mapped onto the faces that carry it.

Every kind is therefore marked `reconstructionStatus: 'approximate'`.
None is marked `verified`, and nothing should be until someone has
measured the real object and compared renders against it from known
angles. `kind.uncertain` lists, per product, what the photograph could
not show — usually the back, the underside, or a detail too small to
read.

The catalogue panel shows the real photograph beside the model, and an
open gift's panel has a collapsed note saying the preview is an
approximation. That is deliberate: the customer should never be in
doubt about which is the product and which is the drawing.

Flat image planes are never used as a finished model. The one
fallback, `Placeholder` in `src/hamper/models/parts.jsx`, is a plain
wireframed box at the product's real size, and a kind that renders as
one says so in the panel.

## The box arranges itself

There are no direction controls. The customer chooses what goes in;
`src/lib/packing.js` decides where each thing goes, and it is the
only code allowed to write a gift's position.

The method is largest-first placement against candidate corner
points — the extreme-point method — with each candidate validated
against the walls and against everything already placed. Gifts are
ordered by the floor they cover, because what makes a hamper hard to
pack is area, not volume: a tall bottle is easy to fit late, a flat
magazine is not.

Three properties it is written to have:

- **Deterministic.** The same gifts in the same box give the same
  arrangement every time, so a saved design reopens looking like
  itself.
- **Bounded.** Every loop has a ceiling, so a large catalogue cannot
  hang the page. A box packed four times past its capacity completes
  in a few milliseconds.
- **Honest.** A gift that will not fit is kept, marked
  `placed: false`, named in the panel with the box that would take
  it, and blocks checkout. Nothing is silently shrunk, dropped or
  left through a wall.

Adding a gift tries a local placement first and only repacks the
whole box if that fails, so adding a chocolate bar does not reshuffle
everything the customer has just watched settle. Removing one moves
nothing, unless something was waiting for room.

### Collision

Products are placed upright and turned about the vertical axis only,
which is how a hamper is really packed and which makes the exact
oriented-box test cheap: a 2D separating-axis test across the floor
plus an interval test up the wall.

A product is not one box. `kind.proxy` declares as many boxes as the
shape needs — a doll is a body with a smaller head on it, a bouquet
is a narrow cone under a wide spray — so an irregular product does
not claim air it never occupies. The upright box is the broad phase;
only pairs that survive it are measured box by box.

`kind.clearance` is the air a product wants around it, in
centimetres. The default is 0.4; a bouquet asks for more.

## The coordinate system

Centimetres throughout, measured from the middle of the floor of the
box:

| axis | positive | negative |
| ---- | -------- | -------- |
| X | right | left |
| Y | up | down |
| Z | forward, towards the viewer | backward, away |

Gifts are only ever turned about Y, so a gift's rotation is always
`[0, yaw, 0]`.

**Every model obeys the same contract**, and the bounds maths depends
on it: a model is drawn standing on the origin, spanning `-w/2 .. w/2`
across, `0 .. h` up and `-d/2 .. d/2` along, where `[w, h, d]` is the
kind's `size`. A model that centred itself on its middle, or rotated
itself at load, would be clamped against a shape it does not have.

## Where things live

| file | what it holds |
| ---- | ------------- |
| `src/data/hamperKit.js` | the manifest: one row per product |
| `src/data/hamperItems.js` | the same products as catalogue rows, for pricing |
| `src/hamper/models/registry.jsx` | model id → component, lazily loaded |
| `src/hamper/models/*.jsx` | the geometry, grouped by family |
| `src/hamper/models/textures.js` | the shared, reference-counted texture cache |
| `src/lib/giftBounds.js` | the interior of the box, as a volume |
| `src/lib/collision.js` | collision proxies and the oriented-box test |
| `src/lib/packing.js` | the packer, and the validator that guards it |
| `src/hamper/panels/ArrangementBar.jsx` | how the packing went, and Rearrange |
| `public/images/kit/` | the photographs, and `-label` crops used as textures |

## A manifest row

```js
{
  id: 'choc-kitkat',             // stable; a saved design stores this
  name: 'KitKat',
  category: 'chocolate',         // groups the catalogue panel
  productId: 'kit-choc-kitkat',  // where the price comes from
  model: 'wrapped-bar',          // a component in the registry
  size: [10, 1.2, 4],            // centimetres, w × h × d
  maxQty: 6,
  colours: ['#E2231A'],
  wrapper: { texture: '…/choc-kitkat-label.jpg', base: '#E2231A', sheen: 0.35, crimped: true },
  previewPath: '…/choc-kitkat.jpg',   // the real photograph
  texturePath: '…/choc-kitkat-label.jpg',
  sourceImages: ['WhatsApp Image 2026-10-25 at 10.52.39 AM (1).jpeg'],
  materialSummary: 'Printed foil wrapper, crimped at both ends',
  reconstructionStatus: 'approximate',
  uncertain: ['the reverse of the wrapper is estimated']
}
```

Optional flags: `supportsScale`, `supportsText` (+ `textLabel`,
`textMax`), `supportsPhoto` (+ `photoLabel`), `variants`, and
`figure` / `tumbler` / `bottle` for the families that take
parameters. For packing: `proxy` (collision boxes, as fractions of
`size`), `clearance` (centimetres of air), and `turns` (which yaws
the packer may try; by default a quarter turn either way, or none at
all for something round in plan).

## Adding a product

1. Put the photograph in `public/images/kit/` and make a square crop
   beside it as `<id>-label.jpg` if the product has printed artwork.
2. Add a catalogue row to `src/data/hamperItems.js` with a price.
3. Add a manifest row to `GIFT_KINDS` in `src/data/hamperKit.js`.
4. If no existing `model` fits, write a component in the matching
   family file and register it. Keep to the contract above.
5. Give it a `proxy` if it is not roughly a rectangle, and a
   `clearance` if it is fragile or has parts the boxes do not
   describe.
6. `npm test` — the suite checks that every kind fits at least one
   box, has a price, names a model, declares a status, stands on its
   own origin, and can actually be packed.

Most products need only steps 1–3: a new chocolate bar is a row, not
a component.

## Performance notes

Model families are separate chunks and load on demand, so a hamper of
chocolates never downloads the crochet models. Label textures are
fetched only when a gift using one is in the box, shared between
instances of the same kind, and disposed thirty seconds after the last
one is taken out. The scene draws on demand rather than at 60fps.

When the packer moves things, they fly up, across and down rather
than sliding straight to their new places, and the flights are
staggered gift by gift. A straight line between two valid
arrangements passes through invalid ones, and a box of gifts sliding
through each other on the way to a tidy result looks like a bug even
though the result is correct.
