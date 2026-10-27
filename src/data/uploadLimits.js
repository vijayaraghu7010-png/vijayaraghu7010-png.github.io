/* How many photographs each kind of product takes, and how big one
   may be.

   These are the same numbers the server holds, in settings under
   'uploads.limits'. They are repeated here so a customiser can say
   "that is too many" while the customer is still choosing, rather
   than after they have waited for an upload to be refused. The
   server's copy is the one that decides: if the two ever disagree,
   the customer is told no by the server and these are stale.

   A product may be stricter than its limit for a reason of its own -
   an eight-page magazine holds thirty photographs however many the
   studio would accept - and where it is, the product's own rule
   stands. These are ceilings, not targets.                        */

export const MAX_PHOTOS = {
  polaroid: 120,
  magazine: 100,
  poster: 50,
  frame: 30,
  bouquet: 50,
  'hamper-3d': 50
};

export const MAX_PHOTOS_DEFAULT = 50;

/* 25 MB a photograph. Originals are kept as they are - these are
   printed - so the limit has to allow a full-size picture from a
   recent phone without argument. */
export const MAX_BYTES_PER_PHOTO = 25 * 1024 * 1024;

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];

export function maxPhotosFor(customiser) {
  return MAX_PHOTOS[customiser] ?? MAX_PHOTOS_DEFAULT;
}
