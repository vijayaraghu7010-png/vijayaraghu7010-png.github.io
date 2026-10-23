import { requireAdmin, audit } from '../_lib/auth.js';
import { serviceClient } from '../_lib/supabase.js';

/* POST /api/admin/upload?name=rose.jpg   (raw image bytes in the body)

   The deployed site has no writable disk, so a picture goes into a
   Supabase Storage bucket called "media" and the product stores the
   public URL of it. Create the bucket once, as a public bucket. */

export const config = { api: { bodyParser: false } };

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

const MAX_UPLOAD = 8 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media';

async function readBytes(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD) throw new Error('That file is larger than 8 MB');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handler(req, res, admin) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const type = String(req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
    const original = decodeURIComponent(req.query.name || 'image.jpg');
    const ext = TYPES[type] || (original.split('.').pop() || '').toLowerCase();
    if (!Object.values(TYPES).includes(ext)) {
      return res.status(400).json({ error: 'Only image files can be uploaded' });
    }

    const bytes = await readBytes(req);
    if (!bytes.length) return res.status(400).json({ error: 'No file was received' });

    const base =
      (original.replace(/\.[^.]+$/, '') || 'image')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'image';
    const path = `products/${base}-${Date.now().toString(36)}.${ext}`;

    const db = serviceClient();
    const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
      contentType: type,
      upsert: false
    });

    if (error) {
      const hint = /bucket/i.test(error.message)
        ? ` — create a public bucket called "${BUCKET}" in Supabase Storage`
        : '';
      return res.status(400).json({ error: error.message + hint });
    }

    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    await audit(admin, 'upload', 'media', path, { bytes: bytes.length });
    return res.status(201).json({ url: data.publicUrl });
  } catch (err) {
    return res.status(400).json({ error: String(err.message || err) });
  }
}

export default requireAdmin(handler);
