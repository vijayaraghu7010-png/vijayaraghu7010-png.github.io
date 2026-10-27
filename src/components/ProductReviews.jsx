import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';

import StarRating from './StarRating';
import { useSiteConfig } from '../context/SiteConfigContext';
import { ratingFor, reviewsFor, spreadOf } from '../utils/ratings';

/* What customers thought, and the form that lets the next one say so.

   The stars above the price are the average of exactly this list, so a
   review left here moves them immediately - on this page, on the card
   in every grid, and on everybody else's screen when the shop is being
   served by the demo server. */

const WHEN = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const lit = hover || value;

  return (
    <div className="rate__picker" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`rate__pick${n <= lit ? ' is-on' : ''}`}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={value === n}
        >
          <Star size={26} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ product }) {
  const { reviews, addReview } = useSiteConfig();

  const [score, setScore] = useState(0);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);

  const mine = useMemo(() => reviewsFor(product.id, reviews), [product.id, reviews]);
  const rating = ratingFor(product, reviews);
  const spread = spreadOf(mine);

  function submit(e) {
    e.preventDefault();
    setError('');
    try {
      addReview({ productId: product.id, rating: score, name, text });
      setScore(0);
      setName('');
      setText('');
      setThanks(true);
      window.setTimeout(() => setThanks(false), 4000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <h2 id="reviews-title">Ratings &amp; reviews</h2>

      <div className="reviews__summary">
        <div className="reviews__average">
          <strong>{rating.value ? rating.value.toFixed(1) : '—'}</strong>
          <StarRating value={rating.value} size={18} showValue={false} />
          <span>
            {mine.length
              ? `${mine.length} review${mine.length > 1 ? 's' : ''}`
              : 'No reviews yet — be the first'}
          </span>
        </div>

        {mine.length > 0 && (
          <ul className="reviews__spread">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = spread[n - 1];
              return (
                <li key={n}>
                  <span className="reviews__spread-n">{n}</span>
                  <span className="reviews__bar">
                    <span style={{ width: `${(count / mine.length) * 100}%` }} />
                  </span>
                  <span className="reviews__spread-c">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form className="rate" onSubmit={submit}>
        <p className="rate__ask">How many stars would you give it?</p>
        <StarPicker value={score} onChange={setScore} />

        <div className="rate__fields">
          <input
            placeholder="Your name (optional)"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            rows={2}
            placeholder="Anything you want to say about it (optional)"
            value={text}
            maxLength={600}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <button className="btn btn--primary" type="submit" disabled={!score}>
          Post review
        </button>

        {error && <p className="rate__error">{error}</p>}
        {thanks && <p className="rate__ok">Thank you — your review is up.</p>}
      </form>

      {mine.length > 0 && (
        <ul className="reviews__list">
          {mine.map((r) => (
            <li key={r.id}>
              <div className="reviews__head">
                <StarRating value={r.rating} size={13} showValue={false} />
                <strong>{r.name}</strong>
                <time dateTime={r.at}>{WHEN.format(new Date(r.at))}</time>
              </div>
              {r.text ? <p>{r.text}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
