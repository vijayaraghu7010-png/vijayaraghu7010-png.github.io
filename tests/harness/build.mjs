import * as esbuild from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Running the real code without the runtime it ships to.

   Two pieces of this shop cannot be imported by the test runner as
   they stand. The download function is Deno, with remote imports and
   a global this process does not have. The orders panel is JSX, and
   there is no React renderer here.

   Rather than reimplement either - which would test a copy, and a
   copy is always right - both are bundled by esbuild, which is
   already present because Vite uses it. Only the surroundings are
   replaced: Deno's shared modules, React's hooks, the icons, the
   Supabase client, and fetch. Everything the feature itself does is
   the shipping source, byte for byte.

   Nothing built here reaches the network. The mocks have no addresses
   in them, and a test that tried would find no Supabase and no R2. */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const stub = (...p) => path.join(here, ...p);

/* esbuild resolves bare and relative imports itself; this redirects
   the few that must not be followed. */
function redirect(map) {
  return {
    name: 'redirect',
    setup(build) {
      for (const [pattern, to] of Object.entries(map)) {
        build.onResolve({ filter: new RegExp(pattern) }, () => ({ path: to }));
      }
    }
  };
}

async function bundle(entry, { plugins = [], define = {} } = {}) {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'ws-harness-')), 'bundle.mjs');
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile: out,
    logLevel: 'silent',
    plugins,
    define,
    jsx: 'automatic',
    jsxImportSource: 'react'
  });
  return pathToFileURL(out).href;
}

/* The real photos-download function, with its two shared modules
   replaced so the database and the bucket can be driven from a test. */
export function buildFunction() {
  return bundle(path.join(repo, 'supabase', 'functions', 'photos-download', 'index.ts'), {
    plugins: [
      redirect({
        '_shared[\\\\/]common\\.ts$': stub('mocks', 'common.ts'),
        '_shared[\\\\/]r2\\.ts$': stub('mocks', 'r2.ts')
      })
    ]
  });
}

/* Any of the customer-facing functions, with the database and the
   email boundary replaced and nothing else.

   _shared/customer.ts is deliberately NOT redirected: the ownership
   check, the response shaping and the rate limiter are the things
   being tested, so they must be the shipping ones. */
export function buildCustomerFunction(name) {
  return bundle(path.join(repo, 'supabase', 'functions', name, 'index.ts'), {
    plugins: [
      redirect({
        '_shared[\\\\/]common\\.ts$': stub('mocks', 'common-db.ts'),
        '_shared[\\\\/]email\\.ts$': stub('mocks', 'email.ts'),
        '_shared[\\\\/]pricing\\.ts$': stub('mocks', 'pricing.ts'),
        '^https://esm\\.sh/@supabase/supabase-js': stub('stubs', 'supabase-types.js')
      })
    ]
  });
}

/* The real orders panel, with React's hooks, the icon set and the
   Supabase client replaced. orderClient.js and supabaseClient.js are
   the shipping ones: their error handling is part of what is tested. */
export function buildPanel() {
  return bundle(path.join(repo, 'src', 'admin', 'panels', 'OrdersPanel.jsx'), {
    plugins: [
      redirect({
        '^react/jsx-runtime$': stub('stubs', 'jsx-runtime.js'),
        '^react$': stub('stubs', 'react.js'),
        '^lucide-react$': stub('stubs', 'lucide.js'),
        '^@supabase/supabase-js$': stub('stubs', 'supabase.js')
      })
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': '"https://harness.invalid"',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '"harness-anon-key"'
    }
  });
}
