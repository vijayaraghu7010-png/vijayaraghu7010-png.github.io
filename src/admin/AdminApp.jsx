import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, KeyRound, LogOut, Palette, Percent, RefreshCw, Type } from 'lucide-react';

import {
  supabase,
  supabaseConfigured,
  adminFetch,
  localMode,
  localToken,
  setLocalToken,
  canChangePassword,
  prefetchAdmin,
  clearAdminCache
} from '../lib/supabaseClient';
import AdminLogin from './AdminLogin';
import ChangePassword from './ChangePassword';
import { onSiteChange } from '../lib/liveUpdates';
import ProductsPanel from './panels/ProductsPanel';
import ContentPanel from './panels/ContentPanel';
import ThemePanel from './panels/ThemePanel';
import OffersPanel from './panels/OffersPanel';
import '../styles/admin.css';

const TABS = [
  { id: 'products', label: 'Products', icon: Boxes, panel: ProductsPanel },
  { id: 'content', label: 'Text', icon: Type, panel: ContentPanel },
  { id: 'theme', label: 'Theme', icon: Palette, panel: ThemePanel },
  { id: 'offers', label: 'Offers', icon: Percent, panel: OffersPanel }
];

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [denied, setDenied] = useState('');
  const [tab, setTab] = useState('products');
  const [busting, setBusting] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  /* Local mode keeps its own token; there is no Supabase session. */
  useEffect(() => {
    if (!localMode) return;
    if (!localToken()) {
      setChecking(false);
      return;
    }
    adminFetch('/api/admin/session')
      .then((r) => setAdmin(r.admin))
      .catch(() => setLocalToken(''))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setChecking(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  /* A session only proves who signed in. The server decides whether
     that address may administer anything. */
  useEffect(() => {
    if (localMode) return;
    if (!session) {
      setAdmin(null);
      return;
    }
    adminFetch('/api/admin/session')
      .then((r) => {
        setAdmin(r.admin);
        setDenied('');
      })
      .catch((err) => {
        setAdmin(null);
        setDenied(
          /database/i.test(err.message) ? err.message : session.user?.email || 'this account'
        );
      });
  }, [session]);

  /* Once we know who they are, fetch all four tabs at once rather than
     waiting for each to be opened. And when another device changes
     something, drop what we are holding so the next look is current. */
  useEffect(() => {
    if (!admin) return undefined;
    prefetchAdmin();
    return onSiteChange(() => {
      clearAdminCache();
      prefetchAdmin();
    });
  }, [admin]);

  async function signOut() {
    if (localMode) setLocalToken('');
    else await supabase.auth.signOut();
    clearAdminCache();
    setSession(null);
    setAdmin(null);
  }

  async function clearCache() {
    setBusting(true);
    try {
      clearAdminCache();
      await adminFetch('/api/admin/session', { method: 'POST' });
      prefetchAdmin();
    } finally {
      setBusting(false);
    }
  }

  if (checking) return <div className="admin admin--center">Checking your session…</div>;

  if (!admin) {
    return (
      <AdminLogin
        denied={denied}
        onSignOut={session ? signOut : null}
        onLocalSignIn={(who) => setAdmin(who)}
      />
    );
  }

  const Panel = TABS.find((t) => t.id === tab)?.panel || ProductsPanel;

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">
          <img src="/images/logo.png" alt="" width="512" height="512" />
          <div>
            <strong>Studio admin</strong>
            <span>{admin.email}</span>
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
          <button type="button" className="admin__ghost" onClick={clearCache} disabled={busting}>
            <RefreshCw size={15} /> {busting ? 'Clearing…' : 'Clear cache'}
          </button>
          {canChangePassword ? (
            <button
              type="button"
              className="admin__ghost"
              onClick={() => setPasswordOpen(true)}
            >
              <KeyRound size={15} /> Password
            </button>
          ) : null}
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

      {passwordOpen ? (
        <ChangePassword email={admin.email} onClose={() => setPasswordOpen(false)} />
      ) : null}
    </div>
  );
}
