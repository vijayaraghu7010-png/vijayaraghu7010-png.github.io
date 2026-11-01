import { useEffect, useRef, useState } from 'react';
import { ImagePlus, ShoppingBag, X } from 'lucide-react';

import QuantitySelector from './QuantitySelector';
import { POSTER_PAPERS, POSTER_SETS, POSTER_SIZES } from '../data/products';
import { ACCEPTED_TYPES, MAX_BYTES_PER_PHOTO, maxPhotosFor } from '../data/uploadLimits';
import { putLinePhotos } from '../lib/photoStore';
import { formatRupees } from '../utils/currency';
import { makeLineKey } from '../utils/cartCalculations';
import { useCart } from '../context/CartContext';

const MAX_MB = Math.round(MAX_BYTES_PER_PHOTO / 1048576);
const MAX_PHOTOS = maxPhotosFor('poster');

/* A wall poster is sold two ways from the one component.

   Most are ready-made: the artwork is the studio's, and the customer
   only chooses how big and on what stock. One is not - the make-your-
   own poster, which carries `upload: true` and asks for the picture
   first. Everything after that step is identical, so it is the same
   form with one section switched on rather than a second component
   that would drift away from this one.

   Size carries the price and the paper does not, so the basket is
   handed a copy of the product under the size's id - exactly as
   FrameOptions does it. That id is what keeps an A4 and an A5 of the
   same design as two lines instead of one, and it is what the server
   prices the line from, so every id here needs its price_variants row
   (scripts/catalogue-sql.mjs writes them). The paper is recorded in
   the line's config, which is what the studio reads off the order.

   The pictures are put aside under the same key the basket line uses,
   as every other customiser does, so the checkout still finds them
   after a reload. They are never resized or recompressed here - they
   are what gets printed. */
export default function PosterOptions({ product }) {
  const { addItem, openCart } = useCart();

  const wantsUpload = Boolean(product.upload);
  const sizes = product.posterSizes || POSTER_SIZES;
  const [sizeId, setSizeId] = useState(product.sizeId || sizes[0].id);
  const [paperId, setPaperId] = useState(POSTER_PAPERS[0].id);
  const [setId, setSetId] = useState(product.setId || POSTER_SETS[0].id);
  const [quantity, setQuantity] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState([]);

  const inputRef = useRef(null);
  const urls = useRef(new Map());

  const size = sizes.find((s) => s.id === sizeId) || sizes[0];
  const paper = POSTER_PAPERS.find((p) => p.id === paperId) || POSTER_PAPERS[0];
  const set = POSTER_SETS.find((s) => s.id === setId) || POSTER_SETS[0];
  /* The basket counts prints, not sets, so a set of three ordered
     twice is six prints - which is what the server prices. */
  const sheets = set.count * quantity;
  const subtotal = size.price * sheets;

  /* Numbered here so the steps stay in sequence whether the upload
     step is shown or not. */
  let n = 0;
  const stepNo = {
    art: wantsUpload ? ++n : null,
    size: ++n,
    paper: ++n,
    set: ++n,
    note: wantsUpload ? ++n : null
  };

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
      const typeOk =
        ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
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
      problems.push(`A poster order takes ${MAX_PHOTOS} pictures at most`);
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

    if (wantsUpload && !photos.length) {
      setErrors(['Add the picture you would like printed.']);
      return;
    }

    /* Built once and used for both the line key and the basket, so the
       two agree and the checkout finds the pictures under the key the
       basket line carries. */
    const config = {
      size: size.label,
      paper: paper.label,
      /* Only worth recording when it is actually a set; a single print
         says so by being one. */
      set: set.count > 1 ? set.label : undefined,
      photoCount: photos.length || undefined,
      note: note.trim() || undefined
    };

    const chosen = { ...product, id: `${product.id}-${size.id}`, price: size.price };

    if (photos.length) {
      putLinePhotos(makeLineKey(chosen.id, config), photos);
    }

    addItem(chosen, { quantity: sheets, config });
    openCart();
  };

  return (
    <form className="customiser info-card" onSubmit={onSubmit}>
      <h3>{wantsUpload ? 'Make your poster' : 'Choose your print'}</h3>

      {wantsUpload ? (
        <div className="step">
          <div className="step__head">
            <span className="step__num">{stepNo.art}</span>
            <h4 className="step__title">Your picture</h4>
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
            <ImagePlus size={15} /> {photos.length ? 'Add another' : 'Add your picture'}
          </button>

          {photos.length ? (
            <div className="previews">
              {photos.map((file) => (
                <figure className="preview" key={`${file.name}-${file.size}`}>
                  <img src={previewUrl(file)} alt={`Selected picture: ${file.name}`} />
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

          <p className="field-hint">
            A photograph, a design, artwork of your own — whatever you would like on the wall. Send the
            largest copy you have; a small picture prints soft. Add more than one and each is printed as its
            own poster.
          </p>
        </div>
      ) : null}

      <div className="step">
        <div className="step__head">
          <span className="step__num">{stepNo.size}</span>
          <h4 className="step__title">Size</h4>
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
          <span className="step__num">{stepNo.paper}</span>
          <h4 className="step__title">Paper</h4>
        </div>
        <div className="option-grid">
          {POSTER_PAPERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`option${p.id === paperId ? ' is-on' : ''}`}
              aria-pressed={p.id === paperId}
              onClick={() => setPaperId(p.id)}
            >
              <strong>{p.label}</strong>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
        <p className="field-hint">Both cost the same — the size sets the price.</p>
      </div>

      <div className="step">
        <div className="step__head">
          <span className="step__num">{stepNo.set}</span>
          <h4 className="step__title">How many</h4>
        </div>
        <div className="option-grid">
          {POSTER_SETS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`option${s.id === setId ? ' is-on' : ''}`}
              aria-pressed={s.id === setId}
              onClick={() => setSetId(s.id)}
            >
              <strong>{s.label}</strong>
              <span>{s.blurb}</span>
              <span>{formatRupees(size.price * s.count)}</span>
            </button>
          ))}
        </div>
        <p className="field-hint">
          A set is priced by the sheet — {formatRupees(size.price)} a print at {size.label}.
        </p>
      </div>

      {wantsUpload ? (
        <div className="step">
          <div className="step__head">
            <span className="step__num">{stepNo.note}</span>
            <h4 className="step__title">Anything we should know</h4>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Crop it square, keep the border, print it warmer…"
          />
          <p className="field-hint">Optional. Tell us how you would like it printed.</p>
        </div>
      ) : null}

      {errors.length ? (
        <ul className="field-error">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="customiser__foot">
        <QuantitySelector value={quantity} onChange={setQuantity} min={1} max={50} />
        <p className="customiser__total">
          <span>Total</span>
          <strong>{formatRupees(subtotal)}</strong>
        </p>
      </div>

      <button className="btn btn--primary btn--block" type="submit">
        <ShoppingBag size={16} /> Add to cart
      </button>

      <p className="field-hint">
        Posters come unframed. Shipping is charged separately, once the print is ready.
      </p>
    </form>
  );
}
