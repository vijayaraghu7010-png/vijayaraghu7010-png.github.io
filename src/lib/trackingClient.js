import { callCustomerFunction } from './customerClient';

/* The shop's side of tracking. Thin on purpose: every decision that
   matters - whether a code is right, whose order this is, how often
   somebody may ask - is made by the server, because a decision made
   here could be made differently by anyone with a developer console.

   Nothing is cached. A tracking token is good for an hour and an
   order's status changes while the studio works; a stale answer
   kept in a module would be worse than a round trip. */

export async function requestTrackingCode({ orderCode, email }) {
  return await callCustomerFunction('track-request-code', {
    order_code: orderCode,
    email
  });
}

export async function verifyTrackingCode({ orderCode, email, code }) {
  return await callCustomerFunction('track-verify-code', {
    order_code: orderCode,
    email,
    code
  });
}

export async function fetchTrackedOrder(token) {
  const { order } = await callCustomerFunction('track-order', { token });
  return order;
}

export async function fetchMyOrders({ limit = 20, offset = 0 } = {}) {
  return await callCustomerFunction('customer-orders', { limit, offset });
}

export async function fetchMyOrder(orderCode) {
  const { order } = await callCustomerFunction('customer-orders', { order_code: orderCode });
  return order;
}

export async function claimOrder({ orderCode, code }) {
  return await callCustomerFunction('customer-claim-order', {
    order_code: orderCode,
    code
  });
}

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
