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

import Home from './pages/Home';
import Magazines from './pages/Magazines';
import Polaroids from './pages/Polaroids';
import Bouquets from './pages/Bouquets';
import Hampers from './pages/Hampers';
import CustomGifts from './pages/CustomGifts';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import About from './pages/About';
import NotFound from './pages/NotFound';

/* The admin panel is a separate bundle: a customer never downloads it. */
const AdminApp = lazy(() => import('./admin/AdminApp'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function Shop() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [auth, setAuth] = useState({ open: false, mode: 'login' });
  const { version } = useSiteConfig();

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
            <Routes key={version}>
              <Route path="/" element={<Home />} />
              <Route path="/magazines" element={<Magazines />} />
              <Route path="/polaroids" element={<Polaroids />} />
              <Route path="/bouquets" element={<Bouquets />} />
              <Route path="/hampers" element={<Hampers />} />
              <Route path="/custom-gifts" element={<CustomGifts />} />
              <Route path="/product/:slug" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
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
