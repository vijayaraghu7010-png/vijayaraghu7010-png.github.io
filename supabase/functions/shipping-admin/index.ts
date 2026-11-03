/* Reading and setting what delivery costs.

   The settings table is readable by anybody - the shop has to be able
   to print the charge on the bag before anyone signs in - but it is
   writable by nothing except the service role. So this is the only
   way the figure changes, and it checks the caller is an
   administrator against the admins table before it will.

   The amounts arrive in rupees, because that is what somebody types
   into a box, and are kept in paise, because that is what every other
   figure in this shop is kept in. Converting at the edge is the whole
   of the reason this function exists rather than a direct write.   */

import { serviceClient, json, fail, corsHeaders, requireAdmin } from '../_shared/common.ts';
import { normaliseShipping, shippingConfig } from '../_shared/shipping.ts';

/* Nobody posts a parcel for more than this, and a typo that turns
   ₹60 into ₹60,000 should be caught before it reaches a customer's
   total rather than after. */
const MAX_CHARGE_PAISE = 500000; // ₹5,000

const rupeesToPaise = (v: unknown) => Math.round(Number(v) * 100);

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail('Use POST', 405, origin);

  const db = serviceClient();

  const admin = await requireAdmin(req, db);
  if (!admin) return fail('That is not an administrator', 403, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('That request was not readable', 400, origin);
  }

  /* Reading is a POST with nothing in it, so the panel can fill its
     form from the same place it saves to. */
  if (body.action !== 'save') {
    return json({ shipping: await shippingConfig(db) }, 200, origin);
  }

  const enabled = body.enabled === true;
  const flatPaise = rupeesToPaise(body.flat_rupees);
  const freeAboveRaw = body.free_above_rupees;
  const hasFreeAbove =
    freeAboveRaw !== null && freeAboveRaw !== undefined && String(freeAboveRaw).trim() !== '';
  const freeAbovePaise = hasFreeAbove ? rupeesToPaise(freeAboveRaw) : 0;

  if (!Number.isFinite(flatPaise) || flatPaise < 0) {
    return fail('That is not an amount we can charge', 400, origin);
  }
  if (flatPaise > MAX_CHARGE_PAISE) {
    return fail('That shipping charge looks like a mistake. The most this will take is ₹5,000.', 400, origin);
  }
  if (hasFreeAbove && (!Number.isFinite(freeAbovePaise) || freeAbovePaise < 0)) {
    return fail('That is not an order value we can read', 400, origin);
  }

  /* Charging switched on with nothing to charge would print
     "Shipping ₹0" on every page, which is worse than the sentence it
     replaces. Said plainly rather than quietly corrected, so the
     studio knows why it did not take. */
  if (enabled && flatPaise <= 0) {
    return fail('Give a shipping charge before switching it on', 400, origin);
  }

  const value = normaliseShipping({
    enabled,
    flat_paise: flatPaise,
    free_above_paise: hasFreeAbove ? freeAbovePaise : null,
    note: String(body.note ?? '')
  });

  const { error } = await db
    .from('settings')
    .upsert({ key: 'shipping.config', value }, { onConflict: 'key' });

  if (error) return fail('That could not be saved', 500, origin);

  console.log(
    `[shipping-admin] saved by ${admin.email}; enabled=${value.enabled} flat=${value.flat_paise}`
  );

  return json({ shipping: value }, 200, origin);
});
