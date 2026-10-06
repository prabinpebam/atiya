// @ts-check
/**
 * The contact form's proof of work (documentation/contact/spec.md §5.1): a challenge the service signs and
 * the browser solves (src/site/scripts/contactWork.ts). Stateless until it's used: the service records a
 * used challenge's ID (store.mjs). A solution is a nonce such that SHA-256("<salt>:<nonce>") starts with
 * `difficulty` zero bits.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Zero bits a solution needs: about 65,000 hashes on average. */
export const DIFFICULTY = 16;
/** How long a challenge can be used. */
export const TTL_MS = 10 * 60 * 1000;

const sign = (/** @type {string} */ secret, /** @type {string} */ challenge) => createHmac('sha256', secret).update(challenge).digest('base64url');

/**
 * A new challenge.
 * @param {string} secret
 * @param {number} [now]
 * @param {number} [difficulty]
 */
export function issue(secret, now = Date.now(), difficulty = DIFFICULTY) {
  const body = { s: randomBytes(16).toString('hex'), e: now + TTL_MS, d: difficulty };
  const challenge = Buffer.from(JSON.stringify(body)).toString('base64url');
  return { challenge, signature: sign(secret, challenge), difficulty };
}

/** How many zero bits a hash starts with. */
export function leadingZeroBits(/** @type {Uint8Array} */ bytes) {
  let n = 0;
  for (const b of bytes) {
    if (b === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

/**
 * Whether a solved challenge holds: signed by us, not expired, and solved.
 * @param {string} secret
 * @param {{ challenge?: unknown; signature?: unknown; nonce?: unknown }} p
 * @param {number} [now]
 * @returns {{ ok: true; id: string; expires: number } | { ok: false; why: 'shape' | 'signature' | 'expired' | 'work' }}
 */
export function verify(secret, p, now = Date.now()) {
  const { challenge, signature, nonce } = p;
  if (typeof challenge !== 'string' || typeof signature !== 'string' || typeof nonce !== 'string' || challenge.length > 200 || !/^\d{1,12}$/.test(nonce)) return { ok: false, why: 'shape' };
  const want = Buffer.from(sign(secret, challenge));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, why: 'signature' };
  /** @type {{ s?: unknown; e?: unknown; d?: unknown }} */
  let body;
  try {
    body = JSON.parse(Buffer.from(challenge, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, why: 'shape' };
  }
  if (typeof body?.s !== 'string' || typeof body.e !== 'number' || typeof body.d !== 'number') return { ok: false, why: 'shape' };
  if (body.e < now) return { ok: false, why: 'expired' };
  const hash = createHash('sha256').update(`${body.s}:${nonce}`).digest();
  if (leadingZeroBits(hash) < Math.max(body.d, DIFFICULTY)) return { ok: false, why: 'work' };
  return { ok: true, id: body.s, expires: body.e };
}
