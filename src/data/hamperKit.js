/* ===========================================================
   What can go into a build-your-own hamper, and what it costs.

   This is the trusted source for the studio. A design saved in
   somebody's browser is only a list of ids, quantities and
   positions — every price, every size and every colour is looked
   up here when the design is loaded, priced and ordered, so an
   edited record in IndexedDB can never buy a ₹1,299 bouquet for
   ₹1. Prices that already live in the catalogue are not repeated:
   those items carry a `productId` and are priced from
   src/data/products.js instead.

   Positions are in centimetres of box space, measured from the
   middle of the floor of the box.
   =========================================================== */

import { getProductById } from './products';

/* The product the studio sells: an empty keepsake box. Everything
   inside is added on top of it. Kept here so the studio and the
   catalogue entry can never drift apart. */
export const STUDIO_PRODUCT_ID = 'hamper-build-your-own';

/* --------------------------------------------------------- the box */

/* The boxes themselves live in src/data/hamperBoxes.js, which is
   where the real-world catalogue sizes, the inch-to-centimetre
   conversion and the outer-to-inner construction sum all are. They
   are re-exported here because this module is the studio's one
   front door for kit data, and because every panel, the packer and
   the scene already import the box from it. */
export {
  BOX_VARIANTS,
  BOXES_BY_ROOM,
  DEFAULT_BOX_VARIANT,
  HAMPER_CATEGORIES,
  INCH_CM,
  boxSnapshot,
  boxesInCategory,
  cm,
  describeInterior,
  deriveBox,
  formatCm,
  getBoxVariant,
  getCategory,
  inchesToCm,
  usableVolume,
  variantFromSnapshot,
  withinRange
} from './hamperBoxes';

/* Finishes, in the shop's own palette. A design stores the id; the
   hex is read from here, so a retouched palette reaches every saved
   design without migrating anything. */
export const BOX_COLOURS = [
  { id: 'burgundy', label: 'Burgundy', hex: '#603D42' },
  { id: 'ivory', label: 'Ivory', hex: '#FAF6F2' },
  { id: 'blush', label: 'Blush', hex: '#E5D9D1' },
  { id: 'rosewood', label: 'Rosewood', hex: '#7A3B40' },
  { id: 'navy', label: 'Deep navy', hex: '#2C3444' },
  { id: 'kraft', label: 'Kraft brown', hex: '#9A7B5F' },
  { id: 'forest', label: 'Forest', hex: '#3C4A3E' },
  { id: 'charcoal', label: 'Charcoal', hex: '#2E2425' }
];

export const LINING_COLOURS = [
  { id: 'cream-crinkle', label: 'Cream crinkle paper', hex: '#F3E7DA' },
  { id: 'blush-crinkle', label: 'Blush crinkle paper', hex: '#EFD9D6' },
  { id: 'ivory-satin', label: 'Ivory satin', hex: '#FBF4EC', sheen: true },
  { id: 'burgundy-satin', label: 'Burgundy satin', hex: '#6B3A40', sheen: true },
  { id: 'sage-tissue', label: 'Sage tissue', hex: '#CBD5C4' },
  { id: 'kraft-shred', label: 'Kraft shred', hex: '#C9A87C' }
];

export const RIBBON_COLOURS = [
  { id: 'gold', label: 'Antique gold', hex: '#C9A227', sheen: true },
  { id: 'ivory', label: 'Ivory', hex: '#F6EDE3', sheen: true },
  { id: 'burgundy', label: 'Burgundy', hex: '#5A2F34', sheen: true },
  { id: 'blush', label: 'Blush', hex: '#E7BFBD', sheen: true },
  { id: 'sage', label: 'Sage', hex: '#A8B79C', sheen: true },
  { id: 'black', label: 'Black grosgrain', hex: '#241E1F' }
];

export const RIBBON_STYLES = [
  { id: 'cross-bow', label: 'Cross ribbon with a bow' },
  { id: 'single-bow', label: 'One band and a bow' },
  { id: 'band', label: 'A plain band' },
  { id: 'none', label: 'No ribbon' }
];

export const MATERIALS = [
  { id: 'matte', label: 'Matte board', roughness: 0.85, metalness: 0 },
  { id: 'satin', label: 'Satin finish', roughness: 0.35, metalness: 0.04 },
  { id: 'linen', label: 'Linen wrap', roughness: 0.95, metalness: 0 }
];

