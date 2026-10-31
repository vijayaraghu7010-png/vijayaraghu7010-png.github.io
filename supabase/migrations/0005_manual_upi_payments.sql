/* Taking money by hand, for now.

   There is no payment gateway here and this migration does not add
   one. A customer pays into the studio's UPI account with whichever
   app they use, tells the shop the reference number, and somebody at
   the studio opens their banking app and checks the money actually
   arrived. That last step is the only thing in this design that
   constitutes proof. Everything else is a claim.

   That is worth saying plainly, because the temptation in a system
   like this is to treat a screenshot or a reference number as
   evidence. They are not. A screenshot is an image anybody can make,
   and a reference number is a string anybody can type. What this
   schema does is record the claim, keep it apart from the order's own
   state, and make sure the order cannot become paid until a named
   administrator says they saw the credit.

   Three ideas run through it:

   First, a payment submission is not an order status. The order goes
   on being 'pending' while a submission sits at 'submitted'. They are
   different facts about different things, and collapsing them would
   mean a customer's claim could move the order.

   Second, every attempt is kept. A rejected submission is not
   deleted, and a correction is a new row rather than an edit, so the
   history of what was claimed and who decided what survives.

   Third, a payment screenshot is not a customer photograph. It lives
   under its own prefix, in its own table, and the photo deletion that
   runs when an order is completed cannot see it.

   Additive throughout. One existing constraint is widened; no column
   is renamed, dropped or back-filled.                               */

-- ------------------------------------------------- the provider list

/* The orders table was written when Razorpay was the plan, and its
   check constraint still says so. UPI has to be allowed alongside it.

   The constraint was declared inline in 0001, so PostgreSQL named it
   rather than us. Rather than guess that name, this finds whichever
   check constraint on orders mentions payment_provider and replaces
   it with one that has a name we chose. If 0001 is ever re-run on a
   fresh database the inline constraint comes back; running this again
   is harmless, because it looks for whatever is actually there.

   'razorpay' stays in the list. Nothing uses it today, and removing
   it would make a future gateway a schema change rather than a
   decision. */
do $$
declare
  existing text;
begin
  select con.conname into existing
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'orders'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%payment_provider%'
  limit 1;

  if existing is not null then
    execute format('alter table public.orders drop constraint %I', existing);
  end if;
end $$;

alter table public.orders
  add constraint orders_payment_provider_allowed
  check (payment_provider is null or payment_provider in ('upi', 'razorpay'));

-- ------------------------------------------------ payment submissions

/* What a customer says they paid.

   One row per attempt. A correction is a new row, not an edit of the
   old one, so "what did they tell us the first time" is always
   answerable.

   amount_paise is what the order cost when the submission was made,
   copied here so that a later price change cannot quietly make an old
   payment look correct. The administrator compares it against the
   credit they can see in the account.

   proof_r2_key must begin with payments/. That is a structural
   guarantee rather than a convention: a payment proof cannot be
   written into the orders/ tree where customer photographs live, so
   the photo deletion in photos-delete - which only ever removes keys
   recorded in order_photos, and refuses any key outside its own
   order's folder - cannot reach it by any route. */
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  /* Which app the customer says they used. 'other' exists because a
     customer may pay from a bank app nobody listed. */
  method text not null
    check (method in ('gpay', 'phonepe', 'paytm', 'other')),

  /* The bank's reference for the transfer, as the customer typed it,
     and the same string folded to upper case for comparison. Banks
     are inconsistent about case and spacing; the comparison column
     is generated so the two can never drift apart. */
  utr text not null check (length(trim(utr)) between 6 and 40),
  utr_normalised text generated always as (upper(regexp_replace(utr, '\s', '', 'g'))) stored,

  amount_paise integer not null check (amount_paise > 0),

  proof_r2_key text not null unique check (proof_r2_key like 'payments/%'),
  proof_content_type text not null
    check (proof_content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  proof_byte_size bigint not null check (proof_byte_size > 0),

  /* Where this claim has got to. Nothing to do with the order's own
     status, which stays 'pending' until somebody verifies. */
  status text not null default 'submitted'
    check (status in ('submitted', 'verified', 'rejected', 'correction_requested')),

  /* Who decided, when, and why. Null until somebody has. */
  decided_by text,
  decided_at timestamptz,
  decision_note text check (length(decision_note) <= 500),

  customer_note text check (length(customer_note) <= 500),

  created_at timestamptz not null default now(),

  /* A decision needs a decider. Either both are set or neither is. */
  constraint order_payments_decision_complete
    check ((decided_by is null) = (decided_at is null)),
  constraint order_payments_decided_when_settled
    check (status = 'submitted' or decided_at is not null)
);

