import { PackageOpen } from 'lucide-react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, compact = false, variant = '', emptyText = 'Nothing here yet.' }) {
  if (!products.length) {
    return (
      <div className="empty">
        <span className="empty__icon">
          <PackageOpen size={26} />
        </span>
        <h2>No products match</h2>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} compact={compact} variant={variant} />
      ))}
    </div>
  );
}
