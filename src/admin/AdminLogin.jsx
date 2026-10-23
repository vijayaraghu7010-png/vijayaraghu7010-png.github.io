import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

import { supabase, localMode, localSignIn } from '../lib/supabaseClient';

/* A short list of addresses administers this shop, each with its own
   password. Sign-in used to be a mailed link, but the project's mail
   allowance runs out after a couple of sends an hour, which locked the
   owner out of her own panel. The server checks the address again on
   every request either way, so nothing is weaker for the change. */
export default function AdminLogin({ denied, onSignOut, onLocalSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function send(e) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      /* local mode: the same pair of fields, checked by the SQLite
         backend instead of Supabase */
      if (localMode) {
        const who = await localSignIn(email.trim(), password);
        onLocalSignIn?.(who);
        return;
      }

      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (err) throw err;
      /* AdminApp is listening for the session and swaps this screen out */
    } catch (err) {
      setError(err.message || 'Could not sign in');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin admin--center">
      <div className="admin__card">
        <img className="admin__logo" src="/images/logo.png" alt="" width="512" height="512" />
        <h1>Studio admin</h1>

        {denied ? (
          <>
            <p className="admin__error">
              {/database/i.test(denied)
                ? denied
                : `${denied} is signed in, but it is not an administrator of this shop.`}
            </p>
            {onSignOut && (
              <button type="button" className="admin__btn" onClick={onSignOut}>
                Sign in as someone else
              </button>
            )}
          </>
        ) : (
          <form onSubmit={send}>
            <label htmlFor="admin-email">Administrator email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
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

            <button className="admin__btn" type="submit" disabled={sending}>
              <LogIn size={16} />
              {sending ? 'Signing in…' : 'Sign in'}
            </button>

            {localMode && (
              <p className="admin__hint">
                Running on the local database. Supabase takes over as soon as its keys are set.
              </p>
            )}
            {error && <p className="admin__error">{error}</p>}
          </form>
        )}

        <Link className="admin__back" to="/">
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
