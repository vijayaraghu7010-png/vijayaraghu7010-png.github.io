/* ===========================================================
   Compresses the pictures in public/ that are over budget.

   The admin panel compresses everything picked through it, so this is
   for the other door: a file dropped into public/images by hand, which
   nothing in the browser ever sees. Run it after adding one.

       npm run images            # compress what is over budget
       npm run images -- --check # list them, change nothing (for CI)
       npm run images -- --all   # re-encode everything, not just the big

   What it does, per file:
     · scales anything wider than MAX_EDGE down to it
     · re-encodes JPEG as JPEG
     · re-encodes PNG as WEBP when the PNG has transparency, and as
       JPEG when it does not - a photograph saved as PNG is the single
       most expensive mistake available, and that is what the 2 MB hero
       this shop shipped with was
     · keeps the result only if it actually came out smaller
     · never touches public/images/uploads, which is content somebody
       put there, not artwork the site ships

   A rewritten extension means the old path stops resolving, so those
   are reported rather than done silently, with the files that refer to
   them. Decide, then update the reference and delete the original.

   Needs ffmpeg on PATH. It is the only image tool that can be relied
   on to already be there, and it does both jobs.
   =========================================================== */

import { execFile } from 'node:child_process';
import { readdir, stat, rename, unlink, readFile } from 'node:fs/promises';
import { join, extname, relative, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PUBLIC = join(ROOT, 'public');

/* Budgets. A picture the page has to paint before it is useful gets a
   tighter one than a thumbnail nobody waits for. */
const MAX_EDGE = 1600;
const BUDGET_BYTES = 250 * 1024;
const JPEG_Q = 5; // ffmpeg -q:v, 2 best .. 31 worst
const WEBP_Q = 82;

const SKIP_DIRS = new Set(['uploads']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const ALL = args.includes('--all');

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(join(dir, entry.name), out);
    } else if (IMAGE_EXT.has(extname(entry.name).toLowerCase())) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/* PNG colour type 4 and 6 carry an alpha channel; 3 may carry one in a
   tRNS chunk. Anything else is opaque and belongs in a JPEG. */
async function pngHasAlpha(file) {
  const buf = await readFile(file);
  if (buf.length < 26 || buf.toString('latin1', 1, 4) !== 'PNG') return true;
  const colourType = buf[25];
  if (colourType === 4 || colourType === 6) return true;
  if (colourType === 3) return buf.includes(Buffer.from('tRNS', 'latin1'));
  return false;
}

/* `scale` only ever shrinks: min(MAX_EDGE, iw) leaves a small picture
   alone, and -2 keeps the aspect ratio on an even number of pixels. */
const scaleFilter = `scale='min(${MAX_EDGE},iw)':-2:flags=lanczos`;

async function encode(from, to, kind) {
  const opts =
    kind === 'webp'
      ? ['-c:v', 'libwebp', '-quality', String(WEBP_Q), '-compression_level', '6']
      : ['-q:v', String(JPEG_Q)];
  await run('ffmpeg', ['-v', 'error', '-y', '-i', from, '-vf', scaleFilter, ...opts, to], {
    windowsHide: true
  });
}

async function referencedBy(publicPath) {
  const needle = `/${relative(PUBLIC, publicPath).split(sep).join('/')}`;
  const hits = [];
  for (const dir of ['src', 'index.html']) {
    const base = join(ROOT, dir);
    let files = [];
    try {
      files = (await stat(base)).isDirectory() ? await walkAny(base) : [base];
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        if ((await readFile(f, 'utf8')).includes(needle)) hits.push(relative(ROOT, f));
      } catch {
        /* unreadable: not a reference */
      }
    }
  }
  return hits;
}

async function walkAny(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await walkAny(join(dir, entry.name), out);
    else if (/\.(jsx?|mjs|css|html)$/.test(entry.name)) out.push(join(dir, entry.name));
  }
  return out;
}

async function main() {
  try {
    await run('ffmpeg', ['-version'], { windowsHide: true });
  } catch {
    console.error('ffmpeg is not on PATH. Install it (winget install Gyan.FFmpeg) and run this again.');
    process.exit(1);
  }

  const files = await walk(PUBLIC);
  let saved = 0;
  const done = [];
  const renames = [];
  const skipped = [];

  for (const file of files) {
    const before = (await stat(file)).size;
    const ext = extname(file).toLowerCase();
    const shown = relative(ROOT, file);

    if (!ALL && before <= BUDGET_BYTES) continue;

    /* what this file should become */
    let target = ext === '.png' ? ((await pngHasAlpha(file)) ? 'webp' : 'jpg') : ext.slice(1);
    if (target === 'jpeg') target = 'jpg';
    const kind = target === 'webp' ? 'webp' : 'jpg';
    const changesName = `.${target}` !== ext;

    if (CHECK) {
      skipped.push(`${shown}  ${kb(before)}${changesName ? `  → would become .${target}` : ''}`);
      continue;
    }

    const tmp = `${file}.tmp.${target}`;
    try {
      await encode(file, tmp, kind);
    } catch (e) {
      console.warn(`! ${shown} could not be encoded: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
      await unlink(tmp).catch(() => {});
      continue;
    }

    const after = (await stat(tmp)).size;
    if (after >= before) {
      await unlink(tmp).catch(() => {});
      continue; /* already as small as it is going to get */
    }

    if (changesName) {
      /* A new extension breaks every path that names the old one, so
         this is reported, not done. The new file is left beside the
         original for a look before committing to it. */
      const next = file.slice(0, -ext.length) + `.${target}`;
      await rename(tmp, next);
      renames.push({
        shown,
        to: relative(ROOT, next),
        before,
        after,
        refs: await referencedBy(file)
      });
      saved += before - after;
      continue;
    }

    await rename(tmp, file);
    done.push(`${shown}  ${kb(before)} → ${kb(after)}`);
    saved += before - after;
  }

  if (CHECK) {
    if (!skipped.length) {
      console.log(`Every picture in public/ is within ${kb(BUDGET_BYTES)}.`);
      return;
    }
    console.log(`${skipped.length} picture(s) over ${kb(BUDGET_BYTES)}:\n`);
    skipped.forEach((l) => console.log(`  ${l}`));
    console.log('\nRun `npm run images` to compress them.');
    process.exitCode = 1;
    return;
  }

  if (done.length) {
    console.log(`Compressed ${done.length} picture(s) in place:\n`);
    done.forEach((l) => console.log(`  ${l}`));
  }

  if (renames.length) {
    console.log(`\n${renames.length} picture(s) were written in a better format under a new name.`);
    console.log('The originals are still there. Update the reference, then delete the original:\n');
    for (const r of renames) {
      console.log(`  ${r.shown}  ${kb(r.before)}`);
      console.log(`    → ${r.to}  ${kb(r.after)}`);
      console.log(`    referenced in: ${r.refs.length ? r.refs.join(', ') : 'nothing — safe to delete'}`);
    }
  }

  if (!done.length && !renames.length) {
    console.log(`Nothing to do: every picture in public/ is within ${kb(BUDGET_BYTES)}.`);
  } else {
    console.log(`\nSaved ${kb(saved)}.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
