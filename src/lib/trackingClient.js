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

/* The steps, and how a status reads against them. They live in
   orderProgress, which has no network in it; re-exported here so
   that every existing import of this module still works. */
export {
  TRACK_STEPS,
  OWN_EVENT,
  stepStateFor,
  entriesForStep
} from './orderProgress';
