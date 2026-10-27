/* ===========================================================
   One compressor, for every picture that enters the site.

   Anything added from here on goes through this: a product photo
   picked in the admin panel, a hero banner, a customer's photograph
   on its way into the hamper studio. The shop was shipped with a
   2 MB PNG hero and three half-megabyte heading images, and the page
   could not paint until they had been decoded. This is the thing that
   stops that happening again.

   It is deliberately not a build step. A build step cannot help a
   picture chosen in the admin panel after the site is live, which is
   where most of them now come from. Files added to public/images by
   hand are the one case this cannot see, and `npm run images` covers
   those.
   =========================================================== */

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
];

/* How large a file is allowed to arrive. Past this it is not worth
   decoding on a phone - the browser would rather throw the tab away. */
export const MAX_UPLOAD_MB = 12;

export function uploadProblem(file, { maxMb = MAX_UPLOAD_MB } = {}) {
  if (!file) return 'No file was given.';
  const typeOk =
    ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name || '');
  if (!typeOk) return `${file.name || 'That file'} is not a JPG, PNG, WEBP, AVIF or HEIC image.`;
  if (!file.size) return `${file.name || 'That file'} is empty.`;
  if (file.size > maxMb * 1024 * 1024) {
    return `${file.name || 'That file'} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxMb} MB.`;
  }
  return null;
}

/* Decodes to a bitmap with the camera's orientation already applied.
   `imageOrientation: 'from-image'` is the only way to get an upright
   portrait photo without parsing EXIF by hand; where it is not
   supported the image element path is used, which applies orientation
   itself in every current browser. */
export async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return { bitmap: await createImageBitmap(file, { imageOrientation: 'from-image' }), release: true };
    } catch {
      /* HEIC on a browser that cannot decode it, or a malformed file.
         The <img> path is tried before giving up. */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode-failed'));
      el.src = url;
    });
    if (!img.naturalWidth) throw new Error('decode-failed');
    return { bitmap: img, release: false, revoke: url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export function fit(width, height, max) {
  if (width <= max && height <= max) return [width, height];
  const scale = max / Math.max(width, height);
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function toBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode-failed'))), type, quality);
  });
}

function canvasOf(width, height) {
  return typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
}

/* Draws a bitmap down to `maxEdge` and encodes it.

   `background` paints behind the image before drawing: a photograph
   behind a white mount reads better than one behind transparency when
   it lands on a frame or a print. Pass null to keep the alpha channel,
   which is what a logo or a cut-out heading wants - and which is why
   that case encodes to WEBP rather than JPEG, since JPEG has no alpha
   and would flatten it to black. */
export async function render(bitmap, { maxEdge, quality, type, background = '#ffffff' } = {}) {
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const [width, height] = fit(sourceWidth, sourceHeight, maxEdge);

  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await toBlob(canvas, type, quality);
  return { blob, width, height };
}

/* ---------------------------------------------------------------- */

/* Squeezes a picked file until it is both small enough on screen and
   small enough on disk.

   The loop is the point. One pass at a fixed quality cannot promise a
   byte budget, because how well a photograph compresses depends on the
   photograph - a flat studio shot and a crowd scene at the same size
   and quality can differ fourfold. So it re-encodes at a lower
   quality, then at a smaller size, and stops at the first attempt that
   fits. A picture already under budget still gets resized if it is
   enormous on screen, and is otherwise left as it is.

   `budgetBytes` of 0 means "no byte budget": resize and encode once.

   Resolves { blob, width, height, type, attempts, from, to }. */
export async function compressFile(file, options = {}) {
  const {
    maxEdge = 1600,
    budgetBytes = 0,
    quality = 0.85,
    /* a picture with transparency has to stay WEBP; JPEG has no alpha */
    type = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
    background = type === 'image/jpeg' ? '#ffffff' : null,
    maxMb = MAX_UPLOAD_MB
  } = options;

  const problem = uploadProblem(file, { maxMb });
  if (problem) {
    const err = new Error(problem);
    err.reason = 'rejected';
    throw err;
  }

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    const err = new Error(
      `${file.name || 'That image'} could not be opened. If it came from an iPhone, try saving it as a JPG first.`
    );
    err.reason = 'decode';
    throw err;
  }

  const { bitmap, release, revoke } = decoded;

  try {
    /* quality first, then size: dropping quality costs less of what a
       customer can see than throwing pixels away does */
    const ladder = [
      { maxEdge, quality },
      { maxEdge, quality: Math.max(0.6, quality - 0.14) },
      { maxEdge: Math.round(maxEdge * 0.75), quality: Math.max(0.6, quality - 0.14) },
      { maxEdge: Math.round(maxEdge * 0.55), quality: 0.72 },
      { maxEdge: Math.round(maxEdge * 0.4), quality: 0.68 }
    ];

    let best = null;
    let attempts = 0;

    for (const step of ladder) {
      attempts += 1;
      let out;
      try {
        out = await render(bitmap, { ...step, type, background });
      } catch {
        const err = new Error(`${file.name || 'That image'} could not be prepared.`);
        err.reason = 'encode';
        throw err;
      }

      /* keep the smallest seen, so a failure to reach the budget still
         returns the best effort rather than the first attempt */
      if (!best || out.blob.size < best.blob.size) best = out;
      if (!budgetBytes || out.blob.size <= budgetBytes) break;
    }

    return {
      ...best,
      type: best.blob.type || type,
      attempts,
      from: file.size,
      to: best.blob.size
    };
  } finally {
    if (release && bitmap.close) bitmap.close();
    if (revoke) URL.revokeObjectURL(revoke);
  }
}

/* A data URL is base64, so it is about a third larger than the blob it
   came from. Anything budgeting for localStorage has to count that. */
export const DATA_URL_OVERHEAD = 4 / 3;

export function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
