import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  profileFrom,
  requestPasswordReset,
  resendVerification,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp
} from '../lib/customerAuth';
import { customerSupabase, CUSTOMER_BACKEND_READY } from '../lib/customerClient';

/* The customer's account.

   This used to keep a name in localStorage and call it a login. It
   now holds whatever Supabase says about the person, and nothing
   else: no password, no token copied out into storage of our own, no
   list of "known accounts" that anybody could claim by typing an
   address.

   The shape it hands out is the same as before - user, isSignedIn,
   initials, firstName, signUp, logIn, logOut - so the header, the
   account button and the mobile menu did not have to change. What
   changed is what stands behind it.

   One rule governs the rendering: the shop never waits for this.
   Finding out whether there is a session is a round trip, and a
   storefront that holds its first paint for it would be slower than
   the one that existed before accounts did. So children render at
   once with status 'loading', and anything that actually needs to
   know waits for 'ready'.                                          */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(CUSTOMER_BACKEND_READY ? 'loading' : 'ready');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!CUSTOMER_BACKEND_READY) return undefined;

    /* One read at startup, then one subscription. No polling, and no
       second request per component that happens to ask. */
    customerSupabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted.current) return;
        setUser(profileFrom(data?.session?.user) ?? null);
        setStatus('ready');
      })
      .catch(() => {
        if (mounted.current) setStatus('ready');
      });

    const { data: sub } = customerSupabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      setUser(profileFrom(session?.user) ?? null);
      setStatus('ready');
    });

    return () => {
      mounted.current = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const signUp = useCallback(async ({ name, email, password }) => {
    const result = await authSignUp({ name, email, password });
    if (result.ok && result.user?.verified) setUser(result.user);
    return result;
  }, []);

  const logIn = useCallback(async ({ email, password }) => {
    const result = await authSignIn({ email, password });
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const logOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      ready: status === 'ready',
      isSignedIn: Boolean(user),
      verified: Boolean(user?.verified),
      initials: user?.name ? user.name.trim().charAt(0).toUpperCase() : '',
      firstName: user?.name ? user.name.trim().split(/\s+/)[0] : '',
      accountsAvailable: CUSTOMER_BACKEND_READY,
      signUp,
      logIn,
      logOut,
      requestPasswordReset,
      resendVerification
    }),
    [user, status, signUp, logIn, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
