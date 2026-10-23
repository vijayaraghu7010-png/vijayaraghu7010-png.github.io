import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

import ProductGrid from '../components/ProductGrid';
import usePageMeta from '../hooks/usePageMeta';
import { getByCategory, MAGAZINE_THEMES } from '../data/products';
import { useText } from '../context/SiteConfigContext';

export default function Magazines() {
  usePageMeta(
    'Personalised Magazines',
    'Personalised photo magazines — 4 pages (8 sides) for ₹300 or 8 pages (16 sides) for ₹550. Choose a theme, send photos, approve the PDF preview.'
  );

  const products = getByCategory('magazine');

  return (
    <div className="shell">
      <header className="page-head">
        <h1 className="page-head__art">
          <img src="/images/headings/magazines.png" alt="Personalised Magazines" width="1200" height="379" />
        </h1>
        <p>{useText('magazines.subtitle', 'Turn your favourite memories into a magazine made just for you.')}</p>
      </header>

      <ProductGrid products={products} variant="magazine" />

      <section className="section two-col" aria-label="How magazines work">
        <div className="info-card">
          <h3>How your magazine is made</h3>
          <ol className="numbered">
            <li>Choose the size — 4 pages / 8 sides, or 8 pages / 16 sides.</li>
            <li>Choose a theme from the list, or ask for a custom one.</li>
            <li>Share your photographs to suit the size you picked.</li>
            <li>We design and edit the pages by hand.</li>
            <li>You get a PDF preview to look over.</li>
            <li>Printing starts only after you approve that preview.</li>
            <li>The magazine is packed carefully and shipped to you.</li>
          </ol>
          <p className="form-note">
            Share your photographs according to the selected magazine size. Choose a theme, and your magazine pages
            will be designed and provided as a PDF preview. After your approval, the magazine can be printed and
            shipped. Design, printing and shipping are handled by our team after you place the order — this website
            does not generate the PDF automatically.
          </p>
        </div>

        <div className="info-card">
          <h3>Themes you can pick</h3>
          <ul className="pdp__list">
            {MAGAZINE_THEMES.map((theme) => (
              <li key={theme.id}>
                <Check size={15} />
                <span>
                  <strong style={{ color: 'var(--ink)' }}>{theme.name}</strong> — {theme.blurb}
                </span>
              </li>
            ))}
          </ul>
          <Link className="btn btn--primary btn--sm" to="/product/personalised-magazine-4-pages">
            Start customising <ArrowRight className="arrow" size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
