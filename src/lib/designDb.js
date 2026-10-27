/* ===========================================================
   Where a customer's hamper designs actually live.

   IndexedDB, not localStorage and not the HTTP cache: designs hold
   image blobs and a few kilobytes of structure each, they have to
   survive a browser restart, and they are written often enough that
   a synchronous API would be felt while dragging. localStorage is
   used for exactly one thing — a pointer to the design that was
   last open, small enough to read before the first paint.

   Nothing in here assumes storage is available or permanent. A
   private window, a browser with site data blocked, a full disk and
   a user who clears their data are all normal, and each one has to
   leave the studio usable rather than broken. Callers get told which
   of those happened so they can say so on screen.
   =========================================================== */

const DB_NAME = 'wrappedstudio-designs';
const DB_VERSION = 1;

export const STORE_DESIGNS = 'designs';
export const STORE_ASSETS = 'designAssets';
export const STORE_META = 'autosaveMetadata';

/* Which design was last open, kept in two places on purpose.

   The record in IndexedDB is the authority: it is written in the same
   transaction as the design itself, so it is exactly as durable.
   The copy in localStorage is a hint that can be read synchronously
   before the first paint, which saves a round trip through IndexedDB
   on the common path. Where they disagree, the database wins. */
const ACTIVE_KEY = 'wrappedstudio.hamper.active.v1';
const ACTIVE_META_KEY = 'activeDesignId';

export class StorageUnavailableError extends Error {
  constructor(reason, cause) {
    super(reason);
    this.name = 'StorageUnavailableError';
    this.reason = reason;
    this.cause = cause;
  }
}

let dbPromise = null;

/* Why opening failed, once we know, so the UI can be specific rather
   than saying "something went wrong". */
let unavailableReason = null;

export const storageUnavailableReason = () => unavailableReason;

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    const designs = db.createObjectStore(STORE_DESIGNS, { keyPath: 'id' });
    /* The saved list is shown newest first, and recovery wants the
       most recently touched record without reading them all. */
    designs.createIndex('updatedAt', 'updatedAt');

    const assets = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
    assets.createIndex('createdAt', 'createdAt');

    db.createObjectStore(STORE_META, { keyPath: 'key' });
  }
  /* A version 2 would add its own branch here. Existing stores are
     never dropped: a migration that cannot keep the designs is not
     one worth shipping. */
}

export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      unavailableReason = 'blocked';
      reject(new StorageUnavailableError('blocked'));
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      /* Firefox in a private window throws here rather than failing
         the request. */
      unavailableReason = 'private';
      reject(new StorageUnavailableError('private', err));
      return;
    }

    /* Safari has shipped builds where open() never settles. Without a
       deadline the studio would sit on its loading state forever. */
    const deadline = setTimeout(() => {
      unavailableReason = 'timeout';
      reject(new StorageUnavailableError('timeout'));
    }, 8000);

    request.onupgradeneeded = (event) => {
      try {
        upgrade(request.result, event.oldVersion);
      } catch (err) {
        clearTimeout(deadline);
        unavailableReason = 'upgrade-failed';
        reject(new StorageUnavailableError('upgrade-failed', err));
      }
    };

    request.onsuccess = () => {
      clearTimeout(deadline);
      const db = request.result;
      /* Another tab has asked for a version we do not know. Closing
         lets it through instead of deadlocking it. */
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      clearTimeout(deadline);
      unavailableReason = 'blocked';
      reject(new StorageUnavailableError('blocked', request.error));
    };

    request.onblocked = () => {
      clearTimeout(deadline);
      unavailableReason = 'blocked-by-other-tab';
      reject(new StorageUnavailableError('blocked-by-other-tab'));
    };
  });

  /* A failed open must not be cached as a permanent verdict: the user
     may grant storage, or close the tab that was holding the old
     version, and the next attempt should try again for real. */
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

