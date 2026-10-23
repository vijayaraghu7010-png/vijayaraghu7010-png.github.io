import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LogOut, ShoppingBag, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/* Signed out: a "Log in" pill (just the icon on small screens).
   Signed in: an initial badge that opens a small account menu. */
export default function AccountButton({ onOpenAuth }) {
  const { isSignedIn, initials, firstName, user, logOut } = useAuth();
  const { notify } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isSignedIn) {
    return (
      <button className="btn btn--primary btn--sm account-btn" type="button" onClick={() => onOpenAuth('login')}>
        <User size={16} aria-hidden="true" />
        <span className="account-btn__text">Log in</span>
      </button>
    );
  }

  return (
    <div className="account" ref={wrap}>
      <button
        className="account__avatar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${firstName}`}
        onClick={() => setOpen((v) => !v)}
      >
        {initials}
      </button>

      {open && (
        <div className="account__menu" role="menu">
          <div className="account__who">
            <p className="account__name">{user.name}</p>
            <p className="account__email">{user.email}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/cart');
            }}
          >
            <ShoppingBag size={15} /> Your bag
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/wishlist');
            }}
          >
            <Heart size={15} /> Wishlist
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logOut();
              notify('Signed out');
            }}
          >
            <LogOut size={15} /> Sign out
          </button>

          <p className="account__note">Saved on this device only — no accounts server yet.</p>
        </div>
      )}
    </div>
  );
}
