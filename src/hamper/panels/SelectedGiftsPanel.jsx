import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Loader2, Trash2, X } from 'lucide-react';

import {
  GIFT_TEXT_MAX,
  SCALE_MAX,
  SCALE_MIN,
  getBoxVariant,
  getGiftKind,
  giftColours,
  giftUnitPrice
} from '../../data/hamperKit';
import { MAX_UPLOAD_MB, acquireAssetUrl, releaseAssetUrl, storeUpload } from '../../lib/designAssets';
import { formatRupees } from '../../utils/currency';

/* A thumbnail of a photo that lives in IndexedDB. The object URL is
   taken out and handed back, so closing the panel does not leave the
   blob pinned in memory. */
function AssetThumb({ assetId, onMissing }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return undefined;
    }
    let cancelled = false;

    acquireAssetUrl(assetId).then((entry) => {
      if (cancelled) {
        if (entry) releaseAssetUrl(assetId);
        return;
      }
      if (!entry) {
        onMissing?.(assetId);
        return;
      }
      setUrl(entry.url);
    });

    return () => {
      cancelled = true;
      releaseAssetUrl(assetId);
      setUrl(null);
    };
  }, [assetId, onMissing]);

  if (!assetId) return null;
  if (!url) {
    return <span className="gift-photo gift-photo--gone">Photo not on this device</span>;
  }
  return <img className="gift-photo" src={url} alt="The photograph on this gift" />;
}

