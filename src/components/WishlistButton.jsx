import { Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function WishlistButton({ product, size = 16, className = 'wish-btn' }) {
  const wishlist = useWishlist();
  const { notify } = useCart();
  const saved = wishlist.has(product.id);

  return (
    <button
      type="button"
      className={`${className}${saved ? ' is-on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        wishlist.toggle(product.id);
        notify(saved ? `${product.name} removed from wishlist` : `${product.name} saved to wishlist`);
      }}
    >
      <Heart size={size} />
    </button>
  );
}
