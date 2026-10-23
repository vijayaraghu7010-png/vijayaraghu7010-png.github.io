import { useEffect, useState } from 'react';
import { ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';

import { adminFetch, adminUpload } from '../../lib/supabaseClient';

const BLANK = {
  name: '',
  slug: '',
  category: 'bouquet',
  categoryLabel: 'Bouquet',
  price: 0,
  priceMode: 'fixed',
  unitLabel: '',
  image: '',
  alt: '',
  shortDescription: '',
  description: '',
  details: [],
  occasions: [],
  keywords: [],
  gallery: [],
  featured: false,
  published: true
};

const CATEGORIES = ['magazine', 'polaroid', 'bouquet', 'hamper'];

const list = (v) => (Array.isArray(v) ? v.join('\n') : '');
const unlist = (v) =>
  String(v || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export default function ProductsPanel() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { products: rows } = await adminFetch('/api/admin/products');
      setProducts(rows);
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
      if (editing.isNew) {
        await adminFetch('/api/admin/products', { method: 'POST', body });
      } else {
        await adminFetch(`/api/admin/products?id=${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          body
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(product) {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    try {
      await adminFetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  /* A picture has to live on the site to show up on it, so the chosen
     file is sent to the server and the product keeps the URL it gives
     back. Typing a path from your own computer can never work. */
  async function pickImage(e, field = 'image') {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await adminUpload(file);
      setEditing((cur) =>
        field === 'gallery' ? { ...cur, gallery: [...(cur.gallery || []), url] } : { ...cur, image: url }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="admin__hint">Loading the catalogue…</p>;

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Products</h2>
          <p className="admin__hint">{products.length} in the catalogue. Unpublished ones stay hidden from the shop.</p>
        </div>
        <button className="admin__btn" type="button" onClick={() => setEditing({ ...BLANK, isNew: true })}>
          <Plus size={16} /> New product
        </button>
      </div>

      {error && <p className="admin__error">{error}</p>}

      <div className="admin__table">
        {products.map((p) => (
          <article key={p.id} className="admin__row">
            <img src={p.image || '/images/logo.png'} alt="" loading="lazy" />
            <div className="admin__row-main">
              <strong>{p.name}</strong>
              <span>
                {p.categoryLabel || p.category} · ₹{p.price}
                {p.unitLabel ? ` ${p.unitLabel}` : ''}
                {p.featured ? ' · featured' : ''}
                {p.published === false ? ' · draft' : ''}
              </span>
            </div>
            <button type="button" className="admin__ghost" onClick={() => setEditing({ ...p })}>
              Edit
            </button>
            <button type="button" className="admin__ghost admin__ghost--danger" onClick={() => remove(p)}>
              <Trash2 size={15} />
            </button>
          </article>
        ))}
      </div>

      {editing && (
        <div className="admin__drawer" role="dialog" aria-label="Edit product">
          <form onSubmit={save}>
            <header>
              <h3>{editing.isNew ? 'New product' : editing.name}</h3>
              <button type="button" className="admin__ghost" onClick={() => setEditing(null)}>
                <X size={16} />
              </button>
            </header>

            <label>Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />

            <div className="admin__pair">
              <div>
                <label>Category</label>
                <select
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      category: e.target.value,
                      categoryLabel: e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)
                    })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="admin__pair">
              <div>
                <label>Price mode</label>
                <select
                  value={editing.priceMode}
                  onChange={(e) => setEditing({ ...editing, priceMode: e.target.value })}
                >
                  <option value="fixed">fixed</option>
                  <option value="per-unit">per-unit</option>
                </select>
              </div>
              <div>
                <label>Unit label</label>
                <input
                  value={editing.unitLabel || ''}
                  placeholder="each / per set"
                  onChange={(e) => setEditing({ ...editing, unitLabel: e.target.value })}
                />
              </div>
            </div>

            <label>Picture</label>
            <div className="admin__upload">
              {editing.image ? (
                <img src={editing.image} alt="" className="admin__preview" />
              ) : (
                <span className="admin__preview admin__preview--empty">no picture</span>
              )}
              <div>
                <label className="admin__ghost admin__file">
                  <ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Choose a picture'}
                  <input type="file" accept="image/*" onChange={pickImage} disabled={uploading} hidden />
                </label>
                <input
                  value={editing.image || ''}
                  placeholder="/images/example.jpg or https://…"
                  onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                />
                <p className="admin__hint">
                  Pick a file from this computer, or paste a web address. A path from your own
                  disk will not show, because the shop cannot read it.
                </p>
              </div>
            </div>

            <label>Extra pictures</label>
            <div className="admin__gallery">
              {(editing.gallery || []).map((src) => (
                <span key={src}>
                  <img src={src} alt="" />
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ ...editing, gallery: editing.gallery.filter((g) => g !== src) })
                    }
                    aria-label="Remove this picture"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              <label className="admin__ghost admin__file">
                <Plus size={14} /> Add
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickImage(e, 'gallery')}
                  disabled={uploading}
                  hidden
                />
              </label>
            </div>

            <label>Image description (alt text)</label>
            <input value={editing.alt || ''} onChange={(e) => setEditing({ ...editing, alt: e.target.value })} />

            <label>Short description</label>
            <input
              value={editing.shortDescription || ''}
              onChange={(e) => setEditing({ ...editing, shortDescription: e.target.value })}
            />

            <label>Full description</label>
            <textarea
              rows={4}
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />

            <label>Details (one per line)</label>
            <textarea
              rows={3}
              value={list(editing.details)}
              onChange={(e) => setEditing({ ...editing, details: unlist(e.target.value) })}
            />

            <div className="admin__pair">
              <div>
                <label>Occasions (one per line)</label>
                <textarea
                  rows={3}
                  value={list(editing.occasions)}
                  onChange={(e) => setEditing({ ...editing, occasions: unlist(e.target.value) })}
                />
              </div>
              <div>
                <label>Search keywords (one per line)</label>
                <textarea
                  rows={3}
                  value={list(editing.keywords)}
                  onChange={(e) => setEditing({ ...editing, keywords: unlist(e.target.value) })}
                />
              </div>
            </div>

            <div className="admin__checks">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(editing.featured)}
                  onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                />
                Featured
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editing.published !== false}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                />
                Published
              </label>
            </div>

            {error && <p className="admin__error">{error}</p>}

            <button className="admin__btn" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save product'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
