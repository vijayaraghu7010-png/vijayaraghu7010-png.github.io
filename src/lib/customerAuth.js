import { customerSupabase, CUSTOMER_BACKEND_READY } from './customerClient';

/* Signing a customer in, for real this time.

   What used to be here kept a name in localStorage and let anybody
   who typed a known address through. Supabase Auth does the work now:
   it holds the password, it sends the confirmation, it decides when a
   session has expired. Nothing in this file ever sees a password
   after it has been handed over, and nothing writes one down.

   Two habits run through it. Errors are generic where a precise one
   would say whether an account exists - "those details do not match"
   rather than "no such user". And the address is not trusted until
   Supabase says it has been confirmed, because an unconfirmed address
   is just something somebody typed.                                */

const GENERIC = 'That email address and password do not match.';

function nameFrom(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : '')
  );
}

export function profileFrom(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: nameFrom(user),
    /* Supabase sets one or the other depending on its age. */
    verified: Boolean(user.email_confirmed_at || user.confirmed_at)
  };
}

export async function signUp({ name, email, password }) {
  if (!CUSTOMER_BACKEND_READY) return { ok: false, error: 'Accounts are not available just now.' };

  const { data, error } = await customerSupabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: name.trim() } }
  });

  if (error) {
    /* "already registered" is exactly the thing not to confirm. */
    if (/already/i.test(error.message)) {
      return { ok: true, needsVerification: true, user: null };
    }
    return { ok: false, error: error.message };
  }

  /* With confirmation on, Supabase returns a user and no session. */
  return {
    ok: true,
    needsVerification: !data.session,
    user: profileFrom(data.user)
  };
}

export async function signIn({ email, password }) {
  if (!CUSTOMER_BACKEND_READY) return { ok: false, error: 'Accounts are not available just now.' };

  const { data, error } = await customerSupabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    if (/not confirmed|confirm/i.test(error.message)) {
      return { ok: false, needsVerification: true, error: 'Please confirm your email address first. Check your inbox.' };
    }
    return { ok: false, error: GENERIC };
  }

  const profile = profileFrom(data.user);
  if (!profile?.verified) {
    await customerSupabase.auth.signOut();
    return { ok: false, needsVerification: true, error: 'Please confirm your email address first. Check your inbox.' };
  }

  return { ok: true, user: profile };
}

/* Only this customer's session. The studio's, under its own key, is
   untouched - signing out of the shop must not sign an administrator
   out of the panel in the next tab. */
export async function signOut() {
  if (!CUSTOMER_BACKEND_READY) return;
  try {
    await customerSupabase.auth.signOut();
  } catch {
    /* already gone is the outcome we wanted */
  }
}

/* The same sentence whether or not the address is known here. */
export async function requestPasswordReset(email) {
  if (!CUSTOMER_BACKEND_READY) return { ok: true };
  try {
    await customerSupabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/account`
    });
  } catch {
    /* deliberately ignored */
  }
  return { ok: true };
}

export async function resendVerification(email) {
  if (!CUSTOMER_BACKEND_READY) return { ok: true };
  try {
    await customerSupabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
  } catch {
    /* deliberately ignored */
  }
  return { ok: true };
}
