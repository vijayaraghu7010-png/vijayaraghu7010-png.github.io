import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, IndianRupee, LogOut, Package, Palette, Percent, Star, Type } from 'lucide-react';

import { currentAdmin, restoreSession, signOut as endSession } from '../lib/adminAuth';
import AdminLogin from './AdminLogin';
import OrdersPanel from './panels/OrdersPanel';
import PaymentsPanel from './panels/PaymentsPanel';
import ProductsPanel from './panels/ProductsPanel';
import ContentPanel from './panels/ContentPanel';
import ThemePanel from './panels/ThemePanel';
import OffersPanel from './panels/OffersPanel';
import ReviewsPanel from './panels/ReviewsPanel';
import '../styles/admin.css';

const TABS = [
  { id: 'orders', label: 'Orders', icon: Package, panel: OrdersPanel },
  { id: 'payments', label: 'Payments', icon: IndianRupee, panel: PaymentsPanel },
  { id: 'products', label: 'Products', icon: Boxes, panel: ProductsPanel },
  { id: 'content', label: 'Text', icon: Type, panel: ContentPanel },
  { id: 'theme', label: 'Theme', icon: Palette, panel: ThemePanel },
  { id: 'offers', label: 'Offers', icon: Percent, panel: OffersPanel },
  { id: 'reviews', label: 'Reviews', icon: Star, panel: ReviewsPanel }
];

export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('orders');

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
        <div className="admin__brand">
          <img src="/images/logo.png" alt="" width="512" height="512" />
          <div>
            <strong>Studio admin</strong>
            <span>{admin.id}</span>
          </div>
        </div>

        <nav className="admin__tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`admin__tab${tab === id ? ' is-on' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="admin__bar-actions">
          <Link className="admin__ghost" to="/">
            View shop
          </Link>
          <button type="button" className="admin__ghost" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="admin__main">
        <Panel />
      </main>
    </div>
  );
}
