import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import StarRating from '../../components/StarRating';
import { adminFetch } from '../../lib/adminClient';

/* Everything customers have said, newest first.

   Nothing here writes a review - the shop does that. The one thing
   the panel can do is take one down, which matters because there are
   no accounts and so no way to stop somebody leaving a silly one. */

const WHEN = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

export default function ReviewsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { reviews } = await adminFetch('/api/admin/reviews');
      setRows(reviews);
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

  async function remove(r) {
    try {
      await adminFetch(`/api/admin/reviews?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <p className="admin__hint">Loading the reviews…</p>;

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Reviews</h2>
          <p className="admin__hint">
            {rows.length
              ? `${rows.length} left by customers. The stars on every card are the average of these.`
              : 'Nobody has left one yet. The stars show the rating set on each product until somebody does.'}
          </p>
        </div>
      </div>

      {error && <p className="admin__error">{error}</p>}

      {rows.map((r) => (
        <div className="admin__row" key={r.id}>
          <div className="admin__row-main">
            <strong>{r.productName}</strong>
            <div className="admin__review-line">
              <StarRating value={r.rating} size={12} showValue={false} />
              <span>{r.name}</span>
              <time dateTime={r.at}>{WHEN.format(new Date(r.at))}</time>
            </div>
            {r.text ? <p className="admin__review-text">{r.text}</p> : null}
          </div>
          <button
            className="admin__ghost admin__ghost--danger"
            type="button"
            onClick={() => remove(r)}
            title="Take this review down"
          >
            <Trash2 size={15} /> Remove
          </button>
        </div>
      ))}
    </section>
  );
}
