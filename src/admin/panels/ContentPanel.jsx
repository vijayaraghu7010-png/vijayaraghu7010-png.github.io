import { useEffect, useMemo, useState } from 'react';
import { Plus, Save } from 'lucide-react';

import { adminFetch } from '../../lib/supabaseClient';

/* Every sentence on the site that has been given a key can be edited
   here. Adding a key is possible too, for copy wired up later. */
export default function ContentPanel() {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState({ key: '', value: '', group: 'general', label: '' });

  async function load() {
    setLoading(true);
    try {
      const { content } = await adminFetch('/api/admin/content');
      setRows(content);
      setDraft({});
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

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matching = q
      ? rows.filter(
          (r) =>
            r.key.toLowerCase().includes(q) ||
            (r.label || '').toLowerCase().includes(q) ||
            (r.value || '').toLowerCase().includes(q)
        )
      : rows;
    return matching.reduce((acc, r) => {
      (acc[r.group_name] ||= []).push(r);
      return acc;
    }, {});
  }, [rows, filter]);

  const dirty = Object.keys(draft).length;

  async function saveAll() {
    setSaving(true);
    setError('');
    try {
      const { updated } = await adminFetch('/api/admin/content', {
        method: 'PATCH',
        body: JSON.stringify({ entries: draft })
      });
      setSaved(updated);
      await load();
      window.setTimeout(() => setSaved(0), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addKey(e) {
    e.preventDefault();
    try {
      await adminFetch('/api/admin/content', { method: 'POST', body: JSON.stringify(newKey) });
      setAdding(false);
      setNewKey({ key: '', value: '', group: 'general', label: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="admin__hint">Loading the site text…</p>;

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Site text</h2>
          <p className="admin__hint">
            {rows.length} editable strings. Changes go live as soon as they are saved.
          </p>
        </div>
        <div className="admin__panel-actions">
          <input
            className="admin__search"
            placeholder="Search text or key…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="admin__ghost" type="button" onClick={() => setAdding((a) => !a)}>
            <Plus size={15} /> New key
          </button>
          <button className="admin__btn" type="button" onClick={saveAll} disabled={!dirty || saving}>
            <Save size={16} /> {saving ? 'Saving…' : dirty ? `Save ${dirty} change${dirty > 1 ? 's' : ''}` : 'Saved'}
          </button>
        </div>
      </div>

      {error && <p className="admin__error">{error}</p>}
      {saved > 0 && <p className="admin__ok">{saved} string{saved > 1 ? 's' : ''} updated.</p>}

      {adding && (
        <form className="admin__inline-form" onSubmit={addKey}>
          <input
            placeholder="key (e.g. about.intro)"
            value={newKey.key}
            onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
            required
          />
          <input
            placeholder="group"
            value={newKey.group}
            onChange={(e) => setNewKey({ ...newKey, group: e.target.value })}
          />
          <input
            placeholder="value"
            value={newKey.value}
            onChange={(e) => setNewKey({ ...newKey, value: e.target.value })}
          />
          <button className="admin__btn" type="submit">
            Add
          </button>
        </form>
      )}

      {Object.entries(groups).map(([group, items]) => (
        <div className="admin__group" key={group}>
          <h3>{group}</h3>
          {items.map((r) => {
            const value = draft[r.key] !== undefined ? draft[r.key] : r.value;
            return (
              <div className="admin__field" key={r.key}>
                <label title={r.key}>{r.label || r.key}</label>
                {r.multiline ? (
                  <textarea
                    rows={2}
                    value={value}
                    onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })}
                  />
                ) : (
                  <input value={value} onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })} />
                )}
                <code>{r.key}</code>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
