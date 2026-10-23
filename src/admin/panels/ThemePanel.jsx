import { useEffect, useState } from 'react';
import { Check, Plus, Save, Trash2 } from 'lucide-react';

import { adminFetch } from '../../lib/supabaseClient';

/* The palette the shop wears, and the festival palettes waiting their
   turn. A festival theme can be given a window, and it takes over by
   itself while that window is open. */

const TOKEN_LABELS = {
  '--coral': 'Primary',
  '--coral-dark': 'Primary (pressed)',
  '--coral-soft': 'Primary wash',
  '--accent': 'Accent',
  '--orange': 'Accent (alt)',
  '--cream': 'Background',
  '--cream-2': 'Background (raised)',
  '--peach': 'Surface tint',
  '--peach-deep': 'Footer / strip',
  '--blush': 'Surface tint (deep)',
  '--ink': 'Text',
  '--ink-2': 'Text (secondary)',
  '--brown': 'Muted text',
  '--btn-text': 'Button text',
  '--line': 'Borders',
  '--line-2': 'Borders (strong)'
};

const localDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export default function ThemePanel() {
  const [themes, setThemes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { themes: rows } = await adminFetch('/api/admin/themes');
      setThemes(rows);
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

  async function activate(theme) {
    try {
      await adminFetch(`/api/admin/themes?activate=${theme.id}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify(editing);
      if (editing.isNew) await adminFetch('/api/admin/themes', { method: 'POST', body });
      else await adminFetch(`/api/admin/themes?id=${editing.id}`, { method: 'PATCH', body });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(theme) {
    if (!window.confirm(`Delete the ${theme.name} theme?`)) return;
    try {
      await adminFetch(`/api/admin/themes?id=${theme.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function startNew() {
    const base = themes.find((t) => t.isDefault) || themes[0];
    setEditing({
      isNew: true,
      name: 'New festival',
      kind: 'festival',
      tokens: { ...(base?.tokens || {}) },
      isActive: false,
      startsAt: '',
      endsAt: '',
      bannerText: ''
    });
  }

  if (loading) return <p className="admin__hint">Loading themes…</p>;

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Theme</h2>
          <p className="admin__hint">
            The live theme paints the whole shop. A festival theme with a date range switches itself on and off.
          </p>
        </div>
        <button className="admin__btn" type="button" onClick={startNew}>
          <Plus size={16} /> New theme
        </button>
      </div>

      {error && <p className="admin__error">{error}</p>}

      <div className="admin__themes">
        {themes.map((t) => (
          <article key={t.id} className={`admin__theme${t.isActive ? ' is-live' : ''}`}>
            <div className="admin__swatches">
              {['--coral', '--accent', '--cream', '--peach-deep', '--ink'].map((k) => (
                <span key={k} style={{ background: t.tokens?.[k] || '#eee' }} title={`${k}: ${t.tokens?.[k]}`} />
              ))}
            </div>
            <div className="admin__theme-main">
              <strong>
                {t.name} {t.isDefault && <em>default</em>}
              </strong>
              <span>
                {t.kind}
                {t.startsAt ? ` · from ${new Date(t.startsAt).toLocaleDateString()}` : ''}
                {t.endsAt ? ` to ${new Date(t.endsAt).toLocaleDateString()}` : ''}
              </span>
            </div>
            {t.isActive ? (
              <span className="admin__live">
                <Check size={14} /> live
              </span>
            ) : (
              <button type="button" className="admin__ghost" onClick={() => activate(t)}>
                Make live
              </button>
            )}
            <button type="button" className="admin__ghost" onClick={() => setEditing({ ...t })}>
              Edit
            </button>
            {!t.isDefault && (
              <button type="button" className="admin__ghost admin__ghost--danger" onClick={() => remove(t)}>
                <Trash2 size={15} />
              </button>
            )}
          </article>
        ))}
      </div>

      {editing && (
        <div className="admin__drawer" role="dialog" aria-label="Edit theme">
          <form onSubmit={save}>
            <header>
              <h3>{editing.isNew ? 'New theme' : editing.name}</h3>
              <button type="button" className="admin__ghost" onClick={() => setEditing(null)}>
                Close
              </button>
            </header>

            <label>Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />

            <div className="admin__pair">
              <div>
                <label>Kind</label>
                <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                  <option value="base">base</option>
                  <option value="festival">festival</option>
                  <option value="custom">custom</option>
                </select>
              </div>
              <div>
                <label>Banner text (optional)</label>
                <input
                  value={editing.bannerText || ''}
                  onChange={(e) => setEditing({ ...editing, bannerText: e.target.value })}
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

            <label className="admin__inline-check">
              <input
                type="checkbox"
                checked={Boolean(editing.isActive)}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              />
              Active
            </label>

            <h4>Colours</h4>
            <div className="admin__tokens">
              {Object.keys(TOKEN_LABELS).map((token) => (
                <div className="admin__token" key={token}>
                  <label>{TOKEN_LABELS[token]}</label>
                  <div>
                    <input
                      type="color"
                      value={editing.tokens?.[token] || '#000000'}
                      onChange={(e) =>
                        setEditing({ ...editing, tokens: { ...editing.tokens, [token]: e.target.value } })
                      }
                    />
                    <input
                      value={editing.tokens?.[token] || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, tokens: { ...editing.tokens, [token]: e.target.value } })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="admin__error">{error}</p>}

            <button className="admin__btn" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save theme'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
