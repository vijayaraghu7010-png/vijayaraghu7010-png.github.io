import { Link } from 'react-router-dom';
import { Info, ShoppingBag } from 'lucide-react';

import CartLine from '../components/CartLine';
import usePageMeta from '../hooks/usePageMeta';
import { useCart } from '../context/CartContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getProductById } from '../data/products';
import { lineDiscount } from '../utils/offers';
import { formatRupees } from '../utils/currency';

export default function Cart() {
  usePageMeta('Your Bag', 'Review the magazines, polaroids and bouquets in your WrappedStudio bag.');
  const { items, subtotal, count, clear } = useCart();
  const { offers } = useSiteConfig();

  /* automatic offers come off the bag without anyone typing a code */
  const savings = items.reduce((sum, item) => {
    const line = lineDiscount(item, getProductById(item.productId), offers);
    return sum + (line ? line.saved : 0);
  }, 0);
  const payable = Math.max(0, subtotal - savings);

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
              <span>Charged separately</span>
            </div>
            <div className="totals__row totals__row--grand">
              <span>Total</span>
              <span>{formatRupees(payable)}</span>
            </div>
          </div>

          <p className="form-note">
            <Info size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--coral)' }} />
            Online payment and order placement are not available yet — no payment gateway is connected to this
            site, so nothing here is charged or confirmed. Send your bag to us and we reply with the shipping cost
            and payment details.
          </p>

          <a
            className="btn btn--primary btn--block"
            href={`mailto:hello@wrappedstudio.in?subject=${encodeURIComponent('WrappedStudio order enquiry')}&body=${encodeURIComponent(
              items
                .map((i) => `${i.quantity} × ${i.name} — ${formatRupees(i.unitPrice * i.quantity)}`)
                .join('\n') +
                `\n\nProduct subtotal: ${formatRupees(subtotal)}` +
                (savings > 0 ? `\nOffer applied: -${formatRupees(savings)}` : '') +
                `\nTotal: ${formatRupees(payable)}\nShipping: to be confirmed`
            )}`}
          >
            Email this order to the studio
          </a>

          <Link className="btn btn--quiet btn--block btn--sm" to="/bouquets">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
