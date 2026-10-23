import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

import { useSiteConfig } from '../context/SiteConfigContext';
import { bannerOffers } from '../utils/offers';

/* The strip across the top of the shop. It announces whatever is
   running — a festival theme's own line, or any offer marked to be
   shown — and a customer can close it for the rest of the visit. */

const DISMISS_KEY = 'ws-banner-dismissed';

export default function OfferBanner() {
  const { theme, offers } = useSiteConfig();
  const [closed, setClosed] = useState(false);
  const live = bannerOffers(offers);

  /* the headline is the festival's own words when it has any,
     otherwise the first offer that asked to be announced */
  const festival = theme?.bannerText ? theme.bannerText : '';
  const offer = live[0];
  const signature = `${festival}|${offer?.id || ''}`;

  useEffect(() => {
    try {
      setClosed(window.sessionStorage.getItem(DISMISS_KEY) === signature);
    } catch {
      setClosed(false);
    }
  }, [signature]);

  if (closed || (!festival && !offer)) return null;

  function dismiss() {
    setClosed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      /* private window: it simply comes back next time */
    }
  }

  const saving =
    offer && (offer.discountType === 'flat' ? `₹${offer.value} off` : `${offer.value}% off`);

  return (
    <div className="offer-bar" role="region" aria-label="Current offer">
      <p>
        <Sparkles size={15} aria-hidden="true" />
        {festival && <strong>{festival}</strong>}
        {offer && (
          <>
            {festival && <span className="offer-bar__dot" aria-hidden="true" />}
            <strong>{offer.title || 'Offer'}</strong>
            <span className="offer-bar__deal">{saving}</span>
            {offer.code && (
              <span className="offer-bar__code">
                code <b>{offer.code}</b>
              </span>
            )}
            {offer.description && <span className="offer-bar__note">{offer.description}</span>}
          </>
        )}
      </p>

      <button type="button" onClick={dismiss} aria-label="Hide this offer">
        <X size={15} />
      </button>
    </div>
  );
}
