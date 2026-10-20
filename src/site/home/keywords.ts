/**
 * Keywords' field (documentation/home-views/keywords.md §3 to §5, §10; for-every-site.md §4): a group per strength
 * shown (L1), its keywords sized by how much proof each matches (L2), and every proof item a pick can bring forward,
 * ranked once, best first. A keyword matches a proof item when its words, or a synonym from the topic vocabulary,
 * are in the page's title, summary or a heading, the page has its topic, its body uses them at least twice, or
 * they're in a résumé line or a colleague's words. A keyword nothing matches leads to its strength's headline, so a
 * pick never comes up empty; a strength with no keywords offers its own name. Pure.
 */
import { CATALOGUE } from './catalogue';
import { humanise, termPattern, type HomePicks, type Pick as Placed, type StrengthPicks } from './curate';
import { normalise, type EvidenceIndex } from './evidence';
import { evidenceItem, strengthsInOrder, type PresentEnv } from './present';
import { PROOF_KINDS, type ProofKind, type Topic } from './schema';
import { slugOf } from '../scripts/keywordsRules';

export interface KeywordsSettings {
  /** How a pick moves things: still (no motion), gentle (the picks and matches settle), lively (also a drift: not built, read as gentle until H4). */
  motion: 'still' | 'gentle' | 'lively';
  /** The person's order, or by the depth of their proof (a lens overrides both). */
  order: 'yours' | 'strongest';
  /** "Or type a skill": shown, or left out. */
  typing: 'on' | 'off';
  /** At most this many keywords to a group, 4 to 8. */
  perGroup: number;
}

const PER = CATALOGUE.views.keywords.settings.perGroup;
const MIN = PER.min ?? 4;
const MAX = PER.max ?? 8;

export const KEYWORDS_DEFAULTS: KeywordsSettings = { motion: 'lively', order: 'yours', typing: 'on', perGroup: Number(PER.default ?? 6) };

const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);

/** The view's settings as Keywords reads them, anything unknown taken as its default. */
export function keywordsSettings(s: Record<string, unknown> = {}): KeywordsSettings {
  const n = typeof s.perGroup === 'number' && Number.isFinite(s.perGroup) ? Math.round(s.perGroup) : KEYWORDS_DEFAULTS.perGroup;
  return {
    motion: oneOf(s.motion, ['still', 'gentle', 'lively'], KEYWORDS_DEFAULTS.motion),
    order: oneOf(s.order, ['yours', 'strongest'], KEYWORDS_DEFAULTS.order),
    typing: oneOf(s.typing, ['on', 'off'], KEYWORDS_DEFAULTS.typing),
    perGroup: Math.min(MAX, Math.max(MIN, n)),
  };
}

/** A proof item a pick can bring forward. */
export interface KeywordItem {
  key: string;
  source: Placed['source'];
  title: string;
  kindLabel?: string;
  href?: string;
  ask?: string;
  /** Its proof line: its page's summary, or the colleague's quote. */
  line?: string;
  /** The strength it proves: the first in the field's order that has it. */
  capability: string;
}

export interface Keyword {
  id: string;
  label: string;
  /** Other words for it, folded, from the topic vocabulary: typing one suggests it. */
  synonyms: string[];
  /** How much proof it has: 1 (one item), 2 (two or three), 3 (four or more). */
  size: 1 | 2 | 3;
  /** The proof items it matches, by key, best first. */
  matches: string[];
}

export interface KeywordGroup {
  id: string;
  name: string;
  short: string;
  line: string;
  keywords: Keyword[];
  /** Its headline, by key: what it leads with when nothing is picked. */
  headline?: string;
  /** How many proof items it has. */
  total: number;
}

export interface KeywordsField {
  groups: KeywordGroup[];
  /** Every proof item, once, best first: the goal's kinds of proof first, then pins, then score. */
  items: KeywordItem[];
}

/** A keyword's size from how many proof items it matches. */
export const sizeOf = (n: number): Keyword['size'] => (n >= 4 ? 3 : n >= 2 ? 2 : 1);

/** Where a keyword looks: the words that matter (title, summary, headings, a résumé line, a colleague's words), the body and the topics. */
interface Haystack {
  near: string[];
  body: string;
  topics: string[];
}

function haystackOf(p: Placed, evidence: EvidenceIndex): Haystack {
  if (p.source === 'page' && p.id) {
    const e = evidence.byId.get(p.id);
    return e ? { near: [e.text.title, e.text.summary, ...e.text.headings], body: e.text.body, topics: e.topics } : { near: [normalise(p.title ?? '')], body: '', topics: [] };
  }
  if (p.source === 'resume' && p.resume) return { near: [normalise(p.resume)], body: '', topics: [] };
  const r = p.recommendation ? evidence.recommendations.find((x) => x.id === p.recommendation) : undefined;
  return { near: r ? [normalise(r.text)] : [], body: '', topics: [] };
}

