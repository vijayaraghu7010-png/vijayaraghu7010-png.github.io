import { callFunction } from './supabaseClient';

/* Placing an order, and getting the photographs there.

   The shape of this deliberately matches src/lib/adminClient.js: a few
   named functions over one transport, so that the pages calling it do
   not have to know there is a network.

   The photographs are never touched on their way out. They are sent
   exactly as the customer chose them, byte for byte, because they are
   going to be printed. src/lib/imageCompress.js is for the shop's own
   pictures and must never be used here.                             */

/* Three at once. Enough to keep a connection busy, few enough that a
   phone on mobile data is not trying to push a hundred megabytes
   through at the same moment. */
const AT_ONCE = 3;
const TRIES = 3;

export async function createOrder({ customer, items, notes }) {
  return await callFunction('orders-create', {
    customer,
    notes,
    /* Only what the customer chose. No prices: the server works those
       out itself, and sending them would only be a suggestion it
       ignores. */
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      config: item.config || {}
    }))
  });
}

export async function requestUploadUrls({ orderId, token, photos }) {
  const { uploads } = await callFunction('uploads-presign', {
    order_id: orderId,
    token,
    photos
  });
  return uploads;
}

export async function confirmUploads({ orderId, token }) {
  return await callFunction('uploads-complete', { order_id: orderId, token });
}

/* One file to one URL, with a few goes at it.

   A failed upload is ordinary - a tunnel, a lift, a lock screen - so
   it is retried rather than reported, and only a file that will not
   go after three attempts is handed back as a failure. */
async function putOne(url, file, onProgress) {
  let lastError = null;

  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type);

        /* XMLHttpRequest rather than fetch for one reason: it can say
           how far along it is, and a customer sending eighty
           photographs deserves to see that something is happening. */
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        };

        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error('The connection dropped'));
        xhr.ontimeout = () => reject(new Error('That took too long'));
        xhr.timeout = 180000;
        xhr.send(file);
      });

      onProgress?.(1);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < TRIES) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError || new Error('That photograph would not upload');
}

/* Sends every file and reports which ones did not make it.

   `files` is a list of { file, orderItemId }. The upload slots come
   back in the order they were asked for, so each one is matched to its
   file by position. */
export async function uploadPhotos({ orderId, token, files, onProgress }) {
  if (!files.length) return { uploaded: 0, failed: [] };

  const uploads = await requestUploadUrls({
    orderId,
    token,
    photos: files.map(({ file, orderItemId }) => ({
      order_item_id: orderItemId,
      filename: file.name,
      content_type: file.type,
      byte_size: file.size
    }))
  });

  const done = new Array(files.length).fill(0);
  const failed = [];

  const report = () => {
    const total = done.reduce((a, b) => a + b, 0);
    onProgress?.(total / files.length);
  };

  let next = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      try {
        await putOne(uploads[i].url, files[i].file, (fraction) => {
          done[i] = fraction;
          report();
        });
      } catch (err) {
        done[i] = 1;
        failed.push({ name: files[i].file.name, reason: err.message });
        report();
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(AT_ONCE, files.length) }, worker));

  /* The server checks the bucket itself before any of this counts. */
  const confirmed = await confirmUploads({ orderId, token });

  return { uploaded: confirmed.uploaded, failed, confirmed };
}

// ----------------------------------------------------------- the panel

export async function listOrders(params = {}) {
  return await callFunction('admin-orders', params, { asAdmin: true });
}

export async function getOrder(orderId) {
  return await callFunction('admin-orders', { order_id: orderId }, { asAdmin: true });
}

export async function setOrderStatus(orderId, status) {
  return await callFunction('order-status', { order_id: orderId, status }, { asAdmin: true });
}

/* Irreversible. The panel asks for the order's code to be typed before
   this is called, and the server asks for it again. */
export async function deleteOrderPhotos(orderId, confirmCode) {
  return await callFunction(
    'photos-delete',
    { order_id: orderId, confirm_code: confirmCode },
    { asAdmin: true }
  );
}
