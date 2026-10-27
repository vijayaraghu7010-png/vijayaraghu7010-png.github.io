import { supabase, BACKEND_READY } from './supabaseClient';

/* Who gets into the panel.

   This used to be a typed ID and nothing else, and said so: the shop
   was static, the panel's edits never left the browser that made them,
   and there was nothing behind the door worth locking. It also said
   what would have to change first - "if the panel ever writes
   somewhere that other people can read, this has to become a real
   check". Orders are that. A customer's name, telephone number and
   address are now on the other side of this door, so the door is real.

   Signing in is Supabase Auth, email and password. Being an
   administrator is a second question, asked of the database: the
   address must also be in the admins table. Neither answer is kept
   here in a form that could be edited into a yes - the session is a
   signed token, and every privileged thing the panel does is checked
   again by the server that does it.                                 */

const CACHE_KEY = 'ws-admin-who';

/* The panel asks who is signed in while it is drawing itself, before
   anything can be awaited, so the answer has to be available at once.
   This is that answer, and it is a convenience only: it decides which
   screen to paint, never what anybody may do. */
let cached = read();

function read() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function remember(admin) {
  cached = admin;
  try {
    if (admin) window.localStorage.setItem(CACHE_KEY, JSON.stringify(admin));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* a private window simply signs in again next time */
  }
}

export function currentAdmin() {
  return cached;
}

/* Is this signed-in person on the studio's list? The question goes to
   the database, which answers it with is_admin() against the caller's
   own token. A browser cannot talk its way to true. */
async function isAllowed() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

export async function signIn(email, password) {
  if (!BACKEND_READY) {
    throw new Error('This shop has no backend configured, so the panel cannot sign anybody in.');
  }

  const address = String(email || '').trim().toLowerCase();
  if (!address || !password) throw new Error('Both an email address and a password are needed');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: address,
    password
  });

  if (error || !data?.user) {
    /* Whether the address exists and whether the password was right
       are the same answer on purpose. */
    throw new Error('That email address and password do not match');
  }

  if (!(await isAllowed())) {
    await supabase.auth.signOut();
    throw new Error('That account is not an administrator of this studio');
  }

  const admin = { id: data.user.email, email: data.user.email, at: new Date().toISOString() };
  remember(admin);
  return admin;
}

/* Called when the panel opens. A session kept from last time is still
   checked against the admins table, because being taken off the list
   has to take effect without waiting for a token to expire. */
export async function restoreSession() {
  if (!BACKEND_READY) {
    remember(null);
    return null;
  }

  const { data } = await supabase.auth.getSession();
  if (!data?.session?.user?.email) {
    remember(null);
    return null;
  }

  if (!(await isAllowed())) {
    await supabase.auth.signOut();
    remember(null);
    return null;
  }

  const email = data.session.user.email;
  const admin = { id: email, email, at: new Date().toISOString() };
  remember(admin);
  return admin;
}

export async function signOut() {
  remember(null);
  if (BACKEND_READY) {
    try {
      await supabase.auth.signOut();
    } catch {
      /* the local session is gone either way */
    }
  }
}
