import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

import { signIn } from '../lib/adminAuth';
import { BACKEND_READY } from '../lib/supabaseClient';

/* The studio's own door. A customer signing in to the shop uses a
   different form entirely and never arrives here: a shop account buys
   things, this one reads orders and changes what is for sale. */
export default function AdminLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const admin = await signIn(email, password);
      onSignedIn?.(admin);
    } catch (err) {
      setError(err.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin admin--center">
      <div className="admin__card admin__card--gate">
        <img className="admin__logo" src="/images/logo.png" alt="" width="512" height="512" />
        <h1>Studio admin</h1>
        <p className="admin__hint">This is the staff entrance, not the shop login.</p>

        {!BACKEND_READY && (
          <p className="admin__error">
            No backend is configured for this build, so there is nobody to sign in. Set
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and reload.
          </p>
        )}

        <form onSubmit={submit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="admin__btn" type="submit" disabled={busy || !BACKEND_READY}>
            <LogIn size={16} />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {error ? <p className="admin__error">{error}</p> : null}
        </form>

        <Link className="admin__back" to="/">
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
