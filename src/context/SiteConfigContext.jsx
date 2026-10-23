import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { setLiveProducts } from '../data/products';
import { onSiteChange } from '../lib/liveUpdates';

/* One request on load brings back everything the admin controls:
   the catalogue, every editable string, the theme that is live right
   now and any running offers. Until it lands — or if it never does —
   the site runs on the data it was built with. */

const SiteConfigContext = createContext({
  ready: false,
  source: 'built-in',
  content: {},
  theme: null,
  offers: [],
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
    version: 0
  });

  async function load() {
    try {
      const res = await fetch('/api/site-config', {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`site-config ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data.products) && data.products.length) setLiveProducts(data.products);
      if (data.theme?.tokens) applyTheme(data.theme.tokens);

      setState((s) => ({
        ready: true,
        source: 'database',
        content: data.content || {},
        theme: data.theme || null,
        offers: data.offers || [],
        version: s.version + 1
      }));
    } catch {
      /* no backend yet, or it is down: keep the built-in content */
      setState((s) => ({ ...s, ready: true, source: 'built-in', version: s.version + 1 }));
    }
  }

  useEffect(() => {
    load();
    return () => clearTheme(state.theme?.tokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The database says when something changed, so an edit on a laptop
     reaches a phone that is sitting open on the shop. The focus and
     interval checks stay as a safety net: a websocket can drop on a
     phone that has been asleep, and a scheduled festival theme turns
     itself on at a time nobody is editing. */
  useEffect(() => {
    const stop = onSiteChange(load);
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

  const value = useMemo(() => ({ ...state, refresh: load }), [state]);

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
