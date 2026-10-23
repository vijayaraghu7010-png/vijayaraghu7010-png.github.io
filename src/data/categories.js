/* Home-page categories, benefits and site-wide contact details.
   Edit here to change the three category cards or the footer. */

export const CATEGORIES = [
  {
    id: 'magazine',
    title: 'MAGAZINES',
    description: 'Turn your moments into beautifully designed personalised magazines.',
    cta: 'Explore Magazines',
    to: '/magazines',
    image: '/images/magazine-hero.jpg',
    alt: 'Hands turning the pages of a personalised photo magazine filled with printed memories'
  },
  {
    id: 'polaroid',
    title: 'POLAROIDS',
    description: 'Your favourite moments as insta-style polaroid prints.',
    cta: 'Shop Polaroids',
    to: '/polaroids',
    image: '/images/polaroid-set.jpg',
    alt: 'Polaroid prints laid out in rows on a warm wooden table'
  },
  {
    id: 'bouquet',
    title: 'BOUQUETS',
    description: 'Handcrafted bouquets inspired by the calm, warmth and beauty of sunsets.',
    cta: 'Shop Bouquets',
    to: '/bouquets',
    image: '/images/p-golden-hour.jpg',
    alt: 'A handmade bouquet of coral and cream roses wrapped in soft paper'
  },
  {
    id: 'hamper',
    title: 'HAMPERS',
    description: 'Keepsake boxes packed by hand — candles, jewellery, chocolates and a note from you.',
    cta: 'Shop Hampers',
    to: '/hampers',
    image: '/images/hampers/hamper-blush-luxe.jpg',
    alt: 'A blush pink gift hamper packed with perfume, jewellery and chocolates',
    wide: true,
    gallery: [
      '/images/hampers/hamper-blush-luxe.jpg',
      '/images/hampers/hamper-keepsake.jpg',
      '/images/hampers/hamper-sweet-thanks.jpg',
      '/images/hampers/hamper-rosewood.jpg'
    ]
  }
];

export const BENEFITS = [
  { icon: 'heart', title: 'Personalised with Love', text: 'Made for your special moments' },
  { icon: 'gem', title: 'Premium Print Quality', text: 'Vibrant colours, lasting memories' },
  { icon: 'gift', title: 'Carefully Packed', text: 'Safe & secure packaging' },
  { icon: 'truck', title: 'Delivery Across India', text: 'Bringing happiness to your doorstep' }
];

/* Placeholder business details — replace with the real ones.
   A social link with an empty url is rendered as a disabled icon
   rather than being pointed at an unrelated website. */
export const CONTACT = {
  email: 'hello@wrappedstudio.in',
  phone: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  whatsapp: '919876543210',
  city: 'Chennai, India'
};

export const SOCIALS = [
  { id: 'instagram', label: 'Instagram', url: '' },
  { id: 'pinterest', label: 'Pinterest', url: '' },
  { id: 'facebook', label: 'Facebook', url: '' },
  { id: 'youtube', label: 'YouTube', url: '' }
];

export const BRAND = {
  name: 'WrappedStudio',
  tagline: 'More than gifts, a little piece of your story.',
  footerLine: 'Flowers inspired by sunsets, moments inspired by you.'
};
