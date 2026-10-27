import { useState } from 'react';

import {
  BOX_COLOURS,
  HAMPER_CATEGORIES,
  LINING_COLOURS,
  MATERIALS,
  RIBBON_COLOURS,
  RIBBON_STYLES,
  boxesInCategory,
  describeInterior,
  formatCm,
  getBoxVariant,
  getGiftKind
} from '../../data/hamperKit';
import { arrangementSummary, giftCouldFit, smallestBoxFor } from '../../lib/packing';
import { formatRupees } from '../../utils/currency';

/* The box itself: which hamper, which size, and then the finish,
   lining and ribbon. Every control here writes straight to the
   design, so the 3D box changes as it is pressed and the autosave is
   scheduled by the same call.

   The size is chosen in two steps, because that is how the catalogue
   is organised: a category first — Small, Medium, Large,
   Extra-Large, each with a published range — and then one of the
   sizes stocked inside that range. No size outside a published range
   can be chosen, because none is offered.

   The dimensions are shown in both units, outside and in. The
   interior is marked as computed and not measured: it is the quoted
   outer box less a wall, base, lid, hinge and lining nobody here has
   measured, and presenting an estimate as a specification would be
   the one dishonest thing this panel could do. */

function Swatches({ label, list, value, onChange, name }) {
  return (
    <fieldset className="swatches">
      <legend>{label}</legend>
      <div className="swatches__row">
        {list.map((swatch) => (
          <label
            key={swatch.id}
            className={`swatch${value === swatch.id ? ' is-on' : ''}`}
            title={swatch.label}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === swatch.id}
              onChange={() => onChange(swatch.id)}
            />
            <span className="swatch__chip" style={{ background: swatch.hex }} aria-hidden="true" />
            <span className="sr-only">{swatch.label}</span>
          </label>
        ))}
      </div>
      <p className="swatches__name">{list.find((s) => s.id === value)?.label}</p>
    </fieldset>
  );
}

/* The size of the box, in both units, with the interior worked out
   from the construction and labelled as such. */
function Dimensions({ variant, summary, giftCount }) {
  const inner = describeInterior(variant);
  const [lengthIn, widthIn, heightIn] = variant.inches;

  return (
    <dl className="dims">
      <div className="dims__row">
        <dt>Outer</dt>
        <dd>
          {formatCm(variant.outer)}
          <span className="dims__alt">
            {lengthIn} × {widthIn} × {heightIn} in
          </span>
        </dd>
      </div>
      <div className="dims__row">
        <dt>Inside the walls</dt>
        <dd>{inner.cavity}</dd>
      </div>
      <div className="dims__row">
        <dt>Usable, over the lining</dt>
        <dd>{inner.usable}</dd>
      </div>
      <div className="dims__row">
        <dt>Gifts chosen</dt>
        <dd>{giftCount}</dd>
      </div>
      <div className="dims__row">
        <dt>Placement</dt>
        <dd className={summary.ok ? 'dims__ok' : 'dims__warn'}>
          {giftCount === 0 ? 'Nothing in it yet' : summary.ok ? 'Valid' : `Unable to fit ${summary.total - summary.placed}`}
        </dd>
      </div>
    </dl>
  );
}

