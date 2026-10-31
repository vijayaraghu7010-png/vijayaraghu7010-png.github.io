/* The pieces the three payment functions share: who may speak for an
   order, what the studio's UPI details are, and what counts as a
   bank reference.

   The rule from 0005 runs through all of it. A customer's submission
   is a claim, not evidence. Nothing here moves an order to paid; the
   only thing that does is an administrator saying they saw the credit
   in the account, and that lives in payments-admin.                */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { text } from './common.ts';
import { hashToken } from './customer.ts';

/* What a bank reference looks like once the spaces are gone.

   UTRs are twelve digits on most rails and alphanumeric on a few, so
   this is deliberately loose about the alphabet and strict about
   everything else: no spaces, no punctuation, nothing that could be a
   path or a fragment of SQL. The database normalises it again on the
   way in - upper case, spaces stripped - so the comparison column and
   this check can never disagree. */
const UTR = /^[A-Za-z0-9]{6,40}$/;

export const UPI_METHODS = ['gpay', 'phonepe', 'paytm', 'other'];

/* The screenshot. Narrower than the photograph limits on purpose: a
   payment confirmation is one phone screen, and anything larger is
   either not a screenshot or not worth storing. */
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const PROOF_MAX_BYTES = 8 * 1024 * 1024;

export const PROOF_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
};

export type UpiConfig = {
  enabled: boolean;
  upi_id: string;
  display_name: string;
  qr_asset: string;
  apps: string[];
};

const UPI_OFF: UpiConfig = {
  enabled: false,
  upi_id: '',
  display_name: '',
  qr_asset: '',
  apps: ['gpay', 'phonepe', 'paytm']
};

/* Where to pay, as the studio set it.

   Off is the default and the fallback. A missing row, an unreadable
   one, a half-filled one - all of them mean payment is not available
   yet, because the alternative is showing a customer a UPI ID that is
   blank or wrong and taking their money somewhere nobody can find. */
export async function upiConfig(db: SupabaseClient): Promise<UpiConfig> {
  const { data } = await db
    .from('settings')
    .select('value')
    .eq('key', 'payments.upi')
    .maybeSingle();

  const value = (data?.value ?? {}) as Partial<UpiConfig>;
  const config: UpiConfig = {
    ...UPI_OFF,
    ...value,
    apps: Array.isArray(value.apps) && value.apps.length ? value.apps : UPI_OFF.apps
  };

  /* Enabled without an address to pay into is not enabled. */
  if (!config.upi_id.trim()) config.enabled = false;

  return config;
}

export function normaliseUtr(raw: unknown): string | null {
  const value = text(raw, 60).replace(/\s+/g, '');
  return UTR.test(value) ? value : null;
}

export type OrderClaim = {
  id: string;
  order_code: string;
  status: string;
  payment_status: string;
  total_paise: number;
  customer_email: string;
};

const ORDER_FIELDS = 'id, order_code, status, payment_status, total_paise, customer_email';

/* Which order this request may speak for.

   Two ways to hold an order, and both are checked against the
   database rather than believed. A tracking token is the link the
   checkout handed over - hashed, matched, and refused once revoked or
   expired. A signed-in customer is whoever Supabase says they are,
   and the order must already carry their id.

   An order id on its own is never enough. Order codes run in
   sequence; if quoting one were sufficient, anybody could submit a
   payment against somebody else's order and tie it up.            */
export async function orderFromClaim(
  db: SupabaseClient,
  body: Record<string, unknown>,
  customerId: string | null
): Promise<{ order: OrderClaim } | { error: string; status: number }> {
  const token = text(body.token, 200);

  if (token) {
    const { data: row } = await db
      .from('order_tracking_tokens')
      .select('order_id, expires_at, revoked_at')
      .eq('token_hash', await hashToken(token))
      .maybeSingle();

    if (!row || row.revoked_at || new Date(String(row.expires_at)) < new Date()) {
      return { error: 'That payment link is not valid any more.', status: 403 };
    }

    const { data: order } = await db
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('id', row.order_id)
      .maybeSingle();

    if (!order) return { error: 'That payment link is not valid any more.', status: 403 };
    return { order: order as OrderClaim };
  }

  if (customerId) {
    const orderId = text(body.order_id, 40);
    if (!orderId) return { error: 'Which order is this for?', status: 400 };

    const { data: order } = await db
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('id', orderId)
      .eq('user_id', customerId)
      .maybeSingle();

    if (!order) return { error: 'That order is not yours.', status: 403 };
    return { order: order as OrderClaim };
  }

  return { error: 'That payment link is not valid any more.', status: 403 };
}

/* Whether this order is in a state that can take a payment at all,
   and whether one is already being looked at.

   Called before the presign as well as before the insert, so a
   customer who cannot submit is told so before they pick a file
   rather than after they have uploaded one. */
export async function paymentGate(
  db: SupabaseClient,
  order: OrderClaim
): Promise<{ error: string; status: number } | null> {
  if (order.status === 'cancelled') {
    return { error: 'That order was cancelled.', status: 409 };
  }
  if (order.status !== 'pending' || order.payment_status === 'paid') {
    return { error: 'That order has already been paid for.', status: 409 };
  }

  const { data: live } = await db
    .from('order_payments')
    .select('id, status')
    .eq('order_id', order.id)
    .in('status', ['submitted', 'verified'])
    .limit(1);

  if (live && live.length) {
    return live[0].status === 'verified'
      ? { error: 'That order has already been paid for.', status: 409 }
      : {
          error: 'A payment for this order is already being checked. Please wait for the studio to confirm it.',
          status: 409
        };
  }

  return null;
}

/* What a customer may know about their own payment.

   Not the administrator who decided it, and not another order's
   reference. The note is the studio's own words to this customer -
   why something was turned down, what to send instead - so it is
   included; the decider's address is not. */
export function paymentView(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    status: row.status,
    method: row.method,
    utr: row.utr,
    amount_paise: row.amount_paise,
    submitted_at: row.created_at,
    decided_at: row.decided_at ?? null,
    note: row.decision_note ?? null
  };
}
