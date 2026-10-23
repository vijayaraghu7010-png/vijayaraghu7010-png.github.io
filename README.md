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

The two hero PNGs are large (≈2 MB each) — worth re-exporting as optimised JPG/WebP
before going live.

## Responsive

Checked for horizontal overflow at **1536 / 1280 / 1024 / 768 / 390 / 360 px** on the
home, collection, product and cart routes — none at any width. Breakpoints at 1280,
1100, 1024, 900 (mobile nav), 860, 768, 560 and 420. Reduced-motion preferences are
respected.
