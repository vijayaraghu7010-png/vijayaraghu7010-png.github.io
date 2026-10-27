import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { BOUQUET_MATERIALS, BOUQUET_SIZES, BOUQUET_WRAPS } from '../data/products';
import { FLOWER_CATEGORIES, FLOWERS } from '../data/flowers';
import { formatRupees } from '../utils/currency';
import { useCart } from '../context/CartContext';

/* Bouquets are priced products, so nothing chosen here changes the
   price — size, material, flowers and cover are what the studio needs
   to make the right thing, and they travel with the order.

   The flowers come from the studio's own catalogue sheet
   (src/data/flowers.js), each one with its picture and its name, so a
   customer picks the exact flower rather than describing one. */
export default function BouquetOptions({ product }) {
  const { addItem, openCart } = useCart();
  const [sizeId, setSizeId] = useState(BOUQUET_SIZES[1].id);
  const [materialId, setMaterialId] = useState(BOUQUET_MATERIALS[0].id);
  const [picked, setPicked] = useState([]);
  const [wrap, setWrap] = useState(BOUQUET_WRAPS[0]);
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState(1);

  const size = BOUQUET_SIZES.find((s) => s.id === sizeId) || BOUQUET_SIZES[0];
  const material = BOUQUET_MATERIALS.find((m) => m.id === materialId) || BOUQUET_MATERIALS[0];
  const subtotal = product.price * quantity;

  /* Picking keeps the order the customer chose in: the studio reads
     the list as the bouquet's own order of importance. */
  const toggle = (id) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const chosen = picked.map((id) => FLOWERS.find((f) => f.id === id)).filter(Boolean);

  const onSubmit = (e) => {
    e.preventDefault();
    addItem(product, {
      quantity,
      config: {
        size: size.label,
        material: material.label,
        flowers: chosen.length ? chosen.map((f) => f.label) : undefined,
        wrap,
        message: message.trim() || undefined
      }
    });
    openCart();
  };

  return (
    <form className="customiser info-card" onSubmit={onSubmit}>
      <h3>Make it yours</h3>

      <div className="step">
        <div className="step__head">
          <span className="step__num">1</span>
          <h4 className="step__title">Size</h4>
        </div>
        <div className="option-grid">
          {BOUQUET_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`option${s.id === sizeId ? ' is-on' : ''}`}
              aria-pressed={s.id === sizeId}
              onClick={() => setSizeId(s.id)}
            >
              <span className="option__name">{s.label}</span>
              <span className="option__meta">{s.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">2</span>
          <h4 className="step__title">What the flowers are made of</h4>
        </div>
        <div className="option-grid">
          {BOUQUET_MATERIALS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`option${m.id === materialId ? ' is-on' : ''}`}
              aria-pressed={m.id === materialId}
              onClick={() => setMaterialId(m.id)}
            >
              <span className="option__name">{m.label}</span>
              <span className="option__meta">{m.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">3</span>
          <h4 className="step__title">
            Choose your flowers {chosen.length > 0 && <span className="step__count">({chosen.length} picked)</span>}
          </h4>
        </div>

        <p className="field-hint">
          Pick as many as you like from the catalogue, in the order you want them to lead. Leave it empty and we
          arrange it for you.
        </p>

        {FLOWER_CATEGORIES.map((category) => {
          const rows = FLOWERS.filter((f) => f.category === category.id);
          if (!rows.length) return null;

          return (
            <div className="flower-group" key={category.id}>
              <p className="flower-group__title">{category.label}</p>
              <div className="flower-grid">
                {rows.map((flower) => {
                  const on = picked.includes(flower.id);
                  return (
                    <button
                      key={flower.id}
                      type="button"
                      className={`flower${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggle(flower.id)}
                    >
                      <img src={flower.image} alt={flower.alt} loading="lazy" decoding="async" />
                      <span className="flower__name">{flower.name}</span>
                      {flower.also && <span className="flower__also">{flower.also}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {material.id !== 'thread' && (
          <p className="field-hint">
            The catalogue is photographed in thread. In {material.label.toLowerCase()} these are the same flowers in
            another material, so the finish will differ a little.
          </p>
        )}
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">4</span>
          <h4 className="step__title">Cover colour</h4>
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
          <span className="step__num">5</span>
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
          <span className="step__num">6</span>
          <h4 className="step__title">Quantity</h4>
        </div>
        <QuantitySelector value={quantity} min={1} onChange={setQuantity} label="Bouquet quantity" size="lg" />
      </div>

      <dl className="summary-rows">
        <div>
          <dt>Size</dt>
          <dd>{size.label}</dd>
        </div>
        <div>
          <dt>Made of</dt>
          <dd>{material.label}</dd>
        </div>
        <div>
          <dt>Flowers</dt>
          <dd>{chosen.length ? chosen.map((f) => f.name).join(', ') : 'Arranged for you'}</dd>
        </div>
        <div>
          <dt>Cover</dt>
          <dd>{wrap}</dd>
        </div>
      </dl>

      <p className="form-note">
        Every bouquet is made by hand to order. The price is for the bouquet as listed; size, flowers and material
        are confirmed with you before anything is made. Shipping is charged separately.
      </p>

      <button className="btn btn--primary btn--block" type="submit">
        <ShoppingBag size={16} /> Add to bag — {formatRupees(subtotal)}
      </button>
    </form>
  );
}
