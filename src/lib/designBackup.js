/* ===========================================================
   Moving a design to another device, the only way this site
   currently can.

   There is no accounts backend — src/context/AuthContext.jsx keeps a
   profile in localStorage and never speaks to a server — so there is
   nothing to synchronise designs through, and the studio does not
   pretend otherwise. What it offers instead is honest and real: a
   file. One design, its photographs inside it, downloaded; opened
   again on the other device.

   If an accounts API ever lands, this is the shape the sync payload
   would take, and `exportDesign` is what would be posted.
   =========================================================== */

import { getAssets, putAsset, putDesign } from './designDb';
import { assetIdsOf, newId, validateDesign } from './designSchema';

const FORMAT = 'wrappedstudio.hamper.backup';
const FORMAT_VERSION = 1;

/* 8 MB of base64 is about 6 MB of photographs — more than a hamper
   needs and little enough to open again without stalling the tab. */
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.readAsDataURL(blob);
  });

const fromBase64 = (base64, type) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || 'image/jpeg' });
};

export async function exportDesign(design) {
  const wanted = assetIdsOf(design);
  const assets = wanted.length ? await getAssets(wanted).catch(() => []) : [];

  const encoded = [];
  let bytes = 0;
  const skipped = [];

  for (const asset of assets) {
    if (bytes + asset.bytes > MAX_BACKUP_BYTES) {
      skipped.push(asset.originalName || asset.id);
      continue;
    }
    /* Sequential on purpose: four FileReaders at once on a phone is
       how you get a tab killed for memory. */
    // eslint-disable-next-line no-await-in-loop
    const base64 = await toBase64(asset.blob).catch(() => null);
    if (!base64) {
      skipped.push(asset.originalName || asset.id);
      continue;
    }
    bytes += asset.bytes;
    encoded.push({
      id: asset.id,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      originalName: asset.originalName,
      bytes: asset.bytes,
      base64
    });
  }

  return {
    payload: {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      exportedAt: Date.now(),
      design,
      assets: encoded
    },
    skipped
  };
}

export function downloadDesign(design) {
  return exportDesign(design).then(({ payload, skipped }) => {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safe = design.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'hamper';
    link.href = url;
    link.download = `wrappedstudio-${safe}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    /* Revoked on the next turn of the loop — immediately would race
       the download starting in Safari. */
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { skipped };
  });
}

/* Reads a backup file back in as a new design, with a new id, so
   importing twice gives two hampers rather than overwriting one.
   The file is untrusted input and goes through the same validation as
   anything read out of storage. */
export async function importDesign(file) {
  if (!file) return { ok: false, error: 'No file was chosen.' };
  if (file.size > MAX_BACKUP_BYTES * 2) {
    return { ok: false, error: 'That file is too large to be a hamper backup.' };
  }

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'That file is not a hamper backup — it is not readable as one.' };
  }

  if (payload?.format !== FORMAT) {
    return { ok: false, error: 'That file is not a WrappedStudio hamper backup.' };
  }
  if (Number(payload.formatVersion) > FORMAT_VERSION) {
    return { ok: false, error: 'That backup was made by a newer version of the studio.' };
  }

  const result = validateDesign(payload.design);
  if (!result.ok) return { ok: false, error: `That backup could not be read (${result.reason}).` };

  /* Assets keep the ids the design refers to, unless one is already
     here — in which case the imported copy gets a new id and the
     design is pointed at it, so an import can never overwrite a photo
     another design is using. */
  const remap = new Map();
  const existing = new Set((await getAssets((payload.assets || []).map((a) => a.id)).catch(() => [])).map((a) => a.id));

  for (const asset of payload.assets || []) {
    if (!asset?.base64) continue;
    const id = existing.has(asset.id) ? newId('asset') : asset.id;
    if (id !== asset.id) remap.set(asset.id, id);
    try {
      // eslint-disable-next-line no-await-in-loop
      await putAsset({
        id,
        blob: fromBase64(asset.base64, asset.type),
        type: asset.type || 'image/jpeg',
        bytes: Number(asset.bytes) || 0,
        width: Number(asset.width) || 0,
        height: Number(asset.height) || 0,
        originalName: String(asset.originalName || 'photo').slice(0, 120),
        createdAt: Date.now()
      });
    } catch {
      /* Out of room, or a corrupt base64 blob. The design still
         imports; the photo shows as missing, which is already a case
         the studio handles. */
    }
  }

  const design = {
    ...result.design,
    id: newId('design'),
    name: `${result.design.name} (imported)`.slice(0, 60),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: 1,
    lastSavedAt: null,
    orderedAs: null,
    gifts: result.design.gifts.map((g) => ({
      ...g,
      uid: newId('gift'),
      assetId: g.assetId ? remap.get(g.assetId) || g.assetId : null
    }))
  };

  try {
    await putDesign(design);
  } catch {
    return { ok: false, error: 'There was no room on this device to save the imported hamper.' };
  }

  return { ok: true, id: design.id, name: design.name };
}
