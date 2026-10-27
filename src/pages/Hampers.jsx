import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

import ProductGrid from '../components/ProductGrid';
import usePageMeta from '../hooks/usePageMeta';
import { getByCategory, HAMPER_OCCASIONS } from '../data/products';
import { useText } from '../context/SiteConfigContext';
import '../styles/hamper.css';

const FILTERS = ['All Hampers', ...HAMPER_OCCASIONS];

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest' }
];

export default function Hampers() {
  usePageMeta(
    'Gift Hampers',
    'Keepsake gift hampers from ₹1,499 — candles, jewellery, chocolates and handwritten notes, packed by hand in Chennai.'
  );

  const all = getByCategory('hamper');
  const [filter, setFilter] = useState('All Hampers');
  const [sort, setSort] = useState('featured');

  const products = useMemo(() => {
    const filtered =
      filter === 'All Hampers' ? [...all] : all.filter((p) => (p.occasions || []).includes(filter));

    switch (sort) {
      case 'price-asc':
        return filtered.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return filtered.sort((a, b) => b.price - a.price);
      case 'newest':
        return filtered.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      default:
        return filtered.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
  }, [all, filter, sort]);

  return (
    <div className="shell">
      <header className="page-head">
        <h1>{useText('hampers.title', 'Gift Hampers')}</h1>
        <p>{useText('hampers.subtitle', 'Keepsake boxes packed by hand, for the people you love most.')}</p>
      </header>

      <section className="studio-invite" aria-labelledby="studio-invite-title">
        <div>
          <p className="eyebrow">
            <Sparkles size={13} aria-hidden="true" /> New
          </p>
          <h2 id="studio-invite-title">Build your own hamper in 3D</h2>
          <p>
            Pick the box, fill it, move everything where you want it and write the card — all in a 3D preview of
            how it will arrive. Your design saves itself on this device, so you can close the page and carry on
            later.
          </p>
        </div>
        <Link className="btn btn--primary" to="/hamper-studio">
          Start building
        </Link>
      </section>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${filter === f ? ' is-on' : ''}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}

        <div className="filters__sort">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="result-count" role="status">
        {products.length} {products.length === 1 ? 'hamper' : 'hampers'}
        {filter !== 'All Hampers' ? ` for ${filter}` : ''}
      </p>

      <ProductGrid
        products={products}
        emptyText={`No hampers for ${filter} just yet — try another occasion.`}
      />
    </div>
  );
}
