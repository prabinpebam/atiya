/**
 * Questions' rules in the browser (tier 0; docs: documentation/home-views/questions.md §5): the answer an address
 * names (`#q<n>`), the terms a question is matched by (folded, small words left out, endings taken off), the closest
 * answers to a typed question (its own words count most, then the strengths it shows, then its evidence's titles,
 * a word every answer has counting least), what the status line says, and Show more questions. Typed words never
 * leave the browser. Pure: no DOM, so the page and the compound share them.
 */
import { fold } from './keywordsRules';

/** An answer as the page's index carries it: its terms, already through `termsOf`. */
export interface IndexedAnswer {
  n: number;
  id: string;
  question: string;
  /** How many strengths it shows: one that shows them all says less about any one. */
  tags: number;
  /**
   * Its question's terms, its strengths' (one list each, in the answer's order: the first is what it's mainly
   * about), its shown evidence's titles', and each strength's other proof's titles (the items there's no room to show).
   */
  terms: { question: string[]; strengths: string[][]; evidence: string[]; proof?: string[][] };
}

/** The answer an address names (`#q3`): its number, when there's an answer with it. */
export function answerFrom(hash: string, count: number): number | null {
  const m = /^#q([1-9]\d*)$/.exec(hash);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= count ? n : null;
}

// the small words of a question: matching on them would find every answer
const STOP = new Set(
  'a an and any are as at be been but by can could did do does done else ever for from had has have he her hers him his how i if in is it its kind me my no not of on or our she so some something than that the their them then there they this those to us was we were what when where which who whom whose why will with would you your'.split(' '),
);
const ENDINGS = ['ments', 'ment', 'ships', 'ship', 'ings', 'ing', 'ers', 'er', 'ies', 'es', 'ed', 's', 'e'];

/** A word's stem, near enough to match its forms: managed, managers and management are all `manag`. */
export function stem(word: string): string {
  let w = word;
  for (let changed = true; changed; ) {
    changed = false;
    for (const end of ENDINGS) {
      if (w.length - end.length >= 3 && w.endsWith(end)) {
        w = end === 'ies' ? `${w.slice(0, -3)}y` : w.slice(0, -end.length);
        changed = true;
        break;
      }
    }
  }
  return w;
}

/** The terms words are matched by: each word folded and stemmed, the small ones left out, each once. */
export function termsOf(...texts: readonly string[]): string[] {
  const words = texts.flatMap((t) => fold(t).split(/[^\p{L}\p{N}]+/u));
  return [...new Set(words.filter((w) => w.length >= 2 && !STOP.has(w)).map(stem))];
}

/** At most this many closest answers under Ask something else. */
export const MAX_CLOSEST = 3;

/** A phone's questions at rest: the first few (and the open one); Show more questions shows the rest. */
export const FIRST_ROWS = 3;

/**
 * The answers closest to a typed question, best first. A term found in an answer's own question counts 3, in a
 * strength it shows 2, in its shown evidence's titles 1, in a strength's other proof ½; a strength's count falls with
 * its place (the first is what the answer is mainly about) and when the answer shows more than three (question 1 shows
 * them all). Each term counts where it counts most, weighted by how few answers have it. Ties go to the answer whose
 * own question the words cover most (so a question typed as it's written finds its own answer), then the one showing
 * fewer strengths, then the earlier one. `partial`: the last word is still being typed, so it also matches the terms
 * it begins (three letters or more). Nothing in common: none.
 */
export function closest(text: string, answers: readonly IndexedAnswer[], partial = false): IndexedAnswer[] {
  const asked = termsOf(text);
  if (!asked.length) return [];
  const last = partial ? asked[asked.length - 1] : undefined;
  const has = (set: Set<string>, t: string) => set.has(t) || (t === last && t.length >= 3 && [...set].some((x) => x.startsWith(t)));
  const sets = answers.map((a) => ({
    a,
    q: new Set(a.terms.question),
    s: a.terms.strengths.map((x) => new Set(x)),
    e: new Set(a.terms.evidence),
    p: (a.terms.proof ?? []).map((x) => new Set(x)),
  }));
  type Sets = (typeof sets)[number];
  const anywhere = (x: Sets, t: string) => has(x.q, t) || has(x.e, t) || x.s.some((s) => has(s, t)) || x.p.some((p) => has(p, t));
  const idf = (t: string) => Math.log(1 + answers.length / Math.max(1, sets.filter((x) => anywhere(x, t)).length));
  const weights = new Map(asked.map((t) => [t, idf(t)]));
  const place = (a: IndexedAnswer, k: number) => Math.min(1, 3 / Math.max(1, a.tags)) / (k + 1);
  const inLists = (x: Sets, lists: Set<string>[], t: string, w: number) => {
    const k = lists.findIndex((l) => has(l, t));
    return k < 0 ? 0 : w * place(x.a, k);
  };
  const count = (x: Sets, t: string) => Math.max(has(x.q, t) ? 3 : 0, inLists(x, x.s, t, 2), has(x.e, t) ? 1 : 0, inLists(x, x.p, t, 0.5));
  return sets
    .map((x) => ({
      a: x.a,
      score: asked.reduce((sum, t) => sum + count(x, t) * weights.get(t)!, 0),
      covered: x.q.size ? asked.filter((t) => has(x.q, t)).length / x.q.size : 0,
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.covered - x.covered || x.a.tags - y.a.tags || x.a.n - y.a.n)
    .slice(0, MAX_CLOSEST)
    .map((x) => x.a);
}

/** What the status line says after Ask something else: the closest answer, or that there's none. */
export function askedStatus(found?: Pick<IndexedAnswer, 'n' | 'question'>): string {
  return found ? `Closest answer: question ${found.n}, ${found.question}` : 'There’s no answer to that here yet.';
}

/** A phone's Show more questions, with how many it shows. */
export function moreLabel(hidden: number): string {
  return hidden === 1 ? 'Show 1 more question' : `Show ${hidden} more questions`;
}
