/* Lets `node --test` import the app's modules as written.

   The source imports `../data/hamperKit`, with no extension, because
   that is what Vite resolves and what the rest of the codebase does.
   Node's ESM loader wants the extension. Rather than write imports
   for the test runner's benefit and against the project's grain, the
   runner is taught the same resolution Vite does.

   Registered by the `test` script with --import. */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const HOOK = `
const EXTENSIONS = ['.js', '.mjs', '.jsx', '/index.js'];

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw err;

    for (const extension of EXTENSIONS) {
      try {
        return await next(specifier + extension, context);
      } catch {
        /* try the next one */
      }
    }
    throw err;
  }
}
`;

register(`data:text/javascript,${encodeURIComponent(HOOK)}`, pathToFileURL('./'));
