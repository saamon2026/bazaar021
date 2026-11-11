// Auction rules shared by /api/submit (bids) and /api/bids. Keep LOTS in step with LOTS in public/index.html.
import { get, put } from '@vercel/blob';

export const LOTS = {
  L001: { open: 250, mins: 0 },
  L002: { open: 180, mins: 10 },
  L003: { open: 320, mins: 20 },
  L004: { open: 60, mins: 30 }
};
export const inc = a => (a < 100 ? 5 : a < 500 ? 10 : 25);
const SOFT = 2 * 60000;      // a bid in the last 2 minutes adds 2 minutes
const GRACE = 6 * 3600000;   // a closed auction stays on show for 6 hours before the next week opens

// Sunday 9:00 p.m. Toronto time, same maths as the storefront.
const TZ = 'America/Toronto';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fParts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
function parts(t) { const o = {}; for (const p of fParts.formatToParts(new Date(t))) o[p.type] = p.value; return o; }
function wall(y, mo, d, h, mi) {
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let t = want;
  for (let i = 0; i < 3; i++) { const p = parts(t); t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
  return t;
}
export function auctionClose(now = Date.now()) {
  const from = now - GRACE, p = parts(from);
  const add = (0 - DOW.indexOf(p.weekday) + 7) % 7;
  let t = wall(+p.year, +p.month, +p.day + add, 21, 0);
  if (t <= from) t = wall(+p.year, +p.month, +p.day + add + 7, 21, 0);
  return t;
}

const PATH = 'state/bids.json';
export async function readBoard(now = Date.now()) {
  const week = auctionClose(now);
  let board = null;
  try {
    const r = await get(PATH, { access: 'private', useCache: false });
    if (r) board = JSON.parse(await new Response(r.stream).text());
  } catch { board = null; }
  if (!board || board.week !== week || !board.lots) board = { week, lots: {} };
  for (const [id, l] of Object.entries(LOTS)) {
    const cur = board.lots[id] || {};
    board.lots[id] = { top: cur.top || 0, n: cur.n || 0, end: cur.end || week + l.mins * 60000 };
  }
  return board;
}
export const writeBoard = board => put(PATH, JSON.stringify(board), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

// Checks a bid against the board and, if it stands, updates that lot in place.
export function placeBid(board, lotId, amount, now = Date.now()) {
  const def = LOTS[lotId];
  if (!def) return { error: 'Unknown lot.', status: 400 };
  const lot = board.lots[lotId];
  if (now >= lot.end) return { error: 'This lot has closed.', status: 409, lot };
  const min = lot.top ? lot.top + inc(lot.top) : def.open;
  if (!Number.isFinite(amount) || amount < min) return { error: `${lot.top ? 'Someone bid first. ' : ''}Enter $${min} or more.`, status: 409, lot };
  if (amount > 100000) return { error: 'Bids over $100,000 are taken by phone.', status: 400 };
  lot.top = Math.round(amount);
  lot.n += 1;
  if (lot.end - now < SOFT) lot.end = now + SOFT;
  return { lot };
}