/* Runs `work` in one transaction and resolves when the transaction
   has *completed* — not when the last request succeeded. The
   difference is the whole point: a request can succeed and the
   transaction still abort on quota, and reporting "Saved" in between
   would be a lie. */
async function tx(stores, mode, work) {
  const db = await openDb();
  const transaction = db.transaction(stores, mode);

  const completed = new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('the save was rolled back'));
    transaction.onerror = () => reject(transaction.error || new Error('the save failed'));
  });

  /* A promise handed back by an IndexedDB event keeps the transaction
     alive across the await, because it settles in a microtask before
     the browser gets a chance to auto-commit. Awaiting anything else
     in here — a fetch, a timer — would commit the transaction early,
     so `work` only ever awaits requests from this transaction. */
  let value;
  try {
    value = await work(stores.length === 1 ? transaction.objectStore(stores[0]) : transaction, transaction);
  } catch (err) {
    try {
      transaction.abort();
    } catch {
      /* already gone */
    }
    throw err;
  }

  /* The write is only true once the transaction has committed, not
     when the last request reported success. */
  await completed;
  return value;
}

const ask = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/* --------------------------------------------------------- designs */

export function putDesign(design) {
  return tx([STORE_DESIGNS], 'readwrite', (store) => {
    store.put(design);
    return design.id;
  });
}

/* Saves the design and records it as the one being worked on, in one
   transaction.

   The pointer has to be as durable as the design it points at, and
   localStorage is not: a browser killed rather than closed can lose
   recent localStorage writes while committed IndexedDB transactions
   survive. That really happens — a crash, a phone reclaiming memory,
   a force quit — and the result is reopening the wrong hamper, which
   looks exactly like losing work. Writing both here means the pointer
   can never be older than the design or disagree with it. */
export function putDesignAsActive(design) {
  return tx([STORE_DESIGNS, STORE_META], 'readwrite', (transaction) => {
    transaction.objectStore(STORE_DESIGNS).put(design);
    transaction.objectStore(STORE_META).put({
      key: ACTIVE_META_KEY,
      value: design.id,
      at: Date.now(),
      revision: design.revision
    });
    return design.id;
  });
}

export function getDesign(id) {
  return tx([STORE_DESIGNS], 'readonly', (store) => ask(store.get(id)));
}

/* Newest first. The records are small; the blobs live elsewhere. */
export function listDesigns() {
  return tx([STORE_DESIGNS], 'readonly', (store) =>
    ask(store.index('updatedAt').getAll()).then((rows) => rows.reverse())
  );
}

/* Deletes the design and any asset no other design is still using.
   One transaction over both stores, so a half-deleted design can
   never leave an orphan behind. */
export function deleteDesign(id) {
  return tx([STORE_DESIGNS, STORE_ASSETS], 'readwrite', async (transaction) => {
    const designs = transaction.objectStore(STORE_DESIGNS);
    const assets = transaction.objectStore(STORE_ASSETS);

    const going = await ask(designs.get(id));
    if (!going) return { deleted: false, assetsRemoved: 0 };

    const mine = new Set((going.gifts || []).map((g) => g.assetId).filter(Boolean));
    designs.delete(id);

    if (!mine.size) return { deleted: true, assetsRemoved: 0 };

    const rest = await ask(designs.getAll());
    const stillUsed = new Set();
    rest.forEach((d) => {
      if (d.id === id) return;
      (d.gifts || []).forEach((g) => {
        if (g.assetId) stillUsed.add(g.assetId);
      });
    });

    let removed = 0;
    mine.forEach((assetId) => {
      if (!stillUsed.has(assetId)) {
        assets.delete(assetId);
        removed += 1;
      }
    });

    return { deleted: true, assetsRemoved: removed };
  });
}

/* ---------------------------------------------------------- assets */

export function putAsset(asset) {
  return tx([STORE_ASSETS], 'readwrite', (store) => {
    store.put(asset);
    return asset.id;
  });
}

