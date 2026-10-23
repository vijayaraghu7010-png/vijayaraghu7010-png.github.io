import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

import WishlistButton from './WishlistButton';
import { useCart } from '../context/CartContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { bestOfferFor } from '../utils/offers';
import { formatRupees } from '../utils/currency';

/* Products that need choices made (a magazine theme, how many prints)
   send the customer to the product page instead of straight to the bag. */
const NEEDS_CHOICES = ['magazine', 'polaroid'];

export default function ProductCard({ product, compact = false, variant = '' }) {
  const { addItem } = useCart();
  const { offers } = useSiteConfig();
  const navigate = useNavigate();
  const needsChoices = NEEDS_CHOICES.includes(product.customiser);

  /* an offer with no code applies by itself, so the card shows what
     the customer will actually pay, with the old price struck out */
  const deal = bestOfferFor(product, offers);

  const onAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (needsChoices) {
      navigate(`/product/${product.slug}`);
      return;
    }
    addItem(product, { quantity: 1 });
  };

  return (
    <article className={variant ? `product-card product-card--${variant}` : 'product-card'}>
      <div className="product-card__media">
        <Link to={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true">
          <img src={product.image} alt={product.alt} loading="lazy" />
        </Link>
        <span className="product-card__tag">{product.categoryLabel}</span>
        {deal && (
          <span className="product-card__deal" title={deal.offer.title || 'Offer'}>
            {deal.offer.discountType === 'flat' ? `₹${deal.offer.value} OFF` : `${deal.percent}% OFF`}
          </span>
        )}
        <WishlistButton product={product} />
      </div>

      <div className="product-card__body">
        <h3 className="product-card__name">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>

        {!compact && <p className="product-card__desc">{product.shortDescription}</p>}

        <div className="product-card__foot">
          <span className="product-card__price">
            {deal ? (
              <>
                {formatRupees(deal.price)}
                <s className="product-card__was">{formatRupees(product.price)}</s>
              </>
            ) : (
              formatRupees(product.price)
            )}
            {product.unitLabel ? <small> {product.unitLabel}</small> : null}
          </span>
          <button
            className="add-btn"
            type="button"
            onClick={onAdd}
            aria-label={needsChoices ? `Customise ${product.name}` : `Add ${product.name} to bag`}
            title={needsChoices ? 'Choose your options' : 'Add to bag'}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
