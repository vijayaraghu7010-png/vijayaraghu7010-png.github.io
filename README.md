# WrappedStudio

A React + Vite storefront for **WrappedStudio** — personalised magazines, polaroid
prints and handmade bouquets. Sunset-inspired editorial design, built to match the
supplied reference layout.

> *More than gifts, a little piece of your story.*

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the built app
```

## Stack

React 18 · Vite 5 · React Router 6 · Lucide React icons · custom CSS (no UI framework).

## Structure

```
index.html
public/images/          photography (hero, categories, products, avatars)
src/
  components/           Header, MobileMenu, HeroSection, CategorySection,
                        BenefitsStrip, ProductCard/Grid, FeaturedProducts,
                        CustomGiftBanner, Newsletter, Footer, SearchModal,
                        CartDrawer, CartLine, QuantitySelector, WishlistButton,
                        PhotoUpload, Toast, and the three customisers
                        (Magazine / Polaroid / Bouquet)
  pages/                Home, Magazines, Polaroids, Bouquets, CustomGifts,
                        ProductDetails, Cart, Wishlist, About, NotFound
  context/              CartContext, WishlistContext (localStorage-backed)
  data/                 products.js, categories.js  ← edit prices and copy here
  hooks/                useLocalStorage, usePageMeta
  utils/                currency.js, cartCalculations.js
  styles/               variables, global, layout, components, responsive
