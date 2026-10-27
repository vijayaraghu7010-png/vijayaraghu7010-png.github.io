import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PHOTOS, MAX_BYTES_PER_PHOTO, ACCEPTED_TYPES, maxPhotosFor } from '../src/data/uploadLimits.js';
import { MAGAZINE_SIZES } from '../src/data/products.js';

/* The limits the studio asked for, product by product. They are
   checked here because they are a business decision rather than a
   consequence of the code: getting one wrong means refusing an order
   somebody wanted to place, or accepting one the studio cannot make.

   The server holds its own copy, in settings under 'uploads.limits',
   and that copy is the one that decides. These tests keep the pair in
   step on the side the customer meets first. */

test('every product takes the number of photographs the studio asked for', () => {
  assert.equal(maxPhotosFor('polaroid'), 120);
  assert.equal(maxPhotosFor('magazine'), 100);
  assert.equal(maxPhotosFor('poster'), 50);
  assert.equal(maxPhotosFor('frame'), 30);
  assert.equal(maxPhotosFor('bouquet'), 50);
  assert.equal(maxPhotosFor('hamper-3d'), 50);
});

test('a product nobody has written a limit for still has one', () => {
  assert.equal(maxPhotosFor('something-new'), 50);
  assert.equal(maxPhotosFor(undefined), 50);
  assert.equal(maxPhotosFor(null), 50);
});

/* A magazine is bound by how many pages it has, not by the ceiling.
   The customiser shows whichever is smaller, and for every size the
   studio sells today that is the page count. */
test('a magazine size never promises more photographs than it holds', () => {
  for (const size of MAGAZINE_SIZES) {
    const pages = (size.photos || { max: 15 }).max;
    const shown = Math.min(pages, MAX_PHOTOS.magazine);
    assert.equal(shown, pages, `${size.label} should be bound by its page count`);
    assert.ok(pages <= MAX_PHOTOS.magazine, `${size.label} exceeds the magazine ceiling`);
  }
});

test('a photograph may be a full-size one from a phone', () => {
  /* Originals are kept, so the limit has to clear a modern camera
     file comfortably. Twelve megabytes would have refused some. */
  assert.ok(MAX_BYTES_PER_PHOTO >= 20 * 1024 * 1024);
  assert.equal(MAX_BYTES_PER_PHOTO, 26214400);
});

test('the accepted types are the ones a print shop can use', () => {
  assert.deepEqual(ACCEPTED_TYPES, [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]);
  /* An iPhone sends HEIC unless told otherwise. */
  assert.ok(ACCEPTED_TYPES.includes('image/heic'));
  assert.ok(!ACCEPTED_TYPES.includes('image/gif'));
  assert.ok(!ACCEPTED_TYPES.includes('application/pdf'));
});
