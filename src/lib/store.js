import { PRODUCTS } from '../data/products';
import { DEFAULT_CONTENT, DEFAULT_THEMES, DEFAULT_OFFERS } from '../data/siteDefaults';

/* Where the shop's editable data lives.

   Everything the admin panel changes - products, copy, themes, offers
   - is kept in one record, seeded from the files the site ships with.
   Where that record is kept depends on how the site is being served,
   and the page works out which without being told:

   - On its own (npm run dev, npm run preview, a static host) it is
     localStorage. An edit lives in the browser that made it: it is
     published to nobody, and clearing site data resets the shop.

   - Served by server/demo-server.mjs it is that server, shared by
     everyone looking. An edit made in one panel becomes the shop for
     every open page, which is what a demo to somebody elsewhere
     needs. The server also says when something changed, so pages
     update in under a second rather than on a reload.

   The probe is one request on startup; if it does not answer, the
   browser carries on with localStorage and nothing is lost. */

const KEY = 'ws-site-store';
const VERSION = 1;

function defaults() {
  return {
    version: VERSION,
    products: PRODUCTS.map((p) => ({ ...p })),
    content: DEFAULT_CONTENT.map((c) => ({ ...c })),
    themes: DEFAULT_THEMES.map((t) => ({ ...t, tokens: { ...t.tokens } })),
    offers: [...DEFAULT_OFFERS],
    reviews: []
  };
}

/* A shop saved before a key existed in the code has no row for it, so
   the panel would never show it and the page would sit on its coded
   default forever. Any key the code knows and the saved record does
   not is added back, keeping the edits that were made to the rest. */
function withNewKeys(record) {
  if (!record) return record;
  let next = record;

  if (next.content) {
    const known = new Set(next.content.map((r) => r.key));
    const missing = DEFAULT_CONTENT.filter((r) => !known.has(r.key)).map((r) => ({ ...r }));
    if (missing.length) next = { ...next, content: [...next.content, ...missing] };
  }

  /* The same for a product that was saved before a field existed - a
     rating, say. Only fields the saved copy has no opinion about are
     filled in, so an edited name or price is never overwritten. */
  if (next.products) {
    const shipped = new Map(PRODUCTS.map((p) => [p.id, p]));
    let changed = false;
    const products = next.products.map((p) => {
      const original = shipped.get(p.id);
      if (!original) return p;
      const gaps = Object.keys(original).filter((k) => !(k in p));
      if (!gaps.length) return p;
      changed = true;
      return { ...p, ...Object.fromEntries(gaps.map((k) => [k, original[k]])) };
    });
    if (changed) next = { ...next, products };
  }

  /* a shop saved before reviews existed has no list to add to */
  if (!Array.isArray(next.reviews)) next = { ...next, reviews: [] };

  return next;
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
    state = saved && saved.version === VERSION ? withNewKeys({ ...defaults(), ...saved }) : defaults();
  } catch {
    state = defaults();
  }
  return state;
}

const listeners = new Set();

function tellListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* one broken listener must not stop the rest */
    }
  });
}

/* ------------------------------------------------- the demo server */

let shared = false;

/* Saves are collapsed: dragging a colour picker fires a change per
   frame, and each one would otherwise be its own request. */
let pending = null;

function push() {
  if (pending) window.clearTimeout(pending);
  pending = window.setTimeout(async () => {
    pending = null;
    try {
      await fetch('/api/site', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch {
      /* the server went away mid-demo: the edit still stands in this
         browser, and the next save will try again */
    }
  }, 180);
}

/* Asks the server what the shop looks like, and stays connected for
   what happens to it next. Called once, on load. */
export async function connectShared() {
  if (typeof window === 'undefined' || !('EventSource' in window)) return false;

  try {
    const res = await fetch('/api/site', { headers: { accept: 'application/json' } });
    if (!res.ok) return false;

    const body = await res.json();
    shared = true;

    /* No saved shop yet: this browser's defaults become the shop, so
       the first person to open the panel starts from the real site. */
    if (body.site) {
      state = withNewKeys(body.site);
      tellListeners();
    }

    const events = new EventSource('/api/events');
    events.onmessage = async () => {
      /* Somebody saved. The message carries only the fact, not the
         shop - one small read keeps the stream cheap and means a
         missed message is corrected by the next one. */
      try {
        const next = await fetch('/api/site', { headers: { accept: 'application/json' } });
        const payload = await next.json();
        if (payload.site) {
          state = withNewKeys(payload.site);
          tellListeners();
        }
      } catch {
        /* a dropped read is picked up by the next announcement */
      }
    };
    /* EventSource reconnects by itself; nothing to do on error but
       let it, so the demo survives a laptop sleeping. */

    return true;
  } catch {
    return false;
  }
}

export const isShared = () => shared;

/* Writes the change where this page keeps its data, then tells every
   listener. On the demo server that is a save others will see; on a
   plain build it is this browser and no further. */
function commit() {
  if (shared) {
    push();
  } else {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or a private window: the edit still applies to this
         session, it just will not survive a reload */
    }
  }
  tellListeners();
}

export function onStoreChange(fn) {
  listeners.add(fn);

  /* Another tab of this browser saving to localStorage. On the demo
     server the same job is done by the event stream, which reaches
     other machines as well. */
  const fromAnotherTab = (e) => {
    if (shared || e.key !== KEY) return;
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
export const getReviews = () => read().reviews || [];

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

export function setReviews(next) {
  read().reviews = next;
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
