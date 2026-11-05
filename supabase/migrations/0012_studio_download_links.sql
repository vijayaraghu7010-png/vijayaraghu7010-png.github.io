-- A link the studio can download an order's photographs from.
--
-- When a customer finishes uploading, the studio is told by email.
-- That mail carries a link that fetches the photographs without
-- anybody signing in, because the studio reads it on a phone and the
-- point is to get the pictures to the person printing them.
--
-- The link is therefore a credential, and is treated as one. It is
-- the same arrangement the customer's tracking link already uses:
--
--   * only a hash is stored, so this table is worth nothing if read
--   * it reaches exactly one order and nothing else
--   * it expires
--   * it can be revoked
--   * every use is written down
--
-- Fourteen days, because an order is printed, packed and sent inside
-- that, and a link that outlives the job it was for is a link
-- somebody finds in an old inbox a year later.

create table if not exists public.order_download_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  used_count integer not null default 0,
  revoked_at timestamptz
);

create index if not exists order_download_tokens_order_idx
  on public.order_download_tokens (order_id);

-- Service role only. No policy is deliberate: nothing outside the
-- Edge Functions has any business reading or writing these, and a
-- table with RLS on and no policy is reachable by nobody else.
alter table public.order_download_tokens enable row level security;
