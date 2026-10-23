import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';

import WishlistButton from '../components/WishlistButton';
import ProductCard from '../components/ProductCard';
import MagazineCustomiser from '../components/MagazineCustomiser';
import PolaroidStudio from '../components/PolaroidStudio';
import BouquetOptions from '../components/BouquetOptions';
import NotFound from './NotFound';
import usePageMeta from '../hooks/usePageMeta';
import { PRODUCTS, getProductBySlug } from '../data/products';
import { formatRupees } from '../utils/currency';
import { useSiteConfig } from '../context/SiteConfigContext';
import { bestOfferFor } from '../utils/offers';

const CATEGORY_PATHS = { magazine: '/magazines', polaroid: '/polaroids', bouquet: '/bouquets' };
const CATEGORY_NAMES = { magazine: 'Magazines', polaroid: 'Polaroids', bouquet: 'Bouquets' };

export default function ProductDetails() {
  const { slug } = useParams();
  const product = getProductBySlug(slug);
  const { offers } = useSiteConfig();
  const [shot, setShot] = useState(0);

  /* an automatic offer shows here exactly as it shows on the card */
  const deal = bestOfferFor(product, offers);

  usePageMeta(product?.name, product?.shortDescription);

  if (!product) return <NotFound />;

  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);

  return (
    <div className="shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to={CATEGORY_PATHS[product.category]}>{CATEGORY_NAMES[product.category]}</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="section pdp">
        <div className="pdp__gallery">
          <div className="pdp__main">
            <img src={gallery[shot]} alt={product.alt} />
          </div>
          {gallery.length > 1 && (
            <div className="pdp__thumbs">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  className={i === shot ? 'is-on' : undefined}
                  aria-label={`Show image ${i + 1} of ${gallery.length}`}
                  aria-pressed={i === shot}
                  onClick={() => setShot(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          <div>
            <p className="eyebrow">{product.categoryLabel}</p>
            <h1 className="pdp__title" style={{ marginTop: 6 }}>
              {product.name}
            </h1>
            <p className="pdp__price" style={{ marginTop: 10 }}>
              {deal ? (
                <>
                  {formatRupees(deal.price)}
                  <s className="pdp__was">{formatRupees(product.price)}</s>
                  <span className="pdp__deal">
                    {deal.percent}% off · {deal.offer.title || 'offer applied'}
                  </span>
                </>
              ) : (
                formatRupees(product.price)
              )}
              {product.unitLabel ? <small> {product.unitLabel}</small> : null}
            </p>
          </div>

          <p style={{ color: 'var(--ink-2)' }}>{product.description}</p>

          <ul className="pdp__list">
            {product.details.map((detail) => (
              <li key={detail}>
                <Check size={15} />
                <span>{detail}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <WishlistButton product={product} size={17} className="wish-btn wish-btn--inline" />
            <span className="field-hint">Save this for later</span>
          </div>

          {product.customiser === 'magazine' && <MagazineCustomiser product={product} />}

          {product.customiser === 'bouquet' && <BouquetOptions product={product} />}
        </div>
      </div>

      {product.customiser === 'polaroid' && (
        <div className="section">
          <PolaroidStudio initialFormat={product.id} />
        </div>
      )}

      {related.length > 0 && (
        <section className="section" aria-labelledby="related-title">
          <div className="section__head">
            <h2 className="section-title" id="related-title" style={{ fontSize: 'clamp(20px, 1.8vw, 28px)' }}>
              You might also like
            </h2>
            <Link className="link-all" to={CATEGORY_PATHS[product.category]}>
              All {CATEGORY_NAMES[product.category].toLowerCase()}
            </Link>
          </div>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
