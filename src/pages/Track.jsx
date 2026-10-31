import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, IndianRupee, Loader2, Search } from 'lucide-react';

import OrderTimeline from '../components/OrderTimeline';
import usePageMeta from '../hooks/usePageMeta';
import { fetchTrackedOrder, requestTrackingCode, verifyTrackingCode } from '../lib/trackingClient';

/* Following an order without an account.

   Two ways in. A link that was sent to the customer carries a token,
   and that is the whole of it - no typing. Otherwise the customer
   gives their order code and the address they used, and a short code
   goes to that address; the code proves the address is theirs, which
   the order code alone never could.

   The token in a link is taken out of the address bar as soon as it
   has been used. A URL is copied, pasted, and sent to support; a
   tracking token is not supposed to travel that way, and the page
   that has already spent it has no reason to go on showing it. */

const STEP = { ASK: 'ask', CODE: 'code', SHOWING: 'showing' };

export default function Track() {
  usePageMeta('Track your order', 'See where your WrappedStudio order has got to.');

  const { token: linkToken } = useParams();

  const [step, setStep] = useState(STEP.ASK);
  const [form, setForm] = useState({ orderCode: '', email: '', code: '' });
  const [order, setOrder] = useState(null);

  /* The token this page is working with, kept here rather than in the
     address bar. The payment page is reached with the same token, so
     it has to survive the URL being rewritten. */
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openWithToken = useCallback(async (token) => {
    setBusy(true);
    setError('');
    try {
      const found = await fetchTrackedOrder(token);
      setOrder(found);
      setToken(token);
      setStep(STEP.SHOWING);
    } catch (err) {
      setError(err.message || 'That tracking link is not valid any more.');
      setStep(STEP.ASK);
    } finally {
      setBusy(false);
    }
  }, []);

  /* A token arrived in the link. Use it, then take it out of the URL
     so it is not sitting in the address bar, the history entry or any
     referrer this page later sends. */
  useEffect(() => {
    if (!linkToken) return;
    openWithToken(linkToken);
    try {
      window.history.replaceState(null, '', '/track');
    } catch {
      /* a browser that will not rewrite history is not a reason to fail */
    }
  }, [linkToken, openWithToken]);

  async function askForCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await requestTrackingCode({
        orderCode: form.orderCode.trim(),
        email: form.email.trim()
      });
      /* Only say a message was sent if this shop can actually send
         one. With no provider configured the honest thing is to say
         so, rather than leave somebody watching an inbox. */
      if (res?.delivery === 'unavailable') {
        setError(
          'Email is not set up on this site yet, so we cannot send the code. ' +
            'Please contact the studio with your order code and we will help.'
        );
        return;
      }
      setNote(res?.message || 'If that order and address match, a code is on its way.');
      setStep(STEP.CODE);
    } catch (err) {
      setError(err.message || 'That could not be sent. Please try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await verifyTrackingCode({
        orderCode: form.orderCode.trim(),
        email: form.email.trim(),
        code: form.code.trim()
      });
      await openWithToken(token);
    } catch (err) {
      setError(err.message || 'That code is not right, or it has expired.');
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Track your order</h1>
        <p>Your order code is on your confirmation — it looks like WS-2026-0001.</p>
      </header>

      <div className="section track-layout">
        {step === STEP.SHOWING && order ? (
          <section className="info-card track-card">
            <h2 className="track-card__code">{order.order_code}</h2>
            <p className="admin__hint">
              Placed{' '}
              {new Date(order.placed_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>

            {order.items?.length > 0 && (
              <ul className="track-items">
                {order.items.map((item, i) => (
                  <li key={`${item.product_name}-${i}`}>
                    {item.product_name} <span className="admin__hint">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}

            <OrderTimeline order={order} />

            {/* Still to pay, and we have the token that gets there. An
                order that was cancelled is not offered a payment page. */}
            {order.payment_status !== 'paid' && order.status === 'pending' && token ? (
              <p className="track-pay">
                <Link className="btn btn--primary btn--sm" to={`/pay/${token}`}>
                  <IndianRupee size={14} /> Pay for this order
                </Link>
              </p>
            ) : null}

            <p className="form-note">
              Questions about this order? Write to us quoting <strong>{order.order_code}</strong>.
            </p>
          </section>
        ) : (
          <section className="info-card track-card">
            {step === STEP.ASK ? (
              <form className="track-form" onSubmit={askForCode} noValidate>
                <h2>Find your order</h2>
                <label htmlFor="track-code">Order code</label>
                <input
                  id="track-code"
                  value={form.orderCode}
                  onChange={set('orderCode')}
                  placeholder="WS-2026-0001"
                  autoComplete="off"
                  required
                />

                <label htmlFor="track-email">The email address you used</label>
                <input
                  id="track-email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  required
                />

                {error && <p className="form-error">{error}</p>}

                <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
                  {busy ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
                  {busy ? 'One moment…' : 'Send me a code'}
                </button>

                <p className="admin__hint">
                  We send a short code to that address and ask you to type it back. It keeps your
                  order private even though order codes run in sequence.
                </p>
              </form>
            ) : (
              <form className="track-form" onSubmit={submitCode} noValidate>
                <h2>Enter your code</h2>
                {note && <p className="form-note">{note}</p>}

                <label htmlFor="track-otp">The six-digit code</label>
                <input
                  id="track-otp"
                  value={form.code}
                  onChange={set('code')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />

                {error && <p className="form-error">{error}</p>}

                <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
                  {busy ? <Loader2 size={15} className="spin" /> : null}
                  {busy ? 'Checking…' : 'Show my order'}
                  {!busy && <ArrowRight className="arrow" size={15} />}
                </button>

                <button
                  className="btn btn--quiet btn--block btn--sm"
                  type="button"
                  disabled={busy}
                  onClick={() => { setStep(STEP.ASK); setError(''); setForm((f) => ({ ...f, code: '' })); }}
                >
                  Use a different order code
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
