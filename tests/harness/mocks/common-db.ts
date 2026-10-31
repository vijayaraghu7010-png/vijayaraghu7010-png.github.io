/* A small database that lives in memory.

   The Phase 2 mock beside this one answers a single question at a
   time, which was all that function needed. The customer functions
   filter, sort, page, count attempts and claim rows conditionally, so
   this one is a little query engine instead: tables are arrays, and
   the builder narrows them the way PostgREST would.

   It is not Postgres. It knows eq, is, in, order, limit, range and
   the handful of terminals these functions use, and nothing else. It
   is enough to answer the questions that matter - does a second
   claimant find the row already taken, does an expired code fail, is
   an attempt counted - and small enough to read.

   No address, no key, no network. Driving it is how a test decides
   what the database contains.                                     */

const g: any = globalThis as any;

export function resetDb(tables: Record<string, any[]> = {}) {
  g.__db = {
    orders: [],
    order_items: [],
    order_events: [],
    order_tracking_tokens: [],
    order_lookup_codes: [],
    lookup_attempts: [],
    /* The manual UPI tables from 0005, and the settings row that says
       where to pay. Empty by default: a test that cares about
       payments puts rows in, and every other test gets a shop with no
       payments in it, which is what one looks like. */
    order_payments: [],
    order_payment_events: [],
    settings: [],
    ...tables
  };
  g.__authUser = g.__authUser ?? null;
  g.__dbCalls = [];
  g.__orCalls = [];
  return g.__db;
}
export const db = () => (g.__db ||= resetDb());
export const calls = () => (g.__dbCalls ||= []);

export function setAuthUser(user: any) { g.__authUser = user; }

/* ------------------------------------------------------- the engine */

function matches(row: any, filters: any[]) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return String(v) === String(f.val);
    if (f.op === 'is') return f.val === null ? v === null || v === undefined : v === f.val;
    if (f.op === 'in') return f.val.map(String).includes(String(v));
    if (f.op === 'neq') return String(v) !== String(f.val);
    return true;
  });
}

function builder(table: string) {
  const filters: any[] = [];
  let sort: { col: string; asc: boolean } | null = null;
  let slice: { from: number; to: number } | null = null;
  let cap: number | null = null;
  let pending: { kind: 'update' | 'insert' | 'upsert' | 'delete'; payload?: any; conflict?: string } | null = null;

  /* A table nobody has put rows in is empty, not missing. Tests set
     __db by hand and a function reading a table that fixture never
     mentioned - order_payments, say, on an order nobody has paid for -
     should see nothing there rather than crash. */
  const tbl = (): any[] => (db()[table] ||= []);

  const rows = () => {
    let out = tbl().filter((r: any) => matches(r, filters));
    if (sort) {
      out = [...out].sort((a, b) => {
        const x = a[sort!.col], y = b[sort!.col];
        const c = x < y ? -1 : x > y ? 1 : 0;
        return sort!.asc ? c : -c;
      });
    }
    if (slice) out = out.slice(slice.from, slice.to + 1);
    if (cap !== null) out = out.slice(0, cap);
    return out;
  };

  /* Terminals apply whatever write was queued, then answer. */
  const settle = () => {
    calls().push({ table, op: pending?.kind ?? 'select', filters: [...filters] });
    if (!pending) return { data: rows(), error: null };

    /* A way to make one table refuse a write, so the failure paths
       can be reached without breaking anything else. */
    if (g.__failInsert === table && pending.kind === 'insert') {
      return { data: null, error: { message: 'insert failed', code: 'XX000' } };
    }

    if (pending.kind === 'insert') {
      const incoming = Array.isArray(pending.payload) ? pending.payload : [pending.payload];
      const made = incoming.map((r: any) => {
        const row: any = { id: r.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
        /* The database fills these in by default; the mock has to as
           well, or a test sees a column the real insert would have
           returned as missing. */
        if (table === 'orders') {
          row.order_code = row.order_code ?? `WS-FIXTURE-${String(db().orders.length + 1).padStart(4, '0')}`;
          row.status = row.status ?? 'pending';
          row.updated_at = row.updated_at ?? row.created_at;
          row.completed_at = row.completed_at ?? null;
          row.user_id = row.user_id ?? null;
        }
        return row;
      });
      tbl().push(...made);
      return { data: made, error: null };
    }
    if (pending.kind === 'upsert') {
      const r = pending.payload;
      const keys = (pending.conflict || 'id').split(',').map((k) => k.trim());
      const existing = tbl().find((e: any) => keys.every((k) => String(e[k]) === String(r[k])));
      if (existing) { Object.assign(existing, r); return { data: [existing], error: null }; }
      const made = { id: crypto.randomUUID(), ...r };
      tbl().push(made);
      return { data: [made], error: null };
    }
    if (pending.kind === 'update') {
      const hit = rows();
      hit.forEach((r: any) => Object.assign(r, pending!.payload));
      return { data: hit, error: null };
    }
    const doomed = rows();
    g.__db[table] = tbl().filter((r: any) => !doomed.includes(r));
    return { data: doomed, error: null };
  };

  const b: any = {
    select() { return b; },
    eq(col: string, val: any) { filters.push({ op: 'eq', col, val }); return b; },
    is(col: string, val: any) { filters.push({ op: 'is', col, val }); return b; },
    in(col: string, val: any[]) { filters.push({ op: 'in', col, val }); return b; },
    neq(col: string, val: any) { filters.push({ op: 'neq', col, val }); return b; },
    /* Records the raw PostgREST filter expression so a test can prove
       what was handed to it, and otherwise narrows nothing - the real
       narrowing is PostgREST's and is not what these tests check. */
    or(expr: string) { (g.__orCalls ||= []).push({ table, expr }); return b; },
    order(col: string, opts: any = {}) { sort = { col, asc: opts.ascending !== false }; return b; },
    limit(n: number) { cap = n; return b; },
    range(from: number, to: number) { slice = { from, to }; return b; },
    insert(payload: any) { pending = { kind: 'insert', payload }; return b; },
    upsert(payload: any, opts: any = {}) { pending = { kind: 'upsert', payload, conflict: opts.onConflict }; return b; },
    update(payload: any) { pending = { kind: 'update', payload }; return b; },
    delete() { pending = { kind: 'delete' }; return b; },
    maybeSingle() { const r = settle(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }); },
    single() { const r = settle(); return Promise.resolve({ data: r.data[0] ?? null, error: r.data.length ? null : { message: 'no rows' } }); },
    then(res: any, rej: any) { return Promise.resolve(settle()).then(res, rej); }
  };
  return b;
}

