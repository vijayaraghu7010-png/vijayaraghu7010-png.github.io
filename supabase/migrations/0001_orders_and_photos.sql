/* Orders, and the customer photographs that belong to them.

   Five tables. An order is what somebody asked for and what they paid;
   its items are the lines of that order, each carrying the customiser's
   own configuration as it already leaves the browser; its photos are
   rows pointing at objects in a private Cloudflare R2 bucket.

   Two rules shape all of it:

   - Nobody reads these tables from a browser except an administrator.
     There are no customer accounts, so there is no customer policy to
     write: RLS is on with no policy for anon, which denies everything.
     The Edge Functions reach them with the service role.

   - order_photos is the only record of what was uploaded. Deleting an
     order's photographs means deleting exactly the keys listed here,
     never everything under a prefix. A bucket listing can contain
     something this table does not know about; that object is not ours
     to remove.                                                       */

-- ---------------------------------------------------------------- orders

create sequence if not exists public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),

  /* What a customer and the studio say out loud. The id is a UUID
     because it ends up in storage keys and must not be guessable;
     this is the one people quote. */
  order_code text not null unique
    default 'WS-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY')
            || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0'),

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'in_progress', 'completed', 'cancelled')),

  customer_name  text not null check (length(trim(customer_name)) between 1 and 120),
  customer_email text not null check (customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  customer_phone text not null check (customer_phone ~ '^[0-9+][0-9 +-]{7,19}$'),

  address_line1 text not null check (length(trim(address_line1)) between 1 and 200),
  address_line2 text check (length(address_line2) <= 200),
  city          text not null check (length(trim(city)) between 1 and 80),
  state         text not null check (length(trim(state)) between 1 and 80),
  pincode       text not null check (pincode ~ '^[1-9][0-9]{5}$'),

  /* Money is whole paise. Never a float: ₹6 a print times 9 prints has
     to be 5400 every time, on every machine. */
  subtotal_paise integer not null default 0 check (subtotal_paise >= 0),
  shipping_paise integer not null default 0 check (shipping_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  total_paise    integer not null default 0 check (total_paise >= 0),
  currency       text    not null default 'INR' check (currency = 'INR'),

  /* Phase 2 fills these in. They exist now so that adding Razorpay is
     a function and a migration of data, not a migration of shape. */
  payment_provider text check (payment_provider in ('razorpay')),
  payment_order_id text,
  payment_id       text,
  payment_status   text not null default 'unpaid'
    check (payment_status in ('unpaid', 'created', 'paid', 'failed', 'refunded')),

  notes text check (length(notes) <= 2000),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  paid_at      timestamptz,
  completed_at timestamptz,

  /* Null while the studio still holds the customer's photographs. Set
     once an administrator has confirmed their deletion; the order
     itself stays here for good. */
  photos_deleted_at timestamptz,
  photo_bytes_total bigint not null default 0 check (photo_bytes_total >= 0)
);

comment on table public.orders is
  'One customer order. Kept permanently, including after its photographs are deleted.';

create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_created_idx        on public.orders (created_at desc);
create index orders_email_idx          on public.orders (lower(customer_email));

/* The sweeper that clears abandoned baskets only ever looks at pending
   orders, and they are the small minority. */
create index orders_pending_idx on public.orders (created_at)
  where status = 'pending';

/* Orders still holding photographs: what the admin panel's "to delete"
   view asks for. */
create index orders_holding_photos_idx on public.orders (completed_at)
  where photos_deleted_at is null;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------- order items

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  product_id   text not null,
  product_name text not null,
  category     text not null,

  /* Which customiser produced this line, and so which photo limit and
     which shape of config applies. Null for a product bought off the
     shelf with nothing to customise. */
  customiser text check (customiser in ('polaroid', 'magazine', 'bouquet', 'frame', 'hamper-3d', 'poster')),

  quantity         integer not null check (quantity between 1 and 999),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0),

  /* Exactly what the customiser already puts in the cart line: border
     and captions, size and flowers, the hamper's design document. It
     is stored as it arrives so no customiser had to change to be sold. */
  config jsonb not null default '{}'::jsonb,

  position integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.order_items is
  'The lines of an order. config holds the customiser output unchanged.';

create index order_items_order_idx on public.order_items (order_id, position);

