import usePageMeta from '../hooks/usePageMeta';

/* The FAQ and the cancellation policy are the studio's own designed
   artwork, cut out on a transparent ground so the page's sunset shows
   through them. Their wording lives here as well as in the picture:
   it is what goes into the alt text, so a screen reader and a search
   engine still get every question and every clause, which a bare
   "FAQ poster" alt would throw away. Edit the words here and the
   description follows - the artwork itself has to be redrawn. */
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

const FAQ_ALT = `Frequently asked questions. ${FAQS.map(
  (faq) => `${faq.q} ${faq.a}`
).join(' ')} Still have questions? We're happy to help! Contact WrappedStudio through our official support channel and we'll help you with your gifting questions.`;

const POLICY_ALT = [
  'Cancellation, returns and refunds policy.',
  'At WrappedStudio, every gift is prepared with care to make your moments special. Please read our policy before placing an order.',
  'Order cancellation: If you wish to cancel an order, please contact us as soon as possible after placing it. Cancellation requests will be reviewed based on the order’s preparation and customisation status. Orders that have already been personalised, prepared, or dispatched may not be eligible for cancellation, subject to applicable consumer rights and our policy. Any cancellation charges, if applicable, will be disclosed and handled in accordance with applicable law.',
  'Returns and exchanges: Please check your order upon delivery. Returns or exchanges may be considered if an item arrives damaged, defective, incorrect, or significantly different from what was ordered. Personalised products may have limited return eligibility when there is no defect or error, subject to applicable consumer rights. Change-of-mind returns will be handled according to the product’s stated return eligibility.',
  'Refunds: Approved refunds will be processed through the original payment method wherever possible. The time taken for the refund to appear may depend on the payment provider or bank. If your order has an issue, please contact us with your order number and clear photographs so we can review it.',
  'Need help? For cancellation, return, or refund assistance, contact WrappedStudio through the official contact details listed on our website. We aim to make every gifting experience smooth, thoughtful, and reliable.'
].join(' ');

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
            width="887"
            height="909"
          />
        </header>

        {/* Both posters are below the fold on every screen, so they load
            lazily and are decoded off the main thread - together they are
            the heaviest thing on this page. */}
        <section className="about-poster" id="faqs" aria-label="Frequently asked questions">
          <img
            src="/images/about-faq.webp"
            alt={FAQ_ALT}
            width="915"
            height="1603"
            loading="lazy"
            decoding="async"
          />
        </section>

        <section
          className="about-poster"
          id="returns"
          aria-label="Cancellation, returns and refunds policy"
        >
          <img
            src="/images/about-policy.webp"
            alt={POLICY_ALT}
            width="911"
            height="1546"
            loading="lazy"
            decoding="async"
          />
        </section>

        {/* What the artwork does not cover. These stay as text: the
            footer links straight to each one, and shipping terms, privacy
            and terms of sale need to be selectable and indexable rather
            than baked into a picture. */}
        <div className="stack">
          <div className="info-card" id="shipping">
            <h3>Shipping &amp; delivery</h3>
            <p>
              We ship across India. Shipping is charged separately from the product price and confirmed with you
              before payment, because it depends on where the order is going and how it has to be packed.
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
      </div>
    </div>
  );
}
