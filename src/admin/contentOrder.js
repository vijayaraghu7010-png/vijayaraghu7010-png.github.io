/* The order the Site text panel lists things in.

   The rows arrive sorted by key, which is alphabetical, and
   alphabetical is not the order anybody reads a page in. It put
   `benefit.0.text` above `benefit.0.title`, and turned the home hero
   into ctaPrimary, ctaSecondary, eyebrow, text, title - five fields
   in five unrelated places, none of them where they sit on screen.

   So the panel is sorted the way the page reads instead: the groups
   in the order a visitor meets them, and inside a group the eyebrow,
   then the heading, then the words under it, then the button. A
   studio looking for the sentence under a heading finds it under the
   heading. */

/* Top to bottom, as the site is built. Anything not named here keeps
   its place after these, alphabetically, so a group added later
   appears rather than disappearing. */
const GROUP_ORDER = [
  'brand',
  'home',
  'benefits',
  'categories',
  'magazines',
  'polaroids',
  'bouquets',
  'hampers',
  'contact'
];

/* What the studio calls them, rather than the slug the row carries. */
export const GROUP_LABELS = {
  brand: 'Brand',
  home: 'Home page',
  benefits: 'Why WrappedStudio',
  categories: 'Category cards',
  magazines: 'Magazines page',
  polaroids: 'Polaroids page',
  bouquets: 'Bouquets page',
  hampers: 'Hampers page',
  contact: 'Contact details'
};

export const groupLabel = (name) =>
  GROUP_LABELS[name] ||
  String(name).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/* The last word of a key - `title`, `text`, `ctaPrimary` - ranked by
   where that kind of thing sits on a page. */
const FIELD_ORDER = [
  'eyebrow',
  'title',
  'subtitle',
  'name',
  'tagline',
  'text',
  'description',
  'footerLine',
  'cta',
  'ctaPrimary',
  'ctaPrimaryLink',
  'ctaSecondary',
  'ctaSecondaryLink',
  'image',
  'imageAlt'
];

const fieldRank = (key) => {
  const last = String(key).split('.').pop();
  const i = FIELD_ORDER.indexOf(last);
  return i === -1 ? FIELD_ORDER.length : i;
};

/* Everything before the last segment: `benefit.0`, `category.bouquet`,
   `home.hero`. Fields sharing one belong together. */
const baseOf = (key) => String(key).split('.').slice(0, -1).join('.');

/* `benefit.10` after `benefit.2`, which a string compare gets wrong. */
function compareBase(a, b) {
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i] ?? '';
    const y = bs[i] ?? '';
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isInteger(nx) && Number.isInteger(ny) && x !== '' && y !== '') {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export function sortFields(rows) {
  return [...rows].sort((a, b) => {
    const base = compareBase(baseOf(a.key), baseOf(b.key));
    if (base !== 0) return base;
    const rank = fieldRank(a.key) - fieldRank(b.key);
    if (rank !== 0) return rank;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

export function sortGroups(names) {
  return [...names].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a);
    const bi = GROUP_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
