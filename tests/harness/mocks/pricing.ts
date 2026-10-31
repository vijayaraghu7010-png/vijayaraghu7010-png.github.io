/* Pricing is Phase 1's and is tested there. Here it only needs to
   succeed or fail on demand so the order-creation paths around it can
   be exercised. */
const g: any = globalThis as any;

export async function priceOrder(_db: any, items: any[]) {
  if (g.__priceError) return { error: g.__priceError };
  return {
    subtotal: 5400,
    priced: (items ?? []).map((i: any, n: number) => ({
      product_id: i.productId,
      product_name: 'Test Product',
      customiser: 'polaroid',
      quantity: i.quantity ?? 1,
      unit_price_paise: 600,
      line_total_paise: 5400,
      config: i.config ?? {},
      position: n
    }))
  };
}
