import { Check, CircleDot, X } from 'lucide-react';

import { OWN_EVENT, TRACK_STEPS, entriesForStep, stepStateFor } from '../lib/orderProgress';

/* Where an order has got to.

   Four steps, because the shop has four states an order moves
   through, and a fifth that stops it. Nothing here invents a stage
   the studio does not actually record: an order is not "shipped"
   until somebody can mark it shipped, and nobody can.

   It shows a status and a date and nothing else - no address, no
   photographs, no prices. */

const WHEN = (at) =>
  new Date(at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

export default function OrderTimeline({ order }) {
  if (!order) return null;
  const cancelled = order.status === 'cancelled';
  const timeline = order.timeline || [];

  return (
    <div className="track-timeline">
      {cancelled && (
        <p className="track-timeline__cancelled">
          <X size={15} aria-hidden="true" /> This order was cancelled.
        </p>
      )}

      <ol className="track-steps" aria-label="Order progress">
        {TRACK_STEPS.map((step) => {
          const state = stepStateFor(order.status, step.id);
          const entries = entriesForStep(step.id, timeline);
          const bare = entries.length === 1 && entries[0].event === OWN_EVENT[step.id];

          return (
            <li key={step.id} className={`track-step track-step--${state}`}>
              <span className="track-step__mark" aria-hidden="true">
                {state === 'done' ? <Check size={14} /> : state === 'current' ? <CircleDot size={14} /> : null}
              </span>
              <div className="track-step__body">
                <p className="track-step__label">{step.label}</p>
                {state !== 'future' && !cancelled && <p className="track-step__hint">{step.hint}</p>}
                {entries.map((entry) => (
                  <p className="track-step__at" key={`${entry.event}-${entry.at}`}>
                    {bare ? WHEN(entry.at) : `${entry.label} — ${WHEN(entry.at)}`}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