export function getAsset(id) {
  return tx([STORE_ASSETS], 'readonly', (store) => ask(store.get(id)));
}

export function getAssets(idList) {
  const wanted = [...new Set(idList.filter(Boolean))];
  if (!wanted.length) return Promise.resolve([]);
  return tx([STORE_ASSETS], 'readonly', (store) =>
    Promise.all(wanted.map((id) => ask(store.get(id)))).then((rows) => rows.filter(Boolean))
  );
}

/* Clears out assets nothing refers to any more — what is left behind
   when a photo is swapped, or when a save was interrupted between
   writing the asset and writing the design that was going to use it.
   Assets younger than `graceMs` are left alone, because an upload in
   progress has not been referenced yet. */
export function pruneOrphanAssets({ graceMs = 10 * 60 * 1000 } = {}) {
  return tx([STORE_DESIGNS, STORE_ASSETS], 'readwrite', async (transaction) => {
    const designs = await ask(transaction.objectStore(STORE_DESIGNS).getAll());
    const assets = transaction.objectStore(STORE_ASSETS);

    const used = new Set();
    designs.forEach((d) => {
      (d.gifts || []).forEach((g) => {
        if (g.assetId) used.add(g.assetId);
      });
      if (d.orderedAs?.previewAssetId) used.add(d.orderedAs.previewAssetId);
    });

    const all = await ask(assets.getAll());
    const cutoff = Date.now() - graceMs;
    let removed = 0;
    let bytes = 0;

    all.forEach((asset) => {
      if (used.has(asset.id)) return;
      if (Number(asset.createdAt) > cutoff) return;
      assets.delete(asset.id);
      removed += 1;
      bytes += Number(asset.bytes) || 0;
    });

    return { removed, bytes };
  });
}

/* ------------------------------------------------- autosave record */

export function putMeta(key, value) {
  return tx([STORE_META], 'readwrite', (store) => {
    store.put({ key, value, at: Date.now() });
    return key;
  });
}

export function getMeta(key) {
  return tx([STORE_META], 'readonly', (store) => ask(store.get(key)).then((row) => row?.value ?? null));
}

/* ------------------------------------------- the last design open */

export function rememberActiveDesign(id) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* No localStorage. The design is still in IndexedDB and the
       most recently updated one is picked up instead. */
  }
}

export function activeDesignId() {
  try {
    return window.localStorage.getItem(ACTIVE_KEY) || null;
  } catch {
    return null;
  }
}

/* The durable answer to the same question. */
export function storedActiveDesignId() {
  return getMeta(ACTIVE_META_KEY);
}

/* ------------------------------------------------ storage estimate */

export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (!Number.isFinite(usage) || !Number.isFinite(quota) || !quota) return null;
    return { usage, quota, percent: Math.min(100, (usage / quota) * 100) };
  } catch {
    return null;
  }
}

/* Asks the browser to keep this site's storage even when space runs
   short. Chrome grants it silently for a site somebody uses, Safari
   does not implement it, and Firefox may prompt. It is asked for once
   and never relied on. */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return { supported: false, granted: false };
    if (await navigator.storage.persisted()) return { supported: true, granted: true };
    return { supported: true, granted: await navigator.storage.persist() };
  } catch {
    return { supported: false, granted: false };
  }
}

export function isQuotaError(err) {
  if (!err) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|storage is full|exceeded/i.test(String(err.message || ''))
  );
}

/* Everything this browser holds for the studio. Offered to the
   customer explicitly — never run on logout, and never run because a
   session ended. */
export function deleteEverything() {
  return tx([STORE_DESIGNS, STORE_ASSETS, STORE_META], 'readwrite', (transaction) => {
    transaction.objectStore(STORE_DESIGNS).clear();
    transaction.objectStore(STORE_ASSETS).clear();
    transaction.objectStore(STORE_META).clear();
    rememberActiveDesign(null);
    return true;
  });
}
