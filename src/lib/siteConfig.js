import { supabase } from './supabaseClient';
import { rowToProduct, rowToOffer, rowToTheme, pickActiveTheme } from './shape';

/* Everything the storefront needs, read straight from the database
   with the anon key: the catalogue, every editable string, the theme
   that is live right now and any running offers.

   This used to be /api/site-config, which added a Redis cache in
   front of the same four queries. There is no server to cache in any
   more, so the four queries go out together and the browser's own
   cache is what is left - which is enough, because the payload is
   small and an admin edit is meant to show up at once. */
export async function loadSiteConfig() {
  const [products, content, themes, offers] = await Promise.all([
    supabase.from('products').select('*').eq('published', true).order('sort_order', { ascending: true }),
    supabase.from('site_content').select('*'),
    supabase.from('themes').select('*'),
    supabase.from('offers').select('*').eq('active', true)
  ]);

  const err = products.error || content.error || themes.error || offers.error;
  if (err) throw new Error(err.message || String(err));

  const allThemes = (themes.data || []).map(rowToTheme);

  return {
    products: (products.data || []).map(rowToProduct),
    content: Object.fromEntries((content.data || []).map((r) => [r.key, r.value])),
    theme: pickActiveTheme(allThemes),
    offers: (offers.data || []).map(rowToOffer),
    generatedAt: new Date().toISOString()
  };
}
