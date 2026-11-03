import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ImagePlus, X } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { useCart } from '../context/CartContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { unitPriceWithOffer } from '../utils/offers';
import { BORDER_SWATCHES, POLAROID_BORDERS, getProductById } from '../data/products';
import { ACCEPTED_TYPES, MAX_BYTES_PER_PHOTO, maxPhotosFor } from '../data/uploadLimits';
import { putLinePhotos } from '../lib/photoStore';
import { formatRupees } from '../utils/currency';
import { makeLineKey } from '../utils/cartCalculations';

const FORMAT_IDS = ['polaroid-medium', 'polaroid-large'];
const ACCEPTED = ACCEPTED_TYPES;
const MAX_MB = Math.round(MAX_BYTES_PER_PHOTO / 1048576);
const MAX_PHOTOS = maxPhotosFor('polaroid');

/* The whole polaroid order in one place: pick the size, the count,
   the border and the photos, with a live summary that always shows
   the real maths (the size's rate × the number of prints). */
export default function PolaroidStudio({ initialFormat = 'polaroid-medium' }) {
  const { addItem, openCart } = useCart();

  const [formatId, setFormatId] = useState(
    FORMAT_IDS.includes(initialFormat) ? initialFormat : FORMAT_IDS[0]
  );
  const [quantity, setQuantity] = useState(getProductById(initialFormat)?.minQty || 9);
  const [border, setBorder] = useState(POLAROID_BORDERS[0]);
  const [photos, setPhotos] = useState([]);
  const [captions, setCaptions] = useState('');
  const [errors, setErrors] = useState([]);
  const [touched, setTouched] = useState(false);

  const inputRef = useRef(null);
  const urls = useRef(new Map());
  const [over, setOver] = useState(false);

  const product = getProductById(formatId);
  const min = product.minQty || 1;
  /* The live offer comes off the per-print price, so the studio shows
     what the card and the bag already show. */
  const { offers } = useSiteConfig();
  const unit = unitPriceWithOffer(product, product.price, offers);
  const subtotal = unit.price * quantity;

  /* switching format resets the count to that format's minimum */
  useEffect(() => {
    setQuantity(getProductById(formatId)?.minQty || 1);
  }, [formatId]);

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

  const heroPreview = useMemo(
    () => (photos.length ? previewUrl(photos[0]) : product.image),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos, product.image]
  );

  const accept = (incoming) => {
    const next = [];
    const problems = [];

    Array.from(incoming).forEach((file) => {
      const typeOk = ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
      if (!typeOk) {
        problems.push(`${file.name} — not a JPG, PNG, WEBP or HEIC image`);
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        problems.push(`${file.name} — larger than ${MAX_MB} MB`);
        return;
      }
      if (photos.some((f) => f.name === file.name && f.size === file.size)) {
        problems.push(`${file.name} — already added`);
        return;
      }
      next.push(file);
    });

    setErrors(problems);
    if (photos.length + next.length > MAX_PHOTOS) {
      problems.push(`A polaroid order takes ${MAX_PHOTOS} photographs at most`);
    }
    if (next.length) setPhotos([...photos, ...next].slice(0, MAX_PHOTOS));
  };

  const canAdd = quantity >= min && photos.length > 0;

  const onAdd = () => {
    setTouched(true);
    if (!canAdd) return;

    const config = {
      border,
      photoCount: photos.length,
      photoNames: photos.slice(0, 12).map((f) => f.name),
      captions: captions.trim() || undefined
    };

    /* The files themselves are kept aside under the same key the
       basket uses, so the checkout can still find them after a
       reload. The basket line only ever carries their names. */
    putLinePhotos(makeLineKey(product.id, config), photos);

    addItem(product, { quantity, config });
    openCart();
  };

  return (
    <section className="studio" aria-labelledby="studio-title">
      <div className="studio__steps">
        <h2 className="section-title" id="studio-title">
          Customise Your Polaroids
        </h2>

        <div className="studio__step">
          <p className="studio__label">Step 1</p>
          <h3 className="studio__heading">Select Polaroid Size</h3>
          <div className="format-grid">
            {FORMAT_IDS.map((id) => {
              const f = getProductById(id);
              const on = id === formatId;
              return (
                <button
                  key={id}
                  type="button"
                  className={`format-card${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setFormatId(id)}
                >
                  <span className="format-card__top">
                    <span className="format-card__name">{f.formatTitle}</span>
                    {/* Built from the live price, not from the `formatPrice`
                        string that ships beside it: that string was written
                        once and never moved again, so a price changed in the
                        panel showed everywhere on this page except here. */}
                    <span className="format-card__price">
                      {formatRupees(f.price)}
                      {f.unitLabel ? ` ${f.unitLabel}` : ''}
                    </span>
                  </span>
                  <span className="format-card__note">{f.formatNote}</span>
                  <span className="format-card__meta">{f.formatMeta}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="studio__step">
          <p className="studio__label">Step 2</p>
          <h3 className="studio__heading">Number of Prints (Minimum {min})</h3>
          <div className="studio__qty">
            <QuantitySelector
              value={quantity}
              min={min}
              size="lg"
              onChange={setQuantity}
              label="Number of prints"
            />
            <span className="studio__qtyNote">
              Calculated at {formatRupees(unit.price)} per print
            </span>
          </div>
        </div>

        <div className="studio__step">
          <p className="studio__label">Step 3</p>
          <h3 className="studio__heading">Border Style</h3>
          <div className="border-row">
            {POLAROID_BORDERS.map((b) => (
              <button
                key={b}
                type="button"
                className={`border-chip${b === border ? ' is-on' : ''}`}
                aria-pressed={b === border}
                onClick={() => setBorder(b)}
              >
                <span className="border-chip__swatch" style={{ background: BORDER_SWATCHES[b] }} />
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="studio__step">
          <p className="studio__label">Step 4</p>
          <h3 className="studio__heading">
            Upload Photographs {photos.length > 0 && <span className="studio__count">({photos.length} photos)</span>}
          </h3>

          <div
            className={`dropzone${over ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (e.dataTransfer?.files?.length) accept(e.dataTransfer.files);
            }}
          >
            <ImagePlus size={26} aria-hidden="true" />
            <p className="dropzone__title">Upload your polaroid memories here</p>
            <p className="dropzone__hint">JPG, PNG, WebP supported · up to {MAX_MB} MB each</p>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => inputRef.current?.click()}>
              Select Images
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              aria-label="Select polaroid photographs"
              onChange={(e) => {
                if (e.target.files?.length) accept(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {errors.length > 0 && (
            <ul className="studio__errors" role="alert">
              {errors.map((text) => (
                <li className="field-error" key={text}>
                  {text}
                </li>
              ))}
            </ul>
          )}

          {photos.length > 0 && (
            <div className="previews">
              {photos.map((file, index) => (
                <figure className="preview" key={`${file.name}-${file.size}-${index}`}>
                  <img src={previewUrl(file)} alt={`Selected photo: ${file.name}`} />
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                  >
                    <X size={13} />
                  </button>
                </figure>
              ))}
            </div>
          )}

          {touched && photos.length === 0 && (
            <p className="field-error" role="alert">
              Add at least one photograph to print.
            </p>
          )}
        </div>

        <div className="studio__step">
          <p className="studio__label">Step 5</p>
          <h3 className="studio__heading">
            Captions or Dates <span className="field-optional">(Optional)</span>
          </h3>
          <div className="field">
            <label className="sr-only" htmlFor="studio-captions">
              Captions or dates
            </label>
            <textarea
              id="studio-captions"
              value={captions}
              placeholder="E.g., print 'Goa 2026' on the beach photos, or leave blank for clean borders…"
              onChange={(e) => setCaptions(e.target.value)}
            />
          </div>
        </div>
      </div>

      <aside className="studio__rail" aria-label="Order summary">
        <div className="summary-card">
          <figure className="polaroid-preview" style={{ background: BORDER_SWATCHES[border] }}>
            <img src={heroPreview} alt={photos.length ? 'Your first uploaded photo' : product.alt} />
            <figcaption>{border}</figcaption>
          </figure>

          <div className="summary-card__body">
            <h3 className="summary-card__name">{product.name}</h3>

            <dl className="summary-rows">
              <div>
                <dt>Selected Quantity</dt>
                <dd>
                  {quantity} {quantity === 1 ? 'print' : 'prints'}
                </dd>
              </div>
              <div>
                <dt>Unit Rate</dt>
                <dd>{formatRupees(product.price)} / print</dd>
              </div>
              <div>
                <dt>Border Finish</dt>
                <dd>{border}</dd>
              </div>
              <div>
                <dt>Uploaded Photos</dt>
                <dd>
                  {photos.length} file{photos.length === 1 ? '' : 's'}
                </dd>
              </div>
            </dl>

            <div className="summary-card__total">
              <span>Subtotal</span>
              <strong>{formatRupees(subtotal)}</strong>
            </div>
            <p className="summary-card__note">+ shipping confirmed separately before payment</p>

            <button className="btn btn--primary btn--block" type="button" onClick={onAdd} disabled={!canAdd}>
              Add Polaroids to Bag <ArrowRight className="arrow" size={16} />
            </button>

            {!canAdd && (
              <p className={touched ? 'field-error' : 'field-hint'} role="status" style={{ textAlign: 'center' }}>
                {photos.length === 0 ? 'Upload your photographs to continue.' : `Minimum order is ${min}.`}
              </p>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}
