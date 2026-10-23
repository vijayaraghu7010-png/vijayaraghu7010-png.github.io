import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, X } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { PRODUCTS } from '../data/products';
import { formatRupees } from '../utils/currency';

const NEEDS_CHOICES = ['magazine', 'polaroid'];

export default function Wishlist() {
  usePageMeta('Wishlist', 'The magazines, polaroids and bouquets you have saved at WrappedStudio.');

  const wishlist = useWishlist();
  const { addItem } = useCart();
  const saved = PRODUCTS.filter((p) => wishlist.ids.includes(p.id));

  if (saved.length === 0) {
    return (
      <div className="shell">
        <header className="page-head">
          <h1>Wishlist</h1>
        </header>
        <div className="empty panel">
          <span className="empty__icon">
            <Heart size={26} />
          </span>
          <h2>Nothing saved yet</h2>
          <p>Tap the heart on any product and it will wait for you here, even after you close the tab.</p>
          <Link className="btn btn--primary" to="/bouquets">
            Browse bouquets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Wishlist</h1>
        <p>
          {saved.length} saved {saved.length === 1 ? 'product' : 'products'}. They stay here on this device.
        </p>
      </header>

      <div className="stack">
        {saved.map((product) => {
          const needsChoices = NEEDS_CHOICES.includes(product.customiser);
          return (
            <article className="cart-line info-card" key={product.id} style={{ gridTemplateColumns: '84px 1fr' }}>
              <img src={product.image} alt={product.alt} style={{ width: 84, height: 84 }} loading="lazy" />
              <div>
                <p className="cart-line__name">
                  <Link to={`/product/${product.slug}`}>{product.name}</Link>
                </p>
                <p className="cart-line__config">{product.shortDescription}</p>
                <div className="cart-line__row">
                  <span className="cart-line__total">
                    {formatRupees(product.price)}
                    {product.unitLabel ? <span className="cart-line__unit"> {product.unitLabel}</span> : null}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {needsChoices ? (
                      <Link className="btn btn--primary btn--sm" to={`/product/${product.slug}`}>
                        Customise
                      </Link>
                    ) : (
                      <button
                        className="btn btn--primary btn--sm"
                        type="button"
                        onClick={() => addItem(product, { quantity: 1 })}
                      >
                        <ShoppingBag size={14} /> Add to bag
                      </button>
                    )}
                    <button
                      className="btn btn--quiet btn--sm"
                      type="button"
                      onClick={() => wishlist.remove(product.id)}
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
