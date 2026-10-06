/**
 * The browser's side of the contact form's proof of work (documentation/contact/spec.md §5.1): finds the
 * nonce the service's challenge asks for with Web Crypto, in batches so the page stays responsive. The
 * service checks it with contact-api/src/challenge.mjs.
 */

/** A challenge's salt (its signed body is base64url JSON: { s, e, d }). */
export function saltOf(challenge: string): string {
  const b64 = challenge.replace(/-/g, '+').replace(/_/g, '/');
  const body = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { s?: unknown };
  if (typeof body.s !== 'string') throw new Error('not a challenge');
  return body.s;
}

/** How many zero bits a hash starts with. */
export function zeroBits(bytes: Uint8Array): number {
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
 * The nonce that solves a challenge: SHA-256("<salt>:<nonce>") starts with `difficulty` zero bits.
 * Hashes `batch` candidates at a time, yielding between batches; stops (null) when `signal` aborts.
 */
export async function solve(challenge: string, difficulty: number, o: { batch?: number; signal?: AbortSignal } = {}): Promise<string | null> {
  const salt = saltOf(challenge);
  const enc = new TextEncoder();
  const batch = o.batch ?? 1000;
  for (let start = 0; start < 1e12; start += batch) {
    if (o.signal?.aborted) return null;
    const hashes = await Promise.all(Array.from({ length: batch }, (_, k) => crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${start + k}`))));
    const k = hashes.findIndex((h) => zeroBits(new Uint8Array(h)) >= difficulty);
    if (k >= 0) return String(start + k);
    // let the page breathe between batches
    await new Promise((r) => setTimeout(r, 0));
  }
  return null;
}
