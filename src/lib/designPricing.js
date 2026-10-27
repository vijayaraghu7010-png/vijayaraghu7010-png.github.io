/* ===========================================================
   What a hamper costs.

   Always computed here, from the kit and the catalogue, never read
   back from the saved design. A design's `pricing` field is a note
   of what the customer was last shown — useful for a saved-designs
   list, worthless as a price. If the shop changes a price between
   somebody building a hamper and ordering it, the price they are
   quoted at checkout is the shop's, and the studio says it moved.
   =========================================================== */

import { STUDIO_PRODUCT_ID, getBoxVariant, getGiftKind, giftUnitPrice } from '../data/hamperKit';
import { getProductById } from '../data/products';
import { bestOfferFor } from '../utils/offers';

/* Lines, totals, and anything that could not be priced. An unpriceable
   line is reported rather than skipped: a hamper that silently drops a
   ₹900 perfume would be sold at the wrong price. */
export function priceDesign(design, offers = []) {
  const variant = getBoxVariant(design?.box);
  const studio = getProductById(STUDIO_PRODUCT_ID);

  const lines = [];
  const problems = [];

  /* The empty box itself. A box rebuilt from a saved design whose
     size is no longer stocked has no price in the catalogue, and it
     is reported as unpriceable rather than charged at zero — the
     checkout refuses the order on the same grounds. */
  if (!Number.isFinite(Number(variant.price))) {
    problems.push({ uid: null, kindId: variant.id, reason: 'box-size-unstocked' });
  }

  lines.push({
    kind: 'box',
    id: variant.id,
    /* Named with its size, because the size is what is being
       charged for: a Large hamper is three different prices. */
    label: `${variant.label} — ${variant.sizeLabel}`,
    quantity: 1,
    unitPrice: Number(variant.price) || 0,
    total: Number(variant.price) || 0
  });

  (design?.gifts || []).forEach((gift) => {
    const kind = getGiftKind(gift.kindId);
    if (!kind) {
      problems.push({ uid: gift.uid, kindId: gift.kindId, reason: 'no-longer-offered' });
      return;
    }

    const unit = giftUnitPrice(kind, gift.variantId);
    if (unit === null) {
      /* The kit points at a catalogue product that has been
         unpublished or deleted. */
      problems.push({ uid: gift.uid, kindId: gift.kindId, reason: 'product-missing', productId: kind.productId });
      return;
    }

    const quantity = Math.max(1, Math.min(kind.maxQty || 1, Math.round(Number(gift.quantity) || 1)));
    const variantLabel = (kind.variants || []).find((v) => v.id === gift.variantId)?.label;

    lines.push({
      kind: 'gift',
      uid: gift.uid,
      id: kind.id,
      productId: kind.productId || null,
      label: variantLabel ? `${kind.name} — ${variantLabel}` : kind.name,
      quantity,
      unitPrice: unit,
      total: unit * quantity
    });
  });

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);

  /* An automatic offer that covers the hamper category comes off the
     studio's own product, exactly as it would on a shop page, so the
     studio cannot quote a discount the rest of the shop would not. */
  const deal = studio ? bestOfferFor({ ...studio, price: subtotal }, offers) : null;
  const savings = deal ? deal.amount : 0;

  return {
    currency: 'INR',
    lines,
    subtotal,
    savings,
    payable: Math.max(0, Math.round((subtotal - savings) * 100) / 100),
    offer: deal ? { id: deal.offer.id, title: deal.offer.title || 'Offer applied', percent: deal.percent } : null,
    problems,
    computedAt: Date.now()
  };
}

/* Did the price the customer was last shown survive a recompute? */
export function pricingDrift(design, pricing) {
  const shown = Number(design?.pricing?.payable);
  if (!Number.isFinite(shown)) return null;
  if (Math.abs(shown - pricing.payable) < 0.01) return null;
  return { was: shown, now: pricing.payable };
}
