import { CUSTOMER_BACKEND_READY, callCustomerFunction } from './customerClient';

/* The bag, as the account holds it.

   Everything here fails quietly. A bag that will not sync is an
   inconvenience, not an error worth a red box over somebody's
   shopping: the browser's own copy is still there and still works,
   which is exactly how the shop behaved before any of this existed.
   A guest gets 401 and that is not a failure either - it means "there
   is no account to sync with", and localStorage goes on being the
   whole truth. */

/* The stamp the row carried when we last read it. Sent back with a
   write so the server can tell whether another device has changed the
   bag in the meantime and the two need merging. */
let lastSeen = null;

export function forgetBagStamp() {
  lastSeen = null;
}

export async function loadBag() {
  if (!CUSTOMER_BACKEND_READY) return null;
  try {
    const res = await callCustomerFunction('cart-sync', {});
    lastSeen = res?.bag?.updated_at ?? null;
    return {
      lines: Array.isArray(res?.bag?.lines) ? res.bag.lines : [],
      wishlist: Array.isArray(res?.bag?.wishlist) ? res.bag.wishlist : []
    };
  } catch {
    return null;
  }
}

/* Either half, or both. A field left undefined is not sent at all,
   and the server leaves that half of the row alone - the lines and
   the wishlist are two contexts in the browser and save separately,
   so a call about one must not wipe the other. */
export async function saveBag(lines, wishlist) {
  if (!CUSTOMER_BACKEND_READY) return null;
  try {
    const payload = { base: lastSeen };
    if (Array.isArray(lines)) payload.lines = lines;
    if (Array.isArray(wishlist)) payload.wishlist = wishlist;
    if (!('lines' in payload) && !('wishlist' in payload)) return null;

    const res = await callCustomerFunction('cart-sync', payload);
    lastSeen = res?.bag?.updated_at ?? null;
    /* `merged` means another device had written since we last looked
       and the server joined the two bags rather than letting this one
       flatten the other - so what came back is not what went up, and
       the caller should take it. */
    return res?.merged
      ? {
          lines: Array.isArray(res?.bag?.lines) ? res.bag.lines : [],
          wishlist: Array.isArray(res?.bag?.wishlist) ? res.bag.wishlist : []
        }
      : null;
  } catch {
    return null;
  }
}

/* The bag on this device and the bag on the account, joined for the
   moment somebody signs in. The same rule the server uses: one line
   per key, the larger count rather than the sum, because adding three
   on a phone and seeing six on a laptop reads as a bug. */
export function mergeLines(mine, theirs) {
  const out = new Map();
  for (const line of theirs || []) out.set(line.key, line);
  for (const line of mine || []) {
    const seen = out.get(line.key);
    if (!seen) {
      out.set(line.key, line);
      continue;
    }
    out.set(line.key, {
      ...seen,
      ...line,
      quantity: Math.max(Number(seen.quantity) || 1, Number(line.quantity) || 1)
    });
  }
  return [...out.values()];
}

export function mergeWishlist(mine, theirs) {
  return [...new Set([...(theirs || []), ...(mine || [])])];
}
