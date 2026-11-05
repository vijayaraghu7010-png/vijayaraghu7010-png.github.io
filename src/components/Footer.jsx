import { Link } from 'react-router-dom';
import { Instagram, Mail, MapPin, Phone } from 'lucide-react';

import { BRAND, SOCIALS } from '../data/categories';
import useContact from '../hooks/useContact';
import useBrand from '../hooks/useBrand';

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

/* lucide dropped its brand glyphs, so WhatsApp is its own path. Filled
   rather than stroked because that is the mark people recognise. */
function WhatsAppIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const SOCIAL_ICONS = {
  instagram: Instagram,
  whatsapp: WhatsAppIcon
};

export default function Footer() {
  const contact = useContact();
  const brand = useBrand();

  /* The WhatsApp entry is the studio's own number, so it follows the
     number in the panel rather than the one SOCIALS was built with at
     import time. Everything else in that list is a real URL and is
     left exactly as it is. */
  const socials = SOCIALS.map((s) =>
    s.id === 'whatsapp' ? { ...s, url: contact.whatsappHref } : s
  );

  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__inner">
          <div className="footer__brand-col">
            <Link className="brand" to="/" aria-label={`${brand.name} — home`}>
              <img
                className="footer__logo"
                src="/images/logo.png"
                alt={`${brand.name} — handmade bouquets & gifts`}
                width="512"
                height="512"
              />
            </Link>
            <p className="footer__brandline">{brand.footerLine}</p>

            <div className="footer__socials">
              {socials.map((social) => {
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
                  href={`mailto:${contact.email}`}
                  aria-label={`Email us at ${contact.email}`}
                  title="Email us"
                >
                  <Mail size={18} />
                </a>
              </li>
              <li>
                <a
                  href={contact.phoneHref}
                  aria-label={`Call us on ${contact.phone}`}
                  title="Call us"
                >
                  <Phone size={18} />
                </a>
              </li>
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.city)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Find us in ${contact.city}`}
                  title={contact.city}
                >
                  <MapPin size={18} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <p>
            © {new Date().getFullYear()} {brand.name}. Prices in Indian Rupees. Shipping charged separately.
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