function PhotoField({ gift, kind, change, missing }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = async (file) => {
    setError(null);
    setBusy(true);
    try {
      const asset = await storeUpload(file);
      /* The design points at the asset id. Never at a blob: URL —
         that would be dead the next time the browser opened. */
      change({ type: 'gift', uid: gift.uid, patch: { assetId: asset.id } }, { immediate: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const gone = gift.assetId && missing.includes(gift.assetId);

  return (
    <div className="field">
      <label htmlFor={`photo-${gift.uid}`}>{kind.photoLabel || 'Photograph'}</label>

      {gift.assetId && !gone && <AssetThumb assetId={gift.assetId} />}
      {gone && (
        <p className="field-error" role="alert">
          This photo is no longer stored on this device — browser data was probably cleared. Upload it again to put
          it back.
        </p>
      )}

      <div className="gift-photo__row">
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
          {gift.assetId && !gone ? ' Change photo' : ' Upload a photo'}
        </button>

        {gift.assetId && (
          <button
            className="icon-link"
            type="button"
            onClick={() => change({ type: 'gift', uid: gift.uid, patch: { assetId: null } }, { immediate: true })}
          >
            <X size={13} /> Remove
          </button>
        )}
      </div>

      <input
        ref={input}
        id={`photo-${gift.uid}`}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) pick(file);
        }}
      />

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="field-hint">
        JPG, PNG, WEBP, AVIF or HEIC up to {MAX_UPLOAD_MB} MB. Kept on this device only — nothing is uploaded
        anywhere until you send us the order.
      </p>
    </div>
  );
}

function GiftCard({ gift, change, selected, onSelect, missing, variantLabel }) {
  const kind = getGiftKind(gift.kindId);
  if (!kind) return null;

  const price = giftUnitPrice(kind, gift.variantId);
  const colours = giftColours(kind);

  return (
    <article className={`gift-row${selected ? ' is-on' : ''}`}>
      <button
        type="button"
        className="gift-row__head"
        aria-expanded={selected}
        onClick={() => onSelect(selected ? null : gift.uid)}
      >
        {kind.previewPath ? (
          <img className="gift-row__thumb" src={kind.previewPath} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="gift-row__swatch" style={{ background: gift.colour }} aria-hidden="true" />
        )}
        <span className="gift-row__name">
          {kind.name}
          {gift.quantity > 1 ? ` × ${gift.quantity}` : ''}
        </span>
        <span className="gift-row__price">{price === null ? 'Unavailable' : formatRupees(price * gift.quantity)}</span>
      </button>

      {selected && (
        <div className="gift-row__body">
          {kind.variants?.length > 1 && (
            <div className="field">
              <label htmlFor={`variant-${gift.uid}`}>Option</label>
              <select
                id={`variant-${gift.uid}`}
                value={gift.variantId || ''}
                onChange={(e) => change({ type: 'gift', uid: gift.uid, patch: { variantId: e.target.value } })}
              >
                {kind.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                    {v.priceDelta ? ` (+${formatRupees(v.priceDelta)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <fieldset className="swatches">
            <legend>Colour</legend>
            <div className="swatches__row">
              {colours.map((hex) => (
                <label key={hex} className={`swatch${gift.colour === hex ? ' is-on' : ''}`}>
                  <input
                    type="radio"
                    name={`colour-${gift.uid}`}
                    className="sr-only"
                    checked={gift.colour === hex}
                    onChange={() => change({ type: 'gift', uid: gift.uid, patch: { colour: hex } })}
                  />
                  <span className="swatch__chip" style={{ background: hex }} aria-hidden="true" />
                  <span className="sr-only">{hex}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {kind.supportsScale && (
            <div className="field">
              <label htmlFor={`scale-${gift.uid}`}>Size</label>
              <input
                id={`scale-${gift.uid}`}
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={0.01}
                value={gift.scale}
                onChange={(e) => change({ type: 'gift', uid: gift.uid, patch: { scale: Number(e.target.value) } })}
                /* The slider fires on every pixel of the drag, and
                   each one re-packs the box. The save that matters is
                   the one on release. */
                onPointerUp={() => change({ type: 'gift', uid: gift.uid, patch: { scale: gift.scale } }, { immediate: true })}
              />
              <p className="field-hint">
                {Math.round(gift.scale * 100)}% of its usual size — the hamper is packed again around it.
              </p>
            </div>
          )}

          {(kind.maxQty || 1) > 1 && (
            <div className="field">
              <label htmlFor={`qty-${gift.uid}`}>How many</label>
              <select
                id={`qty-${gift.uid}`}
                value={gift.quantity}
                onChange={(e) => change({ type: 'gift', uid: gift.uid, patch: { quantity: Number(e.target.value) } })}
              >
                {Array.from({ length: kind.maxQty }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          {kind.supportsText && (
            <div className="field">
              <label htmlFor={`text-${gift.uid}`}>{kind.textLabel || 'Personalised text'}</label>
              <input
                id={`text-${gift.uid}`}
                type="text"
                value={gift.text}
                maxLength={kind.textMax || GIFT_TEXT_MAX}
                placeholder="e.g. Always, Asha"
                onChange={(e) => change({ type: 'gift', uid: gift.uid, patch: { text: e.target.value } })}
              />
              <p className="field-hint">
                {gift.text.length}/{kind.textMax || GIFT_TEXT_MAX} — it appears on the gift in the preview.
              </p>
            </div>
          )}

          {kind.supportsPhoto && <PhotoField gift={gift} kind={kind} change={change} missing={missing} />}

          {gift.placed === false && (
            <p className="field-error" role="alert">
              This one could not be fitted into the {variantLabel.toLowerCase()}. It is still in your hamper and
              still in the total — choose a larger box, or take something else out.
            </p>
          )}

          {kind.reconstructionStatus !== 'verified' && (
            <details className="model-note">
              <summary>
                <AlertTriangle size={12} aria-hidden="true" />
                {kind.reconstructionStatus === 'placeholder'
                  ? 'Shown as a stand-in shape'
                  : 'The 3D model is an approximation'}
              </summary>
              <p>
                {kind.reconstructionStatus === 'placeholder'
                  ? 'This product has no model yet, so the preview shows a plain box at its real size. What you receive is the product itself.'
                  : 'Built from the product photograph to match its shape, colours and proportions. It has not been measured against the real object, and the sides the photograph does not show are estimated.'}
              </p>
              {kind.uncertain?.length > 0 && (
                <ul>
                  {kind.uncertain.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </details>
          )}

          <button
            className="btn btn--quiet btn--sm"
            type="button"
            onClick={() => change({ type: 'remove-gift', uid: gift.uid }, { immediate: true })}
          >
            <Trash2 size={14} /> Take out of the hamper
          </button>
        </div>
      )}
    </article>
  );
}

export default function SelectedGiftsPanel({ design, change, missing = [] }) {
  if (!design.gifts.length) {
    return (
      <p className="field-hint">
        Nothing in the box yet. Add something from <strong>Add gifts</strong>, then drag it around the box to
        arrange it.
      </p>
    );
  }

  return (
    <div className="stack">
      <p className="field-hint">
        The studio packs the box for you. Tap a gift to change its colour, its options or its size — it is
        arranged again around whatever you change.
      </p>
      {design.gifts.map((gift) => (
        <GiftCard
          key={gift.uid}
          gift={gift}
          variantLabel={`${getBoxVariant(design.box).sizeLabel} box`}
          change={change}
          missing={missing}
          selected={design.editing.selectedGiftUid === gift.uid}
          onSelect={(uid) => change({ type: 'select', uid })}
        />
      ))}
    </div>
  );
}
