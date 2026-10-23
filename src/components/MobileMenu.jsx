import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Search, User, X } from 'lucide-react';

import Logo from './Logo';
import { NAV_LINKS } from './Header';
import { useAuth } from '../context/AuthContext';

export default function MobileMenu({ open, onClose, onOpenAuth, onOpenSearch }) {
  const { isSignedIn, firstName, logOut } = useAuth();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <div className={`mobile-menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="mobile-menu__backdrop" onClick={onClose} />
      <div className="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="mobile-menu__top">
          <Logo small />
          <button className="icon-btn" type="button" aria-label="Close menu" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <nav className="mobile-menu__links" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onClose}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button
          className="btn btn--ghost btn--block btn--sm mobile-menu__search"
          type="button"
          onClick={() => {
            onClose();
            onOpenSearch();
          }}
        >
          <Search size={15} /> Search products
        </button>

        <div className="mobile-menu__account">
          {isSignedIn ? (
            <>
              <p className="mobile-menu__who">Signed in as {firstName}</p>
              <button
                className="btn btn--quiet btn--block btn--sm"
                type="button"
                onClick={() => {
                  logOut();
                  onClose();
                }}
              >
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn--primary btn--block btn--sm"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth('login');
                }}
              >
                <User size={15} /> Log in
              </button>
              <button
                className="btn btn--ghost btn--block btn--sm"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth('signup');
                }}
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
