/* Pushes from the database, so a change made on one device shows on
   every other one without anybody reloading.

   supabase-js is pulled in with a dynamic import on purpose: the
   storefront's first paint should not wait for a websocket library it
   does not need yet. The shop renders, then this connects. */

const TABLES = ['products', 'site_content', 'themes', 'offers'];

let channel = null;
let clientPromise = null;
const listeners = new Set();

/* Several rows usually change in one save - a product row and its
   images, every text key at once - and each arrives as its own event.
   Waiting a moment turns that burst into a single refresh. */
let timer = null;
function announce() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* one bad listener must not stop the others */
      }
    });
  }, 250);
}

async function connect() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 5 } }
      })
    );
  }

  const client = await clientPromise;
  if (channel) return channel;

  channel = client.channel('ws-site-config');
  TABLES.forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, announce);
  });
  channel.subscribe();
  return channel;
}

/* Returns the function that stops listening. */
export function onSiteChange(fn) {
  listeners.add(fn);
  connect();
  return () => {
    listeners.delete(fn);
  };
}
