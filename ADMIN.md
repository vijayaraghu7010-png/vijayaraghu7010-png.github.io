# WrappedStudio — admin panel

The shop is a Vite/React site with no backend at all. The admin panel
lives at `/admin` in the same app but ships as its own bundle, so a
customer never downloads it.

| Piece | What it does |
| --- | --- |
| `src/data/` | the catalogue and copy the site ships with |
| `src/lib/store.js` | the editable copy of that, kept in the browser |
| `src/lib/adminAuth.js` | the one ID and password that open the panel |

## Two separate doors

They are not the same login and never lead to each other.

- **Shop** — the Log in button in the header. It makes a customer
  profile (name, wishlist, cart) and lives in `AuthContext`. Whatever
  address is typed, it stays in the shop.
- **Studio** — `/admin`, with its own ID and password. There is no link
  to it from the shop.

The administrator ID is `admin` and the password this ships with is
`wrapped-admin`. Change it from **Password** in the admin bar; only a
SHA-256 hash is stored, and only in that browser. To change the one in
the source, replace `DEFAULT_HASH` in `src/lib/adminAuth.js` with the
output of:

```
node -e "console.log(require('crypto').createHash('sha256').update('your-password').digest('hex'))"
```

**What this login is and is not.** The site is static, so the check
runs in the browser and everything it needs is in the bundle: somebody
determined can step past it with the developer tools. It keeps the
panel out of the way of ordinary visitors, which is all it has to do —
there is nothing behind it worth taking, because an edit made there
only changes that one browser.

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
