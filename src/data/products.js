/* ===========================================================
   Central product + content data for WrappedStudio.
   Change prices, names, images and copy here — every page,
   card, search result and cart line reads from this file.
   =========================================================== */

import { HAMPER_ITEM_PRODUCTS } from './hamperItems';

export const CURRENCY = 'INR';

/* How a product is priced. 'each' products multiply the unit
   price by the quantity the customer picks (polaroid prints). */
export const PRICE_MODES = {
  FIXED: 'fixed',
  PER_UNIT: 'per-unit'
};

/* Magazines are sold at two paper sizes, each in two lengths. Every
   row names the catalogue product it is priced from, so the customiser
   never has to work out which product a size means.

   `photos` is how many photographs that length holds: `max` is the
   limit the customiser enforces, and `from` is where a magazine of
   this length usually starts, so the page can ask for enough rather
   than only refusing too many. */
export const MAGAZINE_SIZES = [
  { id: 'mag-a4-4', paper: 'A4', label: 'A4 — 4 pages / 8 sides', pages: 4, sides: 8, price: 300, productId: 'magazine-a4-4', photos: { max: 15 } },
  { id: 'mag-a4-8', paper: 'A4', label: 'A4 — 8 pages / 16 sides', pages: 8, sides: 16, price: 550, productId: 'magazine-a4-8', photos: { from: 25, max: 30 } },
  { id: 'mag-a5-4', paper: 'A5', label: 'A5 — 4 pages / 8 sides', pages: 4, sides: 8, price: 200, productId: 'magazine-a5-4', photos: { max: 15 } },
  { id: 'mag-a5-8', paper: 'A5', label: 'A5 — 8 pages / 16 sides', pages: 8, sides: 16, price: 400, productId: 'magazine-a5-8', photos: { from: 25, max: 30 } }
];

export const MAGAZINE_THEMES = [
  { id: 'love', name: 'Love', blurb: 'Warm tones, soft type, a lot of heart.' },
  {
    id: 'friendship',
    name: 'Friendship',
    blurb: 'Bright, playful and full of inside jokes.',
    /* Pages we have already made in this theme. The shop's own work,
       photographed — see public/images/magazine-themes. */
    samples: [
      { src: '/images/magazine-themes/friendship-1.jpg', alt: 'Friendship magazine spread — a birthday photo dump with torn-paper captions' },
      { src: '/images/magazine-themes/friendship-2.jpg', alt: 'Friendship magazine spread — glitter doodles over a collage of friends' },
      { src: '/images/magazine-themes/friendship-3.jpg', alt: 'Friendship magazine spread — editorial cut-outs and postcards' }
    ]
  },
  { id: 'birthday', name: 'Birthday', blurb: 'Confetti energy and a year worth remembering.' },
  { id: 'anniversary', name: 'Anniversary', blurb: 'Elegant pages for the years you have shared.' },
  { id: 'memories', name: 'Memories', blurb: 'A gentle look back through everything.' },
  { id: 'general', name: 'General', blurb: 'Clean and classic — fits any occasion.' },
  {
    id: 'simba',
    name: 'Minimal Simba',
    blurb: 'Lion King artwork over film strips, with quiet white pages between.',
    samples: [
      { src: '/images/magazine-themes/simba-1.jpg', alt: 'Minimal Simba spread — Lion King characters around a film-strip collage' },
      { src: '/images/magazine-themes/simba-2.jpg', alt: 'Minimal Simba spread — taped photographs with handwritten notes' },
      { src: '/images/magazine-themes/simba-3.jpg', alt: 'Minimal Simba spread — a clean birthday-edition page in black and white' }
    ]
  },
  {
    id: 'spiderman',
    name: 'Spidey / Spider-Man',
    blurb: 'Comic panels, cut-out lettering and red-and-black covers.',
    samples: [
      { src: '/images/magazine-themes/spiderman-1.jpg', alt: 'Spiderman magazine cover — a name in red over a comic-book border' },
      { src: '/images/magazine-themes/spiderman-2.jpg', alt: 'Spiderman spread — ransom-note lettering over comic panels' },
      { src: '/images/magazine-themes/spiderman-3.jpg', alt: 'Spiderman spread — photographs and stickers across comic artwork' }
    ]
  },
  {
    id: 'horror',
    name: 'Horrified / Halloween',
    blurb: 'Dark pages, grain and a little mischief.',
    samples: [
      { src: '/images/magazine-themes/horror-1.jpg', alt: 'Halloween spread — polaroids pegged to a line over a dark collage' },
      { src: '/images/magazine-themes/horror-2.jpg', alt: 'Halloween spread — film strips and a bloody handprint on black' },
      { src: '/images/magazine-themes/horror-3.jpg', alt: 'Halloween spread — pinned photographs with a repeated red warning' }
    ]
  },
  { id: 'batman', name: 'Batman', blurb: 'Gotham black and gold, bold panels and a little drama.' },
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

/* The cover a bouquet is wrapped in. */
export const BOUQUET_WRAPS = ['Blush pink', 'Warm cream', 'Sunset peach', 'Kraft brown'];

/* How big the bouquet is, as the studio quotes it. No price is
   attached: every bouquet in the catalogue carries its own, and the
   size is confirmed with the order. */
export const BOUQUET_SIZES = [
  { id: 'small', label: 'Small', blurb: 'A handful — around 6 stems.' },
  { id: 'medium', label: 'Medium', blurb: 'The usual gift size — around 12 stems.' },
  { id: 'large', label: 'Large', blurb: 'A full armful — around 18 stems.' }
];

/* What the flowers are made of. The catalogue sheet is photographed
   in pipe-cleaner thread; the same flowers are made in cloth, and
   real stems are sourced to order. */
export const BOUQUET_MATERIALS = [
  { id: 'thread', label: 'Thread', blurb: 'Pipe-cleaner flowers, handmade and lasting.' },
  { id: 'cloth', label: 'Cloth', blurb: 'Fabric petals, soft and light.' },
  { id: 'live', label: 'Live flowers', blurb: 'Fresh stems, sourced for the delivery date.' }
];

export const BOUQUET_OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Love',
  'Congratulations',
  'Just Because'
];

