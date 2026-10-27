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
  config: Record<string, unknown>;
  position: number;
};

const rupeesToPaise = (rupees: unknown) => Math.round(Number(rupees) * 100);

export async function priceOrder(
  db: SupabaseClient,
  lines: IncomingLine[]
): Promise<{ priced: PricedLine[]; subtotal: number } | { error: string }> {
  if (!Array.isArray(lines) || lines.length === 0) return { error: 'The basket is empty' };
  if (lines.length > 50) return { error: 'Too many lines in one order' };

  /* One read for the catalogue rather than one per line. */
  const { data: products } = await db
    .from('products')
    .select('id, name, category, price, min_qty, customiser, published');
  const { data: variants } = await db
    .from('price_variants')
    .select('id, kind, parent_product_id, label, price_paise, active');

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const priced: PricedLine[] = [];
  let subtotal = 0;

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

    priced.push({
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      customiser: product.customiser ?? null,
      quantity,
      unit_price_paise: unit,
      line_total_paise: total,
      config,
      position: i
    });
  }

  if (subtotal <= 0) return { error: 'That order comes to nothing' };
  return { priced, subtotal };
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
