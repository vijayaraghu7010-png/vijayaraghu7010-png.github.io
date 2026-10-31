/* Home-page categories, benefits and site-wide contact details.
   Edit here to change the three category cards or the footer.

   Every card carries an `art` file: one piece of artwork that is the
   whole card - the photograph, the name and the arrow are all painted
   into it. The title, description and cta below it are still read,
   but only by a screen reader and a search engine, since the picture
   already says them on screen. `image` and `gallery` stay for the
   other pages that show these categories without the poster art. */

export const CATEGORIES = [
  {
    id: 'magazine',
    title: 'MAGAZINES',
    description: 'Turn your favourite moments into timeless magazines.',
    cta: 'Explore Magazines',
    to: '/magazines',
    image: '/images/extracted/cat-magazines.jpg',
    art: '/images/categories/magazines.jpg',
    alt: 'An open personalised magazine spread, "Moments", laid out with printed photographs among tulips'
  },
  {
    id: 'polaroid',
    title: 'POLAROIDS',
    description: 'Turn your favourite moments into timeless polaroids.',
    cta: 'Shop Polaroids',
    to: '/polaroids',
    image: '/images/extracted/cat-polaroids.jpg',
    art: '/images/categories/polaroids.jpg',
    alt: 'A blush gift box of polaroid prints beside a vase of tulips and a lit candle'
  },
  {
    id: 'bouquet',
    title: 'BOUQUETS',
    description: 'Thoughtfully arranged blooms for your special moments.',
    cta: 'Shop Bouquets',
    to: '/bouquets',
    image: '/images/extracted/cat-bouquets.jpg',
    art: '/images/categories/bouquets.jpg',
    alt: 'A wrapped bouquet of pink tulips and daisies, tagged with a ribbon bow'
  },
  {
    id: 'frame',
    title: 'PHOTO FRAMES',
    description: 'Turn your favourite moments into timeless frames.',
    cta: 'Explore Photo Frames',
    to: '/photo-frames',
    image: '/images/frames/couple-eye-frame.jpg',
    art: '/images/categories/photo-frames.jpg',
    alt: 'A wooden frame holding a six-photo collage, propped beside tulips and a candle'
  },
  {
    id: 'poster',
    title: 'WALL POSTERS',
    description: 'Turn your favourite memories into beautiful wall posters.',
    cta: 'Explore Wall Posters',
    to: '/wall-posters',
    image: '/images/categories/wall-posters.jpg',
    art: '/images/categories/wall-posters.jpg',
    alt: 'A framed collage poster of taped polaroids hanging above a sideboard of tulips'
  },
  {
    id: 'hamper',
    title: 'HAMPERS',
    description: 'Thoughtfully curated gifts for your special moments.',
    cta: 'Shop Hampers',
    to: '/hampers',
    image: '/images/hampers/hamper-blush-luxe.jpg',
    art: '/images/categories/hampers.jpg',
    alt: 'An open blush hamper box packed with a print, a bouquet, a candle and chocolates',
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

/* The studio's own details. The email is the real one; the phone
   number and WhatsApp below are still placeholders and want
   replacing before launch.

   A social link with an empty url is rendered as a disabled icon
   rather than being pointed at an unrelated website. */
export const CONTACT = {
  email: 'wrapped.studio07@gmail.com',
  phone: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  whatsapp: '919876543210',
  city: 'Chennai, India'
};

export const SOCIALS = [
  /* The share link Instagram hands out carries a tracking parameter
     (?obrf=...) that identifies where it was copied from. The profile
     works without it, so the plain address is what goes on the site.

     WhatsApp is where the studio actually takes orders and photographs,
     so it stands beside Instagram; Pinterest, Facebook and YouTube are
     dropped until there is something to point them at. The wa.me link
     is built from the number in CONTACT, which is still a placeholder -
     replace it there and this follows. */
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/wrapped.studio_' },
  { id: 'whatsapp', label: 'WhatsApp', url: `https://wa.me/${CONTACT.whatsapp}` }
];

export const BRAND = {
  name: 'WrappedStudio',
  tagline: 'More than gifts, a little piece of your story.',
  footerLine: 'Flowers inspired by sunsets, moments inspired by you.'
};
