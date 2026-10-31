import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import { CONTACT } from '../data/categories';

const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Browse our collections, choose your favourite gift or hamper, select any available customisation options, add the product to your cart, and proceed to checkout. Enter your delivery details and complete your purchase using the payment options available on our website.'
  },
  {
    q: 'Can I customise a gift hamper?',
    a: 'Yes! Selected hampers can be customised to suit your preferences. Depending on the product, you may be able to choose items, colours, names, photographs, or other personal touches. Available options will be displayed on the product page.'
  },
  {
    q: 'Do I have to customise my gift?',
    a: 'Not at all! You can purchase our ready-made hampers and gifts as they are. Customisation is optional wherever it is offered.'
  },
  {
    q: 'Can I add a name, photograph, or personal message?',
    a: 'Selected products offer personalisation options. Please provide the correct spelling, upload a clear photograph if required, and enter your message in the designated fields before adding the item to your cart.'
  },
  {
    q: 'How long will my order take to arrive?',
    a: 'Preparation and delivery times depend on the product, personalisation requirements, and delivery location. Please check the estimated timeline displayed on the product page or at checkout before ordering.'
  },
  {
    q: 'Can I track my order?',
    a: 'If tracking is available for your shipment, the tracking details will be shared through the contact information provided with your order.'
  },
  {
    q: 'Can I send a gift directly to someone else?',
    a: "Yes! Enter the recipient's delivery address at checkout, provided delivery is available to that location. Please double-check the address and contact details before placing your order."
  },
  {
    q: 'Can I change or cancel my order after placing it?',
    a: 'Please contact us as soon as possible if you need to make a change. Orders that have entered preparation or personalisation may not be eligible for changes or cancellation. Please refer to our cancellation policy for the applicable terms.'
  },
  {
    q: 'What if I receive a damaged or incorrect product?',
    a: "Please contact us promptly with your order number and photographs of the issue. We'll review the concern and assist you according to our returns and resolution policy."
  },
  {
    q: 'Can I return or exchange a customised gift?',
    a: 'Eligibility depends on the reason for the return and our published return policy. Personalised products may have different eligibility rules, but issues such as damage or an incorrect item should still be reported to us.'
  }
];
export default function About() {
  usePageMeta(
    'About',
    'WrappedStudio is a small studio in Chennai making personalised magazines, polaroid prints and handmade bouquets.'
  );

  return (
    <div className="about-page">
    <div className="shell">
      <header className="page-head about-hero">
        {/* The whole introduction is the studio's own designed banner;
            the alt carries its words so the page still reads the same to
            a screen reader and a search engine. */}
        <img
          src="/images/about-banner.webp"
          alt="About WrappedStudio — more than gifts, a little piece of your story. We believe every gift tells a story, from thoughtfully curated hampers to personalised keepsakes and adorable crochet creations. Choose your favourite gifts, add your personal touch, and let us turn little moments into beautiful memories. Wrapped with love, made for memories."
          width="1600"
          height="902"
        />
      </header>

      <div className="two-col">
        <section className="info-card">
          <h3>What we make</h3>
          <p>
            Three things, done properly: personalised magazines from ₹200, medium polaroid prints at ₹6 each, and
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
          {/* Icons only, exactly as the footer does it: the address and
              number live in the href and the aria-label, not in text on
              the page. */}
          <ul className="footer__contact">
            <li>
              <a href={`mailto:${CONTACT.email}`} aria-label={`Email us at ${CONTACT.email}`} title="Email us">
                <Mail size={18} />
              </a>
            </li>
            <li>
              <a href={CONTACT.phoneHref} aria-label={`Call us on ${CONTACT.phone}`} title="Call us">
                <Phone size={18} />
              </a>
            </li>
            <li>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.city)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Find us in ${CONTACT.city}`}
                title={CONTACT.city}
              >
                <MapPin size={18} />
              </a>
            </li>
          </ul>
          <p>Mail us, call us, or find us in {CONTACT.city}.</p>
        </section>
      </div>

      <section className="section two-col">
        <div className="info-card" id="faqs">
          <h3>Frequently asked questions 💌</h3>
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{faq.q}</p>
              <p>{faq.a}</p>
            </div>
          ))}
          <p style={{ fontWeight: 600, color: 'var(--ink)' }}>Still have questions?</p>
          <p>
            We&rsquo;re happy to help! Contact WrappedStudio through our official support channel and we&rsquo;ll
            help you with your gifting questions.
          </p>
        </div>

        <div className="stack">
          <div className="info-card" id="shipping">
            <h3>Shipping &amp; delivery</h3>
            <p>
              We ship across India. Shipping is charged separately from the product price and confirmed with you
              before payment, because it depends on where the order is going and how it has to be packed.
            </p>
          </div>

          <div className="info-card" id="cancellation">
            <h3>Order cancellation</h3>
            <p>
              Every gift is prepared with care to make your moments special. Please read this before placing an
              order.
            </p>
            <ul className="policy-list">
              <li>If you wish to cancel an order, please contact us as soon as possible after placing it.</li>
              <li>
                Cancellation requests will be reviewed based on the order&rsquo;s preparation and customisation
                status.
              </li>
              <li>
                Orders that have already been personalised, prepared, or dispatched may not be eligible for
                cancellation, subject to applicable consumer rights and our policy.
              </li>
              <li>
                Any cancellation charges, if applicable, will be disclosed and handled in accordance with
                applicable law.
              </li>
            </ul>
          </div>

          <div className="info-card" id="returns">
            <h3>Returns &amp; exchanges</h3>
            <ul className="policy-list">
              <li>Please check your order upon delivery.</li>
              <li>
                Returns or exchanges may be considered if an item arrives damaged, defective, incorrect, or
                significantly different from what was ordered.
              </li>
              <li>
                Personalised products may have limited return eligibility when there is no defect or error, subject
                to applicable consumer rights.
              </li>
              <li>
                Change-of-mind returns will be handled according to the product&rsquo;s stated return eligibility.
              </li>
            </ul>
          </div>

          <div className="info-card" id="refunds">
            <h3>Refunds</h3>
            <ul className="policy-list">
              <li>Approved refunds will be processed through the original payment method wherever possible.</li>
              <li>The time taken for the refund to appear may depend on the payment provider or bank.</li>
              <li>
                If your order has an issue, please contact us with your order number and clear photographs so we can
                review it.
              </li>
            </ul>
            <p>
              For cancellation, return, or refund assistance, contact WrappedStudio through the official contact
              details listed on our website. We aim to make every gifting experience smooth, thoughtful and
              reliable.
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
    </div>
  );
}
