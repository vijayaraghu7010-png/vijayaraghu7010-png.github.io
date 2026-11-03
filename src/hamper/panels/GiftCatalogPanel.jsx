import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { GIFT_CATEGORIES, GIFT_KINDS, getBoxVariant, giftIsUngated, giftUnitPrice } from '../../data/hamperKit';
import { giftCouldFit, smallestBoxFor } from '../../lib/packing';
import { formatRupees } from '../../utils/currency';

/* ===========================================================
   What can go in the box.

   Twenty-odd products is more than fits in one scroll, so they are
   grouped the way somebody shops for them — chocolates, crochet,
   fragrance — with a thumbnail of the real product rather than a
   coloured square. The photograph is the fastest way to recognise
   a KitKat, and the model in the preview is an approximation of
   it; showing both is honest about which is which.

   A kind whose catalogue product has gone is shown as unavailable
   rather than hidden, so a customer who put one in last week is not
   left wondering where it went.
   =========================================================== */

export default function GiftCatalogPanel({ design, change }) {
  const variant = getBoxVariant(design.box);
  const full = design.gifts.length >= variant.capacity;
  const [openCategory, setOpenCategory] = useState('all');

  const byCategory = useMemo(() => {
    const groups = new Map(GIFT_CATEGORIES.map((c) => [c.id, { ...c, kinds: [] }]));
    GIFT_KINDS.forEach((kind) => {
      const group = groups.get(kind.category);
      if (group) group.kinds.push(kind);
    });
    return [...groups.values()].filter((g) => g.kinds.length);
  }, []);

  const shown = openCategory === 'all' ? byCategory : byCategory.filter((g) => g.id === openCategory);

  return (
    <div className="stack">
      <p className="field-hint">
        {full
          ? `A ${variant.sizeLabel} hamper takes at most ${variant.capacity} separate gifts. Remove something, or choose a larger box.`
          : `${variant.label}, ${variant.sizeLabel} — a guide of ${variant.guide}. Add what you like and the studio works out what fits.`}
      </p>

      <div className="kit-filter" role="group" aria-label="Filter by kind">
        <button
          type="button"
          className={`chip${openCategory === 'all' ? ' is-on' : ''}`}
          aria-pressed={openCategory === 'all'}
          onClick={() => setOpenCategory('all')}
        >
          Everything
        </button>
        {byCategory.map((group) => (
          <button
            key={group.id}
            type="button"
            className={`chip${openCategory === group.id ? ' is-on' : ''}`}
            aria-pressed={openCategory === group.id}
            onClick={() => setOpenCategory(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>

      {shown.map((group) => (
        <section key={group.id} className="kit-group">
          {openCategory === 'all' && <h3 className="kit-group__title">{group.label}</h3>}

          <div className="kit-grid">
            {group.kinds.map((kind) => {
              const price = giftUnitPrice(kind);
              const unavailable = price === null;
              const inBox = design.gifts.filter((g) => g.kindId === kind.id).reduce((n, g) => n + g.quantity, 0);
              const maxed = inBox >= (kind.maxQty || 1);
              /* Will not go into this box at all — in any turn, and
                 lying down if the manifest allows it. Said plainly,
                 with the size that would take it, rather than a dead
                 button. This is the packer's own test, so the card
                 and the box can never disagree.

                 Except for the categories the catalogue does not gate
                 on size: those are offered whatever the measurements
                 say, and the packer has the last word instead. */
              const tooTall = !giftIsUngated(kind) && !giftCouldFit(kind, variant);
              const needsBox = tooTall ? smallestBoxFor(kind) : null;

              return (
                <button
                  key={kind.id}
                  type="button"
                  className={`kit-card${inBox ? ' is-in' : ''}`}
                  disabled={unavailable || full || maxed || tooTall}
                  onClick={() => change({ type: 'add-gift', kindId: kind.id })}
                >
                  {kind.previewPath && (
                    <img className="kit-card__shot" src={kind.previewPath} alt="" loading="lazy" decoding="async" />
                  )}
                  <span className="kit-card__top">
                    <span className="kit-card__name">{kind.name}</span>
                    <span className="kit-card__price">{unavailable ? 'Unavailable' : formatRupees(price)}</span>
                  </span>
                  <span className="kit-card__blurb">{kind.blurb}</span>
                  <span className="kit-card__foot">
                    {tooTall ? (
                      <em>
                        {needsBox
                          ? `Needs a ${needsBox.sizeLabel} box`
                          : 'Too big for any box we stock'}
                      </em>
                    ) : inBox ? (
                      <em>
                        {inBox} in the box{maxed ? ' — the most we can fit' : ''}
                      </em>
                    ) : (
                      <>
                        <Plus size={13} aria-hidden="true" /> Add to hamper
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <p className="field-hint">
        The preview models are built from these photographs — close, but not measured against the real thing. What
        is packed is the product in the picture.
      </p>
    </div>
  );
}
