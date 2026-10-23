/* The storefront needs to recognise an administrator's address so the
   login box can send them to the panel instead of making a shopper
   profile they do not want. Knowing the list proves nothing: /admin
   still demands a real password, and the API checks the address again
   server-side before anything can be changed. */
const FALLBACK = 'roshinip.0931@gmail.com,vijayaraghu7010@gmail.com';

export const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || FALLBACK)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(value) {
  return adminEmails.includes(String(value || '').trim().toLowerCase());
}
