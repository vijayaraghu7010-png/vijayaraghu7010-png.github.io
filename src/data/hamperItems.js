/* ===========================================================
   The real things that go inside a hamper.

   These are catalogue products like any other — which is the point.
   The hamper studio prices every gift through `giftUnitPrice`, and
   that reads the live catalogue, so a price edited in the admin
   panel reaches the 3D studio without a deploy and without a second
   place to keep it in step.

   They carry `hamperOnly`, which keeps them out of the shop's
   search and off the home page: they are sold as part of a hamper,
   not as their own product page, and a search result that led to a
   half-built page for a ₹10 chocolate bar would be a bug.

   PRICES ARE PLACEHOLDERS. Every `price` below is a round number
   put in so the studio has something to total, at the owner's
   instruction, and every one of them is meant to be corrected in
   Admin → Products before the shop takes an order. They are not
   quotes and they were not supplied with the photographs.
   =========================================================== */

/* The literal rather than the PRICE_MODES import: products.js pulls
   this list in, and importing back out of it would be a cycle that
   leaves the constant in its temporal dead zone. */
const FIXED = 'fixed';

const item = ({ id, name, price, image, short, keywords, brand }) => ({
  id,
  slug: id,
  name,
  category: 'hamper-item',
  categoryLabel: 'Hamper item',
  price,
  priceMode: FIXED,
  unitLabel: '',
  image,
  alt: short,
  gallery: [image],
  shortDescription: short,
  description: short,
  details: brand ? [`Brand: ${brand}`, 'Sold as part of a build-your-own hamper'] : ['Sold as part of a build-your-own hamper'],
  occasions: [],
  keywords,
  /* kept out of search, the home page and the category pages */
  hamperOnly: true,
  featured: false,
  rating: null,
  reviews: 0,
  addedAt: '2026-10-25'
});

