import { Redis } from '@upstash/redis';

/* A Redis-compatible cache (Upstash over REST, so it works from a
   serverless function with no connection pool). It is optional: if
   the credentials are absent every call becomes a no-op and the API
   simply reads Postgres each time. */

let client = null;
function redis() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export const CONFIG_KEY = 'ws:site-config:v1';
export const TTL_SECONDS = 300;

export async function cacheGet(key) {
  const r = redis();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttl = TTL_SECONDS) {
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: ttl });
  } catch {
    /* a cache write failure is not an error worth failing a request for */
  }
}

/* Called after every admin write so the storefront picks the change
   up on its next request rather than when the TTL happens to lapse. */
export async function cacheBust() {
  const r = redis();
  if (!r) return;
  try {
    await r.del(CONFIG_KEY);
  } catch {
    /* ignore */
  }
}

export function cacheEnabled() {
  return Boolean(redis());
}
