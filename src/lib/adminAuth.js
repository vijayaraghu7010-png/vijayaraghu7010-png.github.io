/* One administrator, one password, checked in the browser.

   Be clear-eyed about what this is: the site is static, so there is
   nobody to ask. Anything the check needs is in the bundle, which
   means a determined visitor can read past it with the developer
   tools. It keeps the panel out of the way of ordinary visitors and
   that is all it does - there is nothing behind it worth stealing,
   because an admin edit only changes that one browser.

   The password is never stored, only its SHA-256 hash, so a glance at
   localStorage or at this file does not hand it over. */

const SESSION_KEY = 'ws-admin-session';
const PASSWORD_KEY = 'ws-admin-password';

export const ADMIN_ID = 'admin';

/* SHA-256 of "wrapped-admin". Change the password from the panel, or
   replace this with a new hash:
     node -e "console.log(require('crypto').createHash('sha256').update('your-password').digest('hex'))" */
const DEFAULT_HASH = '0d3ed9aadb3c4faff390e84e54c7ec620c59872ac51229d2f2eaf83614767d15';

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function storedHash() {
  try {
    return window.localStorage.getItem(PASSWORD_KEY) || DEFAULT_HASH;
  } catch {
    return DEFAULT_HASH;
  }
}

/* Who is signed in to the panel, or null. */
export function currentAdmin() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function signIn(id, password) {
  if (String(id).trim().toLowerCase() !== ADMIN_ID) {
    throw new Error('That is not the administrator ID');
  }
  if ((await sha256(password)) !== storedHash()) {
    throw new Error('That password is not right');
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

export async function changePassword(currentPassword, newPassword) {
  if ((await sha256(currentPassword)) !== storedHash()) {
    throw new Error('Current password is not right');
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Pick a password of at least 8 characters');
  }
  window.localStorage.setItem(PASSWORD_KEY, await sha256(newPassword));
}

/* True once the password has been changed from the one in the source,
   which is the only state worth warning about. */
export function usingDefaultPassword() {
  return storedHash() === DEFAULT_HASH;
}