create index if not exists order_payments_order_idx
  on public.order_payments (order_id, created_at desc);

/* The administrator's queue: what is waiting to be looked at. */
create index if not exists order_payments_waiting_idx
  on public.order_payments (created_at)
  where status = 'submitted';

/* One reference number, one live claim.

   A bank reference identifies one transfer. Two orders claiming the
   same one means at most one of them was paid, so the second is
   refused before it reaches an administrator.

   Rejected rows are excluded. If a submission was turned down because
   the number was mistyped, the customer should be able to try again -
   and if they genuinely retype the same wrong number, the
   administrator will see the earlier rejection in the history. */
create unique index if not exists order_payments_utr_live_idx
  on public.order_payments (utr_normalised)
  where status <> 'rejected';

-- -------------------------------------------------- what happened when

/* The history of a payment, append-only.

   order_payments holds the current state of each attempt; this holds
   how it got there. Kept separate from order_events because that
   table is the customer's timeline and this is the studio's record -
   it names administrators, and a customer has no business reading it.

   order_id is carried alongside payment_id so the studio can ask
   "everything that ever happened about this order's money" without a
   join through a row that may have been superseded. */
create table if not exists public.order_payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.order_payments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,

  event text not null
    check (event in ('payment.submitted', 'payment.verified',
                     'payment.rejected', 'payment.correction_requested')),

  /* 'customer' for a submission, an administrator's address for a
     decision. The same convention order_events already uses. */
  actor text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_payment_events_payment_idx
  on public.order_payment_events (payment_id, created_at desc);

create index if not exists order_payment_events_order_idx
  on public.order_payment_events (order_id, created_at desc);

-- ------------------------------------------------------------- RLS

/* On, forced, and with no policy at all - the same arrangement
   upload_sessions, order_tracking_tokens and the rest already have.

   A browser holding the publishable key can read none of this, and
   that includes the customer who made the submission. Their own view
   of it comes from an Edge Function that returns the few fields a
   customer should see: that a payment is being checked, or that it
   was accepted, or that it was turned down and why. Not the reference
   number of somebody else's transfer, and not an administrator's
   name.

   No customer policy is added to orders either. Nothing about this
   migration changes who may read an order. */
alter table public.order_payments       enable row level security;
alter table public.order_payment_events enable row level security;

alter table public.order_payments       force row level security;
alter table public.order_payment_events force row level security;

-- --------------------------------------------- where to pay, publicly

/* The studio's own UPI details, as the checkout page shows them.

   These are deliberately not secret: a UPI ID is printed on a shop
   counter, and the QR code is a picture of it. They live in settings,
   which is world-readable, because the whole point is that every
   customer sees them.

   They are seeded EMPTY and disabled. Nothing here invents a UPI ID,
   and the payment page is expected to refuse to show instructions
   while enabled is false - a wrong UPI ID would send a customer's
   money to a stranger, which is worse than a checkout that politely
   says payment is not available yet.

   Filling this in is a deliberate act by whoever runs the studio:

     update public.settings
        set value = jsonb_build_object(
              'enabled', true,
              'upi_id', '<the real UPI ID>',
              'display_name', '<the name the app will show>',
              'qr_asset', '/images/payments/upi-qr.png',
              'apps', jsonb_build_array('gpay', 'phonepe', 'paytm'))
      where key = 'payments.upi';                                    */
insert into public.settings (key, value)
values ('payments.upi', jsonb_build_object(
  'enabled', false,
  'upi_id', '',
  'display_name', '',
  'qr_asset', '',
  'apps', jsonb_build_array('gpay', 'phonepe', 'paytm')
))
on conflict (key) do nothing;

/* ------------------------------------------------------------------
   Rolling this back

     drop table if exists public.order_payment_events;
     drop table if exists public.order_payments;
     delete from public.settings where key = 'payments.upi';

     alter table public.orders drop constraint if exists
       orders_payment_provider_allowed;
     alter table public.orders add constraint orders_payment_provider_check
       check (payment_provider in ('razorpay'));

   What that loses: every payment submission and its history. If any
   order has already been marked paid through this flow, the order
   keeps its paid status and its payment_id - only the evidence behind
   the decision goes. So before rolling back on a database that has
   taken real money, export order_payments first.

   What it does not touch: orders, order_items, order_photos,
   order_events, or anything in R2. Restoring the old provider
   constraint will fail if any order already has payment_provider =
   'upi'; clear those first, or leave the wider constraint in place -
   it permits strictly more than the original and breaks nothing.  */
