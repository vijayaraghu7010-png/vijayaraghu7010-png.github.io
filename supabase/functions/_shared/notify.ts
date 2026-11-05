/* Sending the shop's post, without letting it break the shop.

   Every function here is called after the thing that matters has
   already happened and been written down: the order exists, the
   status has moved, the payment has been judged. The post is the last
   step and the least important one, so nothing it does may fail the
   request that triggered it. All of these swallow their own failures
   and leave a line in the log.

   The log line names the order and whether it went. Never the
   address, never the subject, never the body - the same rule the
   email boundary keeps. */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { hashToken, newToken } from './common.ts';
import {
  orderPlacedMessage,
  orderStatusMessage,
  paymentMessage,
  paymentSubmittedMessage,
  sendEmail,
  studioAlertMessage,
  studioPaymentAlertMessage,
  studioPhotosMessage,
  type OrderLine
} from './email.ts';

/* Where a customer goes to watch their order. The domain is settable
   because it has already moved once. */
function siteUrl(): string {
  return (Deno.env.get('SITE_URL') || 'https://wrappedstudio.in').replace(/\/$/, '');
}

/* The tracking page, not a tracking token. A confirmation goes to the
   address on the order, so it could carry a private link - but that
   would mean minting a long-lived token for every order whether or
   not anybody ever follows it. The page plus the order code in the
   same message is enough to get there. */
const trackUrl = () => `${siteUrl()}/track`;

/* Who at the studio hears about a new order. Settable, with the two
   addresses the shop actually uses as the default, so this works
   before anybody sets anything. */
