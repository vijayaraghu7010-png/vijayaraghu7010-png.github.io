import { readClient } from './_lib/supabase.js';
import { cacheGet, cacheSet, CONFIG_KEY, cacheEnabled } from './_lib/cache.js';
import { rowToProduct, rowToOffer, rowToTheme, pickActiveTheme } from './_lib/shape.js';

/* Everything the storefront needs in one request: products, editable
   copy, the theme that is live right now and any running offers.
   Served from the Redis-compatible cache when it is warm. */
export default async function handler(req, res) {
  /* No CDN copy. This used to be s-maxage=60 with
     stale-while-revalidate=600, which meant an admin save could take a
     minute to show and, worse, a visitor could be handed a ten-minute-old
     payload while the edge refreshed in the background. Clearing the
     Redis entry could not help: that purges our cache, not Vercel's.
     The response is small and Redis still absorbs the repeat reads, so
     the edge copy was buying very little and costing correctness. */
  res.setHeader('Cache-Control', 'no-store, must-revalidate');

  try {
    const cached = await cacheGet(CONFIG_KEY);
    if (cached) {
      res.setHeader('x-ws-cache', 'hit');
      res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);
      return;
    }

    const db = readClient();
    const [products, content, themes, offers] = await Promise.all([
      db.from('products').select('*').eq('published', true).order('sort_order', { ascending: true }),
      db.from('site_content').select('*'),
      db.from('themes').select('*'),
      db.from('offers').select('*').eq('active', true)
    ]);

    const err = products.error || content.error || themes.error || offers.error;
    if (err) throw err;

    const allThemes = (themes.data || []).map(rowToTheme);
    const payload = {
      products: (products.data || []).map(rowToProduct),
      content: Object.fromEntries((content.data || []).map((r) => [r.key, r.value])),
      theme: pickActiveTheme(allThemes),
      offers: (offers.data || []).map(rowToOffer),
      generatedAt: new Date().toISOString()
    };

    await cacheSet(CONFIG_KEY, payload);
    res.setHeader('x-ws-cache', cacheEnabled() ? 'miss' : 'off');
    res.status(200).json(payload);
  } catch (error) {
    /* The storefront falls back to its built-in data when this fails,
       so a database outage shows the site as shipped rather than a
       broken page. */
    res.status(503).json({ error: String(error.message || error) });
  }
}
