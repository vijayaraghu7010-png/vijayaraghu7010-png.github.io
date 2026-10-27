import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, LogOut, Palette, Percent, Star, Type } from 'lucide-react';

import { currentAdmin, signOut as endSession } from '../lib/adminAuth';
import AdminLogin from './AdminLogin';
import ProductsPanel from './panels/ProductsPanel';
import ContentPanel from './panels/ContentPanel';
import ThemePanel from './panels/ThemePanel';
import OffersPanel from './panels/OffersPanel';
import ReviewsPanel from './panels/ReviewsPanel';
import '../styles/admin.css';

const TABS = [
  { id: 'products', label: 'Products', icon: Boxes, panel: ProductsPanel },
  { id: 'content', label: 'Text', icon: Type, panel: ContentPanel },
  { id: 'theme', label: 'Theme', icon: Palette, panel: ThemePanel },
  { id: 'offers', label: 'Offers', icon: Percent, panel: OffersPanel },
  { id: 'reviews', label: 'Reviews', icon: Star, panel: ReviewsPanel }
];

export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('products');

  /* The session is a record in this browser, so the check is local
     and instant - no round trip, and nothing to be denied by. */
  useEffect(() => {
    setAdmin(currentAdmin());
    setChecking(false);
  }, []);

  function signOut() {
    endSession();
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
