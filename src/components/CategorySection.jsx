import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { CATEGORIES } from '../data/categories';
import { useText } from '../context/SiteConfigContext';

export function CategoryCard({ category }) {
  const title = useText(`category.${category.id}.title`, category.title);
  const description = useText(`category.${category.id}.description`, category.description);
  const cta = useText(`category.${category.id}.cta`, category.cta);

  return (
    <article className={`cat-card${category.wide ? ' cat-card--wide' : ''}`}>
      <div className="cat-card__body">
        <h2 className="cat-card__title">{title}</h2>
        <p className="cat-card__text">{description}</p>
        <Link className="btn btn--primary btn--sm" to={category.to}>
          {cta} <ArrowRight className="arrow" size={15} />
        </Link>
      </div>
      <div className="cat-card__media">
        {category.gallery ? (
          <div className="cat-card__gallery">
            {category.gallery.map((src) => (
              <img key={src} src={src} alt={category.alt} loading="lazy" />
            ))}
          </div>
        ) : (
          <img src={category.image} alt={category.alt} loading="lazy" />
        )}
      </div>
    </article>
  );
}

export default function CategorySection() {
  return (
    <section className="shell section" aria-label="Shop by category">
      <div className="categories">
        {CATEGORIES.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </section>
  );
}