/* Frames are sold by paper size, each at its own price. Listed in the
   order the shop quotes them. The id becomes part of the cart line's
   product id (frame-couple-eye + '-' + this id), which is what the
   server prices the frame from - so every id here must have a matching
   row in the price_variants table, or an order for that size is
   refused. A2 is priced below A4 and A3 at the studio's instruction. */
export const FRAME_SIZES = [
  { id: 'frame-a4', label: 'A4', blurb: '21 x 29.7 cm', price: 450 },
  { id: 'frame-a3', label: 'A3', blurb: '29.7 x 42 cm', price: 750 },
  { id: 'frame-a2', label: 'A2', blurb: '42 x 59.4 cm', price: 300 }
];

/* Some frames are sold two ways - as a print on its own, or printed
   and framed - at two sizes each. A product carries this list on its
   `frameSizes` field and the customiser uses it in place of the default
   sizes above. Each id, joined to the product id, must have a matching
   price_variants row, exactly as the default sizes do. */
export const FRAMED_PRINT_SIZES = [
  { id: 'a5-framed', label: 'A5 · with frame', blurb: 'Printed and framed', price: 1000 },
  { id: 'a4-framed', label: 'A4 · with frame', blurb: 'Printed and framed', price: 1999 },
  { id: 'a5-print', label: 'A5 · print only', blurb: 'Print, no frame', price: 1000 },
  { id: 'a4-print', label: 'A4 · print only', blurb: 'Print, no frame', price: 1900 }
];

/* The frame's design templates. Each is one of the studio's own made
   frames, photographed - the image is the sample the customer picks
   from, and the name is what the chosen template is recorded as on the
   order. The files live in public/images/frame-themes. */
export const FRAME_THEMES = [
  {
    id: 'friendship',
    name: 'Friendship',
    image: '/images/frame-themes/friendship.webp',
    alt: 'Friendship frame — a photo collage around a heartfelt handwritten message'
  },
  {
    id: 'google',
    name: 'Google',
    image: '/images/frame-themes/google.webp',
    alt: 'Google-search frame — "Best Friends Forever" above a collage of photographs'
  },
  {
    id: 'forever',
    name: 'Forever',
    image: '/images/frame-themes/forever.webp',
    alt: 'Forever frame — a black-and-white collage with a cut-out of two friends'
  }
];

export const FRAME_OCCASIONS = [
  'Love',
  'Anniversary',
  'Birthday',
  'Valentine',
  'Long Distance',
  'Just Because'
];

/* Wall posters are the one ready-made print the shop sells: the artwork
   is the studio's, nothing is uploaded and nothing is personalised, so
   the only choice is how big and on what paper. Two sizes at a flat
   price each, the same for every design.

   These are not wired to a picker yet. The catalogue states both prices
   on the product and the studio confirms the size when it replies to
   the order, which is how the shop already works - no payment gateway
   is connected, so every order is an enquiry. Giving posters a real
   size selector means a small customiser plus a `price_variants` row
   per id below, exactly as FRAME_SIZES documents. */
export const POSTER_SIZES = [
  { id: 'poster-a5', label: 'A5', blurb: '14.8 x 21 cm', price: 50 },
  { id: 'poster-a4', label: 'A4', blurb: '21 x 29.7 cm', price: 100 }
];

