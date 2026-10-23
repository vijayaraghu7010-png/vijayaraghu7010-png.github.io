/* Offer maths, in one place.

   An offer with no code runs by itself: the shop shows the reduced
   price on the card, on the product page and in the bag, with the old
   price struck through. An offer with a code is held back until the
   code is entered, so it never quietly discounts everything. */

export function offerIsLive(offer, now = Date.now()) {
  if (!offer || offer.active === false) return false;
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return false;
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now) return false;
  return true;
}

/* Does this offer cover this product? */
export function offerCovers(offer, product) {
  const scope = offer?.appliesTo?.scope || 'all';
  if (scope === 'all') return true;
  if (!product) return false;
  const value = String(offer.appliesTo?.value || '').toLowerCase();
  if (scope === 'category') return String(product.category).toLowerCase() === value;
  if (scope === 'product') return String(product.slug).toLowerCase() === value || String(product.id).toLowerCase() === value;
  return false;
}

/* What one offer takes off one price. */
export function discountOf(offer, price) {
  const amount = Number(price) || 0;
  if (!amount) return 0;

  let off = offer.discountType === 'flat' ? Number(offer.value) || 0 : (amount * (Number(offer.value) || 0)) / 100;

  if (offer.maxDiscount) off = Math.min(off, Number(offer.maxDiscount));
  return Math.max(0, Math.min(off, amount));
}

/* The best automatic offer for one product — automatic meaning it has
   no code, so the customer does not have to know about it. Offers are
   never stacked: the one that saves the most wins. */
export function bestOfferFor(product, offers, { includeCoded = false } = {}) {
  if (!product || !offers?.length) return null;

  const candidates = offers.filter(
    (o) => offerIsLive(o) && (includeCoded || !o.code) && offerCovers(o, product)
  );
  if (!candidates.length) return null;

  let best = null;
  candidates.forEach((offer) => {
    const amount = discountOf(offer, product.price);
    if (amount > 0 && (!best || amount > best.amount)) {
      best = {
        offer,
        amount,
        price: Math.round((Number(product.price) - amount) * 100) / 100,
        percent: Math.round((amount / Number(product.price)) * 100)
      };
    }
  });

  return best;
}

/* The same question for a line in the bag, where quantity matters and
   a minimum order is measured against the line, not the single item. */
export function lineDiscount(item, product, offers) {
  const best = bestOfferFor(product || { price: item.unitPrice, category: item.category, slug: item.slug }, offers);
  if (!best) return null;

  const qty = Number(item.quantity) || 0;
  const gross = (Number(item.unitPrice) || 0) * qty;
  if (best.offer.minOrder && gross < Number(best.offer.minOrder)) return null;

  let saved = best.amount * qty;
  if (best.offer.maxDiscount) saved = Math.min(saved, Number(best.offer.maxDiscount));

  return { offer: best.offer, saved: Math.round(saved * 100) / 100, percent: best.percent };
}

/* The offers that should be announced at the top of the shop. */
export function bannerOffers(offers) {
  return (offers || []).filter((o) => offerIsLive(o) && o.showBanner);
}
