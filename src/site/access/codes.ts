import { randomBytes } from './crypto.ts';
import { WORDS } from './wordlist.ts';

type RandomSource = (n: number) => Uint8Array;

// The EFF list has four hyphenated words; generation filters them so parsing on hyphens stays unambiguous.
const USABLE_WORDS = WORDS.filter((word) => !word.includes('-'));

export const WORDS_BITS = Math.log2(USABLE_WORDS.length);

function randomIndex(size: number, random: RandomSource): number {
  if (!Number.isInteger(size) || size < 1) throw new Error('Random range must be positive.');
  const limit = Math.floor(0x100000000 / size) * size;
  for (;;) {
    const bytes = random(4);
    if (bytes.length < 4) throw new Error('Random source returned too few bytes.');
    const n = bytes[0] * 16777216 + bytes[1] * 65536 + bytes[2] * 256 + bytes[3];
    if (n < limit) return n % size;
  }
}

function randomWord(random: RandomSource): string {
  return USABLE_WORDS[randomIndex(USABLE_WORDS.length, random)];
}

export function generateCode(
  takenNames: Set<string>,
  words = 4,
  random: RandomSource = randomBytes,
): { name: string; secret: string; code: string } {
  if (!Number.isInteger(words) || words < 1) throw new Error('A code needs at least one secret word.');
  const taken = new Set([...takenNames].map((name) => name.toLowerCase()));
  let name = '';
  for (let attempts = 0; attempts < USABLE_WORDS.length * 2; attempts++) {
    const candidate = randomWord(random);
    if (!taken.has(candidate)) {
      name = candidate;
      break;
    }
  }
  if (!name) throw new Error('No unused code names are available.');
  const secretWords: string[] = [];
  for (let i = 0; i < words; i++) secretWords.push(randomWord(random));
  const secret = secretWords.join('-');
  return { name, secret, code: `${name}-${secret}` };
}

// parsing what a visitor types needs no word list, so the browser's runtime imports it alone
export { parseCode } from './parse.ts';
