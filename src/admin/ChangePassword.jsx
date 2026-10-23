import { useState } from 'react';
import { X } from 'lucide-react';

import { changePassword } from '../lib/adminAuth';

/* The password that opens the panel. Only its hash is kept, and only
   in this browser, so changing it here changes it on this machine. */
export default function ChangePassword({ id, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (next.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (next !== again) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('That is the password you already have.');
      return;
    }

    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="admin__drawer">
      <form onSubmit={submit}>
        <header>
          <h3>Change password</h3>
          <button type="button" className="admin__ghost" onClick={onClose}>
            <X size={15} /> Close
          </button>
        </header>

        <p className="admin__hint">Signed in as {id}.</p>

        {done ? (
          <>
            <p className="admin__ok">
              Password changed. Use the new one next time you sign in.
            </p>
            <button type="button" className="admin__btn" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <label htmlFor="pw-current">Current password</label>
            <input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />

            <label htmlFor="pw-next">New password</label>
            <input
              id="pw-next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />

            <label htmlFor="pw-again">New password again</label>
            <input
              id="pw-again"
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              required
            />

            <p className="admin__hint">
              At least 10 characters. It is kept as a hash in this browser
              only, so it has to be set again on another machine.
            </p>

            {error ? <p className="admin__error">{error}</p> : null}

            <button type="submit" className="admin__btn" disabled={busy}>
              {busy ? 'Changing…' : 'Change password'}
            </button>
          </>
        )}
      </form>
    </aside>
  );
}
