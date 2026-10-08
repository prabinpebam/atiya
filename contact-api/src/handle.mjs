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

// ---------- access agreements (documentation/contact/spec.md §4.5; documentation/access/spec.md §7.6) ----------

/** A visitor's agreements an hour, and the whole site's a day: generous (a reader agrees once per access), but a flood stops. */
export const AGREE_HOURLY = 20;
export const AGREE_DAILY = 300;
export const AGREE_MAX_BYTES = 4 * 1024;

const AGREE_KEYS = new Set(['id', 'grant', 'via', 'version', 'statement', 'shown', 'digest', 'page', 'agreedAt']);
const line = (/** @type {unknown} */ v, /** @type {number} */ max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);

/**
 * The record a browser sends when its reader agrees, checked: every field there, of its shape and size. Null
 * if anything's off.
 * @param {unknown} body
 */
export function checkAgreement(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = /** @type {Record<string, unknown>} */ (body);
  if (Object.keys(b).some((k) => !AGREE_KEYS.has(k))) return null;
  const shown = /** @type {Record<string, unknown>} */ (b.shown);
  if (!shown || typeof shown !== 'object' || Array.isArray(shown) || Object.keys(shown).some((k) => k !== 'who' && k !== 'why')) return null;
  if (shown.who !== undefined && !line(shown.who, 250)) return null;
  if (shown.why !== undefined && !line(shown.why, 450)) return null;
  const ok =
    typeof b.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.id) &&
    typeof b.grant === 'string' && /^g[a-z2-7]{8}$/.test(b.grant) &&
    (b.via === 'code' || b.via === 'link') &&
    typeof b.version === 'string' && /^[\w.-]{1,20}$/.test(b.version) &&
    line(b.statement, 300) &&
    typeof b.digest === 'string' && /^[0-9a-f]{8}$/.test(b.digest) &&
    typeof b.page === 'string' && /^\/[^\s]{0,200}$/.test(b.page) &&
    typeof b.agreedAt === 'string' && b.agreedAt.length <= 40 && !Number.isNaN(Date.parse(b.agreedAt));
  if (!ok) return null;
  return {
    id: /** @type {string} */ (b.id),
    grant: /** @type {string} */ (b.grant),
    via: /** @type {'code' | 'link'} */ (b.via),
    version: /** @type {string} */ (b.version),
    statement: /** @type {string} */ (b.statement),
    who: /** @type {string | undefined} */ (shown.who),
    why: /** @type {string | undefined} */ (shown.why),
    digest: /** @type {string} */ (b.digest),
    page: /** @type {string} */ (b.page),
    agreedAt: /** @type {string} */ (b.agreedAt),
  };
}

/**
 * @typedef {NonNullable<ReturnType<typeof checkAgreement>> & { receivedAt: string; ip: string; userAgent: string }} AgreementRow
 * @typedef {{
 *   origins: string[];
 *   secret: string;
 *   take: (key: string, limit: number) => Promise<boolean>;
 *   keep: (row: AgreementRow) => Promise<{ created: boolean; notified: boolean; row: AgreementRow }>;
 *   notified: (row: AgreementRow) => Promise<void>;
 *   notify: (row: AgreementRow) => Promise<void>;
 *   now?: () => number;
 *   log?: (msg: string) => void;
 * }} AgreeDeps
 */

/**
 * POST /api/access/agreement: keeps the record (once, however often it's sent), then tells the owner by email
 * (once: a record whose email failed is emailed when it's sent again).
 * @param {{ origin: string | null; contentType: string | null; forwarded: string | null; userAgent: string | null; text: string }} req
 * @param {AgreeDeps} d
 * @returns {Promise<Answer>}
 */
export async function agreement(req, d) {
  const now = d.now?.() ?? Date.now();
  const log = d.log ?? (() => {});
  if (!d.origins.includes(req.origin ?? '')) return { status: 403, body: { error: 'origin' } };
  if (!(req.contentType ?? '').toLowerCase().startsWith('application/json') || req.text.length > AGREE_MAX_BYTES) return { status: 400, body: { error: 'shape' } };
  let parsed;
  try {
    parsed = JSON.parse(req.text);
  } catch {
    return { status: 400, body: { error: 'shape' } };
  }
  const a = checkAgreement(parsed);
  if (!a) return { status: 400, body: { error: 'shape' } };
  const iso = new Date(now).toISOString();
  const ip = clientIp(req.forwarded);
  const who = createHash('sha256').update(`${d.secret}|${ip}`).digest('hex').slice(0, 32);
  if (!(await d.take(`agree-ip-${who}-${iso.slice(0, 13)}`, AGREE_HOURLY))) return { status: 429, body: { error: 'rate' } };
  if (!(await d.take(`agree-day-${iso.slice(0, 10)}`, AGREE_DAILY))) return { status: 429, body: { error: 'daily' } };
  /** @type {AgreementRow} */
  const row = { ...a, receivedAt: iso, ip, userAgent: (req.userAgent ?? '').slice(0, 300) };
  const kept = await d.keep(row);
  if (kept.notified) {
    log('agreement: sent before');
    return { status: 200, body: { ok: true } };
  }
  try {
    // the record as first kept: a resend's time and address are the retry's, not the agreement's
    await d.notify(kept.row);
    await d.notified(kept.row);
  } catch (e) {
    log(`agreement: email failed (${e instanceof Error ? e.message : 'unknown'})`);
    return { status: 502, body: { error: 'send' } };
  }
  log('agreement: kept and sent');
  return { status: kept.created ? 201 : 200, body: { ok: true } };
}