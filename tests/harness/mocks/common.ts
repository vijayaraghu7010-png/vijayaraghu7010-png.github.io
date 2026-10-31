/* Test double. Only the surface the real function imports.
   State lives on globalThis so the test can drive it. */
const g: any = globalThis as any;
g.__state = g.__state || { admin: { email: 'admin@example.com' }, order: null, photos: [],
                           auditError: null, auditCalls: [], callOrder: [] };
const state = g.__state;

export function corsHeaders(origin: string | null) {
  return { 'Access-Control-Allow-Origin': origin ?? '*' };
}
export function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
}
export function fail(message: string, status: number, origin: string | null) {
  return json({ error: message }, status, origin);
}
export function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}
export async function requireAdmin(_req: any, _db: any) {
  state.callOrder.push('requireAdmin');
  return state.admin;
}
function builder(kind: string) {
  const b: any = {
    select() { return b; },
    eq() { return b; },
    is() { return b; },
    order() { return b; },
    maybeSingle() { state.callOrder.push('read:' + kind); return Promise.resolve({ data: state.order }); },
    insert(row: any) { state.callOrder.push('insert:' + kind); state.auditCalls.push(row);
                       return Promise.resolve({ error: state.auditError }); },
    then(res: any, rej: any) { state.callOrder.push('read:' + kind);
                               return Promise.resolve({ data: state.photos }).then(res, rej); }
  };
  return b;
}
export function serviceClient() { return { from: (t: string) => builder(t) }; }
