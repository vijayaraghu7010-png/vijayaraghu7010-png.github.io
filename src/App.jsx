import { Suspense, lazy, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { SiteConfigProvider, useSiteConfig } from './context/SiteConfigContext';

import Header from './components/Header';
import Footer from './components/Footer';
import SearchModal from './components/SearchModal';
import CartDrawer from './components/CartDrawer';
import Toast from './components/Toast';
import PetalCanvas from './components/PetalCanvas';
import AuthModal from './components/AuthModal';
import IntroVideo from './components/IntroVideo';
import OfferBanner from './components/OfferBanner';
import CustomGiftBanner from './components/CustomGiftBanner';

/* Home and the not-found page are the two a visitor can arrive at
   without having chosen anything, so they ship with the shell. Every
   other page is fetched when it is first opened.

   All fourteen of these used to be in the entry bundle: 600 KB of
   JavaScript to parse before the first screen could be drawn, most of
   it pages that visit never reaches. */
import Home from './pages/Home';
import NotFound from './pages/NotFound';

const Magazines = lazy(() => import('./pages/Magazines'));
const Polaroids = lazy(() => import('./pages/Polaroids'));
const Bouquets = lazy(() => import('./pages/Bouquets'));
const Hampers = lazy(() => import('./pages/Hampers'));
const PhotoFrames = lazy(() => import('./pages/PhotoFrames'));
const WallPosters = lazy(() => import('./pages/WallPosters'));
const CustomGifts = lazy(() => import('./pages/CustomGifts'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const About = lazy(() => import('./pages/About'));

/* The admin panel is a separate bundle: a customer never downloads it. */
const AdminApp = lazy(() => import('./admin/AdminApp'));

/* The hamper studio carries three.js and the whole 3D scene with it.
   Loaded on its own route so the rest of the shop stays the size it
   was for anybody who never opens it. */
const HamperStudio = lazy(() => import('./pages/HamperStudio'));

/* Tracking and the account page are their own bundle too. Most
   visitors are shopping, not checking on something they have already
   bought, and they should not pay for this code to find that out. */
const Track = lazy(() => import('./pages/Track'));
const Account = lazy(() => import('./pages/Account'));

/* Paying is in the same bundle's company for the same reason: it is
   reached from a link in an order confirmation, not from the shop. */
const Payment = lazy(() => import('./pages/Payment'));

function TrackFallback() {
  return (
    <div className="shell" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
      One moment…
    </div>
  );
}

/* Every navigation starts at the top of the new page - except one that
   names a section. React Router does not act on the fragment at all: it
   puts #faqs in the address bar and leaves the page where it was, so
   the footer's Help links did nothing. Handle it here.

   The target usually is not in the DOM yet, because the route behind it
   is code-split and still loading, so look again each frame for a short
   while before falling back to the top of the page. `key` is in the
   deps so that clicking the same link twice scrolls back to the section
   both times, the way a plain anchor would. */
function ScrollToTop() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return undefined;
    }

    const id = decodeURIComponent(hash.slice(1));
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;

    const find = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      } else if (frame++ < 40) {
        raf = requestAnimationFrame(find);
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };

    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash, key]);

  return null;
}

/* The custom-gifts invitation, at the foot of the pages somebody is
   browsing rather than deciding on.

   It belongs after a category of things to look through, and after an
   empty bag. It is kept off home, which already ends on it; off
   /custom-gifts, which would be asking somebody to go where they are;
   and off the wishlist, about and a product page, where the customer
   is reading one particular thing and being sold a different one is
   an interruption.

   Listing the pages that have it, rather than the ones that do not,
   is the deliberate choice here: a page added later stays clean until
   somebody decides it should carry this. */
const GIFT_BANNER_ON = [
  /* not '/magazines': that page ends on its own customiser */
  '/polaroids',
  /* not '/bouquets': that page shows this banner itself, with a
     button that opens its customiser */
  '/hampers',
  /* not '/photo-frames': the frames page has its own designs to browse
     and does not send people to the general custom-gift form */
  '/cart'
];

function GiftInvite() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!GIFT_BANNER_ON.includes(path)) return null;

  return (
    <section className="shell section" aria-label="Custom gifts">
      <CustomGiftBanner />
    </section>
  );
}

function Shop() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [auth, setAuth] = useState({ open: false, mode: 'login' });
  /* Read so that a save in the panel re-renders this component, and
     with it every page below - pages read the catalogue straight from
     the products module, which React cannot watch on its own.

     It used to be `<Routes key={version}>`, which did the same job by
     throwing the whole page away and building it again. That also
     threw away everything the customer was in the middle of: photos
     chosen, a magazine part-customised, a size picked. Re-rendering
     is enough; remounting was never wanted. */
  useSiteConfig();

  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
        <div className="app">
          <IntroVideo />

          <a className="skip-link" href="#main">
            Skip to content
          </a>

          <ScrollToTop />
          <OfferBanner />
          <Header
            onOpenSearch={() => setSearchOpen(true)}
            onOpenAuth={(mode) => setAuth({ open: true, mode })}
          />

          <main className="page" id="main">
            {/* One boundary for the whole switch: a page that has not
                been downloaded yet shows this for the moment it takes,
                and the header, footer and bag stay put while it does. */}
            <Suspense fallback={<TrackFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/magazines" element={<Magazines />} />
              <Route path="/polaroids" element={<Polaroids />} />
              <Route path="/bouquets" element={<Bouquets />} />
              <Route path="/hampers" element={<Hampers />} />
              <Route
                path="/hamper-studio"
                element={
                  <Suspense
                    fallback={
                      <div className="shell" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
                        Opening the hamper studio…
                      </div>
                    }
                  >
                    <HamperStudio />
                  </Suspense>
                }
              />
              <Route path="/photo-frames" element={<PhotoFrames />} />
              <Route path="/wall-posters" element={<WallPosters />} />
              <Route path="/custom-gifts" element={<CustomGifts />} />
              <Route path="/product/:slug" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route
                path="/track"
                element={
                  <Suspense fallback={<TrackFallback />}>
                    <Track />
                  </Suspense>
                }
              />
              <Route
                path="/track/:token"
                element={
                  <Suspense fallback={<TrackFallback />}>
                    <Track />
                  </Suspense>
                }
              />
              <Route
                path="/pay"
                element={
                  <Suspense fallback={<TrackFallback />}>
                    <Payment />
                  </Suspense>
                }
              />
              <Route
                path="/pay/:token"
                element={
                  <Suspense fallback={<TrackFallback />}>
                    <Payment />
                  </Suspense>
                }
              />
              <Route
                path="/account"
                element={
                  <Suspense fallback={<TrackFallback />}>
                    <Account />
                  </Suspense>
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>

            <GiftInvite />
          </main>

          <Footer />

          <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
          <CartDrawer />
          <Toast />
          <PetalCanvas />
          <AuthModal open={auth.open} mode={auth.mode} onClose={() => setAuth((a) => ({ ...a, open: false }))} />
        </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <SiteConfigProvider>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading the admin panel…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Shop />} />
      </Routes>
    </SiteConfigProvider>
  );
}
