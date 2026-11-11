// GET /api/bids  Public: top bid, bid count and closing time for each lot. No names or emails.
import { readBoard } from './_auction.js';
import { send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  try {
    const board = await readBoard();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // a short edge cache keeps Blob reads low; a new bid returns the fresh lot straight to the bidder
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    return res.end(JSON.stringify({ week: board.week, now: Date.now(), lots: board.lots }));
  } catch (e) {
    console.error('bids failed', e);
    return send(res, 500, { error: 'Bids unavailable' });
  }
}
