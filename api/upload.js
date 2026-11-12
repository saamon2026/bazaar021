// POST /api/upload  Owner only. {data: 'data:image/webp;base64,...'} -> {src: '/api/img?k=...'}
// The page shrinks photos before sending, so they stay well under the 4.5 MB function limit.
import { put } from '@vercel/blob';
import { readJson, isOwner, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!isOwner(req)) return send(res, 401, { error: 'Wrong passcode' });
  try {
    const body = await readJson(req, 4_000_000);
    const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
    if (!m) return send(res, 400, { error: 'Send a WebP or JPEG image' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 2_500_000) return send(res, 413, { error: 'Image too large' });
    const ext = m[1] === 'webp' ? 'webp' : 'jpg';
    const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + '.' + ext;
    await put('catalog/img/' + name, buf, { access: 'private', contentType: 'image/' + m[1], addRandomSuffix: false });
    return send(res, 200, { ok: true, src: '/api/img?k=' + name });
  } catch (e) {
    console.error('upload failed', e);
    return send(res, e.status || 500, { error: e.status ? e.message : 'Upload failed' });
  }
}
