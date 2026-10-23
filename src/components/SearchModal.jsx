import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

import { searchProducts } from '../data/products';
import { formatRupees } from '../utils/currency';

const SUGGESTIONS = ['magazine', 'polaroid', 'rose', 'sunflower', 'anniversary', 'birthday'];

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchProducts(query), [query]);
  const trimmed = query.trim();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const goTo = (product) => {
    onClose();
    navigate(`/product/${product.slug}`);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Search products">
      <div className="overlay__backdrop" onClick={onClose} />

      <div className="search-modal">
        <div className="search-modal__bar">
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="site-search">
            Search products
          </label>
          <input
            id="site-search"
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Search magazines, polaroids, bouquets…"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-btn" type="button" aria-label="Close search" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {!trimmed && (
          <>
            <p className="search-empty" style={{ paddingBottom: 0 }}>
              Try one of these
            </p>
            <div className="search-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" type="button" onClick={() => setQuery(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {trimmed && results.length === 0 && (
          <p className="search-empty">
            Nothing matches &ldquo;{trimmed}&rdquo;. Try &ldquo;magazine&rdquo;, &ldquo;polaroid&rdquo; or a flower name.
          </p>
        )}

        {trimmed && results.length > 0 && (
          <div className="search-results">
            <p className="result-count" style={{ padding: '4px 10px 2px' }}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            {results.map((product) => (
              <button key={product.id} className="search-result" type="button" onClick={() => goTo(product)}>
                <img src={product.image} alt="" loading="lazy" />
                <span>
                  <span className="search-result__name">{product.name}</span>
                  <span className="search-result__meta">
                    {product.categoryLabel} · {formatRupees(product.price)}
                    {product.unitLabel ? ` ${product.unitLabel}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