/* ------------------------------------- the surface the functions use */

export function corsHeaders(origin: string | null) {
  return { 'Access-Control-Allow-Origin': origin ?? '*' };
}
export function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}
export function fail(message: string, status: number, origin: string | null) {
  return json({ error: message }, status, origin);
}
export function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}
/* Standing in for bump_lookup_attempt from migration 0004. It does
   what the SQL does - one statement, read and write together - so a
   test can prove the limiter counts parallel attempts correctly.
   Setting __noRpc makes it absent, which is what the deployed system
   looks like before 0004 has been run. */
function rpc(name: string, args: any) {
  if (g.__noRpc) return Promise.resolve({ data: null, error: { message: 'function does not exist' } });
  if (name !== 'bump_lookup_attempt') return Promise.resolve({ data: null, error: { message: 'unknown function' } });
  const rows = db().lookup_attempts;
  const hit = rows.find((r: any) => r.key_hash === args.p_key_hash && r.window_start === args.p_window_start);
  if (hit) { hit.count += 1; return Promise.resolve({ data: hit.count, error: null }); }
  rows.push({ key_hash: args.p_key_hash, window_start: args.p_window_start, count: 1 });
  return Promise.resolve({ data: 1, error: null });
}

export function serviceClient() {
  return {
    from: (t: string) => builder(t),
    rpc,
    auth: {
      getUser: async (token: string) => {
        if (!token || token === 'anon-key') return { data: { user: null }, error: null };
        if (token === 'bad') return { data: { user: null }, error: { message: 'bad jwt' } };
        return { data: { user: g.__authUser }, error: g.__authUser ? null : { message: 'no user' } };
      }
    }
  } as any;
}

/* Nobody, unless a test says otherwise. The customer functions never
   call this; payments-admin calls it on every request, so a test
   signs in by putting an address in __admin and signs out by
   clearing it. The real one asks Supabase and then the admins table;
   this one only has to answer the same shape. */
export async function requireAdmin() {
  return g.__admin ? { email: String(g.__admin) } : null;
}

/* orders-create reads the studio's upload limits. They are Phase 1's
   and are tested there; here they only need to exist. */
export async function getLimits(_db?: any) {
  return {
    max_photos_by_customiser: { polaroid: 120, magazine: 100, poster: 50, frame: 30, bouquet: 50, 'hamper-3d': 50 },
    max_photos_default: 50,
    max_photos_per_order: 300,
    max_bytes_per_photo: 26214400,
    max_bytes_per_order: 2147483648,
    allowed_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  };
}
export function photoLimitFor(limits: any, customiser: string | null): number {
  if (!customiser) return limits.max_photos_default;
  return limits.max_photos_by_customiser[customiser] ?? limits.max_photos_default;
}

export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
