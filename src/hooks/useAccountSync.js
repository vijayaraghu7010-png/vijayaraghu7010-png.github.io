import { useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { forgetBagStamp, loadBag, saveBag } from '../lib/customerBag';

/* Keeps one piece of the bag - the lines, or the wishlist - the same
   on every device the customer signs in on.

   localStorage stays where it was and stays in charge: it is what a
   guest uses, what an offline browser uses, and what is on screen
   while the first sync is still in the air. The account is a copy
   that follows the person; it is never waited on and never blocks.

   On sign-in the two are joined rather than one replacing the other,
   so a bag filled on a phone before signing in is not thrown away by
   an empty one on the account, and an account's bag is not thrown
   away by an empty browser.

   Writes are debounced because the bag changes on every tap of a
   quantity stepper, and a bag is not worth a request per keystroke. */
const SAVE_AFTER = 900;

export function useAccountSync({ field, value, setValue, merge }) {
  const { isSignedIn, verified } = useAuth();

  /* Only a confirmed account gets a bag of its own: the function
     refuses an unverified token, so syncing before then is a round
     trip that can only fail. */
  const on = Boolean(isSignedIn && verified);

  const timer = useRef(null);
  /* Which account this hook has already pulled for. Pulling again on
     every render would undo the customer's own edits. */
  const pulledFor = useRef(null);
  const latest = useRef(value);
  latest.current = value;

  /* Sign-in: take what the account has and join it to what is here. */
  useEffect(() => {
    if (!on) {
      pulledFor.current = null;
      forgetBagStamp();
      return undefined;
    }
    if (pulledFor.current === field) return undefined;
    pulledFor.current = field;

    let live = true;
    loadBag().then((bag) => {
      if (!live || !bag) return;
      const joined = merge(latest.current, bag[field] || []);
      setValue(joined);
      /* Push the joined bag straight back, so the account carries what
         this device brought and the other device sees it next time. */
      saveBag(field === 'lines' ? joined : undefined, field === 'wishlist' ? joined : undefined);
    });

    return () => {
      live = false;
    };
  }, [on, field, merge, setValue]);

  /* Every later change: save it, once the tapping stops. */
  useEffect(() => {
    if (!on || pulledFor.current !== field) return undefined;

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveBag(
        field === 'lines' ? value : undefined,
        field === 'wishlist' ? value : undefined
      ).then((merged) => {
        /* The server joined this bag with a newer one from another
           device. What came back is the truth, not what went up. */
        if (merged) setValue(merged[field] || []);
      });
    }, SAVE_AFTER);

    return () => clearTimeout(timer.current);
  }, [on, field, value, setValue]);
}

export default useAccountSync;