```

**All product data lives in `src/data/products.js`** — prices, page counts, themes,
minimum quantities, images and descriptions. Contact details, social links and the
three home-page category cards are in `src/data/categories.js`. Nothing is
duplicated anywhere else.

## Routes

| Path | Page |
| --- | --- |
| `/` | Home — hero, three categories, benefits, featured products, custom-gift banner, newsletter |
| `/magazines` | Magazine collection + how it works + theme list |
| `/polaroids` | Polaroid collection + pricing table |
| `/bouquets` | Bouquet collection with occasion/flower filters and sorting |
| `/custom-gifts` | Custom gift request form |
| `/product/:slug` | Product detail with the matching customiser |
| `/cart` | Full bag with totals |
| `/wishlist` | Saved products |
| `/about` | About, FAQs, shipping, returns, privacy, terms |
| `*` | 404 |

## Pricing rules

| Product | Price | Rule |
| --- | --- | --- |
| Magazine, 4 pages (8 sides) | ₹300 | fixed, × quantity |
| Magazine, 8 pages (16 sides) | ₹550 | fixed, × quantity |
| Polaroid print, medium | ₹6 | **× number of prints**, minimum 9 (₹54) |
| Polaroid set | ₹150 | **per set of 25**, × number of sets |
| Bouquets | ₹1,299 – ₹1,599 | fixed, × quantity |

Totals are computed in `src/utils/cartCalculations.js` — no hardcoded sums. Shipping
is always shown as a separate line and is never invented.

## Customisation

- **Magazine** — size → theme (8 options incl. a custom theme) → personalisation
  details → photo upload → instructions → review → add to bag.
- **Polaroid** — quantity (min enforced) → photos → captions → border style → review.
- **Bouquet** — wrap colour → message card → quantity.

Each configuration is hashed into the cart line key, so two magazines with different
themes stay **separate lines** in the bag rather than merging.

## What is frontend-only

The spec asked for the complete frontend; these parts are wired for a backend but do
not have one, and the UI says so rather than pretending:

- **Checkout / payment** — no gateway is connected. The cart says online payment and
  order placement are not available yet, and offers an email hand-off instead. No
  success screen is ever shown for an unverified payment.
- **Photo upload** — files are validated (type, size, duplicates, count) and previewed
  in the browser. Only the file names travel with the order; the images are not
  uploaded anywhere.
- **Custom gift form** — validates fully, then prepares the request and tells you it
  has not been sent or stored, with a button to email it.
- **Newsletter** — validates the address and says the address is noted locally,
  because no email service is connected.
- **Social links** — rendered as disabled icons until real URLs are set in
  `src/data/categories.js`. No invented profile URLs.

Cart and wishlist persist in `localStorage` and survive a reload.

## Images

Local files under `public/images`. Hero and custom-gift photography carried over from
the original studio site; magazine, polaroid and avatar photography from Pexels
(free licence). Every product uses a different image. To swap one, change the path in
`src/data/products.js`.

### Everything added from now on is compressed

`src/lib/imageCompress.js` is the one compressor, and every picture that enters the
site goes through it — a product photo or hero banner picked in the admin panel
(`adminUpload`), and a customer's photograph on its way into the hamper studio
(`storeUpload`). It decodes with the camera's orientation applied, scales to a maximum
edge, and re-encodes, stepping quality down and then size down until the result fits
its byte budget. A 4 MB photo straight off a phone is fine; the admin panel used to
refuse anything over 512 KB and tell you to go and put the file in `public/images`
by hand.

The customer photo pickers on the magazine and polaroid pages (`PhotoUpload`,
`PolaroidStudio`) deliberately keep the originals — nothing is persisted there, only
the file names travel with the order, and those are the files a printer would want.

The one door the browser cannot see is a file dropped into `public/images` by hand:

```bash
npm run images              # compress whatever is over budget, in place
npm run images -- --check   # list what is over budget, change nothing (for CI)
npm run images -- --all     # re-encode everything, not just the oversized
```

Budgets are 1600 px on the longest edge and 250 KB a file. A photograph saved as PNG
is re-encoded as JPEG, and a PNG with real transparency as WebP — but since that
changes the extension and so breaks every path naming the old one, the script writes
the new file beside the original and tells you which source files refer to it rather
than doing it silently. `public/images/uploads` is left alone: that is content
somebody put there, not artwork the site ships.

Needs `ffmpeg` on PATH (`winget install Gyan.FFmpeg`).

The two 2 MB hero PNGs and the three half-megabyte heading PNGs this shop shipped with
have been through it: `public/images` went from 16 MB to 7.8 MB.

## Responsive

Checked for horizontal overflow at **1536 / 1280 / 1024 / 768 / 390 / 360 px** on the
home, collection, product and cart routes — none at any width. Breakpoints at 1280,
1100, 1024, 900 (mobile nav), 860, 768, 560 and 420. Reduced-motion preferences are
respected.

## The hamper studio (`/hamper-studio`)

Build-your-own hampers in 3D: choose the hamper size, fill it, upload photographs,
write the card, and come back to it later. The studio arranges the box itself —
there is nothing to position by hand.

**Real sizes.** Four categories (Small, Medium, Large, Extra-Large) with the shop's
published ranges, and twelve stocked sizes inside them, quoted in inches and built in
centimetres at exactly 2.54 cm to the inch. The chosen size is the actual 3D geometry,
and the usable interior is computed from it by taking off the walls, base, lid, hinge
travel and lining — see **`HAMPER-SIZES.md`**, which also says which of those
thicknesses are assumptions rather than measurements. Every collision boundary and
every automatic placement is measured against that interior.

**Where a design lives.** On the customer's own device, in IndexedDB
(`wrappedstudio-designs`), not in an account and not on any server — there is no
accounts backend to sync to, and the studio says so on screen rather than implying
otherwise. Designs survive a reload, a closed tab and a browser restart; they do not
survive clearing site data, which the Saved panel also says. Moving a hamper to
another device is a download-and-open-the-file, which is real rather than a cloud
button that does nothing.

- `src/data/hamperBoxes.js` — the hamper catalogue: the four categories and their
  published ranges, the stocked sizes, the inch-to-centimetre conversion, and the one
  outer-to-inner construction sum everything else measures against.
- `src/data/hamperKit.js` — the trusted kit: palettes and what can go in a hamper,
  each product a manifest row with its real size in centimetres, its collision proxy
  and its permitted orientations. Prices come from here or, for kit items that are
  also shop products, from `src/data/products.js`. A saved design holds ids and
  positions, never prices.
- `src/lib/collision.js` / `src/lib/packing.js` — what space a product takes up, and
  where the studio decides to put it: largest footprint first, against candidate
  corners, validated against the walls and against everything already placed.
- `src/lib/designSchema.js` — the record's shape, its version, and the validation
  every stored design goes through on the way in. Hand-edited values are clamped;
  nothing recoverable is discarded.
- `src/lib/designDb.js` — IndexedDB: `designs`, `designAssets`, `autosaveMetadata`.
  A write resolves when the transaction *commits*, which is what lets the indicator
  say "Saved" honestly.
- `src/lib/designSaver.js` — the autosave queue: debounced, serialised, and ordered by
  revision so an older write can never land on top of a newer one.
- `src/lib/designReducer.js` — every change a customer can make, in one place.
- `src/lib/designCheckout.js` — validates and re-prices from the catalogue, then puts a
  design reference (`WS-…`) in the bag. The bag's price is always the recomputed one.
- `src/hamper/scene/` — the 3D box, built from geometry rather than a GLB because the
  box has to change size, colour, lining and ribbon from a saved record. One unit is
  one centimetre; the camera moves to frame the box rather than the box being scaled
  to fit the viewport.

**Dependencies added:** `three` and `@react-three/fiber` (v8, the React 18 line).
Not `drei` — `three` ships OrbitControls itself. Both load only on this route, so the
rest of the shop's bundle is unchanged; the studio's own chunk is ~930 kB (~254 kB
gzipped), which is three.js.

**Tests.** `npm test` runs the dimension, geometry, packing, schema, reducer and
pricing suites (`node --test`, no test framework). The browser-level behaviour — autosave committing, restoring after a
refresh and after a real browser restart, a photo surviving a restart, a failed save
not reporting success, checkout — was verified by driving Chrome over the DevTools
protocol, including quitting Chrome and reopening the same profile.

**Not done, and why:** cloud sync. `src/context/AuthContext.jsx` is a localStorage
profile with no server behind it, and there are no design endpoints to post to. Adding
a backend was out of scope for a feature that had to work on the device first; what
would be needed is an authenticated `designs` store and a file store for photographs,
at which point `exportDesign` in `src/lib/designBackup.js` is the payload shape.