/** The topics a keyword names (by label, synonym or ID) and their other words. */
function vocabularyOf(label: string, topics: readonly Topic[]): { topics: Set<string>; synonyms: string[] } {
  const own = normalise(label);
  const found = new Set<string>();
  const synonyms = new Set<string>();
  for (const t of topics) {
    const words = [t.label, ...(t.synonyms ?? []), humanise(t.id)].map(normalise);
    if (!words.includes(own)) continue;
    found.add(t.id);
    for (const w of words) if (w !== own && w.length >= 2) synonyms.add(w);
  }
  return { topics: found, synonyms: [...synonyms] };
}

function matches(h: Haystack, terms: string[], topics: Set<string>): boolean {
  if (h.topics.some((t) => topics.has(t))) return true;
  const near = terms.map((t) => termPattern(t));
  if (h.near.some((s) => near.some((re) => re.test(s)))) return true;
  if (!h.body) return false;
  let count = 0;
  for (const t of terms) count += h.body.match(termPattern(t, 'gu'))?.length ?? 0;
  return count >= 2;
}

/** A proof item's place among the rest: the goal's kinds of proof first (Get hired: shipped, led, said), then pins, then score. */
function ranked(entries: { item: KeywordItem; p: Placed; i: number }[], goal: HomePicks['goal']): KeywordItem[] {
  const kinds = [...(CATALOGUE.goals[goal]?.counts ?? []), ...PROOF_KINDS] as ProofKind[];
  const kindRank = (k?: ProofKind) => (k ? kinds.indexOf(k) : kinds.length);
  const score = (p: Placed) => (p.pinned ? 1 : p.score ?? 0);
  return [...entries]
    .sort((a, b) => kindRank(a.p.kind) - kindRank(b.p.kind) || Number(b.p.pinned) - Number(a.p.pinned) || score(b.p) - score(a.p) || a.i - b.i)
    .map((x) => x.item);
}

export function keywordsField(picks: HomePicks, evidence: EvidenceIndex, topics: readonly Topic[], settings: KeywordsSettings, env: PresentEnv): KeywordsField {
  const strengths = strengthsInOrder(picks, settings.order);
  const quoteOf = (id?: string) => strengths.find((s) => s.voice?.recommendation === id)?.voice?.quote;

  // every proof item once, as the first strength in the field's order has it
  const entries: { item: KeywordItem; p: Placed; i: number; hay: Haystack }[] = [];
  const seen = new Set<string>();
  for (const s of strengths) {
    for (const p of s.all) {
      const e = evidenceItem(p, s, env);
      if (!e || seen.has(e.key)) continue;
      seen.add(e.key);
      const line = p.source === 'page' && p.id ? evidence.byId.get(p.id)?.summary : p.source === 'recommendation' ? quoteOf(p.recommendation) : undefined;
      const item: KeywordItem = {
        key: e.key,
        source: e.source,
        title: e.title,
        ...(e.kindLabel ? { kindLabel: e.kindLabel } : {}),
        ...(e.href ? { href: e.href } : {}),
        ...(e.ask ? { ask: e.ask } : {}),
        ...(line?.trim() ? { line: line.trim() } : {}),
        capability: s.id,
      };
      entries.push({ item, p, i: entries.length, hay: haystackOf(p, evidence) });
    }
  }
  const items = ranked(entries, picks.goal);
  const place = new Map(items.map((x, i) => [x.key, i]));
  const best = (keys: string[]) => [...keys].sort((a, b) => place.get(a)! - place.get(b)!);

  const headlineOf = (s: StrengthPicks) => {
    const h = s.headline && evidenceItem(s.headline, s, env);
    return h && place.has(h.key) ? h.key : items.find((x) => x.capability === s.id)?.key;
  };

  // a strength's own keywords are its alone: another's topic labels never take one first. A keyword is one
  // whether singular or plural, so "Design system" adds nothing beside "Design systems"
  const same = (label: string) => slugOf(label).replace(/s$/, '');
  const ownedBy = new Map<string, string>();
  for (const s of strengths) for (const k of s.capability.keywords ?? []) if (!ownedBy.has(same(k))) ownedBy.set(same(k), s.id);
  const used = new Set<string>();
  const groups: KeywordGroup[] = strengths.map((s) => {
    const headline = headlineOf(s);
    const labels = s.keywords.length ? s.keywords : [s.capability.name];
    const keywords: Keyword[] = [];
    for (const label of labels) {
      if (keywords.length >= settings.perGroup) break;
      const id = slugOf(label);
      const key = same(label);
      if (!id || used.has(key) || (ownedBy.get(key) ?? s.id) !== s.id) continue;
      used.add(key);
      const vocab = vocabularyOf(label, topics);
      const terms = [...new Set([normalise(label), ...vocab.synonyms])].filter((t) => t.length >= 2);
      const found = entries.filter((x) => matches(x.hay, terms, vocab.topics)).map((x) => x.item.key);
      const keys = found.length ? best(found) : headline ? [headline] : [];
      keywords.push({ id, label, synonyms: vocab.synonyms, size: sizeOf(found.length), matches: keys });
    }
    return {
      id: s.id,
      name: s.capability.name,
      short: s.capability.short,
      line: s.capability.line,
      keywords,
      ...(headline ? { headline } : {}),
      total: s.total,
    };
  });
  return { groups, items };
}
