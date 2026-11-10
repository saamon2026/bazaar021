// POST /api/submit  {type: 'order'|'draw'|'bid'|'sell', ref, data}
import { put } from '@vercel/blob';
import { TYPES, readJson, clean, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const body = await readJson(req);
    const type = String(body.type || '');
    if (!TYPES.includes(type)) return send(res, 400, { error: 'Unknown type' });
    if (body.website) return send(res, 200, { ok: true }); // honeypot field: bots fill it, people don't
    const data = clean(body.data || {});
    const email = String(data.email || data.contact || '').trim();
    if (!email) return send(res, 400, { error: 'Contact required' });
    const now = new Date();
    const ref = String(body.ref || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 24) || Math.random().toString(36).slice(2, 10).toUpperCase();
    const record = {
      type, ref, status: 'new', note: '',
      at: now.toISOString(),
      data,
      ua: String(req.headers['user-agent'] || '').slice(0, 200)
    };
    const path = `subs/${type}/${now.toISOString().replace(/[:.]/g, '-')}_${ref}.json`;
    await put(path, JSON.stringify(record), { access: 'private', contentType: 'application/json', addRandomSuffix: true });
    return send(res, 200, { ok: true, ref });
  } catch (e) {
    console.error('submit failed', e);
    return send(res, e.status || 500, { error: e.status ? e.message : 'Could not save. Try again or DM us on Instagram.' });
  }
}
