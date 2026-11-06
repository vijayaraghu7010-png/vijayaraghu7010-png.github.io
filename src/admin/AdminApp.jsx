import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, IndianRupee, LogOut, Menu, Package, Palette, Percent, Star, Truck, Type, User } from 'lucide-react';

import { currentAdmin, restoreSession, signOut as endSession } from '../lib/adminAuth';
import AdminLogin from './AdminLogin';
import OrdersPanel from './panels/OrdersPanel';
import PaymentsPanel from './panels/PaymentsPanel';
import ProductsPanel from './panels/ProductsPanel';
import ContentPanel from './panels/ContentPanel';
import ThemePanel from './panels/ThemePanel';
import OffersPanel from './panels/OffersPanel';
import ReviewsPanel from './panels/ReviewsPanel';
import ShippingPanel from './panels/ShippingPanel';
import '../styles/admin.css';

const TABS = [
  { id: 'orders', label: 'Orders', icon: Package, panel: OrdersPanel },
  { id: 'payments', label: 'Payments', icon: IndianRupee, panel: PaymentsPanel },
  { id: 'products', label: 'Products', icon: Boxes, panel: ProductsPanel },
  { id: 'content', label: 'Text', icon: Type, panel: ContentPanel },
  { id: 'theme', label: 'Theme', icon: Palette, panel: ThemePanel },
  { id: 'offers', label: 'Offers', icon: Percent, panel: OffersPanel },
  { id: 'reviews', label: 'Reviews', icon: Star, panel: ReviewsPanel },
  { id: 'shipping', label: 'Shipping', icon: Truck, panel: ShippingPanel }
];

export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('orders');
  const [menuOpen, setMenuOpen] = useState(false);

  /* A session kept from last time is checked with the server before
     the panel is drawn: the token has to still be good, and the
     address has to still be on the studio's list. The cached answer
     is only what decides which screen to paint while that happens. */
  useEffect(() => {
    let live = true;
    setAdmin(currentAdmin());
    restoreSession()
      .then((who) => live && setAdmin(who))
      .catch(() => live && setAdmin(null))
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, []);

  async function signOut() {
    await endSession();
    setAdmin(null);
  }

  if (checking) return <div className="admin admin--center">Checking your session…</div>;

  if (!admin) return <AdminLogin onSignedIn={setAdmin} />;

  const Panel = TABS.find((t) => t.id === tab)?.panel || ProductsPanel;

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__bar-top">
          <button
            type="button"
            className="admin__menu"
            aria-label={menuOpen ? 'Hide the sections' : 'Show the sections'}
            aria-expanded={menuOpen ? 'true' : 'false'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu size={20} />
          </button>

          <div className="admin__brand">
            <img src="/images/logo.png" alt="" width="512" height="512" />
            <span className="admin__brand-chip">Studio Admin</span>
          </div>

          {/* The signed-in address, behind the avatar on a narrow
              screen where there is no room to print it. */}
          <details className="admin__who">
            <summary aria-label={`Signed in as ${admin.id}`}>
              <User size={18} />
            </summary>
            <div className="admin__who-menu">
              <p className="admin__who-email">{admin.id}</p>
              <Link className="admin__ghost" to="/">
                View shop
              </Link>
              <button type="button" className="admin__ghost" onClick={signOut}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </details>
        </div>

        {/* Every section as its own card, two rows of them, so the
            whole panel is one glance rather than a strip that
            scrolls sideways on a phone. */}
        <nav className={`admin__tabs${menuOpen ? ' is-open' : ''}`} aria-label="Sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`admin__tab${tab === id ? ' is-on' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                setMenuOpen(false);
              }}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="admin__main">
        <Panel />
      </main>
    </div>
  );
}
