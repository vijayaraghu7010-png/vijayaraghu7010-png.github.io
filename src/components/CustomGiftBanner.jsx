import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function CustomGiftBanner() {
  return (
    <aside className="gift-banner" aria-labelledby="gift-title">
      <img
        src="/images/custom-sunset.png"
        alt="A woman on the beach at sunset holding a handmade bouquet"
        loading="lazy"
      />
      <div className="gift-banner__copy">
        <p className="eyebrow">Have a special idea?</p>
        <h2 className="gift-banner__title" id="gift-title">
          Custom Gifts
          <br />
          Made Just for You
        </h2>
        <p className="gift-banner__text">Tell us your story and we&rsquo;ll create something truly personal.</p>
        <Link className="btn btn--primary btn--sm" to="/custom-gifts">
          Create Something Personal <ArrowRight className="arrow" size={15} />
        </Link>
      </div>
    </aside>
  );
}
