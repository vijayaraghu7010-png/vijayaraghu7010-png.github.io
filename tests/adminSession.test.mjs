import test from 'node:test';
import assert from 'node:assert/strict';

import { adminAccessToken, SessionEnded } from '../src/lib/adminSession.js';

/* What the panel says when the session has quietly gone.

   A token that has expired is refreshed by supabase-js on the next
   call, and that refresh is a network request. When it cannot be
   made, getSession throws, and what reached the Shipping panel was
   the browser's own words - "Failed to fetch" - under a Save button
   that looked perfectly ready. The studio is told nothing about what
   happened or what to do, and what they have to do is sign in again.

   There is a second half to it: the panel paints from a remembered
   marker, and that marker had outlived the session it stood for by
   over a week. So the panel came up looking signed in and failed on
   the first thing anybody pressed. Clearing it is what sends them
   back to the sign-in screen instead of leaving them there. */

function store() {
  const data = { 'ws-admin-session': '{"id":"admin","at":"2026-10-27T07:48:37.143Z"}' };
  globalThis.window = {
    localStorage: {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = v; },
      removeItem: (k) => { delete data[k]; }
    }
  };
  return data;
}

const clientWith = (impl) => ({ auth: { getSession: impl } });

test('a live session hands back its token', async () => {
  store();
  const token = await adminAccessToken(
    clientWith(async () => ({ data: { session: { access_token: 'GOOD-TOKEN' } } }))
  );
  assert.equal(token, 'GOOD-TOKEN');
});

test('a refresh that cannot be made says so in words, not "Failed to fetch"', async () => {
  /* This is the reported fault, exactly: getSession throwing a
     TypeError from the network layer. */
  store();
  await assert.rejects(
    () => adminAccessToken(clientWith(async () => { throw new TypeError('Failed to fetch'); })),
    (err) => {
      assert.equal(err.sessionEnded, true);
      assert.match(err.message, /session has ended/i);
      assert.doesNotMatch(err.message, /failed to fetch/i);
      return true;
    }
  );
});

test('no session at all says the same thing', async () => {
  store();
  await assert.rejects(
    () => adminAccessToken(clientWith(async () => ({ data: { session: null } }))),
    (err) => err.sessionEnded === true && /sign in again/i.test(err.message)
  );
});

test('a session with no token is no session', async () => {
  store();
  await assert.rejects(
    () => adminAccessToken(clientWith(async () => ({ data: { session: {} } }))),
    (err) => err.sessionEnded === true
  );
});

test('the stale marker is cleared, so the panel stops pretending', async () => {
  const data = store();
  assert.ok(data['ws-admin-session'], 'the marker starts out there');

  await assert.rejects(() => adminAccessToken(clientWith(async () => ({ data: { session: null } }))));

  assert.equal(data['ws-admin-session'], undefined,
    'a marker outliving its session is why the panel came up looking signed in');
});

test('a live session leaves the marker alone', async () => {
  const data = store();
  await adminAccessToken(clientWith(async () => ({ data: { session: { access_token: 'T' } } })));
  assert.ok(data['ws-admin-session'], 'nothing to clear while the session is good');
});

test('storage that refuses to be written does not swallow the real error', async () => {
  /* A private window throws on removeItem. The studio still needs to
     be told their session has ended. */
  globalThis.window = {
    localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); }
    }
  };
  await assert.rejects(
    () => adminAccessToken(clientWith(async () => ({ data: { session: null } }))),
    (err) => err instanceof SessionEnded
  );
});
