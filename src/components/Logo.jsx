import { Link } from 'react-router-dom';
import { BRAND } from '../data/categories';

export default function Logo({ to = '/' }) {
  return (
    <Link className="brand" to={to} aria-label={`${BRAND.name} — home`}>
      <img
        className="brand__logo"
        src="/images/logo.png"
        alt={`${BRAND.name} — magazines, polaroids and bouquets`}
        width="512"
        height="512"
      />
    </Link>
  );
}
