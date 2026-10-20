/**
 * Block keys (documentation/editor/ai-editing.md §3): every block's stable name, six lowercase letters and
 * digits, unique in its article, so a proposal, a comment or a diff can follow a block as others move. The site
 * never renders a key. Pure: the migration script (scripts/add-block-keys.mjs) imports this file too, so it
 * has no runtime imports.
 */
import type { Block } from '../../content/schema';

/** A block key's shape. */
export const BLOCK_KEY = /^[a-z0-9]{6}$/;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Random bytes, from the platform's own generator (the browser's or Node's). */
const randomBytes = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** A new key, not among `taken`. */
export function makeKey(taken: ReadonlySet<string> = new Set(), random: (n: number) => Uint8Array = randomBytes): string {
  for (;;) {
    const key = Array.from(random(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
    if (!taken.has(key)) return key;
  }
}

/**
 * The body with every block keyed: a block with no key, or a malformed one, gets a new key, and of two blocks
 * with the same key the later one does (so a duplicate's copy is re-keyed and the original keeps its name).
 * Returns the same array when nothing changed.
 */
export function withKeys<T extends Pick<Block, 'key'>>(body: T[], random?: (n: number) => Uint8Array): T[] {
  const taken = new Set(body.map((b) => b.key).filter((k): k is string => typeof k === 'string' && BLOCK_KEY.test(k)));
  const seen = new Set<string>();
  let changed = false;
  const out = body.map((b) => {
    if (b.key && BLOCK_KEY.test(b.key) && !seen.has(b.key)) {
      seen.add(b.key);
      return b;
    }
    changed = true;
    const key = makeKey(taken, random);
    taken.add(key);
    seen.add(key);
    return { ...b, key };
  });
  return changed ? out : body;
}

/** The body without its keys: a key alone is never a meaningful change (it doesn't move an article's updated date). */
export const withoutKeys = <T extends Pick<Block, 'key'>>(body: T[]): Omit<T, 'key'>[] => body.map(({ key: _key, ...rest }) => rest);

/** The block a key names, and where it is, or null. */
export function findKey<T extends Pick<Block, 'key'>>(body: T[], key: string): { block: T; at: number } | null {
  const at = body.findIndex((b) => b.key === key);
  return at < 0 ? null : { block: body[at], at };
}
