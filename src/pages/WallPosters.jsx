import { useMemo, useState } from 'react';

import ProductGrid from '../components/ProductGrid';
import usePageMeta from '../hooks/usePageMeta';
import { getByCategory } from '../data/products';
import { useText } from '../context/SiteConfigContext';

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest' }
];

/* Wall posters are a category in their own right, like frames. There
   are no poster products in src/data/products.js yet, so until there
   are this renders its empty state rather than a broken page - add
   entries with category: 'poster' and they appear here with nothing
   else to change.

   There is no occasion filter because posters have no occasions list;
   if one is added to the data, copy the chips from Hampers. */
export default function WallPosters() {
  usePageMeta(
    'Wall Posters',
    'Your favourite memories printed as wall posters — personalised poster prints from WrappedStudio.'
  );

  const all = getByCategory('poster');
  const [sort, setSort] = useState('featured');

  const products = useMemo(() => {
    const list = [...all];
    switch (sort) {
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price);
      case 'newest':
        return list.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      default:
        return list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
  }, [all, sort]);

  return (
    <div className="shell">
      <header className="page-head">
        <h1>{useText('posters.title', 'Wall Posters')}</h1>
        <p>
          {useText(
            'posters.subtitle',
            'Turn your favourite memories into beautiful wall posters.'
          )}
        </p>
      </header>

      <div className="filters">
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

      {products.length ? (
        <p className="result-count" role="status">
          {products.length} {products.length === 1 ? 'poster' : 'posters'}
        </p>
      ) : null}

      <ProductGrid
        products={products}
        emptyText="Posters are being made ready — tell us what you have in mind and we will print it for you."
      />
    </div>
  );
}
