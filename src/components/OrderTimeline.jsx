import { Check, CircleDot, X } from 'lucide-react';

import { TRACK_STEPS, stepStateFor } from '../lib/trackingClient';

/* Where an order has got to.

   Four steps, because the shop has four states an order moves
   through, and a fifth that stops it. Nothing here invents a stage
   the studio does not actually record: an order is not "shipped"
   until somebody can mark it shipped, and nobody can.

   It shows a status and a date and nothing else - no address, no
   photographs, no prices. */

export default function OrderTimeline({ order }) {
  if (!order) return null;
  const cancelled = order.status === 'cancelled';

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
          /* The first step is 'pending', but the event recorded when an
             order is made is order.created - no order.pending is ever
             written. Without this the "Order placed" step was the one
             step that never showed its date. */
          const eventName = step.id === 'pending' ? 'order.created' : `order.${step.id}`;
          const reached = order.timeline?.find((t) => t.event === eventName);
          return (
            <li key={step.id} className={`track-step track-step--${state}`}>
              <span className="track-step__mark" aria-hidden="true">
                {state === 'done' ? <Check size={14} /> : state === 'current' ? <CircleDot size={14} /> : null}
              </span>
              <div className="track-step__body">
                <p className="track-step__label">{step.label}</p>
                {state !== 'future' && !cancelled && <p className="track-step__hint">{step.hint}</p>}
                {reached && (
                  <p className="track-step__at">
                    {new Date(reached.at).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
