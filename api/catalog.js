// GET  /api/catalog  Public: the owner's real listings and shop settings (contact, hide samples).
// POST /api/catalog  Owner only (x-owner-key): {action: 'save'|'delete'|'sold'|'settings', ...}
import { get, put } from '@vercel/blob';
import { readJson, isOwner, send } from './_lib.js';

const PATH = 'catalog/catalog.json';
const DEPTS = ['men', 'women', 'kids', 'acc', 'watch'];
const CATS = ['kicks', 'wear', 'acc', 'watch'];
const CONDS = ['DS', 'NWT', 'VNDS', '9/10', '8/10', '7/10'];

async function readCatalog() {
  try {
    const r = await get(PATH, { access: 'private', useCache: false });
    if (r) {
      const c = JSON.parse(await new Response(r.stream).text());
      return { items: Array.isArray(c.items) ? c.items : [], settings: c.settings || {}, seq: c.seq || 0 };
    }
  } catch { /* first run: no catalog yet */ }
  return { items: [], settings: {}, seq: 0 };
}
const writeCatalog = c => put(PATH, JSON.stringify(c), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const money = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 100000 ? n : 0; };

function cleanItem(raw, old, seq) {
  const it = {
    id: old ? old.id : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    sku: old ? old.sku : 'BZ-' + String(1000 + seq).slice(-4),
    brand: str(raw.brand, 40),
    name: str(raw.name, 80),
    dept: DEPTS.includes(raw.dept) ? raw.dept : 'men',
    cat: CATS.includes(raw.cat) ? raw.cat : 'wear',
    cond: CONDS.includes(raw.cond) ? raw.cond : 'DS',
    sizes: String(raw.sizes || '').split(',').map(s => s.trim().slice(0, 16)).filter(Boolean).slice(0, 12),
    price: money(raw.price),
    was: money(raw.was) || undefined,
    outlet: !!raw.outlet,
    box: !!raw.box,
    note: str(raw.note, 300),
    img: /^\/api\/img\?k=[a-z0-9]{8,40}\.(webp|jpg)$/.test(String(raw.img || '')) ? raw.img : (old && old.img) || '',
    sold: old ? !!old.sold : false,
    at: old ? old.at : new Date().toISOString()
  };
  if (!it.sizes.length) it.sizes = ['One size'];
  if (it.was && it.was <= it.price) it.was = undefined;
  return it;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const c = await readCatalog();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
      return res.end(JSON.stringify({ items: c.items, settings: c.settings }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST' });
    if (!isOwner(req)) return send(res, 401, { error: 'Wrong passcode' });
    const body = await readJson(req);
    const c = await readCatalog();
    if (body.action === 'save') {
      const raw = body.item || {};
      const old = raw.id ? c.items.find(x => x.id === raw.id) : null;
      if (raw.id && !old) return send(res, 404, { error: 'Not found' });
      if (!old) c.seq += 1;
      const it = cleanItem(raw, old, c.seq);
      if (!it.brand || !it.name || !it.price) return send(res, 400, { error: 'برند، اسم و قیمت لازمه.' });
      if (old) c.items[c.items.indexOf(old)] = it; else c.items.unshift(it);
      if (c.items.length > 500) return send(res, 400, { error: 'Too many items' });
    } else if (body.action === 'delete') {
      c.items = c.items.filter(x => x.id !== body.id);
    } else if (body.action === 'sold') {
      const it = c.items.find(x => x.id === body.id);
      if (!it) return send(res, 404, { error: 'Not found' });
      it.sold = !!body.sold;
    } else if (body.action === 'settings') {
      const s = body.settings || {};
      const ig = str(s.ig, 31).replace(/[^@\w.]/g, '');
      const email = str(s.email, 80);
      c.settings = {
        ig: ig ? '@' + ig.replace(/^@+/, '') : '',
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
        hideSamples: !!s.hideSamples,
        drawOpen: !!s.drawOpen,
        bidOpen: !!s.bidOpen
      };
    } else return send(res, 400, { error: 'Unknown action' });
    await writeCatalog(c);
    return send(res, 200, { ok: true, items: c.items, settings: c.settings });
  } catch (e) {
    console.error('catalog failed', e);
    return send(res, e.status || 500, { error: e.status ? e.message : 'Catalog error' });
  }
}
