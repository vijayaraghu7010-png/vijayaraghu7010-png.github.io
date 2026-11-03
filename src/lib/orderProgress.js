/* How an order's progress is read, with nothing attached.

   This is the display half of tracking: the steps, where a status
   sits on them, and which history entries belong under which step.
   It is kept apart from trackingClient because that module reaches
   the network, and reaching the network drags in the Supabase client
   and `import.meta.env` - neither of which a test of this logic
   should need, and which cannot be loaded outside Vite at all.

   Nothing here fetches anything. trackingClient re-exports it, so
   every existing import still works. */

/* The line a customer is walked along, and where they are on it.

   These are the shop's five statuses and no others. cancelled is not
   a step, so an order that was cancelled shows the steps it reached
   and then stops - inventing "shipped" here would be telling the
   customer something the studio never recorded. */
export const TRACK_STEPS = [
  { id: 'pending', label: 'Order placed', hint: 'We have your order and your photographs.' },
  { id: 'paid', label: 'Payment received', hint: 'Payment confirmed with the studio.' },
  { id: 'in_progress', label: 'Being made', hint: 'Your order is being printed and put together.' },
  { id: 'completed', label: 'Completed', hint: 'Finished and on its way to you.' }
];

export function stepStateFor(status, stepId) {
  if (status === 'cancelled') return 'cancelled';
  const order = TRACK_STEPS.map((s) => s.id);
  const at = order.indexOf(status);
  const here = order.indexOf(stepId);
  if (at < 0 || here < 0) return 'future';
  if (here < at) return 'done';
  if (here === at) return 'current';
  return 'future';
}

/* Which timeline entries belong under which step.

   The four steps are order statuses, but the timeline also carries
   what happened to a payment - submitted, needing correction,
   refused. None of those is a status and none ever becomes one: the
   order sits at 'pending' through all of them. A timeline keyed only
   on `order.${step}` found no match for any of them and dropped them
   silently, so a customer who had sent their payment details saw no
   sign the studio had them, and one whose payment was refused saw no
   sign anything had gone wrong.

   They belong to the payment, so they are shown under the payment
   step, in the order they happened. */
const EVENTS_FOR = {
  pending: ['order.created'],
  paid: ['payment.submitted', 'payment.correction_requested', 'payment.rejected', 'order.paid'],
  in_progress: ['order.in_progress'],
  completed: ['order.completed']
};

/* The event that IS the step, as opposed to one that merely happens
   underneath it. */
export const OWN_EVENT = {
  pending: 'order.created',
  paid: 'order.paid',
  in_progress: 'order.in_progress',
  completed: 'order.completed'
};

export function entriesForStep(stepId, timeline = []) {
  const wanted = EVENTS_FOR[stepId] || [];
  return (timeline || []).filter((t) => wanted.includes(t.event));
}