-- ---------------------------------------------------------- order photos

create table public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,

  /* The object in R2. Unique, so the same key can never be claimed by
     two orders, and so a replayed completion cannot double-count. */
  r2_key text not null unique,

  original_filename text not null check (length(original_filename) <= 300),
  content_type      text not null check (content_type in (
                      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  byte_size         bigint not null check (byte_size > 0),
  checksum          text,

  /* reserved: a URL was handed out and the browser may still be
     uploading. uploaded: the server has seen the object in the bucket.
     failed: it never arrived and the slot can be asked for again. */
  upload_status text not null default 'reserved'
    check (upload_status in ('reserved', 'uploaded', 'failed')),

  position   integer not null default 0,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  deleted_at  timestamptz
);

comment on table public.order_photos is
  'The manifest of customer photographs. Deletion removes exactly these keys and no others.';

create index order_photos_order_idx on public.order_photos (order_id, position);
create index order_photos_item_idx  on public.order_photos (order_item_id);

/* What the deletion function reads: this order's objects that are
   still in the bucket. */
create index order_photos_live_idx on public.order_photos (order_id)
  where deleted_at is null;

-- ---------------------------------------------------------- order events

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,

  /* The administrator's email, or 'system' / 'customer'. Who did it is
     part of the record, especially for a deletion. */
  actor  text not null,
  event  text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.order_events is
  'Append-only history of an order. Never updated, never deleted.';

create index order_events_order_idx on public.order_events (order_id, created_at desc);

-- -------------------------------------------------------- upload sessions

/* There are no customer accounts, so a browser proves it owns a pending
   order by holding a token it was handed when the order was made. Only
   the hash is kept here: the token itself exists in that one browser
   and in nothing we store. It stops being worth anything the moment the
   order leaves 'pending'. */
create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  photo_count integer not null default 0 check (photo_count >= 0),
  bytes_used  bigint  not null default 0 check (bytes_used >= 0),
  created_at timestamptz not null default now()
);

create index upload_sessions_order_idx   on public.upload_sessions (order_id);
create index upload_sessions_expires_idx on public.upload_sessions (expires_at);

-- ------------------------------------------------------------------ RLS

/* On, and forced, so that not even the table owner reads around it.

   orders, order_items, order_photos and order_events get one policy
   each: an administrator may look. public.is_admin() already exists -
   it matches the signed-in email against the admins table - and is
   wrapped in a select so it runs once for the query rather than once
   per row.

   There is deliberately no insert, update or delete policy anywhere
   here, and no policy at all on upload_sessions. Every write, and
   every look at a token, happens in an Edge Function holding the
   service role. A browser cannot create an order, change a price, or
   mark anything completed by talking to the database directly. */

alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.order_photos    enable row level security;
alter table public.order_events    enable row level security;
alter table public.upload_sessions enable row level security;

alter table public.orders          force row level security;
alter table public.order_items     force row level security;
alter table public.order_photos    force row level security;
alter table public.order_events    force row level security;
alter table public.upload_sessions force row level security;

create policy orders_admin_read on public.orders
  for select to authenticated using ((select public.is_admin()));

create policy order_items_admin_read on public.order_items
  for select to authenticated using ((select public.is_admin()));

create policy order_photos_admin_read on public.order_photos
  for select to authenticated using ((select public.is_admin()));

create policy order_events_admin_read on public.order_events
  for select to authenticated using ((select public.is_admin()));

-- ------------------------------------------------------- upload limits

/* How many photographs each kind of product takes, and how big each one
   may be. It lives in settings rather than in the code because it is a
   studio decision - a longer magazine, a cheaper plan - and changing it
   should not need a deploy.

   The counts are per order line. The sizes are bytes. */
insert into public.settings (key, value)
values ('uploads.limits', jsonb_build_object(
  'max_photos_by_customiser', jsonb_build_object(
    'polaroid',  120,
    'magazine',  100,
    'poster',     50,
    'frame',      30,
    'bouquet',    50,
    'hamper-3d',  50
  ),
  'max_photos_default', 50,
  'max_photos_per_order', 300,
  'max_bytes_per_photo', 26214400,
  'max_bytes_per_order', 2147483648,
  'allowed_types', jsonb_build_array(
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
))
on conflict (key) do nothing;
