/* Who gets into the panel: anyone who types the administrator ID.

   There is no password. That is a deliberate choice, not an oversight,
   and it costs less than it sounds like: the site is static, so any
   check here runs in the browser with everything it needs sitting in
   the bundle, and a determined visitor could step past a password with
   the developer tools anyway. What is behind the door is a panel whose
   edits are kept in localStorage - they change that one browser and
   reach nobody else - so there is nothing here to take.

   The ID still has to be typed, which keeps the panel out of the way
   of anyone who wanders onto /admin. Treat it as a door marked
   "staff", not as a lock. If the panel ever writes somewhere that
   other people can read, this has to become a real check first. */

const SESSION_KEY = 'ws-admin-session';

export const ADMIN_ID = 'admin';

/* Who is signed in to the panel, or null. */
export function currentAdmin() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function signIn(id) {
  if (String(id).trim().toLowerCase() !== ADMIN_ID) {
    throw new Error('That is not the administrator ID');
  }

  const admin = { id: ADMIN_ID, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(admin));
  } catch {
    /* private window: the session lasts until the tab is closed */
  }
  return admin;
}

export function signOut() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}
