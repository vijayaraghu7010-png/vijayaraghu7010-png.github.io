/* ===========================================================
   Central product + content data for WrappedStudio.
   Change prices, names, images and copy here — every page,
   card, search result and cart line reads from this file.
   =========================================================== */

export const CURRENCY = 'INR';

/* How a product is priced. 'each' products multiply the unit
   price by the quantity the customer picks (polaroid prints). */
export const PRICE_MODES = {
  FIXED: 'fixed',
  PER_UNIT: 'per-unit'
};

export const MAGAZINE_SIZES = [
  { id: 'mag-4', label: '4 pages / 8 sides', pages: 4, sides: 8, price: 300 },
  { id: 'mag-8', label: '8 pages / 16 sides', pages: 8, sides: 16, price: 550 }
];

export const MAGAZINE_THEMES = [
  { id: 'love', name: 'Love', blurb: 'Warm tones, soft type, a lot of heart.' },
  { id: 'friendship', name: 'Friendship', blurb: 'Bright, playful and full of inside jokes.' },
  { id: 'birthday', name: 'Birthday', blurb: 'Confetti energy and a year worth remembering.' },
  { id: 'anniversary', name: 'Anniversary', blurb: 'Elegant pages for the years you have shared.' },
  { id: 'memories', name: 'Memories', blurb: 'A gentle look back through everything.' },
  { id: 'general', name: 'General', blurb: 'Clean and classic — fits any occasion.' },
  { id: 'horror', name: 'Horror', blurb: 'Dark pages, grain and a little mischief.' },
  { id: 'custom', name: 'Custom theme', blurb: 'Tell us the mood and we design around it.' }
];

export const POLAROID_BORDERS = ['Classic White', 'Warm Vintage Cream', 'Sunset Blush', 'Film Grain Matte'];

/* frame colours used by the live preview in the polaroid studio */
export const BORDER_SWATCHES = {
  'Classic White': '#ffffff',
  'Warm Vintage Cream': '#f7ecdc',
  'Sunset Blush': '#ffd9d2',
  'Film Grain Matte': '#efe7e2'
};

export const BOUQUET_WRAPS = ['Blush pink', 'Warm cream', 'Sunset peach', 'Kraft brown'];

export const BOUQUET_OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Love',
  'Congratulations',
  'Just Because'
];

export const HAMPER_OCCASIONS = [
  'Love',
  'Birthday',
  'Anniversary',
  'Rakhi',
  'Thank You',
  'Just Because'
];

