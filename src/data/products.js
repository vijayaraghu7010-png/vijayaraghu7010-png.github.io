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
   order the shop quotes them. */
export const FRAME_SIZES = [
  { id: 'frame-a5', label: 'A5', blurb: '14.8 x 21 cm', price: 400 },
  { id: 'frame-a4', label: 'A4', blurb: '21 x 29.7 cm', price: 500 },
  { id: 'frame-a3', label: 'A3', blurb: '29.7 x 42 cm', price: 750 }
];

export const FRAME_OCCASIONS = [
  'Love',
  'Anniversary',
  'Birthday',
  'Valentine',
  'Long Distance',
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
    rating: 4.8,
    reviews: 131,
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
    rating: 5.0,
    reviews: 74,
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
    rating: 4.7,
    reviews: 58,
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
    rating: 4.9,
    reviews: 103,
    addedAt: '2026-04-06'
  },
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
      'A5 ₹400, A4 ₹500, A3 ₹750',
      'Printed and framed to order',
      'Send two close-up photographs and your two years',
      'Shipping charged separately'
    ],
    occasions: ['Love', 'Anniversary', 'Birthday', 'Valentine', 'Long Distance', 'Just Because'],
    keywords: ['frame', 'photo frame', 'couple', 'eyes', 'anniversary', 'valentine', 'gift', 'personalised'],
    customiser: 'frame',
    sizeId: 'frame-a5',
    featured: true,
    published: true,
    sortOrder: 60,
    rating: 4.8,
    reviews: 87,
    addedAt: '2026-10-23'
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
