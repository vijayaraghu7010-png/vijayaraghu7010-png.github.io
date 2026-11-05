/* No usable session, said once and the same way everywhere.

   A token that has expired is refreshed by supabase-js on the next
   call, and that refresh is a network request. When it cannot be
   made - offline, or the auth endpoint refusing - getSession throws,
   and what reached the panel was the browser's own words: "Failed to
   fetch". That tells somebody nothing about what to do, and what
   they have to do is sign in again.

   The remembered marker goes with it. It is only there to paint the
   panel on the way back, and a marker outliving the session it
   stands for is how the panel comes up looking signed in and then
   fails on the first thing anybody presses. */
export class SessionEnded extends Error {
  constructor() {
    super('Your session has ended. Sign in again.');
    this.name = 'SessionEnded';
    this.sessionEnded = true;
  }
}

export async function adminAccessToken(client) {
  let session = null;
  try {
    const { data } = await client.auth.getSession();
    session = data?.session ?? null;
  } catch {
    /* the refresh could not be made at all */
    session = null;
  }

  if (!session?.access_token) {
    try {
      window.localStorage.removeItem('ws-admin-session');
    } catch {
      /* a private window has nothing to clear */
    }
    throw new SessionEnded();
  }

  return session.access_token;
}