export const PRODUCTS = [
  /* ----------------------------------------------- magazines */
  {
    id: 'magazine-4',
    slug: 'personalised-magazine-4-pages',
    name: 'Personalised Magazine (4 Pages)',
    category: 'magazine',
    categoryLabel: 'Magazine',
    price: 300,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/magazine-4p.jpg',
    alt: 'An open personalised photo magazine lying on a table with printed memories across both pages',
    gallery: ['/images/magazine-4p.jpg', '/images/magazine-hero.jpg'],
    shortDescription: '4 pages, 8 printed sides of your own photos.',
    description:
      'Four pages, eight printed sides. Send us your photos, pick a theme, and we lay out every side by hand. You approve a PDF preview before anything is printed.',
    details: ['4 pages / 8 printed sides', 'Theme of your choice', 'PDF preview before printing', 'Shipping charged separately'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Anniversary', 'Memories'],
    keywords: ['magazine', 'photo book', 'personalised', 'zine', 'memories', 'pages'],
    customiser: 'magazine',
    sizeId: 'mag-4',
    featured: true,
    addedAt: '2026-02-10'
  },
  {
    id: 'magazine-8',
    slug: 'personalised-magazine-8-pages',
    name: 'Personalised Magazine (8 Pages)',
    category: 'magazine',
    categoryLabel: 'Magazine',
    price: 550,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/magazine-8p.jpg',
    alt: 'A layered personalised magazine spread with photographs, notes and pressed flowers',
    gallery: ['/images/magazine-8p.jpg', '/images/magazine-hero.jpg'],
    shortDescription: '8 pages, 16 printed sides — room for the whole story.',
    description:
      'Eight pages, sixteen printed sides — room for a whole year, a whole trip, or a whole friendship. Same process: your photos, your theme, a PDF preview, then print.',
    details: ['8 pages / 16 printed sides', 'Theme of your choice', 'PDF preview before printing', 'Shipping charged separately'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Anniversary', 'Memories'],
    keywords: ['magazine', 'photo book', 'personalised', 'zine', 'memories', 'pages'],
    customiser: 'magazine',
    sizeId: 'mag-8',
    featured: true,
    addedAt: '2026-02-10'
  },

  /* ----------------------------------------------- polaroids */
  {
    id: 'polaroid-medium',
    slug: 'polaroid-prints-medium',
    name: 'Polaroid Prints (Medium)',
    category: 'polaroid',
    categoryLabel: 'Polaroid',
    price: 6,
    priceMode: PRICE_MODES.PER_UNIT,
    unitLabel: 'each',
    unitNoun: 'print',
    minQty: 9,
    step: 1,
    image: '/images/polaroid-medium.jpg',
    alt: 'Medium polaroid prints spread across a wooden table beside an instant camera',
    gallery: ['/images/polaroid-medium.jpg', '/images/polaroid-hero.jpg'],
    shortDescription: 'Medium polaroid prints, ₹6 each, minimum 9 prints.',
    formatTitle: 'Individual Medium Prints',
    formatNote: 'Choose any count (min. 9 photos)',
    formatMeta: 'Printed on heavy 300gsm semi-gloss card.',
    formatPrice: '₹6 each',
    description:
      'Medium polaroid prints of your own photos on soft matte stock. Priced per print, with a minimum of 9 prints per order so the pack arrives worth sending.',
    details: ['₹6 per print', 'Minimum 9 prints', 'Medium size, matte finish', 'Dispatch in 3–4 working days'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Just Because'],
    keywords: ['polaroid', 'prints', 'photos', 'instant', 'pictures'],
    customiser: 'polaroid',
    featured: true,
    addedAt: '2026-03-02'
  },
  {
    id: 'polaroid-set-25',
    slug: 'polaroid-set-25-prints',
    name: 'Polaroid Set (25 Prints)',
    category: 'polaroid',
    categoryLabel: 'Polaroid',
    price: 150,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'per set',
    setSize: 25,
    image: '/images/polaroid-set.jpg',
    alt: 'A set of polaroid prints laid out in rows on a wooden surface',
    gallery: ['/images/polaroid-set.jpg', '/images/polaroid-hero.jpg'],
    shortDescription: '25 polaroid prints in one set for ₹150.',
    formatTitle: 'Keepsake Set (25 Prints)',
    formatNote: '25 curated prints in gift sleeve',
    formatMeta: 'Best value for holiday albums and event gifts.',
    formatPrice: '₹150 / set',
    description:
      'Twenty-five medium polaroid prints as one set — the easy way to turn a camera roll into something you can hold. ₹150 for the set of 25.',
    details: ['25 prints per set', '₹150 per set', 'Medium size, matte finish', 'Dispatch in 3–4 working days'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Just Because'],
    keywords: ['polaroid', 'prints', 'set', 'bundle', 'photos', 'pictures'],
    customiser: 'polaroid',
    featured: true,
    addedAt: '2026-03-02'
  },

  /* ------------------------------------------------ bouquets */
  {
    id: 'bouquet-blush-coast',
    slug: 'blush-sunset-bouquet',
    name: 'Blush Sunset Bouquet',
    category: 'bouquet',
    categoryLabel: 'Bouquet',
    price: 1299,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/p-blush-coast.jpg',
    alt: 'A handmade bouquet of blush pink roses wrapped in pale paper',
    gallery: ['/images/p-blush-coast.jpg', '/images/o-love.jpg'],
    shortDescription: 'Soft, romantic and serene — blush roses tied by hand.',
    description:
      'Blush pink roses and soft fillers, tied by hand and wrapped in pale paper. Made to order, so every bouquet is a little different.',
    details: ['Handmade to order', 'Choice of wrap colour', 'Optional message card', 'Shipping charged separately'],
    occasions: ['Love', 'Anniversary', 'Just Because'],
    flowerType: 'Rose Bouquets',
    keywords: ['bouquet', 'rose', 'pink', 'blush', 'flowers', 'romantic'],
    customiser: 'bouquet',
    featured: true,
    addedAt: '2026-01-18'
  },
  {
    id: 'bouquet-golden-hour',
    slug: 'golden-hour-bouquet',
    name: 'Golden Hour Bouquet',
    category: 'bouquet',
    categoryLabel: 'Bouquet',
    price: 1499,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/p-golden-hour.jpg',
    alt: 'A warm bouquet of coral and cream roses in sunset light',
    gallery: ['/images/p-golden-hour.jpg', '/images/o-anniversary.jpg'],
    shortDescription: 'A warm blend of sunset hues, coral through cream.',
    description:
      'Coral, peach and cream blooms in the colours of the last hour of light. Our most-sent bouquet, and the one most often asked for again.',
    details: ['Handmade to order', 'Choice of wrap colour', 'Optional message card', 'Shipping charged separately'],
    occasions: ['Anniversary', 'Congratulations', 'Love'],
    flowerType: 'Rose Bouquets',
    keywords: ['bouquet', 'rose', 'coral', 'sunset', 'flowers', 'golden'],
    customiser: 'bouquet',
    featured: true,
    addedAt: '2026-01-18'
  },
  {
    id: 'bouquet-sunset-sunflower',
    slug: 'sunset-sunflower-bouquet',
    name: 'Sunset Sunflower Bouquet',
    category: 'bouquet',
    categoryLabel: 'Bouquet',
    price: 1349,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/p-sunflower.jpg',
    alt: 'A bright bouquet of sunflowers wrapped for gifting',
    gallery: ['/images/p-sunflower.jpg', '/images/o-congrats.jpg'],
    shortDescription: 'Radiates joy and positivity — sunflowers, front and centre.',
    description:
      'Big, bright sunflowers with warm fillers. The bouquet to send when the news is good and you want it to feel like it.',
    details: ['Handmade to order', 'Choice of wrap colour', 'Optional message card', 'Shipping charged separately'],
    occasions: ['Congratulations', 'Birthday', 'Just Because'],
    flowerType: 'Sunflower Bouquets',
    keywords: ['bouquet', 'sunflower', 'yellow', 'bright', 'flowers', 'congratulations'],
    customiser: 'bouquet',
    featured: false,
    addedAt: '2026-04-06'
  },
  {
    id: 'bouquet-ocean-breeze',
    slug: 'ocean-breeze-bouquet',
    name: 'Ocean Breeze Bouquet',
    category: 'bouquet',
    categoryLabel: 'Bouquet',
    price: 1599,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/p-ocean-breeze.jpg',
    alt: 'A cream and white bouquet with pastel blooms held in warm light',
    gallery: ['/images/p-ocean-breeze.jpg', '/images/o-justbecause.jpg'],
    shortDescription: 'A touch of calm, a lot of love — cream and pastel blooms.',
    description:
      'Cream and white blooms with cool pastel accents, tied loose and airy. Quiet, and the one people keep the longest.',
    details: ['Handmade to order', 'Choice of wrap colour', 'Optional message card', 'Shipping charged separately'],
    occasions: ['Just Because', 'Birthday', 'Anniversary'],
    flowerType: 'Rose Bouquets',
    keywords: ['bouquet', 'white', 'cream', 'pastel', 'calm', 'flowers'],
    customiser: 'bouquet',
    featured: false,
    addedAt: '2026-04-06'
  },
  /* ------------------------------------------------- hampers */
  {
    id: 'hamper-blush-luxe',
    slug: 'blush-luxe-hamper',
    name: 'Blush Luxe Hamper',
    category: 'hamper',
    categoryLabel: 'Hamper',
    price: 2499,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/hampers/hamper-blush-luxe.jpg',
    alt: 'A blush pink gift box holding perfumes, a pearl clutch, earrings and chocolates',
    gallery: ['/images/hampers/hamper-blush-luxe.jpg', '/images/hampers/hamper-rosewood.jpg'],
    shortDescription: 'Perfume, a pearl clutch, earrings and chocolates in a ribboned box.',
    description:
      'Our most indulgent hamper. A satin-ribboned blush box holding two eau de parfums, a pearl-finish clutch, pearl earring sets, a claw clip, silk scrunchies and Ferrero Rocher, finished with illustrated cards and a handwritten note.',
    details: ['Packed to order', 'Handwritten note included', 'Contents can be swapped on request', 'Shipping charged separately'],
    occasions: ['Love', 'Birthday', 'Anniversary'],
    keywords: ['hamper', 'gift box', 'perfume', 'clutch', 'jewellery', 'chocolate', 'luxury'],
    featured: true,
    addedAt: '2026-10-22'
  },
  {
    id: 'hamper-keepsake',
    slug: 'keepsake-memory-hamper',
    name: 'Keepsake Memory Hamper',
    category: 'hamper',
    categoryLabel: 'Hamper',
    price: 2999,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/hampers/hamper-keepsake.jpg',
    alt: 'A navy gift box with an engraved message board, a handmade bouquet and polaroids',
    gallery: ['/images/hampers/hamper-keepsake.jpg', '/images/hampers/hamper-blush-luxe.jpg'],
    shortDescription: 'An engraved letter board, a handmade bouquet and your own polaroids.',
    description:
      'Built around your own words. An engraved message board carries your letter, paired with a handmade bouquet, printed polaroids of your people, and room for one gift of your choosing.',
    details: ['Your message engraved', 'Handmade bouquet included', 'Photos printed from your uploads', 'Shipping charged separately'],
    occasions: ['Rakhi', 'Birthday', 'Just Because'],
    keywords: ['hamper', 'gift box', 'engraved', 'message', 'bouquet', 'polaroid', 'rakhi'],
    featured: true,
    addedAt: '2026-10-22'
  },
  {
    id: 'hamper-sweet-thanks',
    slug: 'sweet-thanks-hamper',
    name: 'Sweet Thanks Hamper',
    category: 'hamper',
    categoryLabel: 'Hamper',
    price: 1499,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/hampers/hamper-sweet-thanks.jpg',
    alt: 'An ivory gift box with a scented candle, satin scrunchies, chocolate and a pendant set',
    gallery: ['/images/hampers/hamper-sweet-thanks.jpg', '/images/hampers/hamper-keepsake.jpg'],
    shortDescription: 'Scented candle, satin scrunchies, a macrame keyring and chocolate.',
    description:
      'A warm little thank-you in an ivory keepsake box: a grapefruit and mandarin candle, two satin scrunchies, a handmade macrame tassel keyring, a chocolate bar and a gold-tone pendant and earring set.',
    details: ['Packed to order', 'Thank-you card included', 'Contents can be swapped on request', 'Shipping charged separately'],
    occasions: ['Thank You', 'Just Because', 'Birthday'],
    keywords: ['hamper', 'gift box', 'candle', 'scrunchie', 'keyring', 'chocolate', 'thank you'],
    featured: false,
    addedAt: '2026-10-22'
  },
  {
    id: 'hamper-rosewood',
    slug: 'rosewood-charm-hamper',
    name: 'Rosewood Charm Hamper',
    category: 'hamper',
    categoryLabel: 'Hamper',
    price: 1799,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/hampers/hamper-rosewood.jpg',
    alt: 'A red and ivory gift box with a brooch, stud earrings, a heart purse and velvet roses',
    gallery: ['/images/hampers/hamper-rosewood.jpg', '/images/hampers/hamper-sweet-thanks.jpg'],
    shortDescription: 'A charm brooch, stud sets, a heart envelope purse and velvet roses.',
    description:
      'Romance in a red-and-ivory box. A charm brooch and ring card, a six-pair stud earring set, a soft heart-clasp envelope purse and velvet roses, cushioned in blush crinkle paper with our handwritten thank-you card.',
    details: ['Packed to order', 'Handwritten note included', 'Contents can be swapped on request', 'Shipping charged separately'],
    occasions: ['Love', 'Anniversary', 'Just Because'],
    keywords: ['hamper', 'gift box', 'brooch', 'earrings', 'purse', 'roses', 'romantic'],
    featured: false,
    addedAt: '2026-10-22'
  }
];

/* ---------------------------------------------------------------
   The catalogue above is what the site ships with. When the admin
   database is reachable, SiteConfigProvider swaps in the rows from
   Postgres through setLiveProducts, and every accessor below reads
   that instead. If the database is unreachable the built-in list is
   still there, so the shop never renders empty.
   --------------------------------------------------------------- */

let LIVE = PRODUCTS;

export const setLiveProducts = (list) => {
  LIVE = Array.isArray(list) && list.length ? list : PRODUCTS;
};

export const getProducts = () => LIVE;
export const getProductBySlug = (slug) => LIVE.find((p) => p.slug === slug);
export const getProductById = (id) => LIVE.find((p) => p.id === id);
export const getByCategory = (category) => LIVE.filter((p) => p.category === category);
export const getFeatured = () => LIVE.filter((p) => p.featured);

/* Everything a search should look through, as one lowercase string. */
export const searchIndex = (p) =>
  [p.name, p.categoryLabel, p.shortDescription, p.description, p.flowerType, ...(p.occasions || []), ...(p.keywords || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const searchProducts = (query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return LIVE.filter((p) => {
    const haystack = searchIndex(p);
    return terms.every((t) => haystack.includes(t));
  });
};
