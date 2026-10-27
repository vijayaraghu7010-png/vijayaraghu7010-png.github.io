import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

import { ADMIN_ID, signIn } from '../lib/adminAuth';

/* The studio's own door. A customer signing in to the shop uses a
   different form entirely and never arrives here: a shop account buys
   things, this one changes what is for sale. */
export default function AdminLogin({ onSignedIn }) {
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const admin = await signIn(id);
      onSignedIn?.(admin);
    } catch (err) {
      setError(err.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin admin--center">
      <div className="admin__card">
        <img className="admin__logo" src="/images/logo.png" alt="" width="512" height="512" />
        <h1>Studio admin</h1>
        <p className="admin__hint">This is the staff entrance, not the shop login.</p>

        <form onSubmit={submit}>
          <label htmlFor="admin-id">Administrator ID</label>
          <input
            id="admin-id"
            type="text"
            autoComplete="username"
            required
            placeholder={ADMIN_ID}
            value={id}
            onChange={(e) => setId(e.target.value)}
          />

          <button className="admin__btn" type="submit" disabled={busy}>
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
