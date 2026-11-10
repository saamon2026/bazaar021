// Shared helpers for the Bazaar 021 API. Submissions are stored as private JSON blobs.
import { timingSafeEqual } from 'node:crypto';

export const TYPES = ['order', 'draw', 'bid', 'sell'];
export const STATUSES = ['new', 'contacted', 'paid', 'done', 'cancelled'];

export async function readJson(req, limit = 20000) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
  }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

// Keep only plain strings, numbers, booleans, and small arrays/objects of them.
export function clean(v, depth = 0) {
  if (depth > 4) return null;
  if (typeof v === 'string') return v.trim().slice(0, 600);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.slice(0, 40).map(x => clean(x, depth + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 40)) o[String(k).slice(0, 40)] = clean(v[k], depth + 1);
    return o;
  }
  return null;
}

export function isOwner(req) {
  const want = process.env.OWNER_KEY || '';
  const got = String(req.headers['x-owner-key'] || '');
  if (want.length < 12 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
