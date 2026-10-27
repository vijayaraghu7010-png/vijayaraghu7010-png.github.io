/* The gold four-pointed star, drawn rather than loaded.

   The picture it is copied from is a 112px glitter PNG, which would be
   a smear at the 13px a rating line wants. As a path it stays sharp at
   any size, takes the gradient with it, and costs no request.

   A half star is the same path clipped partway across, so 4.5 reads
   as four and a half rather than being rounded to something the shop
   did not earn. */

import { useId } from 'react';

export default function StarRating({ value = 0, count, size = 14, showValue = true }) {
  /* gradient and clip ids must be unique per instance: a grid of cards
     puts many of these on one page, and duplicates would cross-wire.
     useId keeps the same id across re-renders, so nothing flickers. */
  const uid = useId().replace(/:/g, '');

  const score = Math.max(0, Math.min(5, Number(value) || 0));
  if (!score) return null;

  return (
    <div
      className="stars"
      aria-label={`Rated ${score} out of 5${count ? ` from ${count} review${count > 1 ? 's' : ''}` : ''}`}
    >
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F8DD85" />
            <stop offset="42%" stopColor="#E9B527" />
            <stop offset="100%" stopColor="#B87C07" />
          </linearGradient>
        </defs>
      </svg>

      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, score - i));
        return (
          <svg
            key={i}
            className="stars__star"
            width={size}
            height={size}
            viewBox="0 0 100 100"
            aria-hidden="true"
            focusable="false"
          >
            {fill > 0 && fill < 1 ? (
              <clipPath id={`${uid}-clip-${i}`}>
                <rect x="0" y="0" width={fill * 100} height="100" />
              </clipPath>
            ) : null}
            <path
              className="stars__empty"
              d="M50 0C54 30 70 46 100 50C70 54 54 70 50 100C46 70 30 54 0 50C30 46 46 30 50 0Z"
            />
            {fill > 0 ? (
              <path
                d="M50 0C54 30 70 46 100 50C70 54 54 70 50 100C46 70 30 54 0 50C30 46 46 30 50 0Z"
                fill={`url(#${uid}-gold)`}
                clipPath={fill < 1 ? `url(#${uid}-clip-${i})` : undefined}
              />
            ) : null}
          </svg>
        );
      })}

      {showValue && (
        <span className="stars__score">
          {score.toFixed(1)}
          {count ? <span className="stars__count"> ({count})</span> : null}
        </span>
      )}
    </div>
  );
}