export const getSwatch = (list, id) => list.find((c) => c.id === id) || list[0];
export const getMaterial = (id) => MATERIALS.find((m) => m.id === id) || MATERIALS[0];

/* The message card that can be tucked into the lid. */
export const CARD_FONTS = [
  { id: 'script', label: 'Handwritten', css: "'Caveat', cursive" },
  { id: 'serif', label: 'Serif', css: "'Playfair Display', Georgia, serif" },
  { id: 'sans', label: 'Modern', css: "'Inter', sans-serif" }
];

export const MESSAGE_MAX = 240;
export const GIFT_TEXT_MAX = 40;

/* ------------------------------------------------------- the gifts

   What the shop actually puts in a hamper. Each entry is a manifest
   row for one product: the model the scene draws it with, the size
   it is drawn at in centimetres, the photograph it was reconstructed
   from, and how far that reconstruction can be trusted.

   `model` names a component in src/hamper/models/registry.jsx. No
   kind carries its own geometry, and no component knows which
   product it is drawing — a kind is data, which is what keeps
   twenty-odd products out of one enormous component.

   `price` is only read when there is no `productId`. Everything
   photographed is a catalogue product, so its price comes from
   src/data/products.js and is edited in Admin → Products.

   `reconstructionStatus` is honest and deliberately conservative:

     approximate — built from primitives to match the photograph's
                   silhouette, colours and proportions, with the
                   product's own artwork mapped onto the faces that
                   carry it. The sides the photograph does not show
                   are estimated.
     placeholder — a stand-in shape; the panel says so.

   Nothing here is marked verified. Verifying one would mean
   measuring the real object and comparing renders against it from
   known angles, and that has not been done. */

/* Where the product photographs live. Each kind has the photograph
   itself for the catalogue thumbnail, and a square crop of it used
   as a texture on the faces that carry artwork. */
const KIT = '/images/kit';

export const GIFT_CATEGORIES = [
  { id: 'crochet', label: 'Crochet & keyrings' },
  { id: 'chocolate', label: 'Chocolates' },
  { id: 'beauty', label: 'Lips & beauty' },
  { id: 'drinkware', label: 'Drinkware' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'keepsake', label: 'Keepsakes & prints' }
];

/* Bumped when a model's geometry changes enough that a saved render
   or a cached thumbnail of it would be wrong. */
export const ASSET_VERSION = 1;

