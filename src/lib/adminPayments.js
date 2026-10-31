import { callFunction } from './supabaseClient';

/* The studio's own calls about payments.

   Every one goes through the administrator's client and is refused by
   the server unless the caller's token belongs to an address in the
   admins table - the same door the order calls use.

   Nothing here decides anything. Verifying a payment is a person
   opening their banking app and seeing the money; this is only how
   the panel says so afterwards.                                    */

export async function listPayments(params = {}) {
  return await callFunction('payments-admin', { action: 'list', ...params }, { asAdmin: true });
}

/* A URL for one screenshot, good for five minutes. Not cached: an
   expired URL is replaced by asking again. */
export async function getPaymentProofUrl(paymentId) {
  const { url } = await callFunction(
    'payments-admin',
    { action: 'proof', payment_id: paymentId },
    { asAdmin: true }
  );
  return url;
}

/* decision is 'verify', 'reject' or 'correction'.

   Only 'verify' moves the order, and the server refuses it when the
   order's total has changed since the customer submitted - the
   administrator is comparing a credit in an account against a number,
   and if the number has moved the two are not about the same thing. */
export async function decidePayment({ paymentId, decision, note }) {
  return await callFunction(
    'payments-admin',
    { action: 'decide', payment_id: paymentId, decision, note },
    { asAdmin: true }
  );
}

export async function getUpiConfig() {
  const { upi } = await callFunction('payments-admin', { action: 'config' }, { asAdmin: true });
  return upi;
}

export async function saveUpiConfig(upi) {
  const { upi: saved } = await callFunction(
    'payments-admin',
    { action: 'save_config', upi },
    { asAdmin: true }
  );
  return saved;
}
