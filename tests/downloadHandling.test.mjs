import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Two rules that are easy to undo by accident and expensive to notice.

   Neither can be exercised here: one needs a browser, the other needs
   a database that fails on demand, and both live in code this runner
   cannot import. What is checked instead is the shape of the source -
   a weaker test, and an honest one, which will fail the moment
   somebody puts the old behaviour back. The behaviour itself was
   verified against the deployed function and a real browser. */

const panel = readFileSync(
  new URL('../src/admin/panels/OrdersPanel.jsx', import.meta.url),
  'utf8'
);
const fn = readFileSync(
  new URL('../supabase/functions/photos-download/index.ts', import.meta.url),
  'utf8'
);

const downloadFn = panel.match(/async function download\(photo\) \{[\s\S]*?\n  \}/)[0];

test('a download opens its own tab and leaves the panel where it was', () => {
  assert.ok(
    downloadFn.includes("window.open(ready.url, '_blank', 'noopener,noreferrer')"),
    'the signed URL should open in a new tab'
  );
  assert.ok(
    !downloadFn.includes('location.assign'),
    'sending this tab to the URL replaces the panel with an error page when anything goes wrong'
  );
  assert.ok(
    !downloadFn.includes('location.href'),
    'assigning location.href has the same problem as location.assign'
  );
});

/* A blocked pop-up is the one failure the page can actually see. */
test('a blocked window is reported, not ignored', () => {
  assert.ok(downloadFn.includes('if (!opened)'), 'the return of window.open should be checked');
  assert.ok(downloadFn.includes('setError('), 'a blocked window should reach the admin');
});

/* The page cannot observe whether the file arrived, so it must not
   say that it did. */
test('nothing claims the photograph arrived', () => {
  const notes = downloadFn.match(/setNote\((.*)\)/g) || [];
  for (const call of notes) {
    assert.ok(
      /setNote\(''\)/.test(call),
      `download() should only clear the note, never set one: ${call}`
    );
  }
});

test('the signed URL is never kept', () => {
  assert.ok(!/setState|useState\([^)]*ready\.url/.test(downloadFn));
  assert.ok(!downloadFn.includes('localStorage'));
  assert.ok(!downloadFn.includes('sessionStorage'));
});

/* An unrecorded download is worse than one that did not happen: the
   first reads a customer's photographs with no trace of who read
   them, the second is an administrator clicking again. */
test('a download that cannot be recorded is not issued', () => {
  assert.ok(
    fn.includes('const { error: auditError } = await db.from(\'order_events\').insert('),
    'the audit insert should be checked, not fired and forgotten'
  );

  const auditAt = fn.indexOf('auditError');
  const guardAt = fn.indexOf('if (auditError)');
  const returnAt = fn.indexOf('return json({ downloads');
  assert.ok(auditAt > -1 && guardAt > -1 && returnAt > -1);
  assert.ok(guardAt < returnAt, 'the guard must come before the downloads are returned');
});

test('the failure says nothing about the database or the URLs', () => {
  const guard = fn.match(/if \(auditError\) \{[\s\S]*?\n  \}/)[0];
  assert.ok(guard.includes('500'));
  assert.ok(!/auditError\.(message|details|hint|code)/.test(guard), 'no database detail may leak');
  assert.ok(!guard.includes('downloads'), 'no URL may be returned alongside the failure');
  assert.ok(!/console\.(log|error|warn)/.test(guard), 'nothing is logged here');
});

/* Signed URLs must not reach a log anywhere in the function. */
test('no signed URL is ever logged', () => {
  assert.ok(!/console\.(log|error|warn|info)/.test(fn), 'this function logs nothing at all');
});
