import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, X } from 'lucide-react';

import CartLine from './CartLine';
import { useCart } from '../context/CartContext';
import useBasketTotals from '../hooks/useBasketTotals';
import { formatRupees } from '../utils/currency';

export default function CartDrawer() {
  const { items, isOpen, closeCart, count } = useCart();

  /* The same sum the bag and the checkout use. The drawer used to add
     the lines up itself and never subtract offers, so a discounted
     basket showed one total here and a smaller one on the next page. */
  const { subtotal, savings, shippingConfig, shipping, shippingIsFree: freeShipping, payable } =
    useBasketTotals();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="overlay__backdrop" onClick={closeCart} />

      <div className="drawer">
        <div className="drawer__head">
          <h2 className="drawer__title">
            Your bag {count > 0 && <span style={{ color: 'var(--coral)' }}>({count})</span>}
          </h2>
          <button className="icon-btn" type="button" aria-label="Close bag" onClick={closeCart}>
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="drawer__body">
            <div className="empty">
              <span className="empty__icon">
                <ShoppingBag size={26} />
              </span>
              <h2>Your bag is empty</h2>
              <p>Pick a magazine, a set of polaroids or a bouquet and it will show up here.</p>
              <Link className="btn btn--primary" to="/magazines" onClick={closeCart}>
                Start shopping
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="drawer__body">
              {items.map((item) => (
                <CartLine key={item.key} item={item} />
              ))}
            </div>

            <div className="drawer__foot">
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
                <div className="totals__row totals__row--grand">
                  <span>Total</span>
                  <span>{formatRupees(payable)}</span>
                </div>
              </div>

              <Link className="btn btn--primary btn--block" to="/cart" onClick={closeCart}>
                View bag &amp; details
              </Link>
              <button className="btn btn--quiet btn--block btn--sm" type="button" onClick={closeCart}>
                Continue shopping
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
