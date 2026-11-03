import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Upload } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import { useCart } from '../context/CartContext';
import useBasketTotals from '../hooks/useBasketTotals';
import { createOrder, uploadPhotos } from '../lib/orderClient';
import { clearAllPhotos, getLinePhotos } from '../lib/photoStore';
import { CUSTOMER_BACKEND_READY as BACKEND_READY } from '../lib/customerClient';
import { formatRupees } from '../utils/currency';

/* Placing the order.

   Three things happen, in this order and only in this order: the
   order is made and priced by the server, the photographs go to the
   studio's storage, and the customer is told what the order is called.
   Payment is not here yet - that is the next phase - so an order
   leaves this page unpaid and the studio is the one who moves it on.

   The total shown on the way in is the basket's. The total shown on
   the way out is the server's, and if they differ it is the server's
   that stands and the customer is told so plainly.                 */

/* What the server calls each field, in words a customer recognises. */
const FIELD_LABEL = {
  name: 'your name',
  email: 'your email address',
  phone: 'your phone number',
  address: 'your address',
  city: 'the city',
  state: 'the state',
  pincode: 'the PIN code'
};

const BLANK = {
  name: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: ''
};

export default function Checkout() {
  usePageMeta('Checkout', 'Confirm your order with WrappedStudio.');

  const navigate = useNavigate();
  const { items, clear } = useCart();

  /* The same arithmetic as the bag and the drawer. What is actually
     charged is decided by the server when the order is placed, and
     that is the figure on the confirmation. */
  const { subtotal, savings, shippingConfig, shipping, shippingIsFree: freeShipping, payable } =
    useBasketTotals();

  const [form, setForm] = useState(BLANK);
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState('form');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [badFields, setBadFields] = useState([]);
  const [done, setDone] = useState(null);

  /* How many photographs are waiting, so the page can say what it is
     about to send before it sends it. */
  const [photoCount, setPhotoCount] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all(items.map((item) => getLinePhotos(item.key)))
      .then((lists) => live && setPhotoCount(lists.reduce((n, l) => n + l.length, 0)))
      .catch(() => live && setPhotoCount(0));
    return () => {
      live = false;
    };
  }, [items]);

  const expected = useMemo(
    () => items.reduce((n, item) => n + (Number(item.config?.photoCount) || 0), 0),
    [items]
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBadFields([]);
    setStage('placing');

    try {
      const order = await createOrder({
        customer: form,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          config: item.config || {}
        })),
        notes
      });

      /* Each basket line was given an id by the server. The
         photographs waiting under that line's key are sent against
         it, so every picture arrives attached to the thing it is for. */
      const files = [];
      for (const item of items) {
        const line = order.items.find(
          (i) => i.product_id === item.productId && i.position === items.indexOf(item)
        );
        if (!line) continue;
        const stored = await getLinePhotos(item.key);
        for (const file of stored) files.push({ file, orderItemId: line.id });
      }

      let uploaded = { uploaded: 0, failed: [] };
      if (files.length) {
        setStage('uploading');
        uploaded = await uploadPhotos({
          orderId: order.order_id,
          token: order.upload_token,
          files,
          onProgress: setProgress
        });
      }

      /* The basket and the copies of the photographs in this browser
         have done their job. Leaving them would put somebody's
         photographs on a shared computer for the next person. */
      await clearAllPhotos();
      clear?.();

      setDone({ order, uploaded });
      setStage('done');
    } catch (err) {
      /* The server says which fields it did not like. Outlining them
         is not enough on a long form: the button is at the bottom and
         the bad field is usually above the fold, so the message names
         them as well. */
      const bad = err.fields || [];
      setError(
        bad.length
          ? `Please check ${bad.map((f) => FIELD_LABEL[f] || f).join(', ')} — ` +
            'something there is missing or does not look right.'
          : err.message || 'That order could not be placed'
      );
      setBadFields(bad);
      setStage('form');
    }
  }

  if (stage === 'done' && done) {
    return (
      <div className="shell">
        <section className="section info-card">
          <h1>
            <Check size={22} /> Thank you — your order is with the studio
          </h1>
          <p>
            Your order is <strong>{done.order.order_code}</strong>. Please quote that if you write to
            us.
          </p>
          <p>
            Total <strong>{formatRupees(done.order.total_paise / 100)}</strong>. Pay by UPI on the
            next page and tell us the reference number; the studio checks it against the account
            before your order is confirmed.
          </p>
          <p>
            {done.uploaded.uploaded} photograph{done.uploaded.uploaded === 1 ? '' : 's'} received.
          </p>
          {done.uploaded.failed?.length ? (
            <p className="form-error">
              {done.uploaded.failed.length} would not upload. The studio will write to you about
              those rather than printing an incomplete order.
            </p>
          ) : null}
          {done.order.tracking_token ? (
            <p className="checkout__actions">
              <Link className="btn btn--primary" to={`/pay/${done.order.tracking_token}`}>
                Pay now <ArrowRight className="arrow" size={15} />
              </Link>
              <Link className="btn btn--ghost" to={`/track/${done.order.tracking_token}`}>
                Follow this order
              </Link>
            </p>
          ) : (
            /* No tracking token stored means no link we can honour, and
               the payment page is reached by the same token. Saying so
               is better than offering a button that cannot work. */
            <p className="form-note">
              We could not create your payment link. Please write to the studio quoting{' '}
              <strong>{done.order.order_code}</strong> and we will send you one.
            </p>
          )}

          <p className="admin__hint">
            Keep these links private — anybody who has one can see this order's progress and pay
            against it. You can also look the order up later with its code and your email address.
          </p>

          <Link className="btn btn--quiet btn--sm" to="/">
            Back to the shop
          </Link>
        </section>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="shell">
        <section className="section info-card">
          <h1>Your bag is empty</h1>
          <p>There is nothing to order yet.</p>
          <Link className="btn btn--primary" to="/">
            Have a look around <ArrowRight className="arrow" size={15} />
          </Link>
        </section>
      </div>
    );
  }

  const busy = stage === 'placing' || stage === 'uploading';

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Checkout</h1>
        <p>Where the order should go, and who to tell when it is ready.</p>
      </header>

      {!BACKEND_READY ? (
        <p className="form-error">
          This build has no backend configured, so orders cannot be placed. Set VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY.
        </p>
      ) : null}

      <div className="section two-col">
        <form className="info-card" onSubmit={submit} noValidate>
          <h3>Your details</h3>

          <Field id="name" label="Full name" value={form.name} onChange={set('name')} bad={badFields.includes('name')} autoComplete="name" required />
          <Field id="email" label="Email address" type="email" value={form.email} onChange={set('email')} bad={badFields.includes('email')} autoComplete="email" required />
          <Field id="phone" label="Phone number" type="tel" value={form.phone} onChange={set('phone')} bad={badFields.includes('phone')} autoComplete="tel" required />

          <h3>Delivery address</h3>
          <Field id="address_line1" label="Address" value={form.address_line1} onChange={set('address_line1')} bad={badFields.includes('address')} autoComplete="address-line1" required />
          <Field id="address_line2" label="Address line 2 (optional)" value={form.address_line2} onChange={set('address_line2')} autoComplete="address-line2" />
          <Field id="city" label="City" value={form.city} onChange={set('city')} bad={badFields.includes('city')} autoComplete="address-level2" required />
          <Field id="state" label="State" value={form.state} onChange={set('state')} bad={badFields.includes('state')} autoComplete="address-level1" required />
          <Field id="pincode" label="PIN code" value={form.pincode} onChange={set('pincode')} bad={badFields.includes('pincode')} autoComplete="postal-code" inputMode="numeric" required />

          <label htmlFor="notes">Anything we should know (optional)</label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="A date you need it by, how the names are spelled…"
          />

          {error ? <p className="form-error">{error}</p> : null}

          <button className="btn btn--primary" type="submit" disabled={busy || !BACKEND_READY}>
            {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            {stage === 'placing'
              ? 'Placing your order…'
              : stage === 'uploading'
                ? `Sending your photographs… ${Math.round(progress * 100)}%`
                : 'Place the order'}
          </button>

          {stage === 'uploading' ? (
            <p className="admin__hint">
              Please keep this page open until the photographs have finished.
            </p>
          ) : null}
        </form>

        <div className="info-card">
          <h3>Your order</h3>
          <table className="summary-table">
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <th scope="row">
                    {item.name}
                    <br />
                    <span className="admin__hint">× {item.quantity}</span>
                  </th>
                  <td>{formatRupees(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Subtotal</th>
                <td>{formatRupees(subtotal)}</td>
              </tr>
              <tr>
                <th scope="row">Photographs</th>
                <td>
                  {photoCount === null ? 'checking…' : photoCount}
                  {photoCount !== null && photoCount < expected ? (
                    <>
                      {' '}
                      <span className="form-error">of {expected} — some are missing</span>
                    </>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th scope="row">Shipping</th>
                <td>
                  {!shippingConfig.enabled
                    ? 'Confirmed separately before payment'
                    : freeShipping
                      ? 'Free'
                      : formatRupees(shipping)}
                </td>
              </tr>
              {savings > 0 && (
                <tr>
                  <th scope="row">Offer applied</th>
                  <td>− {formatRupees(savings)}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Total</th>
                <td>
                  <strong>{formatRupees(payable)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {photoCount !== null && photoCount < expected ? (
            <p className="form-error">
              Some photographs are no longer in this browser — clearing site data or a private window
              will do that. Add those items to your bag again before ordering.
            </p>
          ) : null}

          <p className="admin__hint">
            The studio prices every order itself when it is placed. If anything has changed since you
            added it, the price you see on the confirmation is the one that stands.
          </p>

          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/cart')}>
            Back to the bag
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, bad, ...rest }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={bad ? 'is-bad' : undefined} {...rest} />
    </>
  );
}
