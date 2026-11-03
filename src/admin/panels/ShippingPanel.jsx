import { useEffect, useState } from 'react';
import { Save, Truck } from 'lucide-react';

import { getShippingConfig, saveShippingConfig } from '../../lib/adminPayments';
import { formatRupees } from '../../utils/currency';

/* What the studio charges for delivery.

   The shop said "shipping charged separately" everywhere and settled
   it by message afterwards. Setting a figure here puts it on the bag,
   the checkout summary and the order's own total, and the server
   charges it when the order is placed - the browser is never asked
   what delivery costs, for the same reason it is never asked what
   anything else costs.

   Off until somebody turns it on. While it is off the shop behaves
   exactly as it always has, which is what makes this safe to deploy
   before the studio has decided on a number. */

const BLANK = { enabled: false, flatRupees: '', freeAboveRupees: '', note: '' };

/* The stored row speaks paise; the boxes speak rupees. Converting on
   the way in and out in one place keeps the two from drifting. */
function toForm(config) {
  return {
    enabled: Boolean(config?.enabled),
    flatRupees: config?.flat_paise ? String(config.flat_paise / 100) : '',
    freeAboveRupees: config?.free_above_paise ? String(config.free_above_paise / 100) : '',
    note: config?.note || ''
  };
}

export default function ShippingPanel() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    getShippingConfig()
      .then((value) => live && setForm(toForm(value)))
      .catch((err) => {
        if (!live) return;
        setError(err.message || 'That could not be read');
        setForm({ ...BLANK });
      });
    return () => {
      live = false;
    };
  }, []);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === 'enabled' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      setForm(toForm(await saveShippingConfig(form)));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'That could not be saved');
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p className="admin__hint">Reading the shipping charge…</p>;

  const flat = Number(form.flatRupees) || 0;
  const freeAbove = Number(form.freeAboveRupees) || 0;

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Shipping</h2>
          <p className="admin__hint">
            {form.enabled
              ? 'Every order pays this, and it is added to the total the customer is asked for.'
              : 'Off. The shop tells customers that delivery is arranged separately, as it does now.'}
          </p>
        </div>
      </div>

      <form className="admin__form" onSubmit={save}>
        <label htmlFor="ship-flat">Delivery charge (₹)</label>
        <input
          id="ship-flat"
          value={form.flatRupees}
          onChange={set('flatRupees')}
          inputMode="decimal"
          autoComplete="off"
          placeholder="60"
        />

        <label htmlFor="ship-free">Free delivery above (₹) — leave blank for none</label>
        <input
          id="ship-free"
          value={form.freeAboveRupees}
          onChange={set('freeAboveRupees')}
          inputMode="decimal"
          autoComplete="off"
          placeholder="999"
        />
        <p className="admin__hint">
          Measured against what the order comes to after any offer — the same figure the customer
          sees, so nobody is promised free delivery and then charged for it.
        </p>

        <label htmlFor="ship-note">A line to show under the charge (optional)</label>
        <input
          id="ship-note"
          value={form.note}
          onChange={set('note')}
          maxLength={300}
          placeholder="Delivered across India in 3–5 working days."
        />

        <label className="admin__check" htmlFor="ship-on">
          <input id="ship-on" type="checkbox" checked={form.enabled} onChange={set('enabled')} />
          <span>Charge for delivery</span>
        </label>

        {/* What this actually does to an order, in the words the
            customer will see. A charge is easy to mistype and hard to
            notice afterwards, so it is spelled out before saving. */}
        {flat > 0 && (
          <p className="admin__hint">
            {form.enabled ? 'Orders will be charged ' : 'Once switched on, orders will be charged '}
            <strong>{formatRupees(flat)}</strong>
            {freeAbove > 0 ? (
              <>
                {' '}
                for delivery, free on orders over <strong>{formatRupees(freeAbove)}</strong>.
              </>
            ) : (
              ' for delivery, on every order.'
            )}
          </p>
        )}

        {error && <p className="admin__error">{error}</p>}
        {saved && <p className="admin__hint">Saved.</p>}

        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? <Truck size={15} /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save shipping'}
        </button>
      </form>
    </section>
  );
}
