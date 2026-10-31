import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { FRAME_SIZES } from '../data/products';
import { formatRupees } from '../utils/currency';
import { useCart } from '../context/CartContext';

/* A frame is one product sold at three sizes, each its own price.

   The cart reads the price off the product it is handed, so the chosen
   size is applied by handing it a copy carrying that size's price and
   id - the id is what keeps an A4 and an A3 as two lines rather than
   one. Magazines do the same thing by swapping to a second product;
   there is only one frame, so the copy is made here. */
export default function FrameOptions({ product }) {
  const { addItem, openCart } = useCart();
  const [sizeId, setSizeId] = useState(product.sizeId || FRAME_SIZES[0].id);
  const [quantity, setQuantity] = useState(1);

  const size = FRAME_SIZES.find((s) => s.id === sizeId) || FRAME_SIZES[0];
  const subtotal = size.price * quantity;

  const onSubmit = (e) => {
    e.preventDefault();
    addItem(
      { ...product, id: `${product.id}-${size.id}`, price: size.price },
      { quantity, config: { size: size.label } }
    );
    openCart();
  };

  return (
    <form className="customiser info-card" onSubmit={onSubmit}>
      <h3>Make it yours</h3>

      <div className="step">
        <div className="step__head">
          <span className="step__num">1</span>
          <h4 className="step__title">Frame size</h4>
        </div>
        <div className="option-grid">
          {FRAME_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`option${s.id === sizeId ? ' is-on' : ''}`}
              aria-pressed={s.id === sizeId}
              onClick={() => setSizeId(s.id)}
            >
              <strong>{s.label}</strong>
              <span>{s.blurb}</span>
              <span>{formatRupees(s.price)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="customiser__foot">
        <QuantitySelector value={quantity} onChange={setQuantity} min={1} max={20} />
        <p className="customiser__total">
          <span>Total</span>
          <strong>{formatRupees(subtotal)}</strong>
        </p>
      </div>

      <button className="btn btn--primary btn--block" type="submit">
        <ShoppingBag size={16} /> Add to cart
      </button>

      <p className="field-hint">Shipping is charged separately, once the frame is ready.</p>
    </form>
  );
}