export const GIFT_KINDS = [
  /* ------------------------------------------------- crochet */
  {
    id: 'crochet-spiderman',
    name: 'Spider-Man crochet keyring',
    blurb: 'Hand-crocheted, with the mask charm on the same ring.',
    category: 'crochet',
    productId: 'kit-crochet-spiderman',
    model: 'amigurumi',
    size: [6, 10, 5],
    /* body, then the smaller head on top of it */
    proxy: [[0, 0.28, 0, 0.45, 0.28, 0.45], [0, 0.74, 0, 0.33, 0.26, 0.33]],
    maxQty: 2,
    colours: ['#C4161C', '#8E1116', '#1B2A52'],
    supportsScale: true,
    figure: {
      kind: 'hero',
      head: '#C4161C',
      body: '#C4161C',
      limbs: '#1B2A52',
      eyes: 'spider',
      web: true,
      ears: 'none',
      charm: 'ball'
    },
    previewPath: KIT + '/crochet-spiderman.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.10 AM.jpeg'],
    materialSummary: 'Cotton yarn, matte, with a steel split ring and chain',
    reconstructionStatus: 'approximate',
    uncertain: ['the back of the head and the underside of the feet are not in the photograph']
  },
  {
    id: 'crochet-batman',
    name: 'Batman crochet doll',
    blurb: 'Cape, cowl ears and a stitched emblem.',
    category: 'crochet',
    productId: 'kit-crochet-batman',
    model: 'amigurumi',
    size: [7, 12, 5],
    proxy: [[0, 0.28, 0, 0.45, 0.28, 0.48], [0, 0.74, 0, 0.33, 0.26, 0.33]],
    maxQty: 2,
    colours: ['#1A1A1E', '#3A3A42', '#B9B9C0'],
    supportsScale: true,
    figure: {
      kind: 'hero',
      head: '#1A1A1E',
      body: '#B9B9C0',
      limbs: '#1A1A1E',
      eyes: 'slits',
      belt: '#E8B02A',
      emblem: '#E8B02A',
      cape: '#1A1A1E',
      ears: 'horns',
      /* sold as a doll, not on a ring */
      keyring: false
    },
    previewPath: KIT + '/crochet-batman.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.11 AM.jpeg'],
    materialSummary: 'Cotton yarn, matte, with a felt-backed cape',
    reconstructionStatus: 'approximate',
    uncertain: ['the back of the cape and the base are estimated']
  },
  {
    id: 'crochet-panda',
    name: 'Panda crochet keyring',
    blurb: 'A palm-sized panda on a split ring.',
    category: 'crochet',
    productId: 'kit-crochet-panda',
    model: 'amigurumi',
    size: [5, 8, 4],
    proxy: [[0, 0.28, 0, 0.45, 0.28, 0.45], [0, 0.74, 0, 0.36, 0.26, 0.36]],
    maxQty: 3,
    colours: ['#FFFFFF', '#F2EFE8'],
    supportsScale: true,
    figure: {
      kind: 'animal',
      head: '#FAFAFA',
      body: '#FAFAFA',
      limbs: '#1A1A1E',
      ears: 'round',
      earColour: '#1A1A1E',
      eyes: 'patches',
      patch: '#1A1A1E',
      muzzle: true,
      charm: 'none'
    },
    previewPath: KIT + '/crochet-panda.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.13 AM.jpeg'],
    materialSummary: 'Cotton yarn, matte, with plastic safety eyes',
    reconstructionStatus: 'approximate',
    uncertain: ['the back is not shown in the photograph']
  },
  {
    id: 'crochet-animals',
    name: 'Crochet animal keyring',
    blurb: 'A bear, a bunny or a cat — choose below.',
    category: 'crochet',
    productId: 'kit-crochet-animals',
    model: 'amigurumi',
    size: [5, 9, 4],
    proxy: [[0, 0.28, 0, 0.45, 0.28, 0.45], [0, 0.74, 0, 0.36, 0.26, 0.36]],
    maxQty: 4,
    colours: ['#9A6B46', '#F6CBD2', '#E8B02A', '#FFFFFF'],
    supportsScale: true,
    figure: {
      kind: 'animal',
      ears: 'round',
      eyes: 'beads',
      muzzle: true,
      charm: 'none'
    },
    /* The photograph shows four of these. They are the same product
       in different colourways, so they are options on one kind
       rather than four catalogue rows. The option picks the ear
       shape and the face. */
    variants: [
      { id: 'bear', label: 'Brown bear', figure: { ears: 'round', earColour: '#7A5236' } },
      { id: 'bunny-pink', label: 'Pink bunny', figure: { ears: 'long', earColour: '#F2A8B8' } },
      { id: 'bunny-yellow', label: 'Yellow bunny', figure: { ears: 'long', earColour: '#F0C24A' } },
      { id: 'cat', label: 'White cat', figure: { ears: 'pointed', earColour: '#F3E2E4', heart: '#D9434E' } }
    ],
    previewPath: KIT + '/crochet-animals.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.11 AM (2).jpeg'],
    materialSummary: 'Cotton yarn, matte, with plastic safety eyes',
    reconstructionStatus: 'approximate',
    uncertain: ['only the front of each animal is photographed']
  },
  {
    id: 'crochet-turtle',
    name: 'Rainbow turtle keyring',
    blurb: 'A white turtle with a rainbow shell.',
    category: 'crochet',
    productId: 'kit-crochet-turtle',
    model: 'crochet-turtle',
    size: [8, 4, 9],
    maxQty: 3,
    colours: ['#FFFFFF', '#F7F2EA'],
    supportsScale: true,
    previewPath: KIT + '/crochet-turtle.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.13 AM (1).jpeg'],
    materialSummary: 'Cotton yarn, matte; the shell is worked in a pastel rainbow spiral',
    reconstructionStatus: 'approximate',
    uncertain: ['the underside is not shown']
  },
  {
    id: 'crochet-bow',
    name: 'Crochet bow keyring',
    blurb: 'A chunky ribbed bow with two tails.',
    category: 'crochet',
    productId: 'kit-crochet-bow',
    model: 'crochet-bow',
    size: [9, 11, 2],
    maxQty: 3,
    colours: ['#D98A9A', '#E7BFBD', '#F6EDE3', '#A8B79C'],
    supportsScale: true,
    previewPath: KIT + '/crochet-bow.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.11 AM (1).jpeg'],
    materialSummary: 'Ribbed cotton yarn, matte, on a split ring',
    reconstructionStatus: 'approximate',
    uncertain: ['the reverse of the bow is not shown']
  },
  {
    id: 'crochet-sunflower',
    name: 'Potted sunflower keyring',
    blurb: 'A sunflower in a little crocheted pot.',
    category: 'crochet',
    productId: 'kit-crochet-sunflower',
    model: 'crochet-potted-flower',
    size: [6, 12, 6],
    /* a narrow pot under a wide flower head, with a thin stem
       between them that claims no space at all */
    proxy: [[0, 0.16, 0, 0.40, 0.16, 0.40], [0, 0.80, 0, 0.50, 0.20, 0.50]],
    clearance: 0.6,
    maxQty: 3,
    colours: ['#E8B02A', '#F0C24A', '#E7BFBD'],
    supportsScale: true,
    previewPath: KIT + '/crochet-sunflower.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.12 AM (1).jpeg'],
    materialSummary: 'Cotton yarn over a stuffed pot, matte throughout',
    reconstructionStatus: 'approximate',
    uncertain: ['the number of petals and the back of the pot are estimated']
  },
  {
    id: 'crochet-bouquet',
    name: 'Crochet bouquet keyring',
    blurb: 'A miniature wrapped bouquet of roses.',
    category: 'crochet',
    productId: 'kit-crochet-bouquet',
    model: 'crochet-bouquet',
    size: [6, 10, 6],
    proxy: [[0, 0.27, 0, 0.32, 0.27, 0.32], [0, 0.74, 0, 0.50, 0.26, 0.50]],
    clearance: 0.6,
    maxQty: 3,
    colours: ['#F3DFA2', '#F6EDE3', '#E7BFBD'],
    supportsScale: true,
    previewPath: KIT + '/crochet-bouquet.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.12 AM (2).jpeg'],
    materialSummary: 'Cotton yarn, matte; a cream frill around a cream-and-pink rose cluster',
    reconstructionStatus: 'approximate',
    uncertain: ['the underside of the cone is not shown']
  },
  {
    id: 'crochet-cherries',
    name: 'Cherry charm with pearls',
    blurb: 'Crocheted cherries on a pearl chain.',
    category: 'crochet',
    productId: 'kit-crochet-cherries',
    model: 'crochet-cherries',
    size: [7, 10, 3],
    proxy: [[0, 0.22, 0, 0.50, 0.22, 0.42], [0, 0.62, 0, 0.26, 0.38, 0.22]],
    maxQty: 3,
    colours: ['#B3121D', '#7E1020', '#D9434E'],
    supportsScale: true,
    previewPath: KIT + '/crochet-cherries.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.49.12 AM.jpeg'],
    materialSummary: 'Cotton yarn with a glass pearl chain and a green leaf bow',
    reconstructionStatus: 'approximate',
    uncertain: ['the chain hangs differently in every photograph; it is modelled straight']
  },

  /* ---------------------------------------------- chocolate */
  {
    id: 'choc-kitkat',
    name: 'KitKat',
    blurb: 'The red bar, laid flat.',
    category: 'chocolate',
    productId: 'kit-choc-kitkat',
    model: 'wrapped-bar',
    size: [10, 1.2, 4],
    maxQty: 6,
    colours: ['#E2231A'],
    wrapper: { texture: KIT + '/choc-kitkat-label.jpg', base: '#E2231A', sheen: 0.35, crimped: true },
    previewPath: KIT + '/choc-kitkat.jpg',
    texturePath: KIT + '/choc-kitkat-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.52.39 AM (1).jpeg'],
    materialSummary: 'Printed foil wrapper, crimped at both ends',
    reconstructionStatus: 'approximate',
    uncertain: ['the photograph is a pile of bars seen front-on; the reverse of the wrapper is estimated']
  },
  {
    id: 'choc-silk',
    name: 'Dairy Milk Silk',
    blurb: 'The purple bar, laid flat.',
    category: 'chocolate',
    productId: 'kit-choc-silk',
    model: 'wrapped-bar',
    size: [13, 1.4, 6],
    maxQty: 4,
    colours: ['#4B2A7B'],
    wrapper: { texture: KIT + '/choc-silk-label.jpg', base: '#4B2A7B', sheen: 0.3, crimped: false },
    previewPath: KIT + '/choc-silk.jpg',
    texturePath: KIT + '/choc-silk-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.52.40 AM (1).jpeg'],
    materialSummary: 'Printed foil-backed paper wrapper',
    reconstructionStatus: 'approximate',
    uncertain: ['the reverse of the wrapper is estimated']
  },
  {
    id: 'choc-crispello',
    name: 'Dairy Milk Crispello',
    blurb: 'A pack of wafer-filled fingers.',
    category: 'chocolate',
    productId: 'kit-choc-crispello',
    model: 'wrapped-bar',
    size: [12, 1.6, 5],
    maxQty: 4,
    colours: ['#4B2A7B'],
    wrapper: { texture: KIT + '/choc-crispello-label.jpg', base: '#4B2A7B', sheen: 0.45, crimped: true },
    previewPath: KIT + '/choc-crispello.jpg',
    texturePath: KIT + '/choc-crispello-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.52.39 AM.jpeg'],
    materialSummary: 'Glossy printed foil wrapper, crimped at both ends',
    reconstructionStatus: 'approximate',
    uncertain: [
      'the photograph also shows a ceramic Ganesha idol, which is a separate object and is not modelled here'
    ]
  },
  {
    id: 'choc-bournville',
    name: 'Bournville 70% Dark',
    blurb: 'The dark bar in its carton.',
    category: 'chocolate',
    productId: 'kit-choc-bournville',
    model: 'carton-bar',
    size: [12, 1.6, 6.5],
    maxQty: 4,
    colours: ['#1E1A17'],
    wrapper: { texture: KIT + '/choc-bournville-label.jpg', base: '#1E1A17', sheen: 0.12, crimped: false },
    previewPath: KIT + '/choc-bournville.jpg',
    texturePath: KIT + '/choc-bournville-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.52.40 AM.jpeg'],
    materialSummary: 'Matte printed board carton',
    reconstructionStatus: 'approximate',
    uncertain: ['the reverse and the ends of the carton are estimated']
  },
  {
    id: 'choc-ferrero',
    name: 'Ferrero Rocher (4)',
    blurb: 'The gold box of four.',
    category: 'chocolate',
    productId: 'kit-choc-ferrero',
    model: 'ferrero-box',
    size: [18, 4, 4.5],
    maxQty: 2,
    colours: ['#C9A227', '#D4AF37'],
    previewPath: KIT + '/choc-ferrero.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.52.40 AM (2).jpeg'],
    materialSummary: 'Gold printed board tray under a clear lid, foil-wrapped spheres inside',
    reconstructionStatus: 'approximate',
    uncertain: ['the underside of the tray is not shown']
  },

  /* ------------------------------------------------- beauty */
  {
    id: 'beauty-mars-gloss',
    name: 'MARS lip gloss',
    blurb: 'Toffee Twirl, 4 ml, with a rose-gold cap.',
    category: 'beauty',
    productId: 'kit-beauty-mars-gloss',
    model: 'lip-gloss',
    size: [2.4, 9.5, 2.4],
    proxy: [[0, 0.5, 0, 0.46, 0.5, 0.46]],
    maxQty: 3,
    colours: ['#B5505F', '#C2697A', '#8E3B4C'],
    previewPath: KIT + '/beauty-mars-gloss.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.03 AM.jpeg'],
    materialSummary: 'Clear plastic barrel of tinted gloss under a polished rose-gold cap',
    reconstructionStatus: 'approximate',
    uncertain: ['the printing on the barrel is too small to read in the photograph and is not reproduced']
  },
  {
    id: 'beauty-lakme-liplove',
    name: 'Lakmé Lip Love',
    blurb: 'Cherry lip care, on its card.',
    category: 'beauty',
    productId: 'kit-beauty-lakme-liplove',
    model: 'carded-balm',
    size: [6, 10, 2],
    maxQty: 3,
    colours: ['#E2231A', '#F04A52'],
    wrapper: { texture: KIT + '/beauty-lakme-liplove-label.jpg', base: '#E2231A', sheen: 0.3 },
    previewPath: KIT + '/beauty-lakme-liplove.jpg',
    texturePath: KIT + '/beauty-lakme-liplove-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.04 AM (2).jpeg'],
    materialSummary: 'Printed card backing with a red plastic twist stick in front of it',
    reconstructionStatus: 'approximate',
    uncertain: ['the back of the card is not shown']
  },
  {
    id: 'beauty-lakme-peptide',
    name: 'Lakmé Peptide Lip I.V.',
    blurb: 'A hydrating balm tube in its carton.',
    category: 'beauty',
    productId: 'kit-beauty-lakme-peptide',
    model: 'tube-and-carton',
    size: [9, 9.5, 2.6],
    /* the carton and the tube beside it are two separate things */
    proxy: [[-0.26, 0.5, 0, 0.22, 0.5, 0.45], [0.26, 0.17, 0, 0.22, 0.17, 0.45]],
    maxQty: 3,
    colours: ['#C77E86', '#B06B74'],
    wrapper: { texture: KIT + '/beauty-lakme-peptide-label.jpg', base: '#C77E86', sheen: 0.25 },
    previewPath: KIT + '/beauty-lakme-peptide.jpg',
    texturePath: KIT + '/beauty-lakme-peptide-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.05 AM.jpeg'],
    materialSummary: 'Matte printed carton beside a soft-touch squeeze tube with a gloss cap',
    reconstructionStatus: 'approximate',
    uncertain: ['the reverse of both the carton and the tube is estimated']
  },

  /* ---------------------------------------------- drinkware */
  {
    id: 'drink-tumbler-leather',
    name: 'Tumbler with leather sleeve',
    blurb: 'Amber glass, 435 ml, with a glass straw.',
    category: 'drinkware',
    productId: 'kit-drink-tumbler-leather',
    model: 'tumbler',
    size: [9, 15, 9],
    /* a cylinder, so the corners of its box are air */
    proxy: [[0, 0.5, 0, 0.46, 0.5, 0.46]],
    /* Tall enough that no hamper in the catalogue takes it
       standing in every size, and a tumbler laid on its side in
       the tissue is how one is really packed. */
    orientations: ['upright', 'on-side'],
    maxQty: 2,
    colours: ['#B5793F', '#8A5A2E', '#2E2425'],
    tumbler: { glass: '#C98B4B', lid: 'glass', sleeve: 'leather', straw: '#B5793F' },
    supportsScale: true,
    previewPath: KIT + '/drink-tumbler-leather.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.04 AM (1).jpeg'],
    materialSummary: 'Amber borosilicate glass, tan leather sleeve, amber glass straw',
    reconstructionStatus: 'approximate',
    uncertain: ['the listing photograph is taken in the hand; the base and the lid catch are partly hidden']
  },
  {
    id: 'drink-tumbler-bamboo',
    name: 'Tumbler with bamboo lid',
    blurb: 'Tall glass with a wooden straw and a grip band.',
    category: 'drinkware',
    productId: 'kit-drink-tumbler-bamboo',
    model: 'tumbler',
    size: [8, 18, 8],
    proxy: [[0, 0.5, 0, 0.46, 0.5, 0.46]],
    /* Tall enough that no hamper in the catalogue takes it
       standing in every size, and a tumbler laid on its side in
       the tissue is how one is really packed. */
    orientations: ['upright', 'on-side'],
    maxQty: 2,
    colours: ['#6E93A8', '#B8CBD6', '#C9A87C'],
    tumbler: { glass: '#EDF3F6', lid: 'bamboo', sleeve: 'silicone', straw: '#C9A87C' },
    supportsScale: true,
    previewPath: KIT + '/drink-tumbler-bamboo.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.04 AM.jpeg'],
    materialSummary: 'Clear glass barrel, ribbed silicone band, bamboo lid and wooden straw',
    reconstructionStatus: 'approximate',
    uncertain: ['the photograph shows two sizes; the taller one is modelled']
  },

  /* ---------------------------------------------- fragrance */
  {
    id: 'perfume-honey-oud',
    name: 'Bella Vita Honey Oud',
    blurb: 'A 100 ml eau de parfum with a gold cap.',
    category: 'fragrance',
    productId: 'kit-perfume-honey-oud',
    model: 'perfume-bottle',
    size: [6, 12, 3.6],
    /* the flacon, and the narrower cap above it */
    proxy: [[0, 0.36, 0, 0.5, 0.36, 0.5], [0, 0.90, 0, 0.30, 0.10, 0.38]],
    maxQty: 2,
    colours: ['#C98B3B', '#9A6B2F'],
    bottle: { juice: '#C98B3B', cap: '#C9A227', label: KIT + '/perfume-honey-oud-label.jpg' },
    supportsScale: true,
    previewPath: KIT + '/perfume-honey-oud.jpg',
    texturePath: KIT + '/perfume-honey-oud-label.jpg',
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.05 AM (1).jpeg'],
    materialSummary: 'Clear glass flacon of amber juice, polished gold cap, printed front label',
    reconstructionStatus: 'approximate',
    uncertain: ['the red presentation box behind it is not modelled; the sides of the bottle are estimated']
  },
  {
    id: 'perfume-bellavita-duo',
    name: 'Bella Vita Fresh & Skai set',
    blurb: 'Two 20 ml bottles in a cream box.',
    category: 'fragrance',
    productId: 'kit-perfume-bellavita-duo',
    model: 'perfume-duo',
    size: [12, 10, 4],
    maxQty: 2,
    colours: ['#F4F0E8', '#2BB3B3', '#2E5FA3'],
    previewPath: KIT + '/perfume-bellavita-duo.jpg',
    texturePath: null,
    sourceImages: ['WhatsApp Image 2026-10-25 at 10.55.05 AM (2).jpeg'],
    materialSummary: 'Cream board sleeve holding two slim glass bottles, teal and blue, with gold caps',
    reconstructionStatus: 'approximate',
    uncertain: ['the box is shown open from the front only; its depth is estimated']
  },

  /* ----- the shop's own products, priced from the catalogue ----- */
  {
    id: 'polaroid-pack',
    name: 'Polaroid prints',
    blurb: 'Nine of your own photographs, printed and tied.',
    category: 'keepsake',
    productId: 'polaroid-medium',
    /* a per-unit product: this many prints per pack */
    productQuantity: 9,
    model: 'photo-stack',
    size: [11, 3, 9],
    maxQty: 2,
    colours: ['#FFFFFF', '#F7ECDC', '#FFD9D2', '#EFE7E2'],
    supportsPhoto: true,
    photoLabel: 'Top print',
    previewPath: '/images/polaroid-medium.jpg',
    texturePath: null,
    sourceImages: [],
    materialSummary: 'Matte photo paper with a white border',
    reconstructionStatus: 'approximate'
  },
  {
    id: 'photo-frame',
    name: 'Couple Eye Frame',
    blurb: 'The A4 frame, laid flat in the box.',
    category: 'keepsake',
    productId: 'frame-couple-eye',
    model: 'frame',
    size: [15, 2, 20],
    maxQty: 1,
    colours: ['#2E2425', '#9A7B5F', '#F6EDE3'],
    supportsPhoto: true,
    photoLabel: 'Framed photograph',
    supportsText: true,
    textLabel: 'Line under the photo',
    textMax: 60,
    previewPath: '/images/frames/frame-couple-eye.jpg',
    texturePath: null,
    sourceImages: [],
    materialSummary: 'Moulded frame with a glass front and a card mount',
    reconstructionStatus: 'approximate'
  },
  {
    id: 'mini-bouquet',
    name: 'Handmade bouquet',
    blurb: 'A small wrapped bouquet, made to order.',
    category: 'keepsake',
    productId: 'bouquet-blush-coast',
    model: 'bouquet',
    size: [13, 14, 13],
    proxy: [[0, 0.27, 0, 0.32, 0.27, 0.32], [0, 0.76, 0, 0.50, 0.24, 0.50]],
    clearance: 0.8,
    maxQty: 1,
    colours: ['#E7BFBD', '#F6EDE3', '#C9A227', '#7A3B40'],
    supportsScale: true,
    previewPath: '/images/p-blush-coast.jpg',
    texturePath: null,
    sourceImages: [],
    materialSummary: 'Paper-wrapped satin flowers',
    reconstructionStatus: 'approximate'
  },
  {
    id: 'magazine',
    name: 'Personalised magazine',
    blurb: 'The four-page A5 magazine, tucked in flat.',
    category: 'keepsake',
    /* A5 — 14.8 x 21 cm, which is the size this model is built at. */
    productId: 'magazine-a5-4',
    model: 'book',
    size: [15, 3, 21],
    maxQty: 1,
    colours: ['#603D42', '#F3E7DA', '#2C3444'],
    supportsPhoto: true,
    photoLabel: 'Cover photograph',
    supportsText: true,
    textLabel: 'Cover line',
    textMax: 40,
    previewPath: '/images/magazine-4p.jpg',
    texturePath: null,
    sourceImages: [],
    materialSummary: 'Printed paper, saddle-stitched',
    reconstructionStatus: 'approximate'
  }
];

