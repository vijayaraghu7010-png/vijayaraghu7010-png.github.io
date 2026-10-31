import { useEffect, useRef, useState } from 'react';
import { ImagePlus, ShoppingBag, X } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { FRAME_SIZES, FRAME_THEMES } from '../data/products';
import { ACCEPTED_TYPES, MAX_BYTES_PER_PHOTO, maxPhotosFor } from '../data/uploadLimits';
import { putLinePhotos } from '../lib/photoStore';
import { formatRupees } from '../utils/currency';
import { makeLineKey } from '../utils/cartCalculations';
import { useCart } from '../context/CartContext';

const MAX_MB = Math.round(MAX_BYTES_PER_PHOTO / 1048576);
const MAX_PHOTOS = maxPhotosFor('frame');

/* A frame is one product sold at three sizes, each its own price.

   The cart reads the price off the product it is handed, so the chosen
   size is applied by handing it a copy carrying that size's price and
   id - the id is what keeps an A4 and an A3 as two lines rather than
   one. Magazines do the same thing by swapping to a second product;
   there is only one frame, so the copy is made here.

   The photographs are kept aside under the same key the basket line
   uses, exactly as the polaroid and magazine customisers do, so the
   checkout can find them after a reload. The originals are never
   touched or compressed - they are what gets printed. */
export default function FrameOptions({ product }) {
  const { addItem, openCart } = useCart();
  /* Most frames are sold at the default sizes; some carry their own
     list (a print-or-framed choice, say) on product.frameSizes. */
  const sizes = product.frameSizes || FRAME_SIZES;
  const [sizeId, setSizeId] = useState(product.sizeId || sizes[0].id);
  const [names, setNames] = useState('');
  const [years, setYears] = useState('');
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState([]);
  const [quantity, setQuantity] = useState(1);

  const inputRef = useRef(null);
  const urls = useRef(new Map());

  const size = sizes.find((s) => s.id === sizeId) || sizes[0];
  /* Which design this frame is, taken from the product itself - the
     themed frames are products now, so there is no picker. Recorded on
     the order so the studio sees the design on the line. */
  const theme = FRAME_THEMES.find((t) => String(product.id || '').endsWith(t.id));
  const subtotal = size.price * quantity;

  /* Object URLs are revoked when this leaves the screen, so a long
     browsing session does not leak them. */
  useEffect(() => {
    const map = urls.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  const previewUrl = (file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!urls.current.has(key)) urls.current.set(key, URL.createObjectURL(file));
    return urls.current.get(key);
  };

  /* The same checks the server will make, done here so a bad file is
     refused before it is ever added rather than at checkout. */
  const accept = (incoming) => {
    const next = [];
    const problems = [];

    Array.from(incoming).forEach((file) => {
      const typeOk = ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
      if (!typeOk) {
        problems.push(`${file.name} — not a JPG, PNG, WEBP or HEIC image`);
        return;
      }
      if (file.size > MAX_BYTES_PER_PHOTO) {
        problems.push(`${file.name} — larger than ${MAX_MB} MB`);
        return;
      }
      if (photos.some((f) => f.name === file.name && f.size === file.size)) {
        problems.push(`${file.name} — already added`);
        return;
      }
      next.push(file);
    });

    if (photos.length + next.length > MAX_PHOTOS) {
      problems.push(`A frame takes ${MAX_PHOTOS} photographs at most`);
    }
    setErrors(problems);
    if (next.length) setPhotos([...photos, ...next].slice(0, MAX_PHOTOS));
  };

  const onPick = (e) => {
    accept(e.target.files);
    /* Clear the input so the same file can be chosen again after it is
       removed. */
    if (inputRef.current) inputRef.current.value = '';
  };

  const removePhoto = (file) => {
    setPhotos(photos.filter((f) => !(f.name === file.name && f.size === file.size)));
    setErrors([]);
  };

  const onSubmit = (e) => {
    e.preventDefault();

    /* Built once and used for both the line key and the basket, so the
       two agree and the checkout finds the photographs under the key
       the basket line carries. */
    const config = {
      size: size.label,
      theme: theme?.name,
      names: names.trim() || undefined,
      years: years.trim() || undefined,
      photoCount: photos.length || undefined
    };

    const framed = { ...product, id: `${product.id}-${size.id}`, price: size.price };

    if (photos.length) {
      putLinePhotos(makeLineKey(framed.id, config), photos);
    }

    addItem(framed, { quantity, config });
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
          {sizes.map((s) => (
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

      <div className="step">
        <div className="step__head">
          <span className="step__num">2</span>
          <h4 className="step__title">Your photographs</h4>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={onPick}
        />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={15} /> {photos.length ? 'Add more photos' : 'Add photos'}
        </button>

        {photos.length ? (
          <div className="previews">
            {photos.map((file) => (
              <figure className="preview" key={`${file.name}-${file.size}`}>
                <img src={previewUrl(file)} alt={`Selected photo: ${file.name}`} />
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removePhoto(file)}
                >
                  <X size={13} />
                </button>
              </figure>
            ))}
          </div>
        ) : null}

        {errors.length ? (
          <ul className="form-error" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        <p className="field-hint">
          Upload the photographs for your frame here, or send them over WhatsApp after ordering.
        </p>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">3</span>
          <h4 className="step__title">Your two names</h4>
        </div>
        <input
          type="text"
          value={names}
          onChange={(e) => setNames(e.target.value)}
        />
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">4</span>
          <h4 className="step__title">The years</h4>
        </div>
        <input
          type="text"
          value={years}
          onChange={(e) => setYears(e.target.value)}
        />
        <p className="field-hint">The year it started, and the year it is still blooming.</p>
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
