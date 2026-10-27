/* ===========================================================
   The flower catalogue — the studio's own sheet, one row per
   flower, grouped the way the printed catalogue groups them.

   The pictures are crops of that sheet (public/images/flowers),
   so what a customer picks here is the exact flower they will be
   handed. The photographs are of the pipe-cleaner versions,
   which is what the sheet is; a bouquet asked for in cloth or in
   live flowers is the same kind in another material.
   =========================================================== */

export const FLOWER_CATEGORIES = [
  { id: 'blooms', label: 'Blooms' },
  { id: 'roses', label: 'Roses & tulips' },
  { id: 'wild', label: 'Wildflowers' },
  { id: 'accents', label: "Baby's breath & accents" },
  { id: 'greenery', label: 'Leaves & greenery' }
];

export const FLOWERS = [
  // ------------------------------------------------- blooms
  { id: 'sunflower', name: 'Sunflower', also: 'maharani', category: 'blooms' },
  { id: 'poppy', name: 'Poppy', category: 'blooms' },
  { id: 'peony', name: 'Peony', category: 'blooms' },
  { id: 'gerbera', name: 'Gerbera', category: 'blooms' },
  { id: 'orchid', name: 'Orchid', also: 'onggret', category: 'blooms' },
  { id: 'anthurium', name: 'Anthurium', category: 'blooms' },
  { id: 'chrysanthemum', name: 'Chrysanthemum', also: 'Krisan', category: 'blooms' },

  // --------------------------------------- roses and tulips
  { id: 'rose-1', name: 'Rose 1', also: 'mawar', category: 'roses' },
  { id: 'rose-2', name: 'Rose 2', also: 'mawar', category: 'roses' },
  { id: 'tulips', name: 'Tulips', category: 'roses' },

  // -------------------------------------------- wildflowers
  { id: 'daisy', name: 'Daisy', category: 'wild' },
  { id: 'mini-daisy', name: 'Mini daisy', category: 'wild' },
  { id: 'aster', name: 'Aster', category: 'wild' },
  { id: 'hibiscus', name: 'Hibiscus', also: 'sepatu', category: 'wild' },
  { id: 'morning-glory', name: 'Morning glory', category: 'wild' },
  { id: 'lavender', name: 'Lavender', category: 'wild' },

  // ------------------------------------------------ accents
  { id: 'babys-breath-1', name: "Baby's breath 1", category: 'accents' },
  { id: 'babys-breath-2', name: "Baby's breath 2", category: 'accents' },
  { id: 'maple', name: 'Maple', category: 'accents' },

  // ----------------------------------------------- greenery
  { id: 'eucalyptus', name: 'Eucalyptus', category: 'greenery' },
  { id: 'fern-mini', name: 'Fern mini', category: 'greenery' },
  { id: 'olive-leaf', name: 'Olive leaf', category: 'greenery' },
  { id: 'palm-leaf', name: 'Palm leaf', category: 'greenery' },
  { id: 'sword-leaf', name: 'Sword leaf', category: 'greenery' },
  { id: 'spiral', name: 'Spiral', category: 'greenery' }
].map((flower) => ({
  ...flower,
  /* every row's picture is named after its id, so a new flower is a
     new row plus a file and nothing else */
  image: `/images/flowers/${flower.id}.jpg`,
  alt: `${flower.name} from the WrappedStudio flower catalogue`,
  /* the name as it is read out, with the local name where there is one */
  label: flower.also ? `${flower.name} (${flower.also})` : flower.name
}));

export const getFlowerById = (id) => FLOWERS.find((f) => f.id === id) || null;

export const flowersInCategory = (categoryId) => FLOWERS.filter((f) => f.category === categoryId);