export const getGiftKind = (id) => GIFT_KINDS.find((g) => g.id === id) || null;

/* ------------------------------------------------- the manifest

   Every entry above is a product-dimension manifest row, and this
   is what the rest of the studio reads it as. Collected in one
   function so that the fields the geometry depends on are named
   once and defaulted once.

   The unit question is the important one. `size` is in centimetres
   — all of it, every kind, with no exceptions — because these
   models are built from primitives in this repository at the sizes
   written here, not exported from a modelling tool. A kind whose
   model later arrives as an asset in other units declares
   `sourceUnits` and `unitScale`, and `size` stays what it has
   always been: the product's real size in centimetres. Nothing
   downstream converts anything, so a 10 cm product is 10 cm in
   every box.

   `orientations` is what the packer may try. 'upright' is the
   default and, for nearly everything, the only one: a hamper is
   packed with bottles standing and bars lying flat, and tipping a
   perfume bottle over to win a centimetre is not what anyone does
   with a present. 'on-side' is declared only where laying the thing
   down is how it would really be packed. */
export const MANIFEST_UNITS = 'cm';

export const ORIENTATIONS = ['upright', 'on-side'];

export function giftManifest(kind) {
  if (!kind) return null;
  return {
    id: kind.id,
    model: kind.model,
    /* physical size in centimetres: length, height, width */
    size: [...kind.size],
    units: MANIFEST_UNITS,
    sourceUnits: kind.sourceUnits || MANIFEST_UNITS,
    unitScale: Number.isFinite(Number(kind.unitScale)) ? Number(kind.unitScale) : 1,
    orientations: (kind.orientations || ['upright']).filter((o) => ORIENTATIONS.includes(o)),
    scaleLimits: kind.supportsScale ? [SCALE_MIN, SCALE_MAX] : [1, 1],
    /* collision representation: the proxy boxes, as fractions of
       `size`; null means the whole of it */
    proxy: kind.proxy ? kind.proxy.map((row) => [...row]) : null,
    clearance: kind.clearance ?? null,
    reconstructionStatus: kind.reconstructionStatus
  };
}

/* What one of these costs, from whichever source owns the price. A
   kind that points at a product the catalogue no longer has returns
   null, so the caller can say so rather than quietly charging 0. */
export function giftUnitPrice(kind, variantId = null) {
  if (!kind) return null;

  let base;
  if (kind.productId) {
    const product = getProductById(kind.productId);
    if (!product) return null;
    base = Number(product.price) * (kind.productQuantity || 1);
  } else {
    base = Number(kind.price);
  }
  if (!Number.isFinite(base)) return null;

  const variant = variantId ? (kind.variants || []).find((v) => v.id === variantId) : null;
  return base + (variant ? Number(variant.priceDelta) || 0 : 0);
}

export const giftColours = (kind) => kind?.colours || ['#F3E7DA'];

/* How small and large a gift may be scaled. Kept narrow: the point is
   to nudge a thing into place, not to send a two-metre candle. */
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.35;

export default GIFT_KINDS;
