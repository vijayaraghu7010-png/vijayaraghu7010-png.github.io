/* A demo server: one shared copy of the shop, for showing it to
   somebody who is not sitting next to you.

   The shop normally keeps what the admin panel edits in localStorage,
   which never leaves the browser that made the edit - fine for one
   person, useless for two. This holds that same record in a file and
   hands it to everyone who asks, so an edit made in your panel is the
   shop everybody else loads.

   "Instantly" is the other half. Rather than have each visitor ask
   again every few seconds, every open page keeps a connection here and
   is told the moment something changes (server-sent events: a plain
   HTTP response that is never closed, which browsers reconnect on
   their own if it drops). A theme or an offer lands in well under a
   second.

   Run it with:  npm run demo
   It serves the built site, so run `npm run build` first.

   No dependencies, on purpose: this is meant to be startable on a
   laptop during a demo, not installed.                            */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT) || 4000;
const ROOT = resolve(process.cwd(), 'dist');
const DATA_DIR = resolve(process.cwd(), 'server', 'data');
const DATA_FILE = join(DATA_DIR, 'demo-site.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* The shop as it stands. null means nobody has saved anything yet, and
   the browser should fall back to the data it was built with. */
let site = null;

async function load() {
  try {
    site = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    console.log(`  loaded a saved shop from ${DATA_FILE}`);
  } catch {
    site = null;
  }
}

let writing = Promise.resolve();
function save() {
  /* Writes are chained rather than fired off together: two saves a
     moment apart must not interleave and leave half a file behind. */
  writing = writing
    .then(() => mkdir(DATA_DIR, { recursive: true }))
    .then(() => writeFile(DATA_FILE, JSON.stringify(site, null, 2)))
    .catch((err) => console.error('  could not save:', err.message));
  return writing;
}

// ------------------------------------------------- live connections

const watchers = new Set();

function announce() {
  const line = `data: ${JSON.stringify({ at: Date.now() })}\n\n`;
  watchers.forEach((res) => {
    try {
      res.write(line);
    } catch {
      watchers.delete(res);
    }
  });
}

function stream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
    /* nginx and some tunnels buffer responses, which would hold the
       events back until the buffer filled - this asks them not to */
    'x-accel-buffering': 'no'
  });
  res.write('retry: 2000\n\n');
  watchers.add(res);

  /* A connection with nothing on it can be dropped by anything in the
     middle, so a comment goes down it every twenty seconds. */
  const beat = setInterval(() => {
    try {
      res.write(': beat\n\n');
    } catch {
      /* the close handler below cleans up */
    }
  }, 20_000);

  req.on('close', () => {
    clearInterval(beat);
    watchers.delete(res);
  });
}

// ------------------------------------------------------ static files

async function sendFile(res, path) {
  const body = await readFile(path);
  res.writeHead(200, {
    'content-type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
    /* the demo is being edited as it is shown, so nothing is cached */
    'cache-control': 'no-store'
  });
  res.end(body);
}

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  res.end(text);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const path = decodeURIComponent(url.pathname);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    res.end();
    return;
  }

  if (path === '/api/events') return stream(req, res);

  if (path === '/api/site') {
    if (req.method === 'GET') return json(res, 200, { site });

    if (req.method === 'PUT') {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        total += chunk.length;
        /* a shop record is tens of kilobytes; anything near a megabyte
           is a mistake or a stray upload, and is refused rather than
           held in memory */
        if (total > 2 * 1024 * 1024) {
          req.destroy();
          return json(res, 413, { error: 'That is too large to be a shop record' });
        }
        chunks.push(chunk);
      }
      try {
        site = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return json(res, 400, { error: 'That was not valid JSON' });
      }
      await save();
      announce();
      console.log(`  saved  ${new Date().toLocaleTimeString()}  -> ${watchers.size} watching`);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  }

  /* everything else is the built site; unknown paths get index.html so
     client-side routes like /admin and /photo-frames work on a reload */
  if (!existsSync(ROOT)) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('dist/ is missing — run `npm run build` first, then start this again.');
    return;
  }

  const wanted = normalize(join(ROOT, path));
  /* a request for ../../something must not escape dist/ */
  const safe = wanted.startsWith(ROOT) ? wanted : ROOT;

  try {
    if (existsSync(safe) && extname(safe)) return await sendFile(res, safe);
    return await sendFile(res, join(ROOT, 'index.html'));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

await load();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  WrappedStudio demo server\n`);
  console.log(`  this machine   http://localhost:${PORT}`);
  console.log(`  the panel      http://localhost:${PORT}/admin`);
  console.log(`\n  Edits made in the panel are saved here and pushed to every`);
  console.log(`  open page. Stop it with Ctrl+C; the shop is kept in`);
  console.log(`  server/data/demo-site.json and is there next time.\n`);
});
