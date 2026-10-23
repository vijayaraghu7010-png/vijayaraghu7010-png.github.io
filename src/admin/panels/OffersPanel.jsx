import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';

import { adminFetch } from '../../lib/supabaseClient';
import { discountOf, offerCovers } from '../../utils/offers';

const BLANK = {
  code: '',
  title: '',
  description: '',
  discountType: 'percent',
  value: 10,
  appliesTo: { scope: 'all' },
  minOrder: 0,
  maxDiscount: '',
  startsAt: '',
  endsAt: '',
  active: true,
  showBanner: false
};

const SCOPES = [
  { id: 'all', label: 'Everything' },
  { id: 'category', label: 'One category' },
  { id: 'product', label: 'One product' }
];

const localDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

const CATEGORY_LABELS = {
  magazine: 'Magazines',
  polaroid: 'Polaroids',
  bouquet: 'Bouquets',
  hamper: 'Hampers'
};

export default function OffersPanel() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [{ offers: rows }, { products: catalogue }] = await Promise.all([
        adminFetch('/api/admin/offers'),
        adminFetch('/api/admin/products')
      ]);
      setOffers(rows);
      setProducts(catalogue);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify(editing);
      if (editing.isNew) await adminFetch('/api/admin/offers', { method: 'POST', body });
      else await adminFetch(`/api/admin/offers?id=${editing.id}`, { method: 'PATCH', body });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(offer) {
    if (!window.confirm(`Delete ${offer.code || offer.title}?`)) return;
    try {
      await adminFetch(`/api/admin/offers?id=${offer.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const scope = editing?.appliesTo?.scope || 'all';
  const categories = [...new Set(products.map((p) => p.category))];

  /* the live sum, so nobody has to work out 15% of ₹550 in their head */
  const affected = editing
    ? products.filter((p) => offerCovers(editing, p) && discountOf(editing, p.price) > 0)
    : [];

  if (loading) return <p className="admin__hint">Loading offers…</p>;

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Offers &amp; discounts</h2>
          <p className="admin__hint">
            A code is entered at checkout. An offer with no code runs automatically while its dates are open.
          </p>
        </div>
        <button className="admin__btn" type="button" onClick={() => setEditing({ ...BLANK, isNew: true })}>
          <Plus size={16} /> New offer
        </button>
      </div>

      {error && <p className="admin__error">{error}</p>}

      <div className="admin__table">
        {offers.map((o) => (
          <article key={o.id} className="admin__row">
            <div className="admin__badge">{o.code || 'auto'}</div>
            <div className="admin__row-main">
              <strong>{o.title || o.code}</strong>
              <span>
                {o.discountType === 'percent' ? `${o.value}% off` : `₹${o.value} off`}
                {o.minOrder ? ` · over ₹${o.minOrder}` : ''}
                {o.appliesTo?.scope === 'category'
                  ? ` · ${CATEGORY_LABELS[o.appliesTo.value] || o.appliesTo.value} only`
                  : o.appliesTo?.scope === 'product'
                    ? ` · ${products.find((p) => p.slug === o.appliesTo.value)?.name || o.appliesTo.value} only`
                    : ' · everything'}
                {o.showBanner ? ' · in the top banner' : ''}
                {o.active ? '' : ' · paused'}
              </span>
            </div>
            <button type="button" className="admin__ghost" onClick={() => setEditing({ ...o })}>
              Edit
            </button>
            <button type="button" className="admin__ghost admin__ghost--danger" onClick={() => remove(o)}>
              <Trash2 size={15} />
            </button>
          </article>
        ))}
        {!offers.length && <p className="admin__hint">No offers yet.</p>}
      </div>

      {editing && (
        <div className="admin__drawer" role="dialog" aria-label="Edit offer">
          <form onSubmit={save}>
            <header>
              <h3>{editing.isNew ? 'New offer' : editing.title || editing.code}</h3>
              <button type="button" className="admin__ghost" onClick={() => setEditing(null)}>
                Close
              </button>
            </header>

            <label>Title</label>
            <input
              value={editing.title || ''}
              placeholder="Diwali week"
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />

            <label>Code (leave empty for an automatic offer)</label>
            <input
              value={editing.code || ''}
              placeholder="DIWALI10"
              onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
            />

            <div className="admin__pair">
              <div>
                <label>Discount type</label>
                <select
                  value={editing.discountType}
                  onChange={(e) => setEditing({ ...editing, discountType: e.target.value })}
                >
                  <option value="percent">percent</option>
                  <option value="flat">flat ₹</option>
                </select>
              </div>
              <div>
                <label>Value</label>
                <input
                  type="number"
                  min="0"
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="admin__pair">
              <div>
                <label>Applies to</label>
                <select
                  value={scope}
                  onChange={(e) =>
                    setEditing({ ...editing, appliesTo: { scope: e.target.value, value: '' } })
                  }
                >
                  {SCOPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>{scope === 'product' ? 'Which product' : 'Which category'}</label>
                {scope === 'all' ? (
                  <input value="Every product in the shop" disabled />
                ) : scope === 'category' ? (
                  <select
                    value={editing.appliesTo?.value || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, appliesTo: { scope, value: e.target.value } })
                    }
                  >
                    <option value="">Choose a category…</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c] || c} ({products.filter((p) => p.category === c).length})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={editing.appliesTo?.value || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, appliesTo: { scope, value: e.target.value } })
                    }
                  >
                    <option value="">Choose a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.name} — ₹{p.price}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="admin__pair">
              <div>
                <label>Minimum order (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={editing.minOrder}
                  onChange={(e) => setEditing({ ...editing, minOrder: Number(e.target.value) })}
                />
              </div>
              <div>
                <label>Maximum discount (₹, optional)</label>
                <input
                  type="number"
                  min="0"
                  value={editing.maxDiscount ?? ''}
                  onChange={(e) => setEditing({ ...editing, maxDiscount: e.target.value })}
                />
              </div>
            </div>

            <div className="admin__pair">
              <div>
                <label>Starts</label>
                <input
                  type="datetime-local"
                  value={localDate(editing.startsAt)}
                  onChange={(e) => setEditing({ ...editing, startsAt: e.target.value || null })}
                />
              </div>
              <div>
                <label>Ends</label>
                <input
                  type="datetime-local"
                  value={localDate(editing.endsAt)}
                  onChange={(e) => setEditing({ ...editing, endsAt: e.target.value || null })}
                />
              </div>
            </div>

            <div className="admin__calc">
              <h4>What customers will see</h4>
              {affected.length ? (
                <>
                  <ul>
                    {affected.slice(0, 4).map((p) => {
                      const off = discountOf(editing, p.price);
                      return (
                        <li key={p.id}>
                          <span>{p.name}</span>
                          <span>
                            <s>₹{p.price}</s> <b>₹{Math.round((p.price - off) * 100) / 100}</b>
                            <em>save ₹{Math.round(off * 100) / 100}</em>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="admin__hint">
                    {affected.length} product{affected.length > 1 ? 's' : ''} affected
                    {affected.length > 4 ? ' (first four shown)' : ''}.
                    {editing.code
                      ? ` Customers must enter ${editing.code} to get it.`
                      : ' This comes off by itself — no code needed.'}
                  </p>
                </>
              ) : (
                <p className="admin__hint">
                  Nothing is covered yet — choose what the offer applies to.
                </p>
              )}
            </div>

            <label>Description (shown to customers)</label>
            <textarea
              rows={2}
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />

            <div className="admin__checks">
              <label>
                <input
                  type="checkbox"
                  checked={editing.active !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(editing.showBanner)}
                  onChange={(e) => setEditing({ ...editing, showBanner: e.target.checked })}
                />
                Show as a banner on the shop
              </label>
            </div>

            {error && <p className="admin__error">{error}</p>}

            <button className="admin__btn" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save offer'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
