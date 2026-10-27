import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { CATEGORIES } from '../data/categories';
import { useText } from '../context/SiteConfigContext';

export function CategoryCard({ category }) {
  const title = useText(`category.${category.id}.title`, category.title);
  const description = useText(`category.${category.id}.description`, category.description);
  const cta = useText(`category.${category.id}.cta`, category.cta);

  /* A card whose artwork already carries its name and its arrow. The
     whole tile is the link; the heading and the sentence stay in the
     markup, read out but not drawn, so the page keeps its headings and
     a search engine still has something to read. */
  if (category.art) {
    return (
      <article className="cat-card cat-card--art">
        <h2 className="sr-only">{title}</h2>
        <p className="sr-only">{description}</p>
        <Link className="cat-card__art" to={category.to} aria-label={cta}>
          <img
            src={category.art}
            alt=""
            width="1024"
            height="1536"
            loading="lazy"
            decoding="async"
          />
        </Link>
      </article>
    );
  }

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
              <img key={src} src={src} alt={category.alt} loading="lazy" decoding="async" />
            ))}
          </div>
        ) : (
          <img src={category.image} alt={category.alt} loading="lazy" decoding="async" />
        )}
      </div>
    </article>
  );
}

/* Every category the home page leads with, in data order. Photo
   frames and hampers used to have panels of their own further down
   the page; they now carry poster artwork like the rest and join the
   same grid, so adding or removing a card is a data change alone. */
export const LEAD_CATEGORIES = CATEGORIES.filter((c) => !c.wide);

/* The cards are cut to a hand-torn outline rather than a rounded
   rectangle, which is what the design draws them as. A border-radius
   cannot make an edge that wanders, so the silhouette is a clip path.

   clipPathUnits="objectBoundingBox" means the path is written in a
   0-1 box and stretches to whatever the card measures, so one shape
   serves every card at every width. It is defined once, here, and
   referenced by id from the stylesheet. */
function CardSilhouette() {
  return (
    <svg className="sr-only" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <clipPath id="cat-card-blob" clipPathUnits="objectBoundingBox">
          <path
            d="M0.034,0.205
               C0.029,0.100 0.070,0.038 0.152,0.047
               C0.300,0.062 0.420,0.020 0.560,0.029
               C0.720,0.039 0.852,0.016 0.930,0.058
               C0.979,0.085 0.990,0.150 0.973,0.231
               C0.952,0.331 0.996,0.430 0.979,0.531
               C0.963,0.641 0.991,0.760 0.963,0.846
               C0.941,0.921 0.881,0.969 0.800,0.959
               C0.650,0.941 0.520,0.986 0.380,0.973
               C0.240,0.960 0.120,0.991 0.062,0.941
               C0.018,0.903 0.011,0.831 0.028,0.741
               C0.046,0.641 0.011,0.520 0.030,0.420
               C0.042,0.350 0.039,0.276 0.034,0.205 Z"
          />
        </clipPath>
      </defs>
    </svg>
  );
}

export default function CategorySection() {
  return (
    <section className="shell section" aria-label="Shop by category">
      <CardSilhouette />
      <div className="categories">
        {LEAD_CATEGORIES.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </section>
  );
}
