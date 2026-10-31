import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';

import { BRAND, CONTACT, SOCIALS } from '../data/categories';

const QUICK_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/magazines', label: 'Magazines' },
  { to: '/polaroids', label: 'Polaroids' },
  { to: '/bouquets', label: 'Bouquets' },
  { to: '/hampers', label: 'Hampers' },
  { to: '/custom-gifts', label: 'Custom Gifts' },
  { to: '/about', label: 'About' }
];

const HELP_LINKS = [
  { to: '/about#faqs', label: 'FAQs' },
  { to: '/about#shipping', label: 'Shipping & Delivery' },
  { to: '/about#returns', label: 'Returns' },
  { to: '/track', label: 'Track Order' },
  { to: '/about#privacy', label: 'Privacy Policy' },
  { to: '/about#terms', label: 'Terms & Conditions' }
];

function PinterestIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M10.4 19 12 12.4" />
      <path d="M9.6 11c0-1.8 1.3-3.2 3-3.2s2.9 1.1 2.9 2.8c0 2-1.1 3.6-2.6 3.6-.8 0-1.4-.6-1.2-1.4" />
    </svg>
  );
}

const SOCIAL_ICONS = {
  instagram: Instagram,
  pinterest: PinterestIcon,
  facebook: Facebook,
  youtube: Youtube
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__inner">
          <div className="footer__brand-col">
            <Link className="brand" to="/" aria-label={`${BRAND.name} — home`}>
              <img
                className="footer__logo"
                src="/images/logo.png"
                alt={`${BRAND.name} — handmade bouquets & gifts`}
                width="512"
                height="512"
              />
            </Link>
            <p className="footer__brandline">{BRAND.footerLine}</p>

            <div className="footer__socials">
              {SOCIALS.map((social) => {
                const Icon = SOCIAL_ICONS[social.id] || Instagram;
                /* No invented URLs: an unconfigured channel renders as a
                   disabled icon rather than linking somewhere unrelated. */
                return social.url ? (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                  >
                    <Icon size={18} />
                  </a>
                ) : (
                  <span key={social.id} title={`${social.label} — link not configured yet`} aria-label={`${social.label}, not linked yet`}>
                    <Icon size={18} />
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <h3>Quick Links</h3>
            <nav className="footer__links" aria-label="Quick links">
              {QUICK_LINKS.map((link) => (
                <Link key={link.label} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3>Help</h3>
            <nav className="footer__links" aria-label="Help">
              {HELP_LINKS.map((link) => (
                <Link key={link.label} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="footer__contact-col">
            <h3>Contact Us</h3>
            {/* The address, number and city are not printed on the page.
                Each icon carries the detail in its own href, so a tap
                opens the mail app, the dialler or a map directly, while
                a scraper trawling the page for plain text finds none.
                The real detail is still in the aria-label, because a
                screen reader has to be able to say what the link does. */}
            <ul className="footer__contact">
              <li>
                <a
                  href={`mailto:${CONTACT.email}`}
                  aria-label={`Email us at ${CONTACT.email}`}
                  title="Email us"
                >
                  <Mail size={18} />
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.phoneHref}
                  aria-label={`Call us on ${CONTACT.phone}`}
                  title="Call us"
                >
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
          </div>
        </div>

        <div className="footer__bottom">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. Prices in Indian Rupees. Shipping charged separately.
          </p>
          <p className="footer__script">
            More than gifts,
            <br />A little piece of your story ♥
          </p>
        </div>
      </div>
    </footer>
  );
}
