// @ts-check
/**
 * What the contact service does with a request (documentation/contact/spec.md §4.2), with what it remembers
 * and how it sends passed in, so the whole path is tested without Azure (tests/unit/contact.test.ts). The
 * checks run in the spec's order; each answer is the spec's.
 */
import { createHash } from 'node:crypto';
import { checkFields, cleanFields, LIMITS } from './rules.mjs';
import { issue, verify } from './challenge.mjs';

/** A visitor's messages an hour, and the whole site's a day. */
export const HOURLY = 5;
export const DAILY = 50;
/** The largest request body read. */
export const MAX_BYTES = 16 * 1024;

const KEYS = new Set(['name', 'email', 'message', 'website', 'elapsed', 'challenge', 'signature', 'nonce', 'about']);

/**
 * @typedef {{ status: number; body: Record<string, unknown> }} Answer
 * @typedef {{
 *   secret: string;
 *   origins: string[];
 *   claim: (id: string, expires: number) => Promise<boolean>;
 *   take: (key: string, limit: number) => Promise<boolean>;
 *   send: (m: { name: string; email: string; message: string; about?: string }) => Promise<void>;
 *   now?: () => number;
 *   log?: (msg: string) => void;
 * }} Deps
 */

/** A client's IP as the front end passes it (x-forwarded-for: its first address, without a port). */
export function clientIp(/** @type {string | null} */ forwarded) {
  const first = (forwarded ?? '').split(',')[0].trim();
  const v4 = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(first);
  if (v4) return v4[1];
  const v6 = /^\[([^\]]+)\](?::\d+)?$/.exec(first);
  return v6 ? v6[1] : first || 'unknown';
}

/** GET /api/contact/challenge */
export function challenge(/** @type {{ origin: string | null }} */ req, /** @type {Pick<Deps, 'secret' | 'origins' | 'now'>} */ d) {
  if (!d.origins.includes(req.origin ?? '')) return { status: 403, body: { error: 'origin' } };
  return { status: 200, body: issue(d.secret, d.now?.() ?? Date.now()) };
}

/**
 * POST /api/contact
 * @param {{ origin: string | null; contentType: string | null; forwarded: string | null; text: string }} req
 * @param {Deps} d
 * @returns {Promise<Answer>}
 */
export async function contact(req, d) {
  const now = d.now?.() ?? Date.now();
  const log = d.log ?? (() => {});
  // 1. the origin
  if (!d.origins.includes(req.origin ?? '')) return { status: 403, body: { error: 'origin' } };
  // 2. the size and shape
  if (!(req.contentType ?? '').toLowerCase().startsWith('application/json') || req.text.length > MAX_BYTES) return { status: 400, body: { error: 'shape' } };
  /** @type {Record<string, unknown>} */
  let body;
  try {
    body = JSON.parse(req.text);
  } catch {
    return { status: 400, body: { error: 'shape' } };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !KEYS.has(k))) return { status: 400, body: { error: 'shape' } };
  if (body.about !== undefined && (typeof body.about !== 'string' || body.about.length > LIMITS.about || /[\r\n]/.test(body.about))) return { status: 400, body: { error: 'shape' } };
  // 3. the challenge
  const v = verify(d.secret, { challenge: body.challenge, signature: body.signature, nonce: body.nonce }, now);
  if (!v.ok) {
    log(`refused: challenge (${v.why})`);
    return { status: 403, body: { error: 'challenge' } };
  }
  // 4 and 5. the honeypot and the time on the form: a bot is told it worked, and nothing is sent
  if ((typeof body.website === 'string' && body.website !== '') || body.website === undefined || typeof body.elapsed !== 'number' || body.elapsed < LIMITS.minElapsed) {
    log('dropped: honeypot or too fast');
    return { status: 202, body: { ok: true } };
  }
  // 6. the fields
  const f = cleanFields(body);
  const problems = checkFields(f);
  if (Object.keys(problems).length) return { status: 400, body: { error: 'invalid', fields: problems } };
  // 7. one use per challenge
  if (!(await d.claim(v.id, v.expires))) {
    log('refused: challenge used before');
    return { status: 403, body: { error: 'challenge' } };
  }
  // 8. the rates: a visitor's hour, then the day
  const iso = new Date(now).toISOString();
  const who = createHash('sha256').update(`${d.secret}|${clientIp(req.forwarded)}`).digest('hex').slice(0, 32);
  if (!(await d.take(`ip-${who}-${iso.slice(0, 13)}`, HOURLY))) return { status: 429, body: { error: 'rate' } };
  if (!(await d.take(`day-${iso.slice(0, 10)}`, DAILY))) return { status: 429, body: { error: 'daily' } };
  // 9. send
  try {
    await d.send({ ...f, ...(typeof body.about === 'string' ? { about: body.about.trim() } : {}) });
  } catch (e) {
    log(`send failed: ${e instanceof Error ? e.message : 'unknown'}`);
    return { status: 502, body: { error: 'send' } };
  }
  log('sent');
  return { status: 202, body: { ok: true } };
}
