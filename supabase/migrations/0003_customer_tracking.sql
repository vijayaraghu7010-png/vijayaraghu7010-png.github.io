/* Letting a customer see where their order has got to.

   Two people may ask: the one who placed it and never made an account,
   and the one who signed in. Neither is trusted to say which order is
   theirs. The guest proves it with something they were sent; the
   signed-in customer proves it with a session this system issued.

   Nothing here opens a door into the orders table. Every new table is
   row-level-secured with no policy at all, exactly as upload_sessions
   is: they exist to be read by an Edge Function holding the service
   role and by nothing else. The customer's own view of an order is
   assembled in a function, field by chosen field, because the row
   itself holds a delivery address, a phone number and payment
   identifiers that are none of a tracking page's business.

   Everything is additive. The only change to an existing table is one
   nullable column.                                                  */

-- -------------------------------------------------------------- orders

/* Who this order belongs to, once anybody has proved it belongs to
   them. Null for every order placed so far, and null for every guest
   checkout hereafter: an order with no account is still an order.

   on delete set null, not cascade. If an account goes, the order it
   claimed stays - a sale that happened goes on having happened. */
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

/* Only the claimed ones are ever looked up this way, so the index
   carries only those. */
create index if not exists orders_user_idx
  on public.orders (user_id, created_at desc)
  where user_id is not null;

-- ------------------------------------------------- tracking tokens

/* A link that shows one order's progress, and nothing else.

   The same shape as upload_sessions, for the same reason: only the
   hash is kept, so the table is worth nothing to anybody who reads
   it. The raw token exists in the reply that created it and in
   whatever message carries it to the customer, and nowhere else -
   not in a row, not in an event, not in a log.

   It authorises reading a status. It does not authorise downloading a
   photograph, changing an order, or seeing any other order. */
create table if not exists public.order_tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists order_tracking_tokens_order_idx
  on public.order_tracking_tokens (order_id);

create index if not exists order_tracking_tokens_live_idx
  on public.order_tracking_tokens (expires_at)
  where revoked_at is null;

-- ------------------------------------------------ lookup codes

/* The other way in: the customer knows their order code and their
   email address, and proves the address is theirs by reading a short
   code out of it.

   The code is six digits because a person has to type it, which is
   also why it is short-lived, single-use and counted. Five wrong
   guesses and it is spent; a million-to-one guess inside ten minutes
   with five attempts is not a way in.

   The address is stored as a hash too. The orders table already holds
   it in clear - this one does not need a second copy. */
create table if not exists public.order_lookup_codes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  email_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists order_lookup_codes_order_idx
  on public.order_lookup_codes (order_id, created_at desc);

create index if not exists order_lookup_codes_live_idx
  on public.order_lookup_codes (expires_at)
  where consumed_at is null;

-- ------------------------------------------------ rate limiting

/* How often somebody has asked lately.

   Order codes run in sequence, so guessing one is easy and the only
   real defence is that guessing is slow. The key is a hash of who is
   asking and what they are asking about, so the table never holds an
   address or an order code of its own.

   A fixed window, not a sliding one: cruder, and a single row per
   caller per window instead of a row per attempt. */
create table if not exists public.lookup_attempts (
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (key_hash, window_start)
);

create index if not exists lookup_attempts_window_idx
  on public.lookup_attempts (window_start);

-- ------------------------------------------------------------- RLS

/* On, forced, and deliberately without a single policy - the same
   arrangement upload_sessions has. A browser holding the publishable
   key can read none of this. Only an Edge Function with the service
   role can, and each one returns a shape it has chosen rather than a
   row it has found.

   The existing policies on orders, order_items, order_photos and
   order_events are not touched. No customer policy is added to
   orders: the row holds an address, a phone number and payment
   identifiers, and a tracking page needs none of them. */
alter table public.order_tracking_tokens enable row level security;
alter table public.order_lookup_codes    enable row level security;
alter table public.lookup_attempts       enable row level security;

alter table public.order_tracking_tokens force row level security;
alter table public.order_lookup_codes    force row level security;
alter table public.lookup_attempts       force row level security;

/* ------------------------------------------------------------------
   Rolling this back

     drop table if exists public.lookup_attempts;
     drop table if exists public.order_lookup_codes;
     drop table if exists public.order_tracking_tokens;
     drop index if exists public.orders_user_idx;
     alter table public.orders drop column if exists user_id;

   Dropping user_id loses which account had claimed which order and
   nothing else. No order, item, photograph or event is touched by
   either direction of this migration.                              */
