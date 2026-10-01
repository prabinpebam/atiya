/**
 * Related stories at the end of a page (documentation/sections/spec.md §3.7), pure so they're unit-tested
 * and safe for the browser (no content reads here: the page hands the candidates in).
 *
 * The page ranks every other story once, at build time: the author's own picks first (the article's
 * `related`), then the ones that share its topics (a rare topic counts for more than one every story
 * has), then the ones in its section, then the newest. The reader's browser then shows the best few it
 * hasn't read yet, falling back to the ones read longest ago, and remembers each page read (in
 * localStorage, on this browser only).
 */

export interface RelatedCandidate {
  id: string;
  kind: string;
  topics?: readonly string[];
  /** Its section on the site (or its building on the planet). */
  section?: string;
  publishedAt?: string;
}

/** Stories the end of a page can suggest: articles and talks, and galleries; a plain page (the résumé) isn't one. */
export const isStory = (c: Pick<RelatedCandidate, 'kind'>) => c.kind === 'note' || c.kind === 'talk' || c.kind === 'gallery';

/** How many candidates a page carries, ranked, for the browser to choose from. */
export const RELATED_CANDIDATES = 8;
/** How many it shows. */
export const RELATED_SHOWN = 3;

/**
 * The other stories, best first: the author's picks (in their order), then by shared topics (each
 * weighted by how rare it is), then the same section, then the newest, then by ID (so it's stable).
 */
export function rankRelated(current: RelatedCandidate & { related?: readonly string[] }, all: readonly RelatedCandidate[], max = RELATED_CANDIDATES): string[] {
  const others = all.filter((c) => c.id !== current.id && isStory(c));
  const picks = (current.related ?? []).filter((id) => others.some((c) => c.id === id));
  // a topic's weight: rarer is more telling (one every story shares says little)
  const count = new Map<string, number>();
  for (const c of others) for (const t of new Set(c.topics ?? [])) count.set(t, (count.get(t) ?? 0) + 1);
  const weight = (t: string) => Math.log(1 + others.length / (count.get(t) ?? 1));
  const mine = new Set(current.topics ?? []);
  const score = (c: RelatedCandidate) => {
    let s = 0;
    for (const t of new Set(c.topics ?? [])) if (mine.has(t)) s += 3 * weight(t);
    if (current.section && c.section === current.section) s += 2;
    return s;
  };
  const rest = others
    .filter((c) => !picks.includes(c.id))
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || (b.c.publishedAt ?? '').localeCompare(a.c.publishedAt ?? '') || a.c.id.localeCompare(b.c.id))
    .map((x) => x.c.id);
  return [...picks, ...rest].slice(0, max);
}

/** When each story was last read, by ID (ms since the epoch). */
export type Visits = Record<string, number>;

/** The stories to show, in order: the best ones not read yet, then the ones read longest ago. */
export function pickToShow(ranked: readonly string[], visits: Visits, n = RELATED_SHOWN): string[] {
  const unread = ranked.filter((id) => !visits[id]);
  const read = ranked.filter((id) => visits[id]).sort((a, b) => visits[a] - visits[b] || ranked.indexOf(a) - ranked.indexOf(b));
  return [...unread, ...read].slice(0, n);
}

/** The most visits remembered: the oldest go first. */
export const MAX_VISITS = 200;

/** Visits with this one recorded (the oldest dropped past the limit). */
export function recordVisit(visits: Visits, id: string, now: number): Visits {
  const next: Visits = { ...visits, [id]: now };
  const ids = Object.keys(next);
  if (ids.length <= MAX_VISITS) return next;
  for (const old of ids.sort((a, b) => next[a] - next[b]).slice(0, ids.length - MAX_VISITS)) delete next[old];
  return next;
}

/** Visits as stored, read safely (anything else is no visits). */
export function parseVisits(raw: string | null): Visits {
  try {
    const v = JSON.parse(raw ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([k, t]) => /^[a-z0-9-]+$/.test(k) && typeof t === 'number' && Number.isFinite(t))) as Visits;
  } catch {
    return {};
  }
}

/** Where the browser keeps them. */
export const VISITS_KEY = 'site.visited';
