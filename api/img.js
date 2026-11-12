// GET /api/img?k=<name>  Serves a listing photo from the private Blob store. Names never change, so the edge caches them for a year.
import { get } from '@vercel/blob';

export default async function handler(req, res) {
  const k = String(new URL(req.url, 'http://x').searchParams.get('k') || '');
  if (!/^[a-z0-9]{8,40}\.(webp|jpg)$/.test(k)) { res.statusCode = 400; return res.end('Bad image name'); }
  try {
    const r = await get('catalog/img/' + k, { access: 'private' });
    if (!r) { res.statusCode = 404; return res.end('Not found'); }
    const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', k.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.end(buf);
  } catch (e) {
    console.error('img failed', e);
    res.statusCode = 500; return res.end('Image error');
  }
}
