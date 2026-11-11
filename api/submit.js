// POST /api/submit  {type: 'order'|'draw'|'bid'|'sell', ref, data, website, t}
import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { TYPES, readJson, clean, send } from './_lib.js';
import { readBoard, writeBoard, placeBid } from './_auction.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAW_ANSWER = '37'; // (9 × 4) + 18 ÷ 3 − 5, same question as the draw form

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const body = await readJson(req);
    const type = String(body.type || '');
    if (!TYPES.includes(type)) return send(res, 400, { error: 'Unknown type' });
    // bots fill the hidden "website" field or post the instant the page opens; people do neither
    if (body.website || (Number.isFinite(body.t) && body.t < 1500)) return send(res, 200, { ok: true, ref: 'OK' });
    const data = clean(body.data || {});
    const contact = String(data.email || data.contact || '').trim();
    if (!contact) return send(res, 400, { error: 'Add an email so we can reach you.' });
    if (type !== 'sell' && !EMAIL.test(contact)) return send(res, 400, { error: 'That email doesn’t look right.' });

    const now = new Date();
    const ref = String(body.ref || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 24) || Math.random().toString(36).slice(2, 10).toUpperCase();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    let path = `subs/${type}/${stamp}_${ref}.json`, overwrite = false, extra = {};

    if (type === 'draw') {
      if (String(data.skill || '').trim() !== DRAW_ANSWER) return send(res, 400, { error: 'That answer to the skill-testing question isn’t right.' });
      if (!data.name || !data.size || !data.prov) return send(res, 400, { error: 'Fill in every field to enter.' });
      // one entry per email per draw: entering again replaces the earlier entry
      const who = createHash('sha256').update(contact.toLowerCase()).digest('hex').slice(0, 16);
      path = `subs/draw/D${String(data.draw || '').replace(/\W/g, '')}_${who}.json`;
      overwrite = true;
    }
    if (type === 'order' && !(Array.isArray(data.items) && data.items.length)) return send(res, 400, { error: 'Your bag is empty.' });
    if (type === 'bid') {
      const board = await readBoard(now.getTime());
      const r = placeBid(board, String(data.lotId || ''), Number(data.amount), now.getTime());
      if (r.error) return send(res, r.status, { error: r.error, lot: r.lot || null });
      await writeBoard(board);
      extra = { lot: r.lot };
    }

    const record = { type, ref, status: 'new', note: '', at: now.toISOString(), data, ua: String(req.headers['user-agent'] || '').slice(0, 200) };
    await put(path, JSON.stringify(record), { access: 'private', contentType: 'application/json', addRandomSuffix: !overwrite, allowOverwrite: overwrite });
    return send(res, 200, { ok: true, ref, ...extra });
  } catch (e) {
    console.error('submit failed', e);
    return send(res, e.status || 500, { error: e.status ? e.message : 'Could not save. Try again in a minute.' });
  }
}
