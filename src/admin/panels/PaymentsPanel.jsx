import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, IndianRupee, RefreshCw, Settings, TriangleAlert, X } from 'lucide-react';

import {
  decidePayment,
  getPaymentProofUrl,
  getUpiConfig,
  listPayments,
  saveUpiConfig
} from '../../lib/adminPayments';
import { formatRupees } from '../../utils/currency';

/* Payments, checked by hand.

   This panel exists to make one act deliberate: somebody at the
   studio opening their banking app, finding the credit, and saying
   so. Nothing on this screen is evidence. The reference number was
   typed by a customer and the screenshot is an image anybody can
   make; both are here so the account can be searched, not so they can
   be believed.

   That is why "Verify" asks for the amount to be looked at and why a
   refusal asks for a reason. The reason is shown to the customer.  */

const STATUSES = [
  { id: 'submitted', label: 'Waiting' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'correction_requested', label: 'Correction asked' },
  { id: '', label: 'All' }
];

const LABEL = {
  submitted: 'Waiting',
  verified: 'Verified',
  rejected: 'Rejected',
  correction_requested: 'Correction asked'
};

const APPS = { gpay: 'Google Pay', phonepe: 'PhonePe', paytm: 'Paytm', other: 'Another app' };

const rupees = (paise) => formatRupees((Number(paise) || 0) / 100);
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');