function studioAddresses(): string[] {
  const configured = Deno.env.get('STUDIO_EMAILS');
  const raw = configured || 'wrapped.studio07@gmail.com,roshinip.0931@gmail.com';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function note(what: string, orderCode: string, ok: boolean, reason?: string) {
  if (ok) {
    console.log(`[mail] ${what} for ${orderCode}: sent`);
  } else {
    console.warn(`[mail] ${what} for ${orderCode}: not sent - ${reason ?? 'no reason given'}`);
  }
}

/* A new order: the customer is told what they bought, and the studio
   is told there is something to make.

   The studio's copies go one at a time rather than as one message
   with two recipients, so that neither of them can see the other's
   address in the header and so one bouncing does not take the other
   with it. */
export async function notifyOrderPlaced(order: {
  id: string;
  order_code: string;
  customer_name: string;
  customer_email: string;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise?: number;
  total_paise: number;
  lines: OrderLine[];
}): Promise<void> {
  try {
    const customer = await sendEmail(
      orderPlacedMessage(
        order.customer_email,
        order.order_code,
        order.lines,
        {
          subtotal_paise: order.subtotal_paise,
          discount_paise: order.discount_paise,
          shipping_paise: order.shipping_paise ?? 0,
          total_paise: order.total_paise
        },
        trackUrl(),
        `placed:${order.id}`
      )
    );
    note('confirmation', order.order_code, customer.delivered, customer.reason);

    for (const to of studioAddresses()) {
      const studio = await sendEmail(
        studioAlertMessage(
          to,
          order.order_code,
          order.customer_name,
          order.lines,
          order.total_paise,
          /* Keyed per recipient, or the second would be treated as a
             repeat of the first and never arrive. */
          `studio:${order.id}:${to}`
        )
      );
      note('studio alert', order.order_code, studio.delivered, studio.reason);
    }
  } catch (e) {
    console.warn(`[mail] confirmation for ${order.order_code} threw: ${(e as Error).message}`);
  }
}

/* An order has moved along. Some statuses have no words written for
   them, and those are not announced at all. */
export async function notifyStatusChange(order: {
  id: string;
  order_code: string;
  customer_email: string;
  status: string;
}): Promise<void> {
  try {
    const message = orderStatusMessage(
      order.customer_email,
      order.order_code,
      order.status,
      trackUrl(),
      `status:${order.id}:${order.status}`
    );
    if (!message) return;

    const out = await sendEmail(message);
    note(`status ${order.status}`, order.order_code, out.delivered, out.reason);
  } catch (e) {
    console.warn(`[mail] status for ${order.order_code} threw: ${(e as Error).message}`);
  }
}

/* A payment has just been submitted and is waiting to be judged.

   This is the moment the shop used to say nothing at all: the customer
   paid, the row was written, and both sides were left guessing. The
   studio's copy is the one that matters most - a manual UPI order does
   not move until somebody opens the panel and confirms it, so nobody
   being told is the same as the order stopping.

   Keyed on the payment rather than the order: a customer who submits a
   corrected payment after a rejection is submitting a new payment, and
   should be told about that one too. */
export async function notifyPaymentSubmitted(order: {
  id: string;
  order_code: string;
  customer_email: string;
  method: string;
  amount_paise: number;
  paymentId: string;
}): Promise<void> {
  try {
    const customer = await sendEmail(
      paymentSubmittedMessage(
        order.customer_email,
        order.order_code,
        trackUrl(),
        `payment-submitted:${order.paymentId}`
      )
    );
    note('payment submitted', order.order_code, customer.delivered, customer.reason);

    for (const to of studioAddresses()) {
      const studio = await sendEmail(
        studioPaymentAlertMessage(
          to,
          order.order_code,
          order.method,
          order.amount_paise,
          /* Keyed per recipient, or the second would be treated as a
             repeat of the first and never arrive. */
          `studio-payment:${order.paymentId}:${to}`
        )
      );
      note('studio payment alert', order.order_code, studio.delivered, studio.reason);
    }
  } catch (e) {
    console.warn(
      `[mail] payment submitted for ${order.order_code} threw: ${(e as Error).message}`
    );
  }
}

/* A manual payment has been judged. */
export async function notifyPaymentOutcome(order: {
  id: string;
  order_code: string;
  customer_email: string;
  outcome: 'confirmed' | 'rejected' | 'correction';
  paymentId: string;
}): Promise<void> {
  try {
    const out = await sendEmail(
      paymentMessage(
        order.customer_email,
        order.order_code,
        order.outcome,
        trackUrl(),
        `payment:${order.paymentId}:${order.outcome}`
      )
    );
    note(`payment ${order.outcome}`, order.order_code, out.delivered, out.reason);
  } catch (e) {
    console.warn(`[mail] payment for ${order.order_code} threw: ${(e as Error).message}`);
  }
}

/* A customer's photographs have arrived; tell the people who print.

   The link is minted here rather than in the function that takes the
   upload, so the only thing that ever holds the plain token is the
   mail. What goes in the table is its hash.

   Keyed on the order, so a customer uploading in three batches gets
   the studio one message rather than three. The link always fetches
   whatever is there when it is clicked, so one mail stays true even
   as more pictures arrive. */
export async function notifyPhotosUploaded(
  db: SupabaseClient,
  order: { id: string; order_code: string; count: number }
): Promise<void> {
  try {
    const token = newToken();
    const { error } = await db.from('order_download_tokens').insert({
      order_id: order.id,
      token_hash: await hashToken(token),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString()
    });

    /* No link rather than a broken one. */
    if (error) {
      console.warn(`[mail] could not mint a download link for ${order.order_code}`);
      return;
    }

    const base = siteUrl();
    for (const to of studioAddresses()) {
      const sent = await sendEmail(
        studioPhotosMessage(
          to,
          order.order_code,
          order.count,
          `${base}/studio/photos/${token}`,
          `${base}/admin`,
          /* Keyed per recipient, or the second is taken for a repeat
             of the first and never arrives. */
          `photos:${order.id}:${to}`
        )
      );
      note('photographs in', order.order_code, sent.delivered, sent.reason);
    }
  } catch (e) {
    console.warn(`[mail] photographs notice for ${order.order_code} threw: ${(e as Error).message}`);
  }
}
