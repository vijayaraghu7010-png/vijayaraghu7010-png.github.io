import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { useText } from '../context/SiteConfigContext';

const AVATARS = [
  { src: '/images/avatar-1.jpg', alt: 'A customer who ordered a personalised magazine' },
  { src: '/images/avatar-2.jpg', alt: 'A customer who ordered polaroid prints' },
  { src: '/images/avatar-3.jpg', alt: 'A customer who ordered a handmade bouquet' }
];

export default function HeroSection() {
  /* Every line here can be rewritten from the admin panel; what is
     written in the code is simply the default. */
  const eyebrow = useText('home.hero.eyebrow', 'Personalised gifts for beautiful people');
  const title = useText('home.hero.title', 'Make Every Memory Bloom');
  const text = useText('home.hero.text', 'Personalised magazines, polaroids and handcrafted bouquets for your special moments.');
  const ctaPrimary = useText('home.hero.ctaPrimary', 'Explore Collections');
  const ctaSecondary = useText('home.hero.ctaSecondary', 'Custom Gifts');
  const proof = useText('home.hero.proof', '4.9/5 from 10K+ happy customers');

  /* the last word of the title is the one picked out in colour */
  const words = title.trim().split(' ');
  const lead = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__media">
        <img
          src="/images/hero-sunset.png"
          alt="A handmade bouquet, printed magazines and polaroids arranged on the sand as the sun sets over the sea"
          fetchpriority="high"
        />
      </div>
      <div className="hero__scrim" />

      <p className="hero__script" aria-hidden="true">
        Same
        <br />
        Sunset Vibes,
        <br />
        Brighter Memories <span className="heart">♥</span>
      </p>

      <div className="shell hero__inner">
        <div className="hero__copy">
          <p className="eyebrow">{eyebrow}</p>

          <h1 className="hero__title" id="hero-title">
            {lead} <span className="text-coral">{tail}</span>
          </h1>

          <p className="hero__text">{text}</p>

          <div className="hero__cta">
            <Link className="btn btn--primary" to="/magazines">
              {ctaPrimary} <ArrowRight className="arrow" size={17} />
            </Link>
            <Link className="btn btn--ghost" to="/custom-gifts">
              {ctaSecondary}
            </Link>
          </div>

          <div className="hero__proof">
            <div className="avatars" aria-hidden="true">
              {AVATARS.map((a) => (
                <img key={a.src} src={a.src} alt="" loading="lazy" />
              ))}
            </div>
            <div>
              <p className="hero__rating">{proof}</p>
              <div className="hero__stars" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
