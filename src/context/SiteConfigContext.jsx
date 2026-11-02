import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { setLiveProducts } from '../data/products';
import { fetchCatalogue, shippedCatalogue } from '../lib/catalogue';
import { customerSupabase } from '../lib/customerClient';
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

  /* Paints from what the site shipped with, then replaces it with
     what the studio has actually saved. Never awaited by the render:
     the shop is on screen before the database answers, and redraws
     only if the answer differs. */
  function apply(data) {
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
      source: data.source || 'live',
      content: Object.fromEntries(data.content.map((r) => [r.key, r.value])),
      theme,
      offers: data.offers,
      reviews: data.reviews || [],
      version: s.version + 1
    }));
  }

  function load() {
    return fetchCatalogue()
      .then(apply)
      .catch(() => {
        /* The database could not be reached at all. The shop still
           has everything it was built with. */
        if (!seen.current) apply({ ...shippedCatalogue(), source: 'built-in' });
      });
  }

  useEffect(() => {
    /* Shipped data on screen immediately, the studio's own a moment
       later. There is no demo server any more: the shop everybody
       sees is the one in the database. */
    apply({ ...shippedCatalogue(), source: 'built-in' });
    load();
    return () => clearTheme(state.theme?.tokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A save in the panel shows in the shop at once, in this tab and in
     any other tab of the same browser. The focus and interval checks
     stay because a scheduled festival theme turns itself on at a time
     when nobody is editing anything. */
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const every = window.setInterval(onFocus, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(every);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Anyone can leave one: the shop has no accounts to check against,
     and a site that asks you to sign in first never gets reviewed.
     The panel can delete whatever should not be there.

     The same bounds the table itself enforces are applied here, so a
     customer is told what is wrong rather than handed a constraint
     violation. */
  async function addReview({ productId, rating, name, text }) {
    const score = Math.round(Number(rating));
    if (!productId || !(score >= 1 && score <= 5)) throw new Error('Pick between one and five stars');

    const body = String(text || '').trim().slice(0, 2000);
    if (!body) throw new Error('Please write a line or two');

    if (!customerSupabase) throw new Error('Reviews are not available right now');

    const { error } = await customerSupabase.from('reviews').insert({
      product_id: productId,
      rating: score,
      name: String(name || '').trim().slice(0, 80) || 'A customer',
      text: body
    });

    if (error) throw new Error('That review could not be saved');

    /* Straight back from the table, so the review appears for the
       person who wrote it and for everybody else alike. */
    seen.current = '';
    await load();
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
