import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import ProductCard from './ProductCard';
import CustomGiftBanner from './CustomGiftBanner';
import { getFeatured } from '../data/products';

export default function FeaturedProducts() {
  const products = getFeatured();

  return (
    <section className="shell section" aria-labelledby="featured-title">
      <div className="feature-row">
        <div className="featured panel">
          <div className="section__head">
            <div>
              <h2 className="section-title" id="featured-title">
                Featured Products
              </h2>
              <p className="section-sub">Handpicked favourites, made to make your moments more special.</p>
            </div>
            <Link className="link-all" to="/bouquets">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="featured__grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </div>

        <CustomGiftBanner />
      </div>
    </section>
  );
}
