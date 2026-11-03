/* What delivery costs, decided here and nowhere else.

   The shop has always said "shipping charged separately" and settled
   it by message afterwards. This lets the studio put a number on it
   instead, and the number is read from the database on every order -
   never from the browser, for the same reason no other price is.

   Off is the default and the fallback. A missing row, an unreadable
   one, or a row with charging switched off all mean the shop behaves
   exactly as it did before: nothing is added, and the page goes on
   saying shipping is arranged separately. Turning this on is a
   deliberate act in the panel, not something a half-written row can
   do by accident.                                                  */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export type ShippingConfig = {
  enabled: boolean;
  /* A single flat charge. Weight- or distance-based pricing is a
     different shop; this one posts parcels of roughly one size. */
  flat_paise: number;
  /* Spend this much and delivery is free. null means no such offer -
     deliberately null rather than 0, because 0 would read as "free
     above nothing", which is free for everybody. */
  free_above_paise: number | null;
  /* One line shown under the charge, for whatever the studio wants to
     say about it - delivery times, which courier, anything. */
  note: string;
};

export const SHIPPING_OFF: ShippingConfig = {
  enabled: false,
  flat_paise: 0,
  free_above_paise: null,
  note: ''
};

const whole = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/* A stored row, read strictly. Anything missing or malformed falls
   back to the shipped default rather than being half-believed. */
export function normaliseShipping(value: unknown): ShippingConfig {
  const raw = (value ?? {}) as Partial<ShippingConfig>;

  const flat = whole(raw.flat_paise);
  const freeAbove = whole(raw.free_above_paise);

  const config: ShippingConfig = {
    enabled: raw.enabled === true,
    flat_paise: flat,
    free_above_paise: freeAbove > 0 ? freeAbove : null,
    note: String(raw.note ?? '').slice(0, 300)
  };

  /* Charging switched on with nothing to charge is not charging. It
     would print "Shipping ₹0" on every page, which is worse than the
     sentence it replaced. */
  if (config.flat_paise <= 0) config.enabled = false;

  return config;
}

export async function shippingConfig(db: SupabaseClient): Promise<ShippingConfig> {
  const { data } = await db
    .from('settings')
    .select('value')
    .eq('key', 'shipping.config')
    .maybeSingle();

  return normaliseShipping(data?.value);
}

/* What this order pays for delivery.

   Measured against what the customer actually owes for the goods -
   after any offer - because that is the number they see, and a
   free-delivery threshold that quietly used the pre-discount figure
   would promise free delivery to somebody who then gets charged. */
export function shippingPaise(config: ShippingConfig, payablePaise: number): number {
  if (!config.enabled) return 0;
  if (config.free_above_paise !== null && payablePaise >= config.free_above_paise) return 0;
  return config.flat_paise;
}