export default function PaymentsPanel() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('submitted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPayments({ status: status || undefined });
      setRows(data.payments || []);
    } catch (err) {
      setError(err.message || 'Those payments could not be read');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Payments</h2>
          <p className="admin__hint">
            What customers say they have paid. Check each one against the studio's own account
            before verifying it — a reference number and a screenshot are claims, not proof.
          </p>
        </div>
        <div className="admin__panel-actions">
          <button type="button" className="admin__ghost" onClick={() => setShowSettings((v) => !v)}>
            <Settings size={15} /> UPI details
          </button>
          <button type="button" className="admin__ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {showSettings ? <UpiSettings /> : null}

      <div className="admin__row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s.id || 'all'} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="admin__error">{error}</p> : null}

      {loading ? (
        <p className="admin__hint">Reading the payments…</p>
      ) : rows.length === 0 ? (
        <div className="admin__empty">
          <IndianRupee size={22} aria-hidden="true" />
          <strong>Nothing to check</strong>
          <p>
            Payments a customer has told the studio about appear here, waiting to be compared with
            the account before they are verified.
          </p>
        </div>
      ) : (
        <div className="admin__stack">
          {rows.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} onDone={load} />
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentCard({ payment, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [proof, setProof] = useState('');

  const order = payment.order;
  const waiting = payment.status === 'submitted';

  /* The two numbers that have to agree. They can differ: the order's
     total may have been corrected after the customer paid, and the
     server refuses a verification when it has. */
  const mismatch = order && Number(order.total_paise) !== Number(payment.amount_paise);

  async function look() {
    setError('');
    setBusy('proof');
    try {
      setProof(await getPaymentProofUrl(payment.id));
    } catch (err) {
      setError(err.message || 'That screenshot could not be opened');
    } finally {
      setBusy('');
    }
  }

  async function decide(decision) {
    setError('');
    setBusy(decision);
    try {
      await decidePayment({ paymentId: payment.id, decision, note: note.trim() });
      onDone();
    } catch (err) {
      setError(err.message || 'That decision could not be recorded');
      setBusy('');
    }
  }

  return (
    <article className="admin__pay-card">
      <div className="admin__row admin__row--between">
        <div>
          <strong>{order?.order_code || 'order gone'}</strong>{' '}
          <span className="admin__badge">{LABEL[payment.status] || payment.status}</span>
          <br />
          <span className="admin__hint">
            {order?.customer_name} · {order?.customer_email}
          </span>
        </div>
        <div className="admin__amount">{rupees(payment.amount_paise)}</div>
      </div>

      <table className="admin__kv">
        <tbody>
          <tr>
            <th scope="row">Reference (UTR)</th>
            <td>
              <code>{payment.utr}</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Paid from</th>
            <td>{APPS[payment.method] || payment.method}</td>
          </tr>
          <tr>
            <th scope="row">Submitted</th>
            <td>{when(payment.created_at)}</td>
          </tr>
          <tr>
            <th scope="row">Order total now</th>
            <td>
              {order ? rupees(order.total_paise) : '—'}
              {mismatch ? (
                <>
                  {' '}
                  <span className="admin__error-inline">
                    <TriangleAlert size={13} /> does not match the payment
                  </span>
                </>
              ) : null}
            </td>
          </tr>
          {payment.customer_note ? (
            <tr>
              <th scope="row">Customer said</th>
              <td>{payment.customer_note}</td>
            </tr>
          ) : null}
          {payment.decided_by ? (
            <tr>
              <th scope="row">Decided</th>
              <td>
                {when(payment.decided_at)} by {payment.decided_by}
                {payment.decision_note ? <> — {payment.decision_note}</> : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="admin__row">
        <button type="button" className="admin__ghost" onClick={look} disabled={busy === 'proof'}>
          <Eye size={15} /> {busy === 'proof' ? 'Opening…' : 'Screenshot'}
        </button>
        {proof ? (
          <a className="admin__ghost" href={proof} target="_blank" rel="noopener noreferrer">
            Open in a new tab
          </a>
        ) : null}
      </div>

      {proof ? <img className="admin__proof" src={proof} alt="The payment screenshot as sent" /> : null}

      {waiting ? (
        <>
          <label htmlFor={`note-${payment.id}`}>
            Note to the customer (required to reject or ask for a correction)
          </label>
          <textarea
            id={`note-${payment.id}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="We could not find this reference in the account…"
          />

          {error ? <p className="admin__error">{error}</p> : null}

          <div className="admin__row">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => decide('verify')}
              disabled={Boolean(busy)}
            >
              <Check size={15} /> I have seen this in the account
            </button>
            <button
              type="button"
              className="admin__ghost"
              onClick={() => decide('correction')}
              disabled={Boolean(busy)}
            >
              Ask for a correction
            </button>
            <button
              type="button"
              className="admin__danger"
              onClick={() => decide('reject')}
              disabled={Boolean(busy)}
            >
              <X size={15} /> Reject
            </button>
          </div>

          <p className="admin__hint">
            Verifying marks the order paid. It is the only thing on this site that does, so do it
            after you have found the money, not after you have read the screenshot.
          </p>
        </>
      ) : error ? (
        <p className="admin__error">{error}</p>
      ) : null}
    </article>
  );
}

/* Where customers are told to send the money.

   Seeded empty and off by migration 0005, and it stays that way until
   somebody types a real UPI ID here. A wrong one sends a customer's
   money to a stranger, which is worse than a checkout that says
   payment is not available yet - so the server refuses to turn this
   on without both an address and the name the app will show. */
function UpiSettings() {
  const [upi, setUpi] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    getUpiConfig()
      .then((value) => live && setUpi(value))
      .catch((err) => live && setError(err.message || 'Those details could not be read'));
    return () => {
      live = false;
    };
  }, []);

  const set = (k) => (e) =>
    setUpi((u) => ({ ...u, [k]: k === 'enabled' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      setUpi(await saveUpiConfig(upi));
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Those details could not be saved');
    } finally {
      setSaving(false);
    }
  }

  if (!upi) {
    return <p className="admin__hint">{error || 'Reading the UPI details…'}</p>;
  }

  return (
    <form className="admin__pay-card" onSubmit={save}>
      <h3>Where customers pay</h3>

      <label htmlFor="upi-id">UPI ID</label>
      <input id="upi-id" value={upi.upi_id} onChange={set('upi_id')} placeholder="name@bank" autoComplete="off" />

      <label htmlFor="upi-name">The name UPI apps will show</label>
      <input id="upi-name" value={upi.display_name} onChange={set('display_name')} placeholder="WrappedStudio" />

      <label htmlFor="upi-qr">QR image (a file in /images/)</label>
      <input id="upi-qr" value={upi.qr_asset} onChange={set('qr_asset')} placeholder="/images/payments/upi-qr.png" />
      <p className="admin__hint">
        Save the QR your UPI app gives you into <code>public/images/payments/</code> and put its
        path here. Leave it empty and the page shows the UPI ID and the app button only.
      </p>

      <label className="admin__check" htmlFor="upi-on">
        <input id="upi-on" type="checkbox" checked={Boolean(upi.enabled)} onChange={set('enabled')} />
        Take payments with this UPI ID
      </label>
      <p className="admin__hint">
        While this is off, the payment page tells customers payment is not open yet and shows them
        no address at all.
      </p>

      {error ? <p className="admin__error">{error}</p> : null}
      {saved ? <p className="admin__hint">Saved.</p> : null}

      <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save these details'}
      </button>
    </form>
  );
}
