import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import ProductGrid from '../components/ProductGrid';
import PolaroidStudio from '../components/PolaroidStudio';
import usePageMeta from '../hooks/usePageMeta';
import { getByCategory } from '../data/products';
import { formatRupees } from '../utils/currency';
import { useText } from '../context/SiteConfigContext';

export default function Polaroids() {
  usePageMeta(
    'Polaroids',
    'Medium polaroid prints at ₹6 each (minimum 9), or a set of 25 prints for ₹150. Small prints, big memories.'
  );

  const products = getByCategory('polaroid');
  const medium = products.find((p) => p.id === 'polaroid-medium');
  const set = products.find((p) => p.id === 'polaroid-set-25');

  return (
    <div className="shell">
      <header className="page-head">
        <h1 className="page-head__art">
          <img src="/images/headings/polaroids.png" alt="Polaroids" width="1200" height="385" />
        </h1>
        <p>{useText('polaroids.subtitle', 'Small prints. Big memories.')}</p>
      </header>

      <ProductGrid products={products} variant="polaroid" />

      <div className="section">
        <PolaroidStudio />
      </div>

      <section className="section two-col" aria-label="How polaroids work">
        <div className="info-card">
          <h3>How polaroid orders work</h3>
          <ol className="numbered">
            <li>Pick the product — single prints or the set of 25.</li>
            <li>Choose how many you want.</li>
            <li>Upload the photographs you want printed.</li>
            <li>Add captions if you would like them on the prints.</li>
            <li>Pick a border style.</li>
            <li>Review everything on the product page.</li>
            <li>Add the configured item to your bag.</li>
          </ol>
        </div>

        <div className="info-card">
          <h3>What it costs</h3>
          <table className="summary-table">
            <tbody>
              <tr>
                <th scope="row">Medium print</th>
                <td>
                  {formatRupees(medium.price)} each · minimum {medium.minQty} prints (
                  {formatRupees(medium.price * medium.minQty)})
                </td>
              </tr>
              <tr>
                <th scope="row">Set of 25</th>
                <td>{formatRupees(set.price)} per set of {set.setSize} prints</td>
              </tr>
              <tr>
                <th scope="row">Dispatch</th>
                <td>3–4 working days</td>
              </tr>
              <tr>
                <th scope="row">Shipping</th>
                <td>Charged separately and confirmed before payment</td>
              </tr>
            </tbody>
          </table>
          <Link className="btn btn--primary btn--sm" to="/product/polaroid-prints-medium">
            Order prints <ArrowRight className="arrow" size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
