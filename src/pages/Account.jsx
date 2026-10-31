import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, LogOut, PackageOpen } from 'lucide-react';

import OrderTimeline from '../components/OrderTimeline';
import usePageMeta from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';
import { claimOrder, fetchMyOrders, requestTrackingCode } from '../lib/trackingClient';

/* The customer's own orders.

   Only the ones linked to this account appear, and the linking is
   done by the server from the session - never from anything typed
   here. An order placed as a guest, before there was an account, is
   not linked to anybody: it can be added below, but only by proving
   the address the same way a guest proves it.

   Everything on this page is a status and a date. There are no
   photographs here, and no way to reach one.                       */

const PAGE = 20;

export default function Account() {
  usePageMeta('Your account', 'Your WrappedStudio orders.');

  const { user, isSignedIn, ready, firstName, logOut } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(null);

  const [claim, setClaim] = useState({ step: 'idle', orderCode: '', code: '', busy: false, error: '', note: '' });

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMyOrders({ limit: PAGE, offset });
      setOrders((prev) => (offset === 0 ? res.orders : [...prev, ...res.orders]));
      setMore(Boolean(res.has_more));
    } catch (err) {
      setError(err.message || 'Those could not be loaded just now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && isSignedIn) load(0);
    else if (ready) setLoading(false);
  }, [ready, isSignedIn, load]);

  if (!ready) {
    return (
      <div className="shell">
        <div className="section info-card">
          <p className="admin__hint"><Loader2 size={15} className="spin" /> One moment…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="shell">
        <header className="page-head"><h1>Your account</h1></header>
        <div className="section info-card">
          <p>Please log in to see your orders.</p>
          <p className="admin__hint">
            Ordered without an account? You can still <Link to="/track">track that order</Link>.
          </p>
        </div>
      </div>
    );
  }

  async function sendClaimCode(e) {
    e.preventDefault();
    setClaim((c) => ({ ...c, busy: true, error: '', note: '' }));
    try {
      const res = await requestTrackingCode({ orderCode: claim.orderCode.trim(), email: user.email });
      if (res?.delivery === 'unavailable') {
        setClaim((c) => ({
          ...c, busy: false,
          error: 'Email is not set up on this site yet, so we cannot send the code. Please contact the studio.'
        }));
        return;
      }
      setClaim((c) => ({ ...c, busy: false, step: 'code', note: res?.message || 'If that order matches your address, a code is on its way.' }));
    } catch (err) {
      setClaim((c) => ({ ...c, busy: false, error: err.message || 'That could not be sent.' }));
    }
  }

  async function finishClaim(e) {
    e.preventDefault();
    setClaim((c) => ({ ...c, busy: true, error: '' }));
    try {
      await claimOrder({ orderCode: claim.orderCode.trim(), code: claim.code.trim() });
      setClaim({ step: 'idle', orderCode: '', code: '', busy: false, error: '', note: '' });
      await load(0);
    } catch (err) {
      setClaim((c) => ({ ...c, busy: false, error: err.message || 'That code is not right, or it has expired.' }));
    }
  }

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Hello{firstName ? `, ${firstName}` : ''}</h1>
        <p>{user.email}</p>
      </header>

      <div className="section">
        <section className="info-card">
          <h2>Your orders</h2>

          {loading && orders.length === 0 && (
            <p className="admin__hint"><Loader2 size={15} className="spin" /> Loading your orders…</p>
          )}

          {error && <p className="form-error">{error}</p>}

          {!loading && !error && orders.length === 0 && (
            <div className="empty">
              <span className="empty__icon"><PackageOpen size={24} /></span>
              <p>No orders here yet.</p>
              <p className="admin__hint">
                Ordered as a guest? Add it to this account below, or just{' '}
                <Link to="/track">track it</Link>.
              </p>
            </div>
          )}

          {orders.length > 0 && (
            <ul className="account-orders">
              {orders.map((o) => (
                <li key={o.order_code} className="account-order">
                  <div className="account-order__head">
                    <div>
                      <p className="account-order__code">{o.order_code}</p>
                      <p className="admin__hint">
                        {new Date(o.placed_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                        {o.items?.length ? ` · ${o.items.map((i) => `${i.product_name} × ${i.quantity}`).join(', ')}` : ''}
                      </p>
                    </div>
                    <span className="admin__badge">{o.status_label}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => setOpen(open === o.order_code ? null : o.order_code)}
                  >
                    {open === o.order_code ? 'Hide progress' : 'Show progress'}
                  </button>

                  {open === o.order_code && <OrderTimeline order={o} />}
                </li>
              ))}
            </ul>
          )}

          {more && (
            <button className="btn btn--ghost btn--sm" type="button" disabled={loading} onClick={() => load(orders.length)}>
              {loading ? 'Loading…' : 'Show older orders'}
            </button>
          )}
        </section>

        <section className="info-card">
          <h2>Add an earlier order</h2>
          {claim.step === 'idle' ? (
            <form className="track-form" onSubmit={sendClaimCode} noValidate>
              <p className="admin__hint">
                Ordered before you had an account? We will send a code to <strong>{user.email}</strong>{' '}
                to check the order is yours.
              </p>
              <label htmlFor="claim-code">Order code</label>
              <input id="claim-code" value={claim.orderCode} autoComplete="off" placeholder="WS-2026-0001"
                onChange={(e) => setClaim((c) => ({ ...c, orderCode: e.target.value }))} required />
              {claim.error && <p className="form-error">{claim.error}</p>}
              <button className="btn btn--primary btn--sm" type="submit" disabled={claim.busy || !claim.orderCode.trim()}>
                {claim.busy ? 'Sending…' : 'Send me a code'}
              </button>
            </form>
          ) : (
            <form className="track-form" onSubmit={finishClaim} noValidate>
              {claim.note && <p className="form-note">{claim.note}</p>}
              <label htmlFor="claim-otp">The six-digit code</label>
              <input id="claim-otp" value={claim.code} inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                onChange={(e) => setClaim((c) => ({ ...c, code: e.target.value }))} required />
              {claim.error && <p className="form-error">{claim.error}</p>}
              <div className="admin__row">
                <button className="btn btn--primary btn--sm" type="submit" disabled={claim.busy}>
                  {claim.busy ? 'Checking…' : 'Add this order'}
                </button>
                <button className="btn btn--quiet btn--sm" type="button" disabled={claim.busy}
                  onClick={() => setClaim({ step: 'idle', orderCode: '', code: '', busy: false, error: '', note: '' })}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <button className="btn btn--quiet btn--sm" type="button" onClick={logOut}>
          <LogOut size={15} /> Log out
        </button>
      </div>
    </div>
  );
}
