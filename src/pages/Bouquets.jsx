import { useEffect, useMemo, useRef, useState } from 'react';

import BouquetOptions from '../components/BouquetOptions';
import CustomGiftBanner from '../components/CustomGiftBanner';
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

  /* The customiser is behind the banner's button rather than always
     open: somebody browsing the bouquets should see the bouquets. */
  const [building, setBuilding] = useState(false);
  const builder = useRef(null);

  /* Opening it scrolls it into view, because the banner is usually at
     the bottom of the window when it is pressed. */
  useEffect(() => {
    if (building && builder.current) {
      builder.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [building]);

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

  /* What the customiser is priced from until the studio quotes the
     build: the first bouquet in the list as it is sorted now. */
  const start = products[0] || all[0];

  return (
    <div className="shell">
      <header className="page-head">
        <h1 className="page-head__art">
          <img src="/images/headings/bouquets.webp" alt="Bouquets for Every Occasion" width="1200" height="404" />
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

      <section className="section" aria-label="Custom bouquets">
        <CustomGiftBanner
          onAction={() => setBuilding((open) => !open)}
          actionLabel={building ? 'Close the builder' : 'Create Something Personal'}
          expanded={building}
        />

        {building && start && (
          <div className="section" ref={builder}>
            <BouquetOptions product={start} />
          </div>
        )}
      </section>
    </div>
  );
}
