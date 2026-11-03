-- A shipping charge the studio can set.
--
-- The shop has always said "shipping charged separately" and settled
-- it by message afterwards. This lets the studio put a number on it
-- instead, decided server-side on every order like every other price.
--
-- Two pieces: somewhere to keep the setting, and somewhere to record
-- what each order actually paid.

-- What was charged, kept on the order itself rather than inferred
-- later by subtracting. The rate can change between one order and the
-- next, so an order that does not record its own shipping cannot be
-- reconciled afterwards.
--
-- Default 0 and NOT NULL, so every order already placed reads as
-- "nothing was charged for delivery", which is exactly what happened.
alter table public.orders
  add column if not exists shipping_paise integer not null default 0;

alter table public.orders
  drop constraint if exists orders_shipping_paise_check;

alter table public.orders
  add constraint orders_shipping_paise_check check (shipping_paise >= 0);

-- The setting itself. Inserted switched OFF, so applying this
-- migration changes nothing a customer sees: the shop goes on saying
-- delivery is arranged separately until somebody turns it on in the
-- panel and gives it an amount.
--
-- free_above_paise is null rather than 0 on purpose - 0 would read as
-- "free above nothing", which is free for everybody.
insert into public.settings (key, value)
values (
  'shipping.config',
  jsonb_build_object(
    'enabled', false,
    'flat_paise', 0,
    'free_above_paise', null,
    'note', ''
  )
)
on conflict (key) do nothing;
