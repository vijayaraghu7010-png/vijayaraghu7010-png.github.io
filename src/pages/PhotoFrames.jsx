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

/* Frames are a category in their own right, like hampers. There are no
   frame products in src/data/products.js yet, so until there are this
   renders its empty state rather than a broken page - add entries with
   category: 'frame' and they appear here with nothing else to change.

   There is no occasion filter because frames have no occasions list;
   if one is added to the data, copy the chips from Hampers. */
export default function PhotoFrames() {
  usePageMeta(
    'Photo Frames',
    'Your favourite moments printed and framed for your walls — personalised photo frames from WrappedStudio.'
  );

  const all = getByCategory('frame');
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
        <h1 className="page-head__art">
          <img src="/images/headings/photo-frames.webp" alt="Photo Frames" width="1600" height="534" />
        </h1>
        <p>
          {useText(
            'frames.subtitle',
            'Turn your favourite moments into beautiful frames for your space.'
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
          {products.length} {products.length === 1 ? 'frame' : 'frames'}
        </p>
      ) : null}

      <ProductGrid
        products={products}
        emptyText="Frames are being made ready — tell us what you have in mind and we will frame it for you."
      />
    </div>
  );
}
