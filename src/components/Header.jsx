import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag } from 'lucide-react';

import Logo from './Logo';
import MobileMenu from './MobileMenu';
import AccountButton from './AccountButton';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/magazines', label: 'Magazines' },
  { to: '/polaroids', label: 'Polaroids' },
  { to: '/bouquets', label: 'Bouquets' },
  { to: '/hampers', label: 'Hampers' },
  { to: '/custom-gifts', label: 'Custom Gifts' },
  { to: '/about', label: 'About' }
];

export default function Header({ onOpenSearch, onOpenAuth }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, openCart } = useCart();
  const wishlist = useWishlist();
  const navigate = useNavigate();

  return (
    <>
      <header className="header">
        <div className="shell header__inner">
          <Logo />

          <nav className="nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button
            className="burger"
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="header__tools">
            <button className="icon-btn icon-btn--search" type="button" aria-label="Search products" onClick={onOpenSearch}>
              <Search size={20} />
            </button>

            <button
              className="icon-btn"
              type="button"
              aria-label={`Wishlist, ${wishlist.count} saved`}
              onClick={() => navigate('/wishlist')}
            >
              <Heart size={20} />
              {wishlist.count > 0 && <span className="icon-btn__count">{wishlist.count}</span>}
            </button>

            <button
              className="icon-btn"
              type="button"
              aria-label={`Shopping bag, ${count} items`}
              onClick={openCart}
            >
              <ShoppingBag size={20} />
              <span className="icon-btn__count">{count}</span>
            </button>

            <AccountButton onOpenAuth={onOpenAuth} />
          </div>
        </div>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenAuth={onOpenAuth}
        onOpenSearch={onOpenSearch}
      />
    </>
  );
}
