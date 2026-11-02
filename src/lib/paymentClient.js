import { callCustomerFunction } from './customerClient';

/* The shop's side of a manual UPI payment.

   Thin, like trackingClient: whether a reference number is plausible,
   whether this order may still be paid for, and what the amount is
   are all the server's business. What a customer types here is a
   claim, and the page it is typed on never pretends otherwise.

   The screenshot goes straight from the browser to the bucket on a
   URL the server signed for one key - exactly as a photograph does -
   so a payment proof never passes through an Edge Function.       */

export async function fetchPaymentContext(token) {
  return await callCustomerFunction('payments-config', token ? { token } : {});
}

async function putProof(url, file) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });
  if (!res.ok) throw new Error('That screenshot would not upload. Please try again.');
}

/* Three steps, in this order and only this order: ask for somewhere
   to put the screenshot, put it there, then tell the studio what was
   paid. The row is written last, after the server has checked the
   object is really in the bucket, so a payment can never be recorded
   pointing at a file that is not there. */
export async function submitPayment({ token, method, utr, note, file }) {
  const slot = await callCustomerFunction('payments-presign', {
    token,
    content_type: file.type,
    byte_size: file.size
  });

  await putProof(slot.url, file);

  const { payment } = await callCustomerFunction('payments-submit', {
    token,
    method,
    utr,
    note,
    proof_key: slot.proof_key,
    proof_content_type: file.type
  });

  return payment;
}

/* The deep link a UPI app answers.

   Everything in it is built here from values the server gave us. The
   amount is in rupees with two decimals because that is what the UPI
   specification asks for, and the note carries the order code so the
   studio can tell two identical transfers apart.

   On a phone this opens GPay, PhonePe, Paytm or whatever else is
   installed. On a desktop nothing happens, which is why the UPI ID
   and the QR code are both on the page as well. */
export function upiLink({ upiId, displayName, amountPaise, orderCode }) {
  const fields = [
    ['pa', upiId],
    ['pn', displayName || 'WrappedStudio'],
    ['am', (Number(amountPaise) / 100).toFixed(2)],
    ['cu', 'INR']
  ];
  if (orderCode) fields.push(['tn', `Order ${orderCode}`]);

  /* Percent-encoded by hand, not by URLSearchParams.

     URLSearchParams writes a space as `+`, which is correct for an
     HTML form and wrong here: a UPI app takes the query literally and
     does not turn `+` back into a space. The payee name and the note
     both contain spaces, so the phone showed "Order+WS-2026-0019" and
     would have shown "Wrapped+Studio" for a two-word name.
     encodeURIComponent writes %20, which every UPI app reads. */
  const query = fields
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

  return `upi://pay?${query}`;
}

export const PAYMENT_APPS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'Another app'
};
