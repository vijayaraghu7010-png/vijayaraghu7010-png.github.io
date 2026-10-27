import { Suspense, lazy, useMemo } from 'react';

import { Placeholder } from './parts';

/* ===========================================================
   Which component draws which product.

   A kind names a model; this is the only place that knows what a
   model actually is. Adding a product is a row in the kit and, at
   most, a component here — never a change to GiftMesh, the panels
   or the scene.

   The families are loaded on demand. A hamper of chocolates never
   downloads the crochet models, which is most of the point of
   splitting them up: twenty-odd products in one bundle would be
   parsed by every visitor to the studio whether they opened the
   crochet tab or not.
   =========================================================== */

const crochet = () => import('./crochet');
const sweets = () => import('./sweets');
const beauty = () => import('./beauty');
const drinkware = () => import('./drinkware');
const fragrance = () => import('./fragrance');
const keepsakes = () => import('./keepsakes');

/* model id -> a lazily loaded component.

   `lazy` is called once per model at module scope, not per render:
   a component identity that changed every render would unmount and
   remount the mesh on every frame of a drag. */
const MODELS = {
  amigurumi: lazy(() => crochet().then((m) => ({ default: m.Amigurumi }))),
  'crochet-bow': lazy(() => crochet().then((m) => ({ default: m.CrochetBow }))),
  'crochet-potted-flower': lazy(() => crochet().then((m) => ({ default: m.PottedFlower }))),
  'crochet-bouquet': lazy(() => crochet().then((m) => ({ default: m.CrochetBouquet }))),
  'crochet-cherries': lazy(() => crochet().then((m) => ({ default: m.CrochetCherries }))),
  'crochet-turtle': lazy(() => crochet().then((m) => ({ default: m.CrochetTurtle }))),

  'wrapped-bar': lazy(() => sweets().then((m) => ({ default: m.WrappedBar }))),
  'carton-bar': lazy(() => sweets().then((m) => ({ default: m.CartonBar }))),
  'ferrero-box': lazy(() => sweets().then((m) => ({ default: m.FerreroBox }))),

  'lip-gloss': lazy(() => beauty().then((m) => ({ default: m.LipGloss }))),
  'carded-balm': lazy(() => beauty().then((m) => ({ default: m.CardedBalm }))),
  'tube-and-carton': lazy(() => beauty().then((m) => ({ default: m.TubeAndCarton }))),

  tumbler: lazy(() => drinkware()),

  'perfume-bottle': lazy(() => fragrance().then((m) => ({ default: m.PerfumeBottle }))),
  'perfume-duo': lazy(() => fragrance().then((m) => ({ default: m.PerfumeDuo }))),

  'photo-stack': lazy(() => keepsakes().then((m) => ({ default: m.PhotoStack }))),
  frame: lazy(() => keepsakes().then((m) => ({ default: m.PhotoFrame }))),
  bouquet: lazy(() => keepsakes().then((m) => ({ default: m.Bouquet }))),
  book: lazy(() => keepsakes().then((m) => ({ default: m.Magazine })))
};

export const hasModel = (id) => Boolean(MODELS[id]);

/* What a variant changes about the figure. Only the crocheted
   animals use this so far — the bear, the two bunnies and the cat
   are one product in four colourways, not four products. */
function figureFor(kind, variantId) {
  const base = kind.figure;
  if (!base) return undefined;
  const variant = (kind.variants || []).find((v) => v.id === variantId);
  return variant?.figure ? { ...base, ...variant.figure } : base;
}

/* Draws one product.

   Everything a model may need arrives as props, and no model reads
   the design, the kit or the store: given the same props it draws
   the same thing, which is what lets the same component render a
   gift in the box and a thumbnail somewhere else. */
export default function ProductModel({ kind, colour, texture, text, variantId }) {
  const Model = MODELS[kind.model];
  const figure = useMemo(() => figureFor(kind, variantId), [kind, variantId]);

  if (!Model) {
    /* A kit row naming a model that does not exist. Drawn as the
       plain box rather than as nothing, so the gift is still there
       to be selected, moved and taken out again. */
    return <Placeholder kind={kind} colour={colour} />;
  }

  return (
    /* While the family is still arriving the gift is its plain box.
       It is in the right place, at the right size, and is replaced
       in place once the real model loads — better than a hole in
       the hamper. */
    <Suspense fallback={<Placeholder kind={kind} colour={colour} />}>
      <Model kind={kind} colour={colour} texture={texture} text={text} figure={figure} variantId={variantId} />
    </Suspense>
  );
}
