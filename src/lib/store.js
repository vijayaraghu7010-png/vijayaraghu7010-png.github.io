import { PRODUCTS } from '../data/products';
import { DEFAULT_CONTENT, DEFAULT_THEMES, DEFAULT_OFFERS } from '../data/siteDefaults';

/* Where the shop's editable data lives now that there is no database.

   Everything the admin panel changes - products, copy, themes, offers
   - is kept in one record in localStorage, seeded from the files the
   site ships with. That has one consequence worth being blunt about:
   an edit lives in the browser that made it. It is not published to
   anyone else, and clearing site data resets the shop to its defaults.
   To change what visitors see, edit src/data and ship a build. */

const KEY = 'ws-site-store';
const VERSION = 1;

function defaults() {
  return {
    version: VERSION,
    products: PRODUCTS.map((p) => ({ ...p })),
    content: DEFAULT_CONTENT.map((c) => ({ ...c })),
    themes: DEFAULT_THEMES.map((t) => ({ ...t, tokens: { ...t.tokens } })),
    offers: [...DEFAULT_OFFERS]
  };
}

/* The one copy every reader shares. Held in memory so a render never
   waits on JSON parsing, and written through on every change. */
let state = null;

function read() {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    /* A saved record from an older shape is discarded rather than
       patched: the defaults are always a working shop, and a half
       migrated record is not worth the code to repair it. */
    state = saved && saved.version === VERSION ? { ...defaults(), ...saved } : defaults();
  } catch {
    state = defaults();
  }
  return state;
}

const listeners = new Set();

/* Tells this tab, and any other tab on the same browser, that the
   data changed. The storage event only fires in the *other* tabs, so
   the local listeners are called by hand. */
function commit() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or a private window: the edit still applies to this
       session, it just will not survive a reload */
  }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* one broken listener must not stop the rest */
    }
  });
}

export function onStoreChange(fn) {
  listeners.add(fn);

  const fromAnotherTab = (e) => {
    if (e.key !== KEY) return;
    state = null;
    fn();
  };
  window.addEventListener('storage', fromAnotherTab);

  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fromAnotherTab);
  };
}

// ------------------------------------------------------------ reads

export const getAll = () => read();
export const getProducts = () => read().products;
export const getContent = () => read().content;
export const getThemes = () => read().themes;
export const getOffers = () => read().offers;

// ----------------------------------------------------------- writes

export function setProducts(next) {
  read().products = next;
  commit();
}

export function setContent(next) {
  read().content = next;
  commit();
}

export function setThemes(next) {
  read().themes = next;
  commit();
}

export function setOffers(next) {
  read().offers = next;
  commit();
}

/* Puts the shop back to what the code ships with. */
export function resetStore() {
  state = defaults();
  commit();
}

/* A new row needs an id that will not collide with the built-in ones
   or with another row made a moment later. */
export function newId(prefix = 'row') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
