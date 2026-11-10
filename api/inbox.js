// Owner inbox. GET lists every submission; PATCH {pathname, status, note} updates one. Header x-owner-key required.
import { list, get, put } from '@vercel/blob';
import { STATUSES, readJson, isOwner, send } from './_lib.js';

async function readBlob(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export default async function handler(req, res) {
  if (!isOwner(req)) return send(res, 401, { error: 'Wrong passcode' });
  try {
    if (req.method === 'GET') {
      const blobs = [];
      let cursor;
      do {
        const page = await list({ prefix: 'subs/', cursor, limit: 1000 });
        blobs.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor && blobs.length < 3000);
      blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
      const items = [];
      for (let i = 0; i < blobs.length; i += 20) {
        const chunk = await Promise.all(blobs.slice(i, i + 20).map(async b => {
          try { const rec = await readBlob(b.pathname); return rec && { ...rec, pathname: b.pathname }; } catch { return null; }
        }));
        items.push(...chunk.filter(Boolean));
      }
      return send(res, 200, { items });
    }
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const pathname = String(body.pathname || '');
      if (!/^subs\/(order|draw|bid|sell)\/[\w.-]+\.json$/.test(pathname)) return send(res, 400, { error: 'Bad pathname' });
      const rec = await readBlob(pathname);
      if (!rec) return send(res, 404, { error: 'Not found' });
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return send(res, 400, { error: 'Bad status' });
        rec.status = body.status;
      }
      if (body.note !== undefined) rec.note = String(body.note).slice(0, 1000);
      rec.updatedAt = new Date().toISOString();
      await put(pathname, JSON.stringify(rec), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'GET or PATCH' });
  } catch (e) {
    console.error('inbox failed', e);
    return send(res, 500, { error: 'Inbox error' });
  }
}
