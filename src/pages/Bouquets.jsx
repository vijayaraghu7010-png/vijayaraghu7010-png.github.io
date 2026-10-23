import { useMemo, useState } from 'react';

import ProductGrid from '../components/ProductGrid';
import usePageMeta from '../hooks/usePageMeta';
import { getByCategory } from '../data/products';
import { useText } from '../context/SiteConfigContext';

const FILTERS = [
  'All Bouquets',
  'Birthday',
  'Anniversary',
  'Love',
  'Congratulations',
  'Just Because',
  'Sunflower Bouquets',
  'Rose Bouquets'
];

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest' }
];

export default function Bouquets() {
  usePageMeta(
    'Bouquets for Every Occasion',
    'Handmade bouquets from ₹1,299 — roses, sunflowers and pastel blooms for birthdays, anniversaries and just because.'
  );

  const all = getByCategory('bouquet');
  const [filter, setFilter] = useState('All Bouquets');
  const [sort, setSort] = useState('featured');

  const products = useMemo(() => {
    const filtered =
      filter === 'All Bouquets'
        ? [...all]
        : all.filter((p) => p.flowerType === filter || (p.occasions || []).includes(filter));

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
        <h1 className="page-head__art">
          <img src="/images/headings/bouquets.png" alt="Bouquets for Every Occasion" width="1200" height="404" />
        </h1>
        <p>{useText('bouquets.subtitle', 'Because every moment deserves a beautiful beginning.')}</p>
      </header>

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
        {products.length} {products.length === 1 ? 'bouquet' : 'bouquets'}
        {filter !== 'All Bouquets' ? ` in ${filter}` : ''}
      </p>

      <ProductGrid
        products={products}
        variant="bouquet"
        emptyText={`No bouquets in ${filter} just yet — try another occasion or flower type.`}
      />
    </div>
  );
}
