import { createContext, useCallback, useContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

/* A front-end account shell. There is no auth server yet, so this
   keeps a profile on this device only and never stores a password.
   When a backend arrives, swap the three functions below for API
   calls — nothing else in the app needs to change. */

const AuthContext = createContext(null);

const PROFILE_KEY = 'wrappedstudio.profile.v1';
const KNOWN_KEY = 'wrappedstudio.knownAccounts.v1';

export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage(PROFILE_KEY, null);
  const [known, setKnown] = useLocalStorage(KNOWN_KEY, []);

  const signUp = useCallback(
    ({ name, email }) => {
      const clean = { name: name.trim(), email: email.trim().toLowerCase() };
      if (known.some((k) => k.email === clean.email)) {
        return { ok: false, error: 'An account with this email already exists on this device.' };
      }
      setKnown([...known, clean]);
      setUser(clean);
      return { ok: true, user: clean };
    },
    [known, setKnown, setUser]
  );

  const logIn = useCallback(
    ({ email }) => {
      const clean = email.trim().toLowerCase();
      const match = known.find((k) => k.email === clean);
      if (!match) {
        return {
          ok: false,
          error: 'No account on this device uses that email. Create one with Sign up.'
        };
      }
      setUser(match);
      return { ok: true, user: match };
    },
    [known, setUser]
  );

  const logOut = useCallback(() => setUser(null), [setUser]);

  const value = useMemo(
    () => ({
      user,
      isSignedIn: Boolean(user),
      initials: user ? user.name.trim().charAt(0).toUpperCase() : '',
      firstName: user ? user.name.trim().split(/\s+/)[0] : '',
      signUp,
      logIn,
      logOut
    }),
    [user, signUp, logIn, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
