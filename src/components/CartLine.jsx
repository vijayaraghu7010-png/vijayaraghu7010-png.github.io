import { Trash2 } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { useCart } from '../context/CartContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getProductById } from '../data/products';
import { lineDiscount } from '../utils/offers';
import { lineTotal, unitNoun } from '../utils/cartCalculations';
import { formatRupees } from '../utils/currency';

/* Shows the customisation a magazine or polaroid order was configured
   with, so two differently configured lines never look identical. */
function configSummary(config) {
  if (!config) return null;
  const parts = [];
  if (config.sizeLabel) parts.push(config.sizeLabel);
  if (config.themeName) parts.push(`${config.themeName} theme`);
  if (config.border) parts.push(config.border);
  if (config.wrap) parts.push(`${config.wrap} wrap`);
  if (config.photoCount) parts.push(`${config.photoCount} photo${config.photoCount === 1 ? '' : 's'} picked`);
  if (config.captions) parts.push('captions included');
  if (config.message) parts.push('message card');
  if (config.notes) parts.push('notes added');
  return parts.length ? parts.join(' · ') : null;
}

export default function CartLine({ item }) {
  const { setQuantity, removeItem } = useCart();
  const { offers } = useSiteConfig();
  const product = getProductById(item.productId);
  const min = product?.minQty || 1;
  const summary = configSummary(item.config);

  /* what an automatic offer takes off this line */
  const deal = lineDiscount(item, product, offers);
  const gross = lineTotal(item);

  return (
    <article className="cart-line">
      <img src={item.image} alt={item.alt || item.name} loading="lazy" />

      <div>
        <p className="cart-line__name">{item.name}</p>
        {summary && <p className="cart-line__config">{summary}</p>}
        {deal && (
          <p className="cart-line__deal">
            {deal.offer.title || 'Offer'} · {deal.percent}% off, you save {formatRupees(deal.saved)}
          </p>
        )}
        <p className="cart-line__unit">
          {formatRupees(item.unitPrice)} {item.unitLabel || `per ${unitNoun(product, 1)}`}
        </p>

        <div className="cart-line__row">
          <QuantitySelector
            value={item.quantity}
            min={min}
            onChange={(q) => setQuantity(item.key, q)}
            label={`Quantity for ${item.name}`}
          />
          <span className="cart-line__total">
            {deal ? (
              <>
                {formatRupees(gross - deal.saved)}
                <s>{formatRupees(gross)}</s>
              </>
            ) : (
              formatRupees(gross)
            )}
          </span>
        </div>

        <div className="cart-line__row">
          <button className="icon-link" type="button" onClick={() => removeItem(item.key)}>
            <Trash2 size={14} /> Remove
          </button>
          <span className="cart-line__unit">
            {item.quantity} {unitNoun(product, item.quantity)}
          </span>
        </div>
      </div>
    </article>
  );
}
