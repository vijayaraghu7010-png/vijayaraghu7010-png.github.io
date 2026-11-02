/* A bag that follows the customer rather than the browser.

   Until now the bag and the wishlist lived in localStorage and nowhere
   else, so the same account showed twelve items on a phone and none on
   a laptop. They belong to the person, not to the device.

   One row per account, holding the whole bag as it stands. There is no
   history and no line table: this is a draft the customer is still
   changing, and the moment it becomes something the studio must honour
   it is copied into orders, which is where the real record lives. The
   server still prices every order itself, so nothing here is ever
   trusted as money - a line is a product id, a count and the choices
   made, and the quantity is re-checked against the catalogue at
   checkout exactly as a guest's would be.

   The photographs do not come here. They are kept in the browser that
   chose them and uploaded when the order is placed, so a line added on
   a phone arrives on a laptop without its pictures; the checkout
   already says so in those words and asks for them again. Changing
   that means uploading pictures for bags that may never be ordered,
   which is a different decision with a storage bill attached.

   Row-level security with no policy, exactly as upload_sessions and
   the tracking tables do it: nothing reaches this table except an Edge
   Function holding the service role, which checks the caller's token
   with Supabase rather than believing the browser.                  */

create table public.customer_bags (
  /* The account is the key - one bag each, replaced as it changes. */
  user_id uuid primary key references auth.users (id) on delete cascade,

  /* The basket lines, as the cart context holds them: product id,
     quantity, and the customiser's own config. Shape is the browser's;
     this table does not interpret it. */
  lines jsonb not null default '[]'::jsonb,

  /* Wishlist is a plain list of product ids and rides along, because
     it has the same problem and the same answer. */
  wishlist jsonb not null default '[]'::jsonb,

  /* Last writer wins, and this is how a stale tab finds out it lost.
     The browser sends the stamp it last saw; a newer one on the row
     means another device has written since, and the two are merged
     rather than one being thrown away. */
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  /* A bag is not a warehouse. Both guard against a runaway client
     filling the table rather than against an honest customer. */
  constraint customer_bags_lines_sane check (jsonb_array_length(lines) <= 100),
  constraint customer_bags_wishlist_sane check (jsonb_array_length(wishlist) <= 200)
);

comment on table public.customer_bags is
  'One draft bag and wishlist per account, synced across that customer''s devices. Not an order.';

alter table public.customer_bags enable row level security;
alter table public.customer_bags force row level security;

/* No policy, by design. The service role bypasses RLS; everybody else
   is refused, including a signed-in customer holding their own token.
   The bag is reached through the cart-sync function and nowhere else. */

create trigger customer_bags_touch_updated_at
  before update on public.customer_bags
  for each row execute function public.touch_updated_at();
