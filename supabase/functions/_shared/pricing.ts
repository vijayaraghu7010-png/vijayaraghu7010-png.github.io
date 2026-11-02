/* What an order costs, decided here and nowhere else.

   The browser sends what the customer chose: which product, how many,
   and the customiser's configuration. It does not send a price, and if
   it does the number is ignored. Every figure below is read from the
   products and price_variants tables, which the shop's own catalogue
   is synced into.

   A line that cannot be priced is refused, never guessed at and never
   charged as zero. A hamper whose perfume has been taken off the
   catalogue is an order the studio should look at, not an order that
   quietly loses nine hundred rupees.                                */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export type IncomingLine = {
  productId: string;
  quantity: number;
  config?: Record<string, unknown> | null;
};

export type PricedLine = {
  product_id: string;
  product_name: string;
  category: string;
  customiser: string | null;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
  /* What an automatic offer took off this line, and which one. Both
     zero and null when nothing applied. */
  discount_paise: number;
  offer_id: string | null;
  config: Record<string, unknown>;
  position: number;
};

type Offer = {
  id: string;
  code: string | null;
  title: string | null;
  discount_type: string;
  value: number | string;
  applies_to: { scope?: string; value?: string } | null;
  min_order: number | string | null;
  max_discount: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

const rupeesToPaise = (rupees: unknown) => Math.round(Number(rupees) * 100);

/* Does this offer cover this product? The scopes, and the order they
   are tried in, are src/utils/offers.js offerCovers(). The server
   knows the real product behind a variant line, so a category offer
   reaches an A4 frame here exactly as it does on the shelf. */
function offerCovers(offer: Offer, product: { id: string; slug?: string; category?: string }) {
  const scope = offer.applies_to?.scope || 'all';
  if (scope === 'all') return true;
  const want = String(offer.applies_to?.value || '').toLowerCase();
  if (scope === 'category') return String(product.category ?? '').toLowerCase() === want;
  if (scope === 'product') {
    return (
      String(product.slug ?? '').toLowerCase() === want ||
      String(product.id ?? '').toLowerCase() === want
    );
  }
  return false;
}

/* What one offer takes off one unit, in paise.

   discountOf() in the browser, to the paise. A percentage is taken of
   this unit's price; a flat offer is that many rupees. maxDiscount
   caps it, and nothing may take more off than the thing costs. */
function unitDiscountPaise(offer: Offer, unitPaise: number): number {
  if (unitPaise <= 0) return 0;

  const value = Number(offer.value) || 0;
  let off =
    offer.discount_type === 'flat'
      ? rupeesToPaise(value)
      : Math.round((unitPaise * value) / 100);

  if (offer.max_discount) off = Math.min(off, rupeesToPaise(offer.max_discount));
  return Math.max(0, Math.min(off, unitPaise));
}

/* The best automatic offer for one line, and what it takes off it.

   Offers never stack: the one that saves the most wins, which is what
   the card and the bag both do. The minimum order is measured against
   this line's gross, and the cap is applied to the line as well as to
   the unit - both exactly as lineDiscount() does, because a total the
   customer was shown and a total the server charges must agree, and
   agreeing matters more than either being tidier alone. */
function lineDiscountPaise(
  offers: Offer[],
  product: { id: string; slug?: string; category?: string },
  unitPaise: number,
  quantity: number
): { paise: number; offer: Offer | null } {
  let best: { paise: number; offer: Offer } | null = null;

  for (const offer of offers) {
    if (!offerCovers(offer, product)) continue;
    const per = unitDiscountPaise(offer, unitPaise);
    if (per > 0 && (!best || per > best.paise)) best = { paise: per, offer };
  }
  if (!best) return { paise: 0, offer: null };

  const gross = unitPaise * quantity;
  if (best.offer.min_order && gross < rupeesToPaise(best.offer.min_order)) {
    return { paise: 0, offer: null };
  }

  let saved = best.paise * quantity;
  if (best.offer.max_discount) saved = Math.min(saved, rupeesToPaise(best.offer.max_discount));

  return { paise: Math.max(0, Math.min(saved, gross)), offer: best.offer };
}

export async function priceOrder(
  db: SupabaseClient,
  lines: IncomingLine[]
): Promise<
  | { priced: PricedLine[]; subtotal: number; discount: number; total: number }
  | { error: string }
> {
  if (!Array.isArray(lines) || lines.length === 0) return { error: 'The basket is empty' };
  if (lines.length > 50) return { error: 'Too many lines in one order' };

  /* One read for the catalogue rather than one per line. */
  const { data: products } = await db
    .from('products')
    .select('id, name, category, price, min_qty, customiser, published');
  const { data: variants } = await db
    .from('price_variants')
    .select('id, kind, parent_product_id, label, price_paise, active');

  /* Offers are the shop's, not the browser's. An order arrives with no
     discount on it and none is believed if one is sent: what comes off
     is decided here, from this table, at this moment. */
  const { data: offerRows } = await db
    .from('offers')
    .select(
      'id, code, title, discount_type, value, applies_to, min_order, max_discount, starts_at, ends_at, active'
    );

  const now = Date.now();

  /* The same three questions src/utils/offers.js asks, in the same
     order. An offer with a code is held back until somebody enters
     one, and nothing in the shop can - so a coded offer is nobody's
     discount and is skipped here too, rather than quietly becoming an
     automatic one at checkout. */
  const live = (offerRows ?? []).filter((o: Offer) => {
    if (!o || o.active === false) return false;
    if (o.code) return false;
    if (o.starts_at && new Date(o.starts_at).getTime() > now) return false;
    if (o.ends_at && new Date(o.ends_at).getTime() < now) return false;
    return true;
  }) as Offer[];

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const priced: PricedLine[] = [];
  let subtotal = 0;
  let discount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const quantity = Math.floor(Number(line?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return { error: `Line ${i + 1}: that is not a quantity we can sell` };
    }

    const config = (line?.config && typeof line.config === 'object' ? line.config : {}) as Record<
      string,
      unknown
    >;
    const id = String(line?.productId ?? '');

    let product = byId.get(id);
    let unit: number | null = null;

    /* A frame size, or anything else the cart names by joining a
       product to a variant. The price belongs to the variant. */
    if (!product) {
      const variant = variantById.get(id);
      if (variant?.active) {
        product = byId.get(variant.parent_product_id);
        unit = variant.price_paise;
      }
    }

    if (!product || !product.published) {
      return { error: `Line ${i + 1}: that product is no longer sold` };
    }

    if (product.customiser === 'hamper-3d') {
      const built = priceHamper(config, byId, variantById);
      if ('error' in built) return { error: `Line ${i + 1}: ${built.error}` };
      unit = built.paise;
    }

    if (unit === null) unit = rupeesToPaise(product.price);

    if (!Number.isFinite(unit) || unit < 0) {
      return { error: `Line ${i + 1}: that product has no price` };
    }

    /* Nine prints is the smallest order the studio will run. The
       browser enforces it too, which is for the customer's sake; this
       is the one that counts. */
    const min = Number(product.min_qty) || 1;
    if (quantity < min) {
      return { error: `Line ${i + 1}: the smallest order is ${min}` };
    }

    const total = unit * quantity;
    subtotal += total;

    /* The discount is worked out from the product this line really
       is, not from the id the cart made for a size - so an A4 poster
       is still a poster to a category offer. */
    const deal = lineDiscountPaise(live, product, unit, quantity);
    discount += deal.paise;

    priced.push({
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      customiser: product.customiser ?? null,
      quantity,
      unit_price_paise: unit,
      /* Gross, so that line total and unit price never disagree. What
         came off is its own column and the order's own total. */
      line_total_paise: total,
      discount_paise: deal.paise,
      offer_id: deal.offer?.id ?? null,
      config,
      position: i
    });
  }

  if (subtotal <= 0) return { error: 'That order comes to nothing' };

  /* A discount may bring an order down but never through the floor. */
  discount = Math.max(0, Math.min(discount, subtotal));

  return { priced, subtotal, discount, total: subtotal - discount };
}

/* A built hamper: the box it is packed in, plus everything in it. Both
   come from the catalogue, and a gift the catalogue has forgotten
   stops the order rather than being thrown in free. */
function priceHamper(
  config: Record<string, unknown>,
  byId: Map<string, { price: unknown; published: boolean }>,
  variantById: Map<string, { price_paise: number; active: boolean }>
): { paise: number } | { error: string } {
  const design = (config.design ?? config) as Record<string, unknown>;
  const boxId = String((design?.box as Record<string, unknown>)?.variantId ?? design?.boxId ?? '');

  const box = variantById.get(boxId);
  if (!box?.active) return { error: 'that hamper box is no longer stocked' };

  let paise = box.price_paise;

  const gifts = Array.isArray(design?.gifts) ? (design.gifts as Record<string, unknown>[]) : [];
  for (const gift of gifts) {
    const productId = String(gift?.productId ?? '');
    const item = byId.get(productId);
    if (!item || !item.published) return { error: 'a gift in that hamper is no longer offered' };

    const qty = Math.floor(Number(gift?.quantity ?? 1));
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) return { error: 'a gift quantity is wrong' };

    paise += rupeesToPaise(item.price) * qty;
  }

  return { paise };
}
