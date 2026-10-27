# WrappedStudio — admin panel

The shop is a Vite/React site. The catalogue and copy ship in the
bundle; orders, customer photographs and signing in go through
Supabase and a private Cloudflare R2 bucket. The admin panel
lives at `/admin` in the same app but ships as its own bundle, so a
customer never downloads it.

| Piece | What it does |
| --- | --- |
| `src/data/` | the catalogue and copy the site ships with |
| `src/lib/store.js` | the editable copy of that, kept in the browser |
| `src/lib/adminAuth.js` | signing in, and who counts as an administrator |
| `src/lib/supabaseClient.js` | the one connection to the backend |
| `src/lib/orderClient.js` | placing orders, sending photographs, the panel's calls |
| `src/admin/panels/OrdersPanel.jsx` | the orders, and deleting their photographs |

## Two separate doors

They are not the same login and never lead to each other.

- **Shop** — the Log in button in the header. It makes a customer
  profile (name, wishlist, cart) and lives in `AuthContext`. Whatever
  address is typed, it stays in the shop.
- **Studio** — `/admin`, which asks for an email address and a
  password. There is no link to it from the shop.

Sign in at `/admin` with an address that is in the `admins` table of
the Supabase project, using the password set for that account in
Supabase Auth. Both have to be true: the password proves who you are,
and the `admins` row says that person runs this studio. Being taken off
that list takes effect at once, without waiting for a session to end.

**This used to be a typed ID with no password at all**, and said why:
the shop was static, the panel's edits never left the browser that made
them, and there was nothing behind the door worth locking. It also said
what would have to change first — "this stops being true the moment the
panel writes somewhere shared".

Orders are that moment. A customer's name, telephone number, address
and photographs are now on the other side of this door, so the door is
real, and the check is made by the server rather than by the page
asking it. Every privileged thing the panel does — reading orders,
moving one along, deleting photographs — is checked again by the Edge
Function that does it, against the caller's own token. Nothing is
trusted because the browser said so.

## Where an edit goes

Into `localStorage`, under `ws-site-store`, seeded from `src/data` the
first time the shop is opened. That has one consequence worth being
blunt about:

> **An edit lives in the browser that made it.** It is not published to
> visitors, it does not reach another device, and clearing site data
> puts the shop back to its defaults.

So the panel is for trying things out — a price, a festival palette, a
line of copy — and for seeing them immediately. To change what everyone
sees, edit `src/data/products.js`, `src/data/categories.js` or
`src/data/siteDefaults.js` and ship a build.

## What the admin can do

- **Products** — create, edit, delete; price and price mode (fixed or
  per-unit), images, descriptions, details, occasions, search keywords;
  mark featured; keep a product as an unpublished draft. Pictures under
  512 KB can be dropped in and are kept as data URLs; anything larger
  belongs in `public/images`, where it costs the shop nothing and ships
  with the build — put the path in, e.g. `/images/rose.jpg`.
- **Text** — every string that has a key: hero, page titles and
  subtitles, category cards, benefits, brand and contact lines. A key
  with no row falls back to what is written in the code, so the site
  never breaks.
- **Theme** — edit any palette token with a colour picker, make a theme
  live, or schedule one. **A festival theme with a start and end date
  turns itself on and off** — set Diwali to its week and the whole shop
  changes on the day and reverts after.
- **Offers** — percent or flat discounts, with or without a code, scoped
  to everything / a category / one product, with minimum order, maximum
  discount and a date window.

A save shows in the shop at once, in that tab and in any other tab of
the same browser: `SiteConfigProvider` listens to the store and to the
`storage` event. The one-minute re-check stays, because a scheduled
festival theme turns itself on at a time when nobody is editing.

## Running it

```
npm install
npm run dev        # the shop, and /admin, on 5173
npm run build      # static files into dist/
npm run preview    # serve that build on 4173
```

There is nothing else to run and no keys to set. `dist/` is the whole
site; any static host will serve it.

## Still to build

- Applying offer codes at checkout (offers exist and reach the
  storefront; the cart does not yet redeem a code)
- Orders and customer accounts
