import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import { BRAND, CONTACT } from '../data/categories';

const FAQS = [
  {
    q: 'How long does an order take?',
    a: 'Polaroids are dispatched within 3–4 working days. Magazines are printed once you approve the PDF preview. Bouquets are made to order — tell us your date and we will confirm it before you pay.'
  },
  {
    q: 'How do I send my photos?',
    a: 'Pick them on the product page so we have the file names with your order, then send the photos themselves on WhatsApp or as a Drive link once we confirm. A direct upload will come with the backend.'
  },
  {
    q: 'Can I change the design after ordering?',
    a: 'Yes. Nothing is printed until you have seen and approved the preview, so changes before that are no trouble.'
  }
];

export default function About() {
  usePageMeta(
    'About',
    'WrappedStudio is a small studio in Chennai making personalised magazines, polaroid prints and handmade bouquets.'
  );

  return (
    <div className="shell">
      <header className="page-head">
        <p className="eyebrow">About us</p>
        <h1 style={{ marginTop: 8 }}>{BRAND.tagline}</h1>
        <p>
          WrappedStudio is a small studio in {CONTACT.city}. We print, fold, tie and pack everything by hand — a
          magazine of your photos, a stack of polaroids, a bouquet that keeps its shape forever.
        </p>
      </header>

      <div className="two-col">
        <section className="info-card">
          <h3>What we make</h3>
          <p>
            Three things, done properly: personalised magazines from ₹300, medium polaroid prints at ₹6 each, and
            handmade bouquets from ₹1,299. Every order is made after you place it — nothing sits on a shelf.
          </p>
          <p>
            Prices are in Indian Rupees and shipping is charged separately, confirmed with you before any payment is
            made.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <Link className="btn btn--primary btn--sm" to="/magazines">
              See magazines
            </Link>
            <Link className="btn btn--ghost btn--sm" to="/custom-gifts">
              Ask for something custom
            </Link>
          </div>
        </section>

        <section className="info-card" id="orders">
          <h3>Contact &amp; orders</h3>
          <ul className="footer__contact">
            <li>
              <Mail size={16} />
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>
              <Phone size={16} />
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            </li>
            <li>
              <MapPin size={16} />
              <span>{CONTACT.city}</span>
            </li>
          </ul>
          <p className="field-hint">
            These contact details are placeholders in this build — replace them in <code>src/data/categories.js</code>.
          </p>
        </section>
      </div>

      <section className="section two-col">
        <div className="info-card" id="faqs">
          <h3>FAQs</h3>
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{faq.q}</p>
              <p>{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="info-card" id="shipping">
            <h3>Shipping &amp; delivery</h3>
            <p>
              We ship across India. Shipping is charged separately from the product price and confirmed with you
              before payment, because it depends on where the order is going and how it has to be packed.
            </p>
          </div>

          <div className="info-card" id="returns">
            <h3>Returns</h3>
            <p>
              Personalised items are made for one person, so they cannot be resold and are not returnable. If
              something arrives damaged or wrong, send us a photo within 48 hours and we will remake it.
            </p>
          </div>

          <div className="info-card" id="privacy">
            <h3>Privacy</h3>
            <p>
              Your photographs are used only to make your order and are deleted once it ships. Your name, phone
              number and address are used only to print and deliver the order. Your bag and wishlist are stored in
              your own browser, not on our servers.
            </p>
          </div>

          <div className="info-card" id="terms">
            <h3>Terms</h3>
            <p>
              Prices are in Indian Rupees and may change. Orders are confirmed once payment is received — and since
              no payment gateway is connected to this site yet, every order here is an enquiry until we reply.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
