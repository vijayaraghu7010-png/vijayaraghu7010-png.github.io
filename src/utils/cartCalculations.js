/* Cart maths. Every total on the site comes from these helpers —
   nothing is hardcoded, and nothing is rounded until it is shown. */

import { PRICE_MODES } from '../data/products';

export function clampQuantity(product, qty) {
  const min = product?.minQty || 1;
  const n = Math.round(Number(qty));
  if (!Number.isFinite(n)) return min;
  return Math.min(999, Math.max(min, n));
}

/* A per-unit product (polaroid prints at ₹6) multiplies by quantity.
   A fixed product (a ₹150 set of 25) multiplies by how many sets. */
export function lineTotal(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  return price * qty;
}

export function cartSubtotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function cartCount(items) {
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

/* How many separate things are in the bag — a 25-print set counts
   once, nine polaroid prints count once, not nine times. */
export function cartLineCount(items) {
  return items.length;
}

export function unitNoun(product, qty) {
  if (!product) return '';
  if (product.priceMode === PRICE_MODES.PER_UNIT) {
    const noun = product.unitNoun || 'item';
    return qty === 1 ? noun : `${noun}s`;
  }
  if (product.setSize) return qty === 1 ? 'set' : 'sets';
  return qty === 1 ? 'item' : 'items';
}

/* Two magazines with different themes must stay separate cart lines,
   so the configuration is part of the line key. */
export function makeLineKey(productId, config) {
  const payload = config && Object.keys(config).length ? JSON.stringify(config) : '';
  if (!payload) return productId;
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0;
  }
  return `${productId}__${Math.abs(hash).toString(36)}`;
}
