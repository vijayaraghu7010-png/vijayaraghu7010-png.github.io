import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Clock, Copy, Loader2, Smartphone, TriangleAlert, Upload } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import { formatRupees } from '../utils/currency';
import { BRAND } from '../data/categories';
import {
  fetchPaymentContext,
  submitPayment,
  upiLink,
  PAYMENT_APPS
} from '../lib/paymentClient';

/* Paying for an order, by hand.

   There is no gateway. The customer transfers the money themselves in
   whichever UPI app they use, and then tells the studio the reference
   number their bank gave them and shows the success screen. Somebody
   at the studio opens their banking app and checks the money actually
   arrived; only then does the order become paid.

   This page is careful about one thing above all: nothing it shows
   after a submission says the order is paid. It says the payment is
   being checked, because that is what is true. A page that showed a
   green tick the moment a customer typed twelve digits would be
   teaching them that typing twelve digits is what paying means.

   The link that reaches here carries a tracking token - the same one
   the order's own page uses. It is kept in state and taken out of the
   address bar, because a URL gets copied into messages and this one
   speaks for somebody's order.                                     */

const BLANK = { method: '', utr: '', note: '' };

export default function Payment() {
  usePageMeta('Pay for your order', 'Complete your WrappedStudio order with UPI.');

  const { token: linkToken } = useParams();
  const [token, setToken] = useState(linkToken || '');

  const [context, setContext] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async (value) => {
    setLoading(true);
    setError('');
    try {
      setContext(await fetchPaymentContext(value));
    } catch (err) {
      setError(err.message || 'That payment link is not valid any more.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!linkToken) {
      setLoading(false);
      return;
    }
    setToken(linkToken);
    load(linkToken);
    try {
      window.history.replaceState(null, '', '/pay');
    } catch {
      /* a browser that will not rewrite history is not a reason to fail */
    }
  }, [linkToken, load]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please add the screenshot of your payment.');
      return;
    }

    setBusy(true);
    try {
      await submitPayment({
        token,
        method: form.method || 'other',
        utr: form.utr.trim(),
        note: form.note.trim(),
        file
      });
      setForm(BLANK);
      setFile(null);
      await load(token);
    } catch (err) {
      setError(err.message || 'That payment could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(context.upi.upi_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard access is refused in plenty of ordinary situations.
         The address is on the page in full, so there is nothing to
         recover from - the customer can select it themselves. */
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <section className="section info-card">
          <p>
            <Loader2 size={16} className="spin" /> Fetching your order…
          </p>
        </section>
      </div>
    );
  }

  if (!token || !context?.order) {
    return (
      <div className="shell">
        <section className="section info-card">
          <h1>This payment link is not valid</h1>
          <p>
            {error ||
              'Payment links come from your order confirmation. Open the one you were given, or look your order up and we will take you there.'}
          </p>
          <Link className="btn btn--primary btn--sm" to="/track">
            Find my order
          </Link>
        </section>
      </div>
    );
  }

  const { order, upi, payment } = context;
  const paid = order.payment_status === 'paid' || order.status === 'paid';
  const waiting = payment?.status === 'submitted';
  const refused = payment?.status === 'rejected' || payment?.status === 'correction_requested';

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Pay for {order.order_code}</h1>
        <p>
          {formatRupees(order.amount_paise / 100)} — by UPI, to the studio directly.
        </p>
      </header>

      <div className="section two-col">
        <div className="stack">
          {/* ---------------------------------------- where things stand */}
          {paid ? (
            <section className="info-card pay-state pay-state--good">
              <h3>
                <Check size={18} /> Payment confirmed
              </h3>
              <p>
                The studio has checked this payment against the account and your order is confirmed.
                Nothing more is needed from you.
              </p>
              <Link className="btn btn--primary btn--sm" to="/track">
                Follow this order
              </Link>
            </section>
          ) : waiting ? (
            <section className="info-card pay-state pay-state--waiting">
              <h3>
                <Clock size={18} /> We are checking your payment
              </h3>
              <p>
                You told us about a payment of {formatRupees(payment.amount_paise / 100)} with
                reference <strong>{payment.utr}</strong>. Somebody at the studio is comparing that
                with the account now.
              </p>
              <p className="admin__hint">
                Your order is not confirmed yet. We will not send anything to print until the money
                has actually arrived — that check is a person looking, not a rule, so it can take a
                few hours.
              </p>
            </section>
          ) : refused ? (
            <section className="info-card pay-state pay-state--bad">
              <h3>
                <TriangleAlert size={18} /> That payment could not be confirmed
              </h3>
              {payment.note ? <p>{payment.note}</p> : null}
              <p className="admin__hint">
                Nothing has been taken from you by us. If the money did leave your account, check
                with your bank using reference {payment.utr} before paying again.
              </p>
            </section>
          ) : null}

          {/* ------------------------------------------- how to pay */}
          {!paid && !waiting ? (
            upi.enabled ? (
              <section className="info-card pay-how">
                <h3>1. Send {formatRupees(order.amount_paise / 100)}</h3>

                <div className="pay-upi">
                  <span className="pay-upi__label">UPI ID</span>
                  <code className="pay-upi__id">{upi.upi_id}</code>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={copyUpiId}>
                    <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {upi.display_name ? (
                  /* The name here is whatever the bank has against the
                     account, which is not always the shop's name - a
                     small studio often starts on a personal UPI ID. A
                     customer who expects one name and sees another
                     assumes they are being defrauded, so the page says
                     the real name first and explains it, rather than
                     printing the brand and hoping nobody notices. */
                  <p className="admin__hint">
                    Your app will show <strong>{upi.display_name}</strong> — that is
                    {' '}{BRAND.name}&rsquo;s own account. If it shows any other name, stop and
                    write to us before sending anything.
                  </p>
                ) : null}

                {upi.qr_asset ? (
                  <img
                    className="pay-qr"
                    src={upi.qr_asset}
                    alt={`UPI QR code for ${upi.display_name || 'WrappedStudio'}`}
                    width="220"
                    height="220"
                  />
                ) : null}

                <a
                  className="btn btn--primary"
                  href={upiLink({
                    upiId: upi.upi_id,
                    displayName: upi.display_name,
                    amountPaise: order.amount_paise,
                    orderCode: order.order_code
                  })}
                >
                  <Smartphone size={15} /> Open my UPI app
                </a>

                <p className="admin__hint">
                  On a phone that opens {(upi.apps || []).map((a) => PAYMENT_APPS[a] || a).join(', ')}{' '}
                  or whichever app you use, with the amount already filled in. On a computer, scan
                  the code or type the UPI ID into your phone.
                </p>
              </section>
            ) : (
              <section className="info-card">
                <h3>Payment is not open yet</h3>
                <p>
                  The studio has not switched on UPI payment for the site. Your order is safe and
                  nothing has been lost — we will write to you to arrange payment.
                </p>
              </section>
            )
          ) : null}
        </div>

        {/* --------------------------------------------- telling us */}
        {!paid && !waiting && upi.enabled ? (
          <form className="info-card" onSubmit={submit} noValidate>
            <h3>2. Tell us about it</h3>
            <p className="admin__hint">
              After paying, your app shows a reference number — twelve digits, often called the UTR
              or transaction ID. That and the success screen are what let us find your payment in
              the account.
            </p>

            <label htmlFor="pay-method">Which app did you pay from?</label>
            <select id="pay-method" value={form.method} onChange={set('method')} required>
              <option value="">Choose…</option>
              {(upi.apps || []).map((app) => (
                <option key={app} value={app}>
                  {PAYMENT_APPS[app] || app}
                </option>
              ))}
              <option value="other">{PAYMENT_APPS.other}</option>
            </select>

            <label htmlFor="pay-utr">UPI reference number (UTR)</label>
            <input
              id="pay-utr"
              value={form.utr}
              onChange={set('utr')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={40}
              placeholder="123456789012"
              required
            />

            <label htmlFor="pay-proof">Screenshot of the payment</label>
            <input
              id="pay-proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            {file ? (
              <p className="admin__hint">
                {file.name} — {(file.size / 1048576).toFixed(1)} MB
              </p>
            ) : null}

            <label htmlFor="pay-note">Anything we should know (optional)</label>
            <textarea
              id="pay-note"
              rows={2}
              value={form.note}
              maxLength={500}
              onChange={set('note')}
              placeholder="Paid from a different number, sent in two parts…"
            />

            {error ? <p className="form-error">{error}</p> : null}

            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
              {busy ? 'Sending…' : 'Submit payment details'}
            </button>

            <p className="admin__hint">
              This tells the studio what to look for. It does not confirm the order on its own —
              somebody checks the account first.
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
