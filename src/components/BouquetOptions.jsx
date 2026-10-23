import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { BOUQUET_WRAPS } from '../data/products';
import { formatRupees } from '../utils/currency';
import { useCart } from '../context/CartContext';

/* Bouquets are priced products — only the options configured for them
   (wrap colour and an optional card) are offered. */
export default function BouquetOptions({ product }) {
  const { addItem, openCart } = useCart();
  const [wrap, setWrap] = useState(BOUQUET_WRAPS[0]);
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState(1);

  const subtotal = product.price * quantity;

  const onSubmit = (e) => {
    e.preventDefault();
    addItem(product, {
      quantity,
      config: { wrap, message: message.trim() || undefined }
    });
    openCart();
  };

  return (
    <form className="customiser info-card" onSubmit={onSubmit}>
      <h3>Make it yours</h3>

      <div className="step">
        <div className="step__head">
          <span className="step__num">1</span>
          <h4 className="step__title">Wrapping colour</h4>
        </div>
        <div className="option-grid">
          {BOUQUET_WRAPS.map((w) => (
            <button
              key={w}
              type="button"
              className={`option${w === wrap ? ' is-on' : ''}`}
              aria-pressed={w === wrap}
              onClick={() => setWrap(w)}
            >
              <span className="option__name">{w}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">2</span>
          <h4 className="step__title">Message card (optional)</h4>
        </div>
        <div className="field">
          <label htmlFor="bouquet-message">
            What should the card say? <span className="field-optional">optional</span>
          </label>
          <textarea
            id="bouquet-message"
            value={message}
            maxLength={240}
            placeholder="Happy anniversary — here is to the next one."
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="field-hint">{240 - message.length} characters left</p>
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">3</span>
          <h4 className="step__title">Quantity</h4>
        </div>
        <QuantitySelector value={quantity} min={1} onChange={setQuantity} label="Bouquet quantity" size="lg" />
      </div>

      <p className="form-note">
        Every bouquet is made by hand to order. Shipping is charged separately and confirmed before payment.
      </p>

      <button className="btn btn--primary btn--block" type="submit">
        <ShoppingBag size={16} /> Add to bag — {formatRupees(subtotal)}
      </button>
    </form>
  );
}
