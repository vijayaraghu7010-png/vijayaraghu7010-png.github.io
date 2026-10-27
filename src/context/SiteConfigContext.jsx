import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { setLiveProducts } from '../data/products';
import { getAll, getReviews, setReviews, newId, onStoreChange, connectShared } from '../lib/store';
import { pickActiveTheme } from '../lib/shape';

/* Everything the admin controls, read from the local store: the
   catalogue, every editable string, the theme that is live right now
   and any running offers. The store seeds itself from the files the
   site ships with, so there is no loading state to sit through and
   nothing to fail. */

const SiteConfigContext = createContext({
  ready: false,
  source: 'built-in',
  content: {},
  theme: null,
  offers: [],
  reviews: [],
  version: 0,
  refresh: () => {}
});

function applyTheme(tokens) {
  const root = document.documentElement;
  if (!tokens || typeof tokens !== 'object') return;
  Object.entries(tokens).forEach(([name, value]) => {
    if (typeof name === 'string' && name.startsWith('--') && typeof value === 'string') {
      root.style.setProperty(name, value);
    }
  });
}

function clearTheme(tokens) {
  const root = document.documentElement;
  Object.keys(tokens || {}).forEach((name) => root.style.removeProperty(name));
}

export function SiteConfigProvider({ children }) {
  const [state, setState] = useState({
    ready: false,
    source: 'built-in',
    content: {},
    theme: null,
    offers: [],
    reviews: [],
    version: 0
  });

  /* What the shop was last built from. `load` runs on a focus, on a
     tab becoming visible and on a timer, and almost every one of those
     finds the shop exactly as it left it. Bumping `version` anyway
     re-rendered every page and every product card on the screen -
     every sixty seconds, and every time the window was clicked back
     into. This is the cheap way to tell a real change from a no-op. */
  const seen = useRef('');

  function load() {
    const data = getAll();
    const theme = pickActiveTheme(data.themes);

    const stamp = JSON.stringify([
      data.products,
      data.content,
      data.offers,
      data.reviews || [],
      theme?.id ?? null,
      theme?.tokens ?? null
    ]);

    if (stamp === seen.current) return; /* nothing moved: leave the page alone */
    seen.current = stamp;

    setLiveProducts(data.products.filter((p) => p.published !== false));
    if (theme?.tokens) applyTheme(theme.tokens);

    setState((s) => ({
      ready: true,
      source: 'local',
      content: Object.fromEntries(data.content.map((r) => [r.key, r.value])),
      theme,
      offers: data.offers,
      reviews: data.reviews || [],
      version: s.version + 1
    }));
  }

  useEffect(() => {
    /* Paint from what this browser already has, then ask whether the
       page is being served by the demo server. If it is, the shared
       shop arrives a moment later and the page redraws; if it is not,
       nothing happens and this stays a one-browser shop. */
    load();
    connectShared().then((isShared) => {
      if (isShared) load();
    });
    return () => clearTheme(state.theme?.tokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A save in the panel shows in the shop at once, in this tab and in
     any other tab of the same browser. The focus and interval checks
     stay because a scheduled festival theme turns itself on at a time
     when nobody is editing anything. */
  useEffect(() => {
    const stop = onStoreChange(load);
    const onFocus = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const every = window.setInterval(onFocus, 60_000);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(every);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Anyone can leave one: the shop has no accounts to check against,
     and a demo that asks you to sign in first never gets reviewed.
     The panel can delete whatever should not be there. */
  function addReview({ productId, rating, name, text }) {
    const score = Math.round(Number(rating));
    if (!productId || !(score >= 1 && score <= 5)) throw new Error('Pick between one and five stars');

    setReviews([
      ...getReviews(),
      {
        id: newId('review'),
        productId,
        rating: score,
        name: String(name || '').trim().slice(0, 40) || 'A customer',
        text: String(text || '').trim().slice(0, 600),
        at: new Date().toISOString()
      }
    ]);
    load();
  }

  const value = useMemo(() => ({ ...state, refresh: load, addReview }), [state]);

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export const useSiteConfig = () => useContext(SiteConfigContext);

/* Reads one editable string. The fallback is what the site shipped
   with, so a key that has not been created yet still renders. */
export function useText(key, fallback = '') {
  const { content } = useSiteConfig();
  const value = content?.[key];
  return value === undefined || value === null || value === '' ? fallback : value;
}

/* The offers that are running at this moment. */
export function useLiveOffers() {
  const { offers } = useSiteConfig();
  const now = Date.now();
  return (offers || []).filter((o) => {
    if (!o.active) return false;
    if (o.startsAt && new Date(o.startsAt).getTime() > now) return false;
    if (o.endsAt && new Date(o.endsAt).getTime() < now) return false;
    return true;
  });
}
