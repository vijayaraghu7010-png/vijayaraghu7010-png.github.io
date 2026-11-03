/* What the bag says delivery will cost.

   The charge the customer actually pays is worked out by the server,
   in supabase/functions/_shared/shipping.ts, and nothing here is
   believed at checkout. This is the same arithmetic done again so the
   bag and the summary can show a figure before the order exists -
   exactly the arrangement the offers already use.

   The two must agree, so the rule is kept deliberately small: a flat
   charge, optionally waived above a spend. Anything more elaborate
   would be two implementations of something complicated, which is two
   chances to disagree about what somebody owes. */

export const SHIPPING_OFF = {
  enabled: false,
  flat_paise: 0,
  free_above_paise: null,
  note: ''
};

/* A row as it comes back from settings, read strictly. A shop that
   cannot read its shipping setting charges nothing and says delivery
   is arranged separately - which is what it did before this existed. */
export function normaliseShipping(value) {
  const raw = value && typeof value === 'object' ? value : {};

  const whole = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const flat = whole(raw.flat_paise);
  const freeAbove = whole(raw.free_above_paise);

  const config = {
    enabled: raw.enabled === true,
    flat_paise: flat,
    free_above_paise: freeAbove > 0 ? freeAbove : null,
    note: String(raw.note ?? '').slice(0, 300)
  };

  if (config.flat_paise <= 0) config.enabled = false;
  return config;
}

/* What delivery costs on this basket, in rupees.

   Measured against what is owed for the goods after any offer,
   because that is the number on the page - and a free-delivery
   threshold quietly using the pre-discount figure would promise free
   delivery to somebody who then gets charged for it. */
export function shippingFor(config, payableRupees) {
  const c = normaliseShipping(config);
  if (!c.enabled) return 0;

  const payablePaise = Math.round(Number(payableRupees) * 100);
  if (c.free_above_paise !== null && payablePaise >= c.free_above_paise) return 0;

  return c.flat_paise / 100;
}

/* Whether this basket got free delivery it would otherwise pay for,
   so the summary can say so rather than printing a bare zero. */
export function shippingIsFree(config, payableRupees) {
  const c = normaliseShipping(config);
  if (!c.enabled || c.free_above_paise === null) return false;
  return Math.round(Number(payableRupees) * 100) >= c.free_above_paise;
}

/* How much more is needed to earn free delivery, in rupees, or 0 when
   there is nothing to earn or it is already earned. A small nudge the
   bag can show, and the only reason this rule is worth sharing. */
export function awayFromFreeShipping(config, payableRupees) {
  const c = normaliseShipping(config);
  if (!c.enabled || c.free_above_paise === null) return 0;

  const short = c.free_above_paise - Math.round(Number(payableRupees) * 100);
  return short > 0 ? short / 100 : 0;
}
