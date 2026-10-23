import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta('Page not found', 'That page does not exist at WrappedStudio.');

  return (
    <div className="shell">
      <div className="empty panel" style={{ marginTop: 'clamp(24px, 4vw, 60px)' }}>
        <span className="empty__icon">
          <Compass size={26} />
        </span>
        <h2>We could not find that page</h2>
        <p>
          The link may be old, or the product may have moved. Everything we make is a click away below.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="btn btn--primary" to="/">
            Back to home
          </Link>
          <Link className="btn btn--ghost" to="/magazines">
            Magazines
          </Link>
          <Link className="btn btn--ghost" to="/polaroids">
            Polaroids
          </Link>
          <Link className="btn btn--ghost" to="/bouquets">
            Bouquets
          </Link>
        </div>
      </div>
    </div>
  );
}
