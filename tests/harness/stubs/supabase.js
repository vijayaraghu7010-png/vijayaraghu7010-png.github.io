/* Stub of the supabase-js surface supabaseClient.js uses.
   The session is controllable so an expired session can be simulated. */
const g = globalThis;
g.__session = g.__session === undefined ? { access_token: 'TEST-SESSION-TOKEN' } : g.__session;
export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: g.__session ? { session: g.__session } : null }),
      signInWithPassword: async () => ({ data: null, error: null }),
      signOut: async () => ({})
    },
    rpc: async () => ({ data: true, error: null })
  };
}
