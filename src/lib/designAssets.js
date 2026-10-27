/* ===========================================================
   Customer photographs, from the file picker to the 3D scene and
   back after a browser restart.

   The rule that shapes this file: a blob: URL is not a photograph.
   It is a handle into one browser session, and it is dead the moment
   the tab closes — so a design that stored `blob:http://…` as its
   photo would restore into a broken image every single time. What
   gets saved is the Blob itself, in IndexedDB, under an id the design
   refers to. Fresh object URLs are minted on load and revoked when
   nothing is looking at them any more.
   =========================================================== */

import { getAsset, getAssets, isQuotaError, putAsset } from './designDb';
import { newId } from './designSchema';
import { ACCEPTED_TYPES, MAX_UPLOAD_MB, compressFile, uploadProblem } from './imageCompress';

/* Decoding, resizing and encoding live in imageCompress now, so that
   every picture entering the site - here, and in the admin panel -
   goes through the same one. Re-exported because the studio panels
   import these names from this module. */
export { ACCEPTED_TYPES, MAX_UPLOAD_MB, uploadProblem };

/* What is kept. Big enough to read as a photograph on a frame or a
   polaroid in the scene, small enough that a hamper with four photos
   is not competing with the browser's storage quota. The original is
   not retained: there is no backend to print from yet, and the studio
   says so on screen. */
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.86;

/* Takes a picked file and leaves a durable asset in IndexedDB.
   Resolves with the record; throws with a `reason` the UI can read. */
export async function storeUpload(file) {
  const problem = uploadProblem(file);
  if (problem) {
    const err = new Error(problem);
    err.reason = 'rejected';
    throw err;
  }

  /* A photograph behind a white mount reads better than one behind
     transparency when it lands on a frame or a print in the scene, so
     this always ends up a JPEG. No byte budget: IndexedDB is roomy,
     and the quota error below is what handles a full device. */
  const { blob, width, height } = await compressFile(file, {
    maxEdge: MAX_EDGE,
    quality: JPEG_QUALITY,
    type: 'image/jpeg',
    background: '#ffffff'
  });

  const asset = {
    id: newId('asset'),
    /* The Blob is what survives a restart. Browsers have stored blobs
       in IndexedDB since 2015; nothing here keeps a blob: URL. */
    blob,
    type: blob.type,
    bytes: blob.size,
    width,
    height,
    originalName: String(file.name || 'photo').slice(0, 120),
    originalBytes: file.size,
    originalType: file.type || '',
    createdAt: Date.now()
  };

  try {
    await putAsset(asset);
  } catch (err) {
    const quota = isQuotaError(err);
    const wrapped = new Error(
      quota
        ? 'There is no room left in this browser for another photo. Delete a saved design and try again.'
        : 'That photo could not be saved on this device.'
    );
    wrapped.reason = quota ? 'quota' : 'write';
    wrapped.cause = err;
    throw wrapped;
  }

  return asset;
}

/* ------------------------------------------------- object URL cache

   One URL per asset, shared by every mesh and thumbnail showing it,
   counted so the last viewer to let go is the one that revokes. A
   leaked URL pins its blob in memory for the life of the document,
   which on a long customising session is exactly the leak you would
   not notice until the tab is using a gigabyte. */

const urls = new Map(); // assetId -> { url, refs, width, height }

export async function acquireAssetUrl(assetId) {
  if (!assetId) return null;

  const held = urls.get(assetId);
  if (held) {
    held.refs += 1;
    return held;
  }

  const asset = await getAsset(assetId).catch(() => null);
  if (!asset?.blob) return null;

  const entry = {
    url: URL.createObjectURL(asset.blob),
    refs: 1,
    width: asset.width,
    height: asset.height,
    originalName: asset.originalName
  };
  urls.set(assetId, entry);
  return entry;
}

export function releaseAssetUrl(assetId) {
  const held = urls.get(assetId);
  if (!held) return;
  held.refs -= 1;
  if (held.refs > 0) return;
  URL.revokeObjectURL(held.url);
  urls.delete(assetId);
}

/* Which of a design's photos are still on this device. A photo can be
   missing because storage was cleared, because the design came from a
   backup file without its assets, or because a save was interrupted —
   all of which should warn, not wipe the design. */
export async function missingAssetIds(idList) {
  const wanted = [...new Set((idList || []).filter(Boolean))];
  if (!wanted.length) return [];
  const found = await getAssets(wanted).catch(() => []);
  const have = new Set(found.map((a) => a.id));
  return wanted.filter((id) => !have.has(id));
}

export const formatBytes = (n) => {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  /* A browser quota is commonly several gigabytes, and "10240.0 MB"
     is not a number anybody reads. */
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};
