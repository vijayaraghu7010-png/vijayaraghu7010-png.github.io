import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/* The banner's button goes to the custom-gift form, unless the page
   it is on has something of its own to open — the bouquets page
   opens its customiser rather than sending anybody away. */
export default function CustomGiftBanner({ onAction, actionLabel, expanded }) {
  return (
    <aside className="gift-banner" aria-labelledby="gift-title">
      <img
        src="/images/custom-sunset.jpg"
        alt="A woman on the beach at sunset holding a handmade bouquet"
        loading="lazy" decoding="async"
      />
      <div className="gift-banner__copy">
        <p className="eyebrow">Have a special idea?</p>
        <h2 className="gift-banner__title" id="gift-title">
          Custom Gifts
          <br />
          Made Just for You
        </h2>
        <p className="gift-banner__text">Tell us your story and we&rsquo;ll create something truly personal.</p>
        {onAction ? (
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={onAction}
            aria-expanded={expanded ? 'true' : 'false'}
          >
            {actionLabel || 'Create Something Personal'} <ArrowRight className="arrow" size={15} />
          </button>
        ) : (
          <Link className="btn btn--primary btn--sm" to="/custom-gifts">
            Create Something Personal <ArrowRight className="arrow" size={15} />
          </Link>
        )}
      </div>
    </aside>
  );
}
