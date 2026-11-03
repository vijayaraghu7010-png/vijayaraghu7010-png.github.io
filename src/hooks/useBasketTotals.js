import { useMemo } from 'react';

import { useCart } from '../context/CartContext';
import { useLiveOffers, useShipping } from '../context/SiteConfigContext';
import { getProductById, getProductBySlug } from '../data/products';
import { lineDiscount } from '../utils/offers';
import { awayFromFreeShipping, shippingFor, shippingIsFree } from '../utils/shipping';

/* What the basket comes to, worked out once.

   Three places show a total - the drawer, the bag and the checkout
   summary - and each used to do its own arithmetic. The drawer never
   subtracted offers at all, so a basket with a discount on it showed
   one total in the drawer and a smaller one on the next page.

   Adding a shipping charge would have made that three copies of a sum
   that has to agree with the server, so it is done here instead and
   they all read the same numbers.

   None of this decides anything. The server prices the order when it
   is placed, shipping included, and that figure is the one that
   stands. This is so the customer can see what to expect first. */
export default function useBasketTotals() {
  const { items, subtotal } = useCart();
  const offers = useLiveOffers();
  const shippingConfig = useShipping();

  return useMemo(() => {
    /* A frame or poster line is filed under an id the cart made for
       the size, which is in no catalogue - so the lookup falls back
       to the product's own slug, exactly as the bag has always done.
       Without that a category offer passes over every sized product
       here while the server, which knows the real product, takes it
       off. */
    const savings = items.reduce((sum, item) => {
      const product = getProductById(item.productId) || getProductBySlug(item.slug);
      const line = lineDiscount(item, product, offers);
      return sum + (line ? line.saved : 0);
    }, 0);

    const goods = Math.max(0, subtotal - savings);
    const shipping = shippingFor(shippingConfig, goods);

    return {
      subtotal,
      savings,
      /* What the goods come to once offers are off, which is what any
         free-delivery threshold is measured against. */
      goods,
      shippingConfig,
      shipping,
      shippingCharged: shippingConfig.enabled,
      shippingIsFree: shippingIsFree(shippingConfig, goods),
      toFreeShipping: awayFromFreeShipping(shippingConfig, goods),
      payable: goods + shipping
    };
  }, [items, subtotal, offers, shippingConfig]);
}
