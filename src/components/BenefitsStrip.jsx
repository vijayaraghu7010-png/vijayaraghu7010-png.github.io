import { Gem, Gift, Heart, Truck } from 'lucide-react';
import { BENEFITS } from '../data/categories';
import { useSiteConfig } from '../context/SiteConfigContext';

const ICONS = { heart: Heart, gem: Gem, gift: Gift, truck: Truck };

export default function BenefitsStrip() {
  const { content } = useSiteConfig();
  const text = (key, fallback) => content?.[key] || fallback;

  return (
    <section className="shell" aria-label="Why WrappedStudio">
      <ul className="benefits panel">
        {BENEFITS.map((benefit, i) => {
          const Icon = ICONS[benefit.icon] || Heart;
          return (
            <li className="benefit" key={benefit.title}>
              <Icon size={26} aria-hidden="true" />
              <div>
                <p className="benefit__title">{text(`benefit.${i}.title`, benefit.title)}</p>
                <p className="benefit__text">{text(`benefit.${i}.text`, benefit.text)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
