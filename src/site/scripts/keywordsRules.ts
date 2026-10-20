/**
 * Keywords' rules in the browser (tier 0; docs: documentation/home-views/keywords.md §5, §10): the picks in the
 * address (`?pick=a,b`), the matches for a set of picks (any pick, the ones matching more first, then the page's
 * own order: best kind of proof first), the keywords a typed skill suggests (by label and synonym), and Ask about
 * these. Typed words never leave the browser. Pure: no DOM, no imports, so the page and the home model share them.
 */

/** A keyword as the page's index carries it. */
export interface IndexedKeyword {
  id: string;
  label: string;
  /** Other words for it, folded (fold): typing one suggests it. */
  synonyms: string[];
  /** The proof items it matches, by key. */
  matches: string[];
}

/** Words as matched: lower case, curly quotes straight, white space collapsed (the home model's `normalise`). */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** A keyword's ID: its label as an address segment (`Agentic AI` is `agentic-ai`). */
export const slugOf = (label: string) =>
  fold(label)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/** The picks an address names (`?pick=a,b`): known IDs only, each once, in its order. */
export function picksFrom(search: string, known: ReadonlySet<string>): string[] {
  const raw = new URLSearchParams(search).get('pick') ?? '';
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => known.has(s)))];
}

/** The address's query with the picks in it (none: `pick` taken out), every other parameter kept. */
export function withPicks(search: string, picks: readonly string[]): string {
  const q = new URLSearchParams(search);
  if (picks.length) q.set('pick', picks.join(','));
  else q.delete('pick');
  // commas stay readable in a link someone pastes into an email
  const s = q.toString().replace(/%2C/gi, ',');
  return s ? `?${s}` : '';
}

/** A match: a proof item and the picks it matches, in the order they were picked. */
export interface Match {
  key: string;
  matched: string[];
}

/**
 * The matches for a set of picks: an item matching any pick (K4), the ones matching more picks first, then in
 * `order` (the page's: best kind of proof first, then its score).
 */
export function matchesFor(picks: readonly string[], keywords: readonly IndexedKeyword[], order: readonly string[]): Match[] {
  const byId = new Map(keywords.map((k) => [k.id, k]));
  const hits = new Map<string, string[]>();
  for (const id of picks) for (const key of byId.get(id)?.matches ?? []) hits.set(key, [...(hits.get(key) ?? []), id]);
  const place = new Map(order.map((key, i) => [key, i]));
  return [...hits]
    .map(([key, matched]) => ({ key, matched }))
    .sort((a, b) => b.matched.length - a.matched.length || (place.get(a.key) ?? Infinity) - (place.get(b.key) ?? Infinity));
}

/** At most this many suggestions under "Or type a skill". */
export const MAX_SUGGESTIONS = 6;

/**
 * The keywords a typed skill suggests, best first: the label itself, then labels that start with it, labels that
 * contain it, then a synonym that starts with or contains it (or that it contains, so "an agentic ai lead" finds
 * Agentic AI). Fewer than two letters suggests nothing.
 */
export function suggest(text: string, keywords: readonly IndexedKeyword[]): IndexedKeyword[] {
  const t = fold(text);
  if (t.length < 2) return [];
  const score = (k: IndexedKeyword) => {
    const label = fold(k.label);
    if (label === t) return 0;
    if (label.startsWith(t)) return 1;
    if (label.includes(t)) return 2;
    if (k.synonyms.some((s) => s === t || s.startsWith(t))) return 3;
    if (k.synonyms.some((s) => s.includes(t))) return 4;
    if (label.length >= 2 && wholeWord(t, label)) return 5;
    if (k.synonyms.some((s) => s.length >= 2 && wholeWord(t, s))) return 6;
    return Infinity;
  };
  return keywords
    .map((k, i) => ({ k, i, s: score(k) }))
    .filter((x) => x.s < Infinity)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, MAX_SUGGESTIONS)
    .map((x) => x.k);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (text: string, term: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, 'u').test(text);

/** Ask about these: the contact page with the picks' labels as its topic. */
export function askAbout(contact: string | undefined, labels: readonly string[]): string | undefined {
  if (!contact || !labels.length) return undefined;
  return `${contact}?topic=${encodeURIComponent(labels.join(', '))}`;
}

/** What the live region says after a pick, an unpick or Clear all ("Agentic AI picked. 3 matches."). */
export function pickStatus(change: { label?: string; on?: boolean; cleared?: boolean }, matches: number, picks: number): string {
  if (change.cleared) return 'Picks cleared. Showing every strength.';
  const what = `${change.label} ${change.on ? 'picked' : 'removed'}.`;
  if (!picks) return `${what} Showing every strength.`;
  return `${what} ${matches === 1 ? '1 match' : `${matches} matches`}.`;
}
