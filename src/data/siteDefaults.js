import { BRAND, CONTACT, BENEFITS, CATEGORIES } from './categories';

/* What the shop looks like before anybody has edited anything.

   These lists used to be turned into a seed migration and loaded into
   Postgres; the database is gone, so they are the starting point the
   store reads on a first visit instead. Editing the site from the
   panel writes over a copy of this - it never touches these values,
   so "reset" is always possible. */

/* every string the admin can edit, addressed by a stable key */
const base = [
  ['brand.name', BRAND.name, 'brand', 'Brand name'],
  ['brand.tagline', BRAND.tagline || '', 'brand', 'Tagline'],
  ['brand.footerLine', BRAND.footerLine || '', 'brand', 'Footer line'],
  ['contact.phone', CONTACT.phone || '', 'contact', 'Phone'],
  ['contact.email', CONTACT.email || '', 'contact', 'Email'],
  ['contact.address', CONTACT.city || '', 'contact', 'Address'],
  ['home.hero.eyebrow', 'Personalised gifts for beautiful people', 'home', 'Hero eyebrow'],
  ['home.hero.title', 'Make Every Memory Bloom', 'home', 'Hero title'],
  [
    'home.hero.text',
    'Personalised magazines, polaroids and handcrafted bouquets for your special moments.',
    'home',
    'Hero paragraph',
    true
  ],
  ['home.hero.ctaPrimary', 'Explore Collections', 'home', 'Hero primary button'],
  ['home.hero.ctaPrimaryLink', '/magazines', 'home', 'Hero primary button goes to'],
  ['home.hero.ctaSecondary', 'Custom Gifts', 'home', 'Hero secondary button'],
  ['home.hero.ctaSecondaryLink', '/custom-gifts', 'home', 'Hero secondary button goes to'],
  ['home.hero.image', '/images/hero-sunset.jpg', 'home', 'Hero banner picture'],
  [
    'home.hero.imageAlt',
    'A handmade bouquet lying on the sand, a ribbon curled into a heart beside it, as the sun sets over the sea',
    'home',
    'Hero picture description',
    true
  ],
  [
    'home.hero.script',
    'Same\nSunset Vibes,\nBrighter Memories ♥',
    'home',
    'Hero handwriting (one line each)',
    true
  ],
  ['magazines.title', 'Personalised Magazines', 'magazines', 'Page title'],
  [
    'magazines.subtitle',
    'Turn your favourite memories into a magazine made just for you.',
    'magazines',
    'Page subtitle',
    true
  ],
  ['polaroids.title', 'Polaroids', 'polaroids', 'Page title'],
  ['polaroids.subtitle', 'Small prints. Big memories.', 'polaroids', 'Page subtitle', true],
  ['bouquets.title', 'Bouquets for Every Occasion', 'bouquets', 'Page title'],
  [
    'bouquets.subtitle',
    'Because every moment deserves a beautiful beginning.',
    'bouquets',
    'Page subtitle',
    true
  ],
  ['hampers.title', 'Hampers', 'hampers', 'Page title'],
  ['hampers.subtitle', 'Curated boxes, wrapped and ready to give.', 'hampers', 'Page subtitle', true]
];

CATEGORIES.forEach((c) => {
  base.push([`category.${c.id}.title`, c.title, 'categories', `${c.title} - title`]);
  base.push([`category.${c.id}.description`, c.description, 'categories', `${c.title} - description`, true]);
  base.push([`category.${c.id}.cta`, c.cta, 'categories', `${c.title} - button`]);
});

BENEFITS.forEach((b, i) => {
  base.push([`benefit.${i}.title`, b.title, 'benefits', `Benefit ${i + 1} title`]);
  base.push([`benefit.${i}.text`, b.text, 'benefits', `Benefit ${i + 1} text`, true]);
});

export const DEFAULT_CONTENT = base.map(([key, value, group_name, label, multiline]) => ({
  key,
  value: value ?? '',
  group_name,
  label,
  multiline: Boolean(multiline)
}));

/* the palette in variables.css, as the default theme */
const PALETTE = {
  '--coral': '#603D42',
  '--coral-dark': '#4C3135',
  '--coral-soft': '#EFE2E2',
  '--burgundy': '#603D42',
  '--burgundy-soft': '#7A5257',
  '--cream': '#FAF6F2',
  '--cream-2': '#FFFCF9',
  '--peach': '#F1E8E2',
  '--peach-deep': '#E5D9D1',
  '--blush': '#E5D9D1',
  '--orange': '#B98285',
  '--brown': '#827674',
  '--ink': '#2E2425',
  '--ink-2': '#3F3233',
  '--accent': '#B98285',
  '--btn-text': '#FAF6F2',
  '--line': '#E5D9D1',
  '--line-2': '#D8C8BE'
};

const festival = (id, name, tokens, bannerText) => ({
  id,
  name,
  kind: 'festival',
  tokens: { ...PALETTE, ...tokens },
  isDefault: false,
  isActive: false,
  startsAt: null,
  endsAt: null,
  bannerText
});

export const DEFAULT_THEMES = [
  {
    id: 'base',
    name: 'WrappedStudio',
    kind: 'base',
    tokens: PALETTE,
    isDefault: true,
    isActive: true,
    startsAt: null,
    endsAt: null,
    bannerText: ''
  },
  festival(
    'diwali',
    'Diwali',
    { '--coral': '#8A2F2A', '--coral-dark': '#6D241F', '--accent': '#C9922F', '--orange': '#C9922F', '--peach-deep': '#EBD9C2', '--line': '#E7D4B8' },
    'Diwali offers are live'
  ),
  festival(
    'christmas',
    'Christmas',
    { '--coral': '#2F5D4A', '--coral-dark': '#24483A', '--accent': '#B03A3A', '--orange': '#B03A3A', '--peach-deep': '#E3E8E1', '--line': '#D8E2D8' },
    'Christmas gifting is open'
  ),
  festival(
    'valentine',
    'Valentine',
    { '--coral': '#9B2F45', '--coral-dark': '#7C2537', '--accent': '#D98395', '--orange': '#D98395', '--peach-deep': '#F3DEE2', '--line': '#EDD3D9' },
    'Valentine collection is here'
  ),
  festival(
    'pongal',
    'Pongal',
    { '--coral': '#8A5A1F', '--coral-dark': '#6E4718', '--accent': '#C9A227', '--orange': '#C9A227', '--peach-deep': '#F0E4C8', '--line': '#E6D6B4' },
    'Pongal hampers are ready'
  )
];

export const DEFAULT_OFFERS = [];