export default function AppearancePanel({ design, change }) {
  const { box } = design;
  const variant = getBoxVariant(box);

  /* The category follows the chosen box, but a customer looking at
     the other categories should be able to do so without changing
     their hamper, so which one is open is this panel's own state. */
  const [openCategory, setOpenCategory] = useState(variant.categoryId);

  /* When the design itself changes category — a saved hamper opened,
     or a size chosen somewhere else — the panel follows it. Adjusting
     state during the render rather than in an effect, so the right
     category is open on the first paint instead of the second. */
  const [seen, setSeen] = useState(variant.categoryId);
  if (seen !== variant.categoryId) {
    setSeen(variant.categoryId);
    setOpenCategory(variant.categoryId);
  }

  const category = HAMPER_CATEGORIES.find((c) => c.id === openCategory) || HAMPER_CATEGORIES[0];
  const sizes = boxesInCategory(category.id);

  const summary = arrangementSummary(design);
  const over = design.gifts.length - variant.capacity;

  /* Changing to a smaller box can leave something that will not go
     in at all. Nothing is removed for the customer, so the panel has
     to say which gift and what to do about it. */
  const wontFit = design.gifts
    .map((g) => ({ gift: g, kind: getGiftKind(g.kindId) }))
    .filter(({ kind, gift }) => kind && !giftCouldFit(kind, variant, gift.scale))
    .map(({ kind, gift }) => ({ name: kind.name, needs: smallestBoxFor(kind, gift.scale) }));

  const choose = (id) => change({ type: 'box', patch: { variantId: id } });

  return (
    <div className="stack">
      <fieldset className="swatches">
        <legend>Hamper size</legend>

        <div className="chips">
          {HAMPER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${c.id === openCategory ? ' is-on' : ''}${
                c.id === variant.categoryId ? ' is-current' : ''
              }`}
              aria-pressed={c.id === openCategory}
              onClick={() => setOpenCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="field-hint">
          {category.label}: {category.rangeIn.min.join(' × ')} in up to {category.rangeIn.max.join(' × ')} in —{' '}
          {category.guide}. What actually fits is worked out by the studio, not by that guide.
        </p>

        <div className="option-grid option-grid--tight">
          {sizes.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`option${v.id === variant.id ? ' is-on' : ''}`}
              aria-pressed={v.id === variant.id}
              onClick={() => choose(v.id)}
            >
              <span className="option__name">{v.sizeLabel}</span>
              <span className="option__price">{formatRupees(v.price)}</span>
              <span className="option__meta">{formatCm(v.outer)}</span>
            </button>
          ))}
        </div>

        {variant.stocked === false && (
          <p className="field-error" role="alert">
            This hamper was built at {variant.sizeLabel}, which is no longer stocked. It is still drawn and
            arranged at exactly that size, but it cannot be ordered — choose one of the sizes above when you are
            ready to buy.
          </p>
        )}

        <Dimensions variant={variant} summary={summary} giftCount={design.gifts.length} />

        <p className="field-hint">
          The outer size is the catalogue&rsquo;s. The two inside figures are worked out from an assumed
          construction — {variant.construction.wall} cm walls, a {variant.construction.base} cm base, a{' '}
          {variant.construction.lid} cm lid and {variant.construction.lining} cm lining paper. No box has been
          measured, so treat them as close rather than exact.
        </p>

        {over > 0 && (
          <p className="field-error" role="alert">
            This box will take at most {variant.capacity} separate gifts and the hamper has {design.gifts.length}.
            Remove {over} or choose a larger box — nothing has been taken out for you.
          </p>
        )}

        {wontFit.length > 0 && (
          <p className="field-error" role="alert">
            {wontFit.map((w) => w.name).join(', ')} {wontFit.length === 1 ? 'does' : 'do'} not go into a{' '}
            {variant.sizeLabel} box in any position.{' '}
            {wontFit[0].needs
              ? `The smallest that would take ${wontFit.length === 1 ? 'it' : 'them'} is ${wontFit[0].needs.sizeLabel}.`
              : 'No box in the catalogue is big enough.'}{' '}
            Nothing has been removed for you.
          </p>
        )}
      </fieldset>

      <Swatches
        label="Box colour"
        name="box-colour"
        list={BOX_COLOURS}
        value={box.boxColourId}
        onChange={(id) => change({ type: 'box', patch: { boxColourId: id } })}
      />

      <fieldset className="swatches">
        <legend>Finish</legend>
        <div className="chips">
          {MATERIALS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip${m.id === box.boxMaterialId ? ' is-on' : ''}`}
              aria-pressed={m.id === box.boxMaterialId}
              onClick={() => change({ type: 'box', patch: { boxMaterialId: m.id } })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Swatches
        label="Lining"
        name="lining"
        list={LINING_COLOURS}
        value={box.liningColourId}
        onChange={(id) => change({ type: 'box', patch: { liningColourId: id } })}
      />

      <Swatches
        label="Ribbon"
        name="ribbon"
        list={RIBBON_COLOURS}
        value={box.ribbonColourId}
        onChange={(id) => change({ type: 'box', patch: { ribbonColourId: id } })}
      />

      <fieldset className="swatches">
        <legend>Ribbon style</legend>
        <div className="chips">
          {RIBBON_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chip${s.id === box.ribbonStyleId ? ' is-on' : ''}`}
              aria-pressed={s.id === box.ribbonStyleId}
              onClick={() => change({ type: 'box', patch: { ribbonStyleId: s.id } })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
