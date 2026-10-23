import { useState } from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';

import PhotoUpload from './PhotoUpload';
import QuantitySelector from './QuantitySelector';
import { MAGAZINE_SIZES, MAGAZINE_THEMES, getProductById } from '../data/products';
import { formatRupees } from '../utils/currency';
import { useCart } from '../context/CartContext';

/* Seven steps, as described on the magazines page. Each step validates
   before the configured magazine can go in the bag. */
export default function MagazineCustomiser({ product }) {
  const { addItem, openCart } = useCart();

  const [sizeId, setSizeId] = useState(product.sizeId || MAGAZINE_SIZES[0].id);
  const [themeId, setThemeId] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [errors, setErrors] = useState({});
  const [added, setAdded] = useState(false);

  const size = MAGAZINE_SIZES.find((s) => s.id === sizeId) || MAGAZINE_SIZES[0];
  const theme = MAGAZINE_THEMES.find((t) => t.id === themeId);
  /* The chosen size decides which catalogue product (and price) applies. */
  const priced = getProductById(sizeId === 'mag-8' ? 'magazine-8' : 'magazine-4') || product;
  const lineTotal = priced.price * quantity;

  const validate = () => {
    const next = {};
    if (!themeId) next.theme = 'Please choose a theme.';
    if (themeId === 'custom' && !customTheme.trim()) next.customTheme = 'Tell us the theme you have in mind.';
    if (!details.trim()) next.details = 'Add the names, dates or wording you want on the pages.';
    if (photos.length === 0) next.photos = 'Add at least one photograph.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    addItem(priced, {
      quantity,
      config: {
        sizeLabel: size.label,
        themeName: themeId === 'custom' ? `Custom: ${customTheme.trim()}` : theme.name,
        personalisation: details.trim(),
        photoCount: photos.length,
        photoNames: photos.slice(0, 12).map((f) => f.name),
        notes: notes.trim() || undefined
      }
    });
    setAdded(true);
    openCart();
  };

  return (
    <form className="customiser info-card" onSubmit={onSubmit} noValidate>
      <h3>Customise your magazine</h3>

      <div className="step">
        <div className="step__head">
          <span className="step__num">1</span>
          <h4 className="step__title">Choose your size</h4>
        </div>
        <div className="option-grid">
          {MAGAZINE_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`option${s.id === sizeId ? ' is-on' : ''}`}
              aria-pressed={s.id === sizeId}
              onClick={() => setSizeId(s.id)}
            >
              <span className="option__name">{s.label}</span>
              <span className="option__price">{formatRupees(s.price)}</span>
              <span className="option__meta">{s.sides} printed sides</span>
            </button>
          ))}
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">2</span>
          <h4 className="step__title">Choose a theme</h4>
        </div>
        <div className="option-grid">
          {MAGAZINE_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`option${t.id === themeId ? ' is-on' : ''}`}
              aria-pressed={t.id === themeId}
              onClick={() => {
                setThemeId(t.id);
                setErrors((p) => ({ ...p, theme: undefined }));
              }}
            >
              <span className="option__name">{t.name}</span>
              <span className="option__meta">{t.blurb}</span>
            </button>
          ))}
        </div>
        {errors.theme && (
          <p className="field-error" role="alert">
            {errors.theme}
          </p>
        )}

        {themeId === 'custom' && (
          <div className="field">
            <label htmlFor="mag-custom-theme">Describe your theme</label>
            <input
              id="mag-custom-theme"
              type="text"
              value={customTheme}
              aria-invalid={errors.customTheme ? 'true' : 'false'}
              placeholder="e.g. a travel diary of our road trip"
              onChange={(e) => setCustomTheme(e.target.value)}
            />
            {errors.customTheme && (
              <p className="field-error" role="alert">
                {errors.customTheme}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">3</span>
          <h4 className="step__title">Your personalisation details</h4>
        </div>
        <div className="field">
          <label htmlFor="mag-details">Names, dates and any wording for the pages</label>
          <textarea
            id="mag-details"
            value={details}
            aria-invalid={errors.details ? 'true' : 'false'}
            placeholder="e.g. For Asha, 2 years of us — include the date 14 Feb 2026 on the cover."
            onChange={(e) => setDetails(e.target.value)}
          />
          {errors.details && (
            <p className="field-error" role="alert">
              {errors.details}
            </p>
          )}
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">4</span>
          <h4 className="step__title">Upload your photographs</h4>
        </div>
        <p className="field-hint">
          Send enough pictures to fill {size.sides} sides. You can add or swap photos with us later.
        </p>
        <PhotoUpload
          files={photos}
          onChange={(files) => {
            setPhotos(files);
            setErrors((p) => ({ ...p, photos: undefined }));
          }}
        />
        {errors.photos && (
          <p className="field-error" role="alert">
            {errors.photos}
          </p>
        )}
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">5</span>
          <h4 className="step__title">Anything else? (optional)</h4>
        </div>
        <div className="field">
          <label htmlFor="mag-notes">
            Instructions <span className="field-optional">optional</span>
          </label>
          <textarea
            id="mag-notes"
            value={notes}
            placeholder="Page order, must-include photos, a note to slip inside…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">6</span>
          <h4 className="step__title">Review</h4>
        </div>
        <table className="summary-table">
          <tbody>
            <tr>
              <th scope="row">Size</th>
              <td>{size.label}</td>
            </tr>
            <tr>
              <th scope="row">Theme</th>
              <td>{themeId ? (themeId === 'custom' ? customTheme || 'Custom theme' : theme.name) : 'Not chosen yet'}</td>
            </tr>
            <tr>
              <th scope="row">Photos</th>
              <td>{photos.length ? `${photos.length} selected` : 'None yet'}</td>
            </tr>
            <tr>
              <th scope="row">Quantity</th>
              <td>
                <QuantitySelector value={quantity} min={1} onChange={setQuantity} label="Magazine quantity" />
              </td>
            </tr>
            <tr>
              <th scope="row">Product total</th>
              <td style={{ fontWeight: 600 }}>
                {formatRupees(lineTotal)} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>+ shipping</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="form-note">
        Printing starts only after you approve the PDF preview. Shipping is charged separately and confirmed before
        payment — nothing is charged on this website.
      </p>

      <button className="btn btn--primary btn--block" type="submit">
        <ShoppingBag size={16} /> Add configured magazine to bag
      </button>

      {added && (
        <p className="field-hint" role="status">
          Added. Configure another one by changing the options above — each configuration stays a separate line in
          your bag. <ArrowRight size={12} />
        </p>
      )}
    </form>
  );
}