/* How many prints are ordered together. A set is priced straight off
   the sheet count - a single A5 is ₹50, so a set of three is ₹150 -
   so there is no price here either, only the multiplier.

   It is applied by multiplying the basket line's quantity rather than
   by minting a variant per set: the server prices a line as unit x
   quantity, so three prints at ₹50 come to ₹150 there exactly as they
   do on the page, and no new price_variants rows are needed. */
export const POSTER_SETS = [
  { id: 'set-1', label: 'Single', blurb: 'One print', count: 1 },
  { id: 'set-2', label: 'Set of 2', blurb: 'Two prints', count: 2 },
  { id: 'set-3', label: 'Set of 3', blurb: 'Three prints', count: 3 },
  { id: 'set-5', label: 'Set of 5', blurb: 'Five prints', count: 5 }
];

/* The stock a poster is printed on. It does not change the price - the
   size does that - so these carry no price of their own and are
   recorded on the order so the studio knows what to print. */
export const POSTER_PAPERS = [
  { id: 'photo-sheet', label: 'Photo sheet', blurb: 'Glossy photo paper' },
  { id: 'card', label: 'Card poster', blurb: '250–400 gsm card' }
];

/* Printed either on photo sheet or on 250-400 gsm card. Every poster
   says the same thing, so it is written once. */
