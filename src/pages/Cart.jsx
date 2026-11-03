import { Link } from 'react-router-dom';
import { Info, ShoppingBag } from 'lucide-react';

import CartLine from '../components/CartLine';
import usePageMeta from '../hooks/usePageMeta';
import { useCart } from '../context/CartContext';
import useBasketTotals from '../hooks/useBasketTotals';
import { formatRupees } from '../utils/currency';

export default function Cart() {
  usePageMeta('Your Bag', 'Review the magazines, polaroids and bouquets in your WrappedStudio bag.');
  const { items, count, clear } = useCart();

  /* Subtotal, offers and delivery, worked out in one place so the
     drawer, this page and the checkout summary cannot disagree. */
  const {
    subtotal, savings, shippingConfig, shipping,
    shippingIsFree: freeShipping, toFreeShipping, payable
  } = useBasketTotals();

  if (items.length === 0) {
    return (
      <div className="shell">
        <header className="page-head">
          <h1>Your bag</h1>
        </header>
        <div className="empty panel">
          <span className="empty__icon">
            <ShoppingBag size={26} />
          </span>
          <h2>Your bag is empty</h2>
          <p>Nothing here yet. Pick a magazine, a set of polaroids or a bouquet and it will show up here.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link className="btn btn--primary" to="/magazines">
              Continue shopping
            </Link>
            <Link className="btn btn--ghost" to="/wishlist">
              View wishlist
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Your bag</h1>
        <p>
          {count} {count === 1 ? 'item' : 'items'} across {items.length}{' '}
          {items.length === 1 ? 'line' : 'lines'}. Differently customised orders stay separate.
        </p>
      </header>

      <div className="two-col">
        <section className="info-card" aria-label="Bag contents">
          <div className="stack">
            {items.map((item) => (
              <CartLine key={item.key} item={item} />
            ))}
          </div>
          <button className="btn btn--quiet btn--sm" type="button" onClick={clear} style={{ justifySelf: 'start' }}>
            Empty the bag
          </button>
        </section>

        <aside className="info-card" aria-label="Order summary">
          <h3>Summary</h3>
          <div className="totals">
            <div className="totals__row">
              <span>Product subtotal</span>
              <span>{formatRupees(subtotal)}</span>
            </div>
            {savings > 0 && (
              <div className="totals__row totals__row--save">
                <span>Offer applied</span>
                <span>− {formatRupees(savings)}</span>
              </div>
            )}
            <div className="totals__row">
              <span>Shipping</span>
              <span>
                {!shippingConfig.enabled
                  ? 'Charged separately'
                  : freeShipping
                    ? 'Free'
                    : formatRupees(shipping)}
              </span>
            </div>
            {toFreeShipping > 0 && (
              <p className="totals__nudge">
                Spend {formatRupees(toFreeShipping)} more for free delivery.
              </p>
            )}
            <div className="totals__row totals__row--grand">
              <span>Total</span>
              <span>{formatRupees(payable)}</span>
            </div>
          </div>

          <p className="form-note">
            <Info size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--coral)' }} />
            {shippingConfig.enabled
              ? shippingConfig.note ||
                'The studio prices every order when it is placed, delivery included.'
              : 'Place the order and send us your photographs, and we reply with the shipping cost and how to pay.'}
          </p>

          <Link className="btn btn--primary btn--block" to="/checkout">
            Place this order
          </Link>

          <Link className="btn btn--quiet btn--block btn--sm" to="/bouquets">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
