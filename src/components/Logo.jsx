import { Link } from 'react-router-dom';
import useBrand from '../hooks/useBrand';

export default function Logo({ to = '/' }) {
  const brand = useBrand();

  return (
    <Link className="brand" to={to} aria-label={`${brand.name} — home`}>
      <img
        className="brand__logo"
        src="/images/logo.png"
        alt={`${brand.name} — magazines, polaroids and bouquets`}
        width="512"
        height="512"
      />
    </Link>
  );
}
