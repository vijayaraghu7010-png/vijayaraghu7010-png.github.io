/* Where a customer's photographs wait.

   A customiser hands the basket a line - a border, a count, a size -
   but the photographs themselves are File objects, and those do not
   survive being written to localStorage or reloaded with the page.
   Until now they did not have to: nothing was sent anywhere. Now the
   order carries them, and the journey from "add to bag" to "place the
   order" can include a reload, a closed tab and a night's sleep.

   So they are kept here, in IndexedDB, keyed by the basket line they
   belong to. A File goes in and a File comes out, byte for byte: the
   studio prints these, and anything that re-encoded them on the way
   past would be throwing away what the customer paid for.

   Everything is written so that storage being unavailable - a private
   window, blocked site data, a full disk - leaves the shop usable.
   The checkout notices the photographs are missing and says so, which
   is better than a silent order of blank prints.                   */

const DB_NAME = 'wrappedstudio-photos';
const DB_VERSION = 1;
const STORE = 'linePhotos';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser will not store your photographs'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Storage is not available'));
  });
}

async function withStore(mode, work) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = work(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => resolve(result?.value ?? result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const wrap = (request) => {
  const box = { value: undefined };
  request.onsuccess = () => {
    box.value = request.result;
  };
  return box;
};

/* Keeps the photographs for one basket line, replacing whatever was
   there. Returns false rather than throwing when storage refuses:
   the customiser has already added the line, and losing the basket
   over this would be the worse failure. */
export async function putLinePhotos(lineKey, files) {
  try {
    await withStore('readwrite', (store) => store.put([...files], lineKey));
    return true;
  } catch {
    return false;
  }
}

export async function getLinePhotos(lineKey) {
  try {
    const files = await withStore('readonly', (store) => wrap(store.get(lineKey)));
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

export async function removeLinePhotos(lineKey) {
  try {
    await withStore('readwrite', (store) => store.delete(lineKey));
    return true;
  } catch {
    return false;
  }
}

/* After an order has gone, the copies here are of no further use: the
   originals are in the studio's own storage. Keeping them would leave
   a stranger's photographs on a shared computer. */
export async function clearAllPhotos() {
  try {
    await withStore('readwrite', (store) => store.clear());
    return true;
  } catch {
    return false;
  }
}