const POSTER_DETAILS = [
  'A5 ₹50, A4 ₹100',
  'Photo sheet, or card poster on 250–400 gsm',
  'Printed to order',
  'Frame not included',
  'Shipping charged separately'
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
    id: 'magazine-a4-4',
    slug: 'personalised-magazine-a4-4-pages',
    name: 'Personalised Magazine — A4 (4 Pages)',
    category: 'magazine',
    categoryLabel: 'Magazine',
    price: 300,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/magazine-4p.jpg',
    alt: 'An open personalised photo magazine lying on a table with printed memories across both pages',
    gallery: ['/images/magazine-4p.jpg', '/images/magazine-hero.jpg'],
    shortDescription: 'A4, 4 pages — 8 printed sides of your own photos.',
    description:
      'Four A4 pages, eight printed sides. Send us your photos, pick a theme, and we lay out every side by hand. You approve a PDF preview before anything is printed.',
    details: ['A4 size', '4 pages / 8 printed sides', 'Theme of your choice', 'PDF preview before printing', 'Shipping charged separately'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Anniversary', 'Memories'],
    keywords: ['magazine', 'photo book', 'personalised', 'zine', 'memories', 'pages', 'a4'],
    customiser: 'magazine',
    sizeId: 'mag-a4-4',
    featured: true,
    rating: 4.9,
    reviews: 212,
    addedAt: '2026-02-10'
  },
  {
    id: 'magazine-a4-8',
    slug: 'personalised-magazine-a4-8-pages',
    name: 'Personalised Magazine — A4 (8 Pages)',
    category: 'magazine',
    categoryLabel: 'Magazine',
    price: 550,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/magazine-8p.jpg',
    alt: 'A layered personalised magazine spread with photographs, notes and pressed flowers',
    gallery: ['/images/magazine-8p.jpg', '/images/magazine-hero.jpg'],
    shortDescription: 'A4, 8 pages — 16 printed sides, room for the whole story.',
    description:
      'Eight A4 pages, sixteen printed sides — room for a whole year, a whole trip, or a whole friendship. Same process: your photos, your theme, a PDF preview, then print.',
    details: ['A4 size', '8 pages / 16 printed sides', 'Theme of your choice', 'PDF preview before printing', 'Shipping charged separately'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Anniversary', 'Memories'],
    keywords: ['magazine', 'photo book', 'personalised', 'zine', 'memories', 'pages', 'a4'],
    customiser: 'magazine',
    sizeId: 'mag-a4-8',
    featured: true,
    rating: 4.8,
    reviews: 164,
    addedAt: '2026-02-10'
  },
  {
    id: 'magazine-a5-4',
    slug: 'personalised-magazine-a5-4-pages',
    name: 'Personalised Magazine — A5 (4 Pages)',
    category: 'magazine',
    categoryLabel: 'Magazine',
    price: 200,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/magazine-4p.jpg',
    alt: 'An open personalised photo magazine lying on a table with printed memories across both pages',
    gallery: ['/images/magazine-4p.jpg', '/images/magazine-hero.jpg'],
    shortDescription: 'A5, 4 pages — the pocket size, 8 printed sides.',
    description:
      'The same magazine at half the paper size: four A5 pages, eight printed sides. Easy to post, easy to keep on a shelf. Your photos, your theme, and a PDF preview before anything is printed.',
    details: ['A5 size', '4 pages / 8 printed sides', 'Theme of your choice', 'PDF preview before printing', 'Shipping charged separately'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Anniversary', 'Memories'],
    keywords: ['magazine', 'photo book', 'personalised', 'zine', 'memories', 'pages', 'a5', 'small'],
    customiser: 'magazine',
    sizeId: 'mag-a5-4',
    rating: 4.8,
    reviews: 41,
    addedAt: '2026-10-26'
  },
  {
    id: 'magazine-a5-8',
    slug: 'personalised-magazine-a5-8-pages',
    name: 'Personalised Magazine — A5 (8 Pages)',
    category: 'magazine',
    categoryLabel: 'Magazine',
    price: 400,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/magazine-8p.jpg',
    alt: 'A layered personalised magazine spread with photographs, notes and pressed flowers',
    gallery: ['/images/magazine-8p.jpg', '/images/magazine-hero.jpg'],
    shortDescription: 'A5, 8 pages — 16 printed sides in the pocket size.',
    description:
      'Eight A5 pages, sixteen printed sides. The longer story in the smaller size, designed by hand and sent to you as a PDF preview before it is printed.',
    details: ['A5 size', '8 pages / 16 printed sides', 'Theme of your choice', 'PDF preview before printing', 'Shipping charged separately'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Anniversary', 'Memories'],
    keywords: ['magazine', 'photo book', 'personalised', 'zine', 'memories', 'pages', 'a5', 'small'],
    customiser: 'magazine',
    sizeId: 'mag-a5-8',
    rating: 4.8,
    reviews: 33,
    addedAt: '2026-10-26'
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
    formatTitle: 'Medium Prints',
    formatNote: 'Choose any count (min. 9 photos)',
    formatMeta: 'Printed on heavy 300gsm semi-gloss card.',
    formatPrice: '₹6 each',
    description:
      'Medium polaroid prints of your own photos on soft matte stock. Priced per print, with a minimum of 9 prints per order so the pack arrives worth sending.',
    details: ['₹6 per print', 'Minimum 9 prints', 'Medium size, matte finish', 'Dispatch in 3–4 working days'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Just Because'],
    keywords: ['polaroid', 'prints', 'photos', 'instant', 'pictures', 'medium'],
    customiser: 'polaroid',
    featured: true,
    rating: 4.9,
    reviews: 148,
    addedAt: '2026-03-02'
  },
  {
    id: 'polaroid-large',
    slug: 'polaroid-prints-large',
    name: 'Polaroid Prints (Large)',
    category: 'polaroid',
    categoryLabel: 'Polaroid',
    price: 10,
    priceMode: PRICE_MODES.PER_UNIT,
    unitLabel: 'each',
    unitNoun: 'print',
    minQty: 10,
    step: 1,
    image: '/images/polaroid-set.jpg',
    alt: 'Larger polaroid prints laid out in rows on a wooden surface',
    gallery: ['/images/polaroid-set.jpg', '/images/polaroid-hero.jpg'],
    shortDescription: 'Large polaroid prints, ₹10 each, minimum 10 prints.',
    formatTitle: 'Large Prints',
    formatNote: 'Choose any count (min. 10 photos)',
    formatMeta: 'The bigger print, on the same heavy card.',
    formatPrice: '₹10 each',
    description:
      'The same prints in the larger size, for the photographs that deserve the room — a wall, a frame, a board. Priced per print, with a minimum of 10 prints per order.',
    details: ['₹10 per print', 'Minimum 10 prints', 'Large size, matte finish', 'Dispatch in 3–4 working days'],
    occasions: ['Love', 'Friendship', 'Birthday', 'Just Because'],
    keywords: ['polaroid', 'prints', 'photos', 'instant', 'pictures', 'large'],
    customiser: 'polaroid',
    featured: true,
    rating: 4.8,
    reviews: 96,
    addedAt: '2026-10-26'
  },

  /* ------------------------------------------------ bouquets

     The four the shop opened with have been taken off. The category,
     the page and the bouquet customiser all stay, so new ones drop
     straight in here and the shop picks them up.

     The hamper's own small bouquet no longer depends on this shelf:
     it is priced from `kit-bouquet-mini` in hamperItems.js, which is
     where hamper fillers belong. Emptying this list does not take it
     with them.                                                     */
  /* -------------------------------------------------- frames */
  {
    id: 'frame-couple-eye',
    slug: 'couple-eye-frame',
    name: 'Couple Eye Frame',
    category: 'frame',
    categoryLabel: 'Photo Frame',
    price: 400,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: '',
    image: '/images/frames/couple-eye-frame.jpg',
    alt: 'Two framed prints of a couple’s eyes above the line "Of all the eyes I’ve met, yours felt like home"',
    gallery: ['/images/frames/couple-eye-frame.jpg'],
    shortDescription: 'Your favourite eyes, framed — with the year it started and the year it bloomed.',
    description:
      'A little piece of your forever. Your two pairs of eyes printed side by side under the line "Of all the eyes I’ve met, yours felt like home", finished with the year it started and the year it is still blooming. A quiet reminder of your love, your journey and everything in between.',
    details: [
      'A4 ₹450, A3 ₹750, A2 ₹300',
      'Printed and framed to order',
      'Send two close-up photographs and your two years',
      'Shipping charged separately'
    ],
    occasions: ['Love', 'Anniversary', 'Birthday', 'Valentine', 'Long Distance', 'Just Because'],
    keywords: ['frame', 'photo frame', 'couple', 'eyes', 'anniversary', 'valentine', 'gift', 'personalised'],
    customiser: 'frame',
    sizeId: 'frame-a4',
    featured: true,
    published: true,
    sortOrder: 60,
    rating: 4.8,
    reviews: 87,
    addedAt: '2026-10-23'
  },
  {
    id: 'frame-friendship',
    slug: 'friendship-frame',
    name: 'Friendship Frame',
    category: 'frame',
    categoryLabel: 'Photo Frame',
    price: 450,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/frame-themes/friendship.webp',
    alt: 'A friendship photo-collage frame with a handwritten message in the centre',
    gallery: ['/images/frame-themes/friendship.webp'],
    shortDescription: 'A collage of your favourite people around a message written just for them.',
    description:
      'Your photographs laid out around a heartfelt note — the frame for a best friend, a sister, the person who has been there through everything. Send your pictures and your words, pick a size, and we print and frame it to order.',
    details: ['A4 ₹450, A3 ₹750, A2 ₹300', 'Printed and framed to order', 'Upload your photographs on the page', 'Shipping charged separately'],
    occasions: ['Friendship', 'Birthday', 'Just Because', 'Thank You'],
    keywords: ['frame', 'photo frame', 'friendship', 'collage', 'best friend', 'gift', 'personalised'],
    customiser: 'frame',
    themeId: 'friendship',
    sizeId: 'frame-a4',
    featured: true,
    published: true,
    sortOrder: 61,
    rating: 4.9,
    reviews: 42,
    addedAt: '2026-10-31'
  },
  {
    id: 'frame-google',
    slug: 'google-frame',
    name: 'Google Frame',
    category: 'frame',
    categoryLabel: 'Photo Frame',
    price: 450,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/frame-themes/google.webp',
    alt: 'A frame styled like a Google search for "Best Friends Forever" above a collage of photographs',
    gallery: ['/images/frame-themes/google.webp'],
    shortDescription: 'Your search for "Best Friends Forever" — their faces as the results.',
    description:
      'A playful frame laid out like a search page: your own line in the search bar and your photographs as the results below it. Tell us the words and send the pictures, choose a size, and we print and frame it to order.',
    details: ['A4 ₹450, A3 ₹750, A2 ₹300', 'Printed and framed to order', 'Upload your photographs on the page', 'Shipping charged separately'],
    occasions: ['Friendship', 'Birthday', 'Just Because', 'Thank You'],
    keywords: ['frame', 'photo frame', 'google', 'search', 'best friends', 'gift', 'personalised'],
    customiser: 'frame',
    themeId: 'google',
    sizeId: 'frame-a4',
    featured: false,
    published: true,
    sortOrder: 62,
    rating: 4.8,
    reviews: 31,
    addedAt: '2026-10-31'
  },
  {
    id: 'frame-forever',
    slug: 'forever-frame',
    name: 'Forever Frame',
    category: 'frame',
    categoryLabel: 'Photo Frame',
    price: 450,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/frame-themes/forever.webp',
    alt: 'A black-and-white photo-collage frame with a cut-out of two friends in the centre',
    gallery: ['/images/frame-themes/forever.webp'],
    shortDescription: 'A black-and-white collage with the two of you standing out in colour.',
    description:
      'Your memories in black and white, with one photograph of the two of you cut out and left in colour so it lifts off the page. Send your pictures, pick a size, and we print and frame it to order.',
    details: ['A4 ₹450, A3 ₹750, A2 ₹300', 'Printed and framed to order', 'Upload your photographs on the page', 'Shipping charged separately'],
    occasions: ['Friendship', 'Love', 'Anniversary', 'Just Because'],
    keywords: ['frame', 'photo frame', 'forever', 'friendz', 'collage', 'black and white', 'gift', 'personalised'],
    customiser: 'frame',
    themeId: 'forever',
    sizeId: 'frame-a4',
    featured: false,
    published: true,
    sortOrder: 63,
    rating: 4.9,
    reviews: 28,
    addedAt: '2026-10-31'
  },
  {
    id: 'frame-wedding-garland',
    slug: 'wedding-garland-embroidery',
    name: 'Wedding Garland Embroidery',
    category: 'frame',
    categoryLabel: 'Photo Frame',
    price: 1000,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/frames/wedding-garland.webp',
    alt: 'A black-and-white wedding photograph with the couple’s garlands hand-embroidered in pink, green and gold thread',
    gallery: ['/images/frames/wedding-garland.webp'],
    shortDescription: 'Your wedding photo in black and white, the garlands embroidered by hand in thread.',
    description:
      'A black-and-white print of your wedding moment, with the garlands raised off the page in hand embroidery — pink, green and gold thread worked over the photograph so the flowers you wore are real again. Choose a size, and whether it comes framed or as the print alone.',
    details: ['A5 ₹1000, A4 ₹1999 framed', 'A5 ₹1000, A4 ₹1900 print only', 'Hand-embroidered to order', 'Upload your photograph on the page', 'Shipping charged separately'],
    occasions: ['Wedding', 'Anniversary', 'Love', 'Engagement'],
    keywords: ['frame', 'photo frame', 'wedding', 'garland', 'embroidery', 'hand embroidered', 'thread', 'gift', 'personalised'],
    customiser: 'frame',
    frameSizes: FRAMED_PRINT_SIZES,
    embroidery: true,
    sizeId: 'a5-framed',
    featured: true,
    published: true,
    sortOrder: 64,
    rating: 5.0,
    reviews: 19,
    addedAt: '2026-10-31'
  },
  {
    id: 'frame-blooming-memories',
    slug: 'blooming-memories',
    name: 'Blooming Memories',
    category: 'frame',
    categoryLabel: 'Photo Frame',
    price: 1000,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/frames/blooming-memories.webp',
    alt: 'A black-and-white photograph with a caption, a row of purple flowers embroidered by hand along the bottom',
    gallery: ['/images/frames/blooming-memories.webp'],
    shortDescription: 'Your photo with a line of flowers embroidered by hand along the bottom, and your own caption.',
    description:
      'A black-and-white print finished with a border of flowers raised off the page in hand embroidery, and a caption of your choosing beneath — a title and a line, the way "The Sequel — 20 years of love and war" sits on ours. Choose a size, and whether it comes framed or as the print alone.',
    details: ['A5 ₹1000, A4 ₹1999 framed', 'A5 ₹1000, A4 ₹1900 print only', 'Hand-embroidered to order', 'Upload your photograph and tell us the caption', 'Shipping charged separately'],
    occasions: ['Anniversary', 'Wedding', 'Love', 'Just Because'],
    keywords: ['frame', 'photo frame', 'blooming', 'memories', 'embroidery', 'hand embroidered', 'flowers', 'anniversary', 'gift', 'personalised'],
    customiser: 'frame',
    frameSizes: FRAMED_PRINT_SIZES,
    embroidery: true,
    sizeId: 'a5-framed',
    featured: false,
    published: true,
    sortOrder: 65,
    rating: 5.0,
    reviews: 14,
    addedAt: '2026-10-31'
  },
  /* ------------------------------------------------- posters */
  /* The one poster with no artwork of its own: the customer brings the
     picture. `upload: true` is what turns the upload step on in
     PosterOptions; everything else about it is an ordinary poster.
     sortOrder 69 keeps it first in the category, ahead of the
     ready-made designs. */
  {
    id: 'poster-your-own',
    slug: 'make-your-own-poster',
    name: 'Make Your Own Poster',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/your-own.webp',
    alt: 'A photograph printed as a poster with a white border, resting against a warm grey wall',
    gallery: ['/images/posters/your-own.webp'],
    shortDescription: 'Your own picture, printed as a poster. Send it and we print it.',
    description:
      'Anything you like on the wall: a photograph, a design you made, a drawing, a line of lettering. Upload the picture, pick A5 or A4 and the paper, and we print it to order. Send the largest copy you have — a small picture prints soft. Add several and each is printed as its own poster.',
    details: [
      'A5 ₹50, A4 ₹100',
      'Photo sheet, or card poster on 250–400 gsm',
      'Upload your own picture on this page',
      'Printed to order, unframed',
      'Shipping charged separately'
    ],
    occasions: ['Birthday', 'Anniversary', 'Love', 'Housewarming', 'Thank You', 'Just Because'],
    keywords: ['poster', 'wall poster', 'custom', 'personalised', 'your own', 'upload', 'photo poster', 'print my photo', 'make your own', 'custom poster'],
    customiser: 'poster',
    upload: true,
    sizeId: 'poster-a5',
    featured: true,
    published: true,
    sortOrder: 69,
    rating: 5.0,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  {
    id: 'poster-botanical-pair',
    slug: 'boho-botanical-poster-pair',
    name: 'Boho Botanical — Pair',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/botanical-pair.webp',
    alt: 'Two botanical posters above a sofa — scattered leaves and flowers beside the words "it’s never too late" over rolling hills',
    gallery: ['/images/posters/botanical-pair.webp'],
    shortDescription: 'Scattered leaves and a quiet reminder, in terracotta, olive and blush.',
    description:
      'A pair made to hang together: one a scatter of pressed-looking leaves and flowers, the other "it’s never too late" lettered over soft hills. Earthy terracotta, olive and blush — the calm wall above a sofa or a reading chair. Printed to order at A5 or A4, on photo sheet or heavy card.',
    details: POSTER_DETAILS,
    occasions: ['Housewarming', 'Just Because', 'Birthday', 'Thank You'],
    keywords: ['poster', 'wall poster', 'botanical', 'boho', 'leaves', 'floral', 'terracotta', 'olive', 'quote', 'minimal', 'living room'],
    customiser: 'poster',
    sizeId: 'poster-a5',
    setId: 'set-2',
    featured: true,
    published: true,
    sortOrder: 70,
    rating: 4.8,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  {
    id: 'poster-i-am-doom',
    slug: 'i-am-doom-poster',
    name: 'I Am Doom',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/i-am-doom.webp',
    alt: 'An armoured fist holding a cracked golden mask against a dark green haze, under the words "I Am Doom"',
    gallery: ['/images/posters/i-am-doom.webp'],
    shortDescription: 'A cracked mask in an armoured grip, lit green out of the dark.',
    description:
      'An armoured gauntlet closed around a battered golden mask, picked out of a black-and-green haze. Heavy, cinematic and built for a dark wall — a gaming corner, a desk setup, a teenager’s room. Printed to order at A5 or A4, on photo sheet or heavy card.',
    details: POSTER_DETAILS,
    occasions: ['Birthday', 'Just Because'],
    keywords: ['poster', 'wall poster', 'doom', 'mask', 'dark', 'green', 'gaming', 'movie', 'cinematic', 'room decor'],
    customiser: 'poster',
    sizeId: 'poster-a5',
    featured: false,
    published: true,
    sortOrder: 71,
    rating: 4.7,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  {
    id: 'poster-cricket-legends',
    slug: 'cricket-legends-poster-set',
    name: 'Cricket Legends — Set of 3',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/cricket-legends.webp',
    alt: 'Three blue cricket posters hung in a row above a sideboard, each a portrait of a player with their shirt number',
    gallery: ['/images/posters/cricket-legends.webp'],
    shortDescription: 'Three in a row, each in blue with the number on the back of the shirt.',
    description:
      'A set of three portraits in deep blue, each with the player’s number set large behind them. Hung in a row they read as one piece — the wall above a desk, a sideboard or a bed. Printed to order at A5 or A4, on photo sheet or heavy card.',
    details: POSTER_DETAILS,
    occasions: ['Birthday', 'Just Because', 'Thank You'],
    keywords: ['poster', 'wall poster', 'cricket', 'sport', 'india', 'blue', 'set of 3', 'room decor'],
    customiser: 'poster',
    sizeId: 'poster-a5',
    setId: 'set-3',
    featured: true,
    published: true,
    sortOrder: 72,
    rating: 4.9,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  {
    id: 'poster-red-aesthetic-kit',
    slug: 'red-aesthetic-collage-kit',
    name: 'Red Aesthetic — Collage Kit',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/red-aesthetic-kit.webp',
    alt: 'A grid of small red and pink collage cards taped above a desk, lit by fairy lights',
    gallery: ['/images/posters/red-aesthetic-kit.webp'],
    shortDescription: 'A grid of small red cards — hearts, lips, cherries and slogans.',
    description:
      'A wall of small prints rather than one big one: hearts, cherries, lips, film stills and slogans, all in reds and deep pinks. Tape them in a block above a desk or scatter them down a wall, and add to it whenever you like. Printed to order at A5 or A4, on photo sheet or heavy card.',
    details: POSTER_DETAILS,
    occasions: ['Birthday', 'Valentine', 'Just Because', 'Love'],
    keywords: ['poster', 'wall poster', 'collage kit', 'red', 'aesthetic', 'hearts', 'dorm', 'teen', 'room decor', 'set'],
    customiser: 'poster',
    sizeId: 'poster-a5',
    featured: true,
    published: true,
    sortOrder: 73,
    rating: 4.8,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  {
    id: 'poster-pink-aesthetic-kit',
    slug: 'pink-aesthetic-collage-kit',
    name: 'Pink Aesthetic — Collage Kit',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/pink-aesthetic-kit.webp',
    alt: 'A gallery wall of pink and sage collage prints — tulips, flower-market posters, affirmations and butterflies — above a dresser',
    gallery: ['/images/posters/pink-aesthetic-kit.webp'],
    shortDescription: 'Tulips, flower-market prints and affirmations, in blush and sage.',
    description:
      'A soft gallery wall in blush, cream and sage: tulips and daisies, flower-market prints, bows, butterflies and a few lines worth reading twice. Mix the sizes and build it outwards from the middle. Printed to order at A5 or A4, on photo sheet or heavy card.',
    details: POSTER_DETAILS,
    occasions: ['Birthday', 'Housewarming', 'Just Because', 'Thank You'],
    keywords: ['poster', 'wall poster', 'collage kit', 'pink', 'blush', 'sage', 'aesthetic', 'floral', 'tulips', 'affirmations', 'room decor', 'set'],
    customiser: 'poster',
    sizeId: 'poster-a5',
    featured: true,
    published: true,
    sortOrder: 74,
    rating: 4.9,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  {
    id: 'poster-music-collage-kit',
    slug: 'music-collage-kit',
    name: 'Music & Film — Collage Kit',
    category: 'poster',
    categoryLabel: 'Wall Poster',
    price: 50,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/posters/music-collage-kit.webp',
    alt: 'Red and black music and film collage prints clipped to a black wire grid panel above a sofa',
    gallery: ['/images/posters/music-collage-kit.webp'],
    shortDescription: 'Album art and film posters in red, black and white, for a grid wall.',
    description:
      'Album covers, track lists and film posters in red, black and white — the wall for someone whose music is the whole personality. Clip them to a wire grid or tape them straight up. Printed to order at A5 or A4, on photo sheet or heavy card.',
    details: POSTER_DETAILS,
    occasions: ['Birthday', 'Just Because'],
    keywords: ['poster', 'wall poster', 'collage kit', 'music', 'album', 'film', 'movie', 'red', 'black', 'grid wall', 'teen', 'room decor', 'set'],
    customiser: 'poster',
    sizeId: 'poster-a5',
    featured: false,
    published: true,
    sortOrder: 75,
    rating: 4.7,
    reviews: 0,
    addedAt: '2026-11-01'
  },
  /* ------------------------------------------------- hampers */
  {
    id: 'hamper-build-your-own',
    slug: 'build-your-own-hamper',
    name: 'Build Your Own Hamper',
    category: 'hamper',
    categoryLabel: 'Hamper',
    /* The price of the empty keepsake box. Everything put inside is
       priced on top of it, from src/data/hamperKit.js and from this
       catalogue — see src/lib/designPricing.js. The box sizes and
       their prices live in BOX_VARIANTS; this is the smallest, so a
       card never quotes more than the hamper can be built for. */
    price: 499,
    priceMode: PRICE_MODES.FIXED,
    unitLabel: 'from',
    image: '/images/hampers/hamper-keepsake.jpg',
    alt: 'An open keepsake gift box being filled by hand with candles, chocolates and polaroids',
    gallery: ['/images/hampers/hamper-keepsake.jpg', '/images/hampers/hamper-blush-luxe.jpg'],
    shortDescription: 'Build it yourself in 3D — your box, your gifts, your words.',
    description:
      'Start with an empty keepsake box and fill it yourself. Choose the size, the colour, the lining and the ribbon, add what you want inside, move each thing where you want it, upload your photographs and write the card — all in 3D, as it will arrive. Your design saves itself on your device, so you can close the page and come back to it.',
    details: [
      'Three box sizes, from ₹499',
      'Arrange everything in 3D before you order',
      'Your design is saved on your device as you build it',
      'Shipping charged separately'
    ],
    occasions: HAMPER_OCCASIONS,
    keywords: ['hamper', 'build', 'custom', 'gift box', 'own', 'design', '3d', 'personalised', 'diy'],
    customiser: 'hamper-3d',
    featured: true,
    published: true,
    sortOrder: 0,
    rating: 0,
    reviews: 0,
    addedAt: '2026-10-24'
  },
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
    rating: 4.6,
    reviews: 41,
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
    rating: 4.9,
    reviews: 119,
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
    rating: 4.8,
    reviews: 66,
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
    rating: 4.9,
    reviews: 52,
    addedAt: '2026-10-22'
  },

  /* ----------------------------------------- inside a hamper

     The real things that go into a build-your-own hamper. They are
     products so that their prices are edited in the one place every
     other price is edited; `hamperOnly` keeps them out of the shop
     itself. */
  ...HAMPER_ITEM_PRODUCTS
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
export const getFeatured = () => LIVE.filter((p) => p.featured && !p.hamperOnly);

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
  /* Hamper fillings are not sold on their own and have no product
     page of their own, so a search must not offer one. */
  return LIVE.filter((p) => !p.hamperOnly).filter((p) => {
    const haystack = searchIndex(p);
    return terms.every((t) => haystack.includes(t));
  });
};