export const HAMPER_ITEM_PRODUCTS = [
  /* ------------------------------------------------ crochet */
  item({
    id: 'kit-crochet-spiderman',
    name: 'Spider-Man Crochet Keyring',
    price: 299,
    image: '/images/kit/crochet-spiderman.jpg',
    short: 'A hand-crocheted Spider-Man doll keyring with a matching mask charm.',
    keywords: ['crochet', 'keyring', 'keychain', 'spiderman', 'amigurumi', 'handmade']
  }),
  item({
    id: 'kit-crochet-batman',
    name: 'Batman Crochet Doll',
    price: 349,
    image: '/images/kit/crochet-batman.jpg',
    short: 'A hand-crocheted Batman doll with a cape and a stitched emblem.',
    keywords: ['crochet', 'batman', 'amigurumi', 'doll', 'handmade']
  }),
  item({
    id: 'kit-crochet-panda',
    name: 'Panda Crochet Keyring',
    price: 199,
    image: '/images/kit/crochet-panda.jpg',
    short: 'A tiny crocheted panda on a split ring.',
    keywords: ['crochet', 'panda', 'keyring', 'amigurumi', 'handmade']
  }),
  item({
    id: 'kit-crochet-animals',
    name: 'Crochet Animal Keyring',
    price: 199,
    image: '/images/kit/crochet-animals.jpg',
    short: 'A crocheted bear, bunny or cat keyring — pick the one you want.',
    keywords: ['crochet', 'bear', 'bunny', 'cat', 'keyring', 'amigurumi']
  }),
  item({
    id: 'kit-crochet-turtle',
    name: 'Rainbow Turtle Keyring',
    price: 229,
    image: '/images/kit/crochet-turtle.jpg',
    short: 'A crocheted turtle with a rainbow shell.',
    keywords: ['crochet', 'turtle', 'rainbow', 'keyring', 'amigurumi']
  }),
  item({
    id: 'kit-crochet-bow',
    name: 'Crochet Bow Keyring',
    price: 179,
    image: '/images/kit/crochet-bow.jpg',
    short: 'A chunky crocheted bow on a split ring, in soft pink.',
    keywords: ['crochet', 'bow', 'ribbon', 'keyring', 'pink']
  }),
  item({
    id: 'kit-crochet-sunflower',
    name: 'Potted Sunflower Keyring',
    price: 219,
    image: '/images/kit/crochet-sunflower.jpg',
    short: 'A crocheted sunflower in a little pot, on a keyring.',
    keywords: ['crochet', 'sunflower', 'flower', 'pot', 'keyring']
  }),
  item({
    id: 'kit-crochet-bouquet',
    name: 'Crochet Bouquet Keyring',
    price: 249,
    image: '/images/kit/crochet-bouquet.jpg',
    short: 'A miniature crocheted rose bouquet charm with a wrapped cone.',
    keywords: ['crochet', 'bouquet', 'roses', 'keyring', 'flowers']
  }),
  item({
    id: 'kit-crochet-cherries',
    name: 'Cherry Charm with Pearls',
    price: 199,
    image: '/images/kit/crochet-cherries.jpg',
    short: 'Crocheted cherries on a pearl chain, with a leaf bow.',
    keywords: ['crochet', 'cherry', 'pearl', 'charm', 'red']
  }),

  /* --------------------------------------------- chocolates */
  item({
    id: 'kit-choc-kitkat',
    name: 'Nestlé KitKat',
    brand: 'Nestlé',
    price: 20,
    image: '/images/kit/choc-kitkat.jpg',
    short: 'A KitKat bar in its red wrapper.',
    keywords: ['chocolate', 'kitkat', 'nestle', 'wafer']
  }),
  item({
    id: 'kit-choc-silk',
    name: 'Cadbury Dairy Milk Silk',
    brand: 'Cadbury',
    price: 90,
    image: '/images/kit/choc-silk.jpg',
    short: 'A Dairy Milk Silk bar in its purple wrapper.',
    keywords: ['chocolate', 'cadbury', 'dairy milk', 'silk']
  }),
  item({
    id: 'kit-choc-crispello',
    name: 'Cadbury Dairy Milk Crispello',
    brand: 'Cadbury',
    price: 45,
    image: '/images/kit/choc-crispello.jpg',
    short: 'A Crispello pack of wafer-filled chocolate fingers.',
    keywords: ['chocolate', 'cadbury', 'crispello', 'wafer']
  }),
  item({
    id: 'kit-choc-bournville',
    name: 'Cadbury Bournville 70% Dark',
    brand: 'Cadbury',
    price: 160,
    image: '/images/kit/choc-bournville.jpg',
    short: 'A Bournville Intense 70% dark chocolate bar in its carton.',
    keywords: ['chocolate', 'bournville', 'dark', 'cadbury', '70%']
  }),
  item({
    id: 'kit-choc-ferrero',
    name: 'Ferrero Rocher (4 pieces)',
    brand: 'Ferrero',
    price: 250,
    image: '/images/kit/choc-ferrero.jpg',
    short: 'A gold Ferrero Rocher box of four, with a ribbon print.',
    keywords: ['chocolate', 'ferrero', 'rocher', 'gold', 'hazelnut']
  }),

  /* ------------------------------------------------- beauty */
  item({
    id: 'kit-beauty-mars-gloss',
    name: 'MARS Toffee Twirl Lip Gloss',
    brand: 'MARS Cosmetics',
    price: 249,
    image: '/images/kit/beauty-mars-gloss.jpg',
    short: 'A MARS candilicious lip gloss, 4 ml, with a rose-gold cap.',
    keywords: ['lip gloss', 'mars', 'makeup', 'beauty', 'toffee twirl']
  }),
  item({
    id: 'kit-beauty-lakme-liplove',
    name: 'Lakmé Lip Love Cherry',
    brand: 'Lakmé',
    price: 199,
    image: '/images/kit/beauty-lakme-liplove.jpg',
    short: 'A Lakmé Lip Love cherry lip care stick with SPF 15, carded.',
    keywords: ['lip balm', 'lakme', 'cherry', 'lip love', 'spf']
  }),
  item({
    id: 'kit-beauty-lakme-peptide',
    name: 'Lakmé 9to5 Peptide Lip I.V.',
    brand: 'Lakmé',
    price: 399,
    image: '/images/kit/beauty-lakme-peptide.jpg',
    short: 'A Lakmé 9to5 peptide hydrating lip balm tube in its carton.',
    keywords: ['lip balm', 'lakme', 'peptide', '9to5', 'hydrating']
  }),

  /* ---------------------------------------------- drinkware */
  item({
    id: 'kit-drink-tumbler-leather',
    name: 'Glass Tumbler with Leather Sleeve',
    price: 649,
    image: '/images/kit/drink-tumbler-leather.jpg',
    short: 'An amber glass tumbler, 435 ml, with a tan leather sleeve and a glass straw.',
    keywords: ['tumbler', 'glass', 'straw', 'leather', 'drinkware', 'sipper']
  }),
  item({
    id: 'kit-drink-tumbler-bamboo',
    name: 'Glass Tumbler with Bamboo Lid',
    price: 599,
    image: '/images/kit/drink-tumbler-bamboo.jpg',
    short: 'A tall glass tumbler with a bamboo lid, wooden straw and a silicone grip band.',
    keywords: ['tumbler', 'glass', 'bamboo', 'straw', 'drinkware', 'sipper']
  }),

  /* ---------------------------------------------- fragrance */
  item({
    id: 'kit-perfume-honey-oud',
    name: 'Bella Vita Honey Oud EDP',
    brand: 'Bella Vita',
    price: 899,
    image: '/images/kit/perfume-honey-oud.jpg',
    short: 'A Bella Vita Honey Oud eau de parfum, 100 ml, with a gold cap.',
    keywords: ['perfume', 'bella vita', 'honey oud', 'edp', 'fragrance']
  }),
  item({
    id: 'kit-perfume-bellavita-duo',
    name: 'Bella Vita Fresh & Skai Duo Set',
    brand: 'Bella Vita',
    price: 749,
    image: '/images/kit/perfume-bellavita-duo.jpg',
    short: 'A boxed pair of Bella Vita 20 ml fragrances — Fresh Unisex and Skai Aquatic.',
    keywords: ['perfume', 'bella vita', 'gift set', 'fresh', 'skai', 'fragrance']
  })
];

export default HAMPER_ITEM_PRODUCTS;
