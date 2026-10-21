/**
 * The home page's picks (documentation/home-views/curation.md §4 to §7): which pages prove each strength, which one
 * is its headline, its details, the highlights and the keywords. Rules, not AI: the same content gives the same
 * picks on any day (no clock, no random choice, no visitor data). The person always wins: a pin beats any score, a
 * hide is absolute, and Hold freezes the automatic picks. Pure.
 */
import { CATALOGUE } from './catalogue';
import { normalise, type Evidence, type EvidenceIndex } from './evidence';
import type { Goal } from './ids';
import { CURATION_DEFAULTS, refId, toRef, type Capability, type ProofItem, type ProofKind, type Showcase, type Topic } from './schema';

/** One proof item as placed: a page, a résumé line or a recommendation, with why it's there. */
export interface Pick {
  source: 'page' | 'resume' | 'recommendation';
  /** A page's ref and ID, title and picture. */
  ref?: string;
  id?: string;
  title?: string;
  picture?: string;
  resume?: string;
  recommendation?: string;
  kind?: ProofKind;
  ask?: boolean;
  pinned: boolean;
  /** 0 to 1, for a page the rules placed. */
  score?: number;
  /** Why it's there, as edit mode shows it: "Pinned by you", "Auto: topic AI, built, 2026". */
  reason: string;
}

/** A strength's picks: its headline (L2), details (L3) and everything that proves it. */
export interface StrengthPicks {
  capability: Capability;
  id: string;
  /** False when nothing proves it: visitors don't see it (CU7). */
  shown: boolean;
  headline?: Pick;
  /** Its own picture, else its headline's. */
  picture?: string;
  /** The same picture in each shape (media IDs): its own picture for all of them, else its headline page's. */
  pictures?: Evidence['pictures'];
  voice?: Capability['voice'];
  /** What its details show before Show all: pins, then the best, kinds balanced. */
  details: Pick[];
  /** Every proof item, pins first: Show all. */
  all: Pick[];
  total: number;
  keywords: string[];
  /** How strongly it's proved (Order: Strongest first): its details' scores, a pin counting as 1. */
  weight: number;
}

export interface HighlightPick {
  ref: string;
  id: string;
  title: string;
  picture?: string;
  capability: string;
  pinned: boolean;
  reason: string;
}

export interface HomePicks {
  goal: Goal;
  /** The lens the picks are ordered for, when one was asked for and exists. */
  lens?: string;
  /** The strengths in the order shown (the person's, or the lens's). */
  strengths: StrengthPicks[];
  highlights: HighlightPick[];
  /** The Showreel's: the highlights, at most 2 per strength. */
  reel: HighlightPick[];
  /** The voice that leads (a lens's, else the first strength's). */
  leadVoice?: { recommendation: string; quote?: string };
  /** Hold automatic changes is on: the automatic picks are the stored ones. */
  held: boolean;
}

export interface CurateInput {
  showcase: Showcase;
  evidence: EvidenceIndex;
  topics?: Topic[];
  lens?: string;
}

const THRESHOLD = { loose: 0.3, balanced: 0.4, strict: 0.7 } as const;
const HALF_LIFE = { off: Infinity, some: 3, strong: 1 } as const;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
/** Above this many pages, body words are matched only for each strength's best candidates (curation §9). */
const BODY_LIMIT = { pages: 200, best: 30 };
export const MAX_HIGHLIGHTS = 8;
const REEL_PER_STRENGTH = 2;
const KEYWORDS_PER_GROUP = 8;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A term as a whole word or phrase, in normalised text. */
export const termPattern = (term: string, flags = 'u') => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, flags);
/** A topic ID as words: `figma-plugin` is "figma plugin". */
export const humanise = (id: string) => id.replace(/-/g, ' ');

interface Matcher {
  topics: Set<string>;
  sections: Set<string>;
  terms: RegExp[];
  counts: RegExp[];
}

function matcherFor(c: Capability, vocab: Map<string, Topic>): Matcher {
  const words = [...(c.keywords ?? [])];
  for (const t of c.match?.topics ?? []) {
    const v = vocab.get(t);
    words.push(v?.label ?? humanise(t), ...(v?.synonyms ?? []));
  }
  const terms = [...new Set(words.map(normalise).filter((w) => w.length >= 2))];
  return { topics: new Set(c.match?.topics ?? []), sections: new Set(c.match?.sections ?? []), terms: terms.map((t) => termPattern(t)), counts: terms.map((t) => termPattern(t, 'gu')) };
}

/** How well a page matches a strength (curation §4): the strongest of its topic, its section and its words. */
function matchOf(e: Evidence, M: Matcher, withBody: boolean, label: (topic: string) => string, sections: Map<string, string>): { m: number; why: string } {
  const topic = e.topics.find((t) => M.topics.has(t));
  if (topic) return { m: 1, why: `topic ${label(topic)}` };
  const inSection = !!e.section && M.sections.has(e.section);
  const has = (s: string) => M.terms.some((t) => t.test(s));
  const parts: [number, string][] = [];
  if (has(e.text.title)) parts.push([0.7, 'its title']);
  if (has(e.text.summary)) parts.push([0.5, 'its summary']);
  if (e.text.headings.some(has)) parts.push([0.4, 'a heading']);
  if (withBody) {
    let n = 0;
    for (const t of M.counts) {
      for (const _ of e.text.body.matchAll(t)) if (++n >= 3) break;
      if (n >= 3) break;
    }
    if (n >= 3) parts.push([0.3, 'its words']);
  }
  const words = Math.min(1, parts.reduce((s, [w]) => s + w, 0));
  if (inSection && 0.8 >= words) return { m: 0.8, why: `section ${sections.get(e.section!) ?? e.section}` };
  return { m: words, why: parts.length ? `words in ${parts[0][1]}` : '' };
}

const byScore = (a: Pick & { time?: number }, b: Pick & { time?: number }) => (b.score ?? 0) - (a.score ?? 0) || (b.time ?? 0) - (a.time ?? 0) || (a.id ?? '').localeCompare(b.id ?? '');

const pageReason = (why: string, e: Evidence) => `Auto: ${[why, e.kind ?? 'a page', String(e.year), e.linksIn ? `${e.linksIn} ${e.linksIn === 1 ? 'page links' : 'pages link'} here` : ''].filter(Boolean).join(', ')}`;

const pagePick = (e: Evidence, extra: Partial<Pick> & { reason: string; pinned: boolean }): Pick => ({ source: 'page', ref: e.ref, id: e.id, title: e.title, ...(e.picture ? { picture: e.picture } : {}), ...(e.kind ? { kind: e.kind } : {}), ...extra });

/** A pin as placed; an unpublished page's pin waits until the page is open again. */
export function pinPick(p: ProofItem, ev: EvidenceIndex): Pick | undefined {
  if (p.ref) {
    const e = ev.byId.get(refId(p.ref));
    return e ? pagePick(e, { pinned: true, reason: 'Pinned by you', ...(p.kind ? { kind: p.kind } : {}), ...(p.ask ? { ask: true } : {}) }) : undefined;
  }
  if (p.resume) return { source: 'resume', resume: p.resume, kind: p.kind, pinned: true, reason: 'Pinned by you', ...(p.ask ? { ask: true } : {}) };
  if (p.recommendation) return { source: 'recommendation', recommendation: p.recommendation, kind: 'said', pinned: true, reason: 'Pinned by you' };
  return undefined;
}

/** Details (L3): pins in order, then by score, at most 2 of one kind while other kinds wait (curation §6). */
function balanced(pins: Pick[], auto: Pick[], detail: number): Pick[] {
  const out = [...pins];
  const count = new Map<string, number>();
  for (const p of out) count.set(p.kind ?? 'none', (count.get(p.kind ?? 'none') ?? 0) + 1);
  const left = [...auto];
  while (out.length < detail && left.length) {
    let i = left.findIndex((p) => (count.get(p.kind ?? 'none') ?? 0) < 2);
    if (i < 0) i = 0;
    const [p] = left.splice(i, 1);
    out.push(p);
    count.set(p.kind ?? 'none', (count.get(p.kind ?? 'none') ?? 0) + 1);
  }
  return out;
}

const keyOf = (p: Pick) => (p.source === 'page' ? `page:${p.id}` : p.source === 'resume' ? `resume:${normalise(p.resume!)}` : `rec:${p.recommendation}`);

/** The home page's picks for a showcase and the site's evidence, ordered for a lens when one is given. */
export function curate({ showcase, evidence, topics = [], lens: lensId }: CurateInput): HomePicks {
  const settings = { ...CURATION_DEFAULTS, ...showcase.curation };
  const goal = showcase.goal ?? 'hired';
  const counts = new Set<string>(CATALOGUE.goals[goal].counts);
  const threshold = THRESHOLD[settings.strict];
  const halfLife = HALF_LIFE[settings.recent];
  const vocab = new Map(topics.map((t) => [t.id, t]));
  const label = (t: string) => vocab.get(t)?.label ?? humanise(t);
  const leave = { sections: new Set(settings.leaveOut?.sections ?? []), topics: new Set(settings.leaveOut?.topics ?? []), kinds: new Set<string>(settings.leaveOut?.kinds ?? []) };
  const eligible = evidence.pages.filter((e) => !(e.section && leave.sections.has(e.section)) && !e.topics.some((t) => leave.topics.has(t)) && !(e.kind && leave.kinds.has(e.kind)));
  const held = !!(settings.hold && showcase.held);

  const score = (e: Evidence, m: number) => {
    const age = Math.max(0, (evidence.now - e.time) / YEAR_MS);
    const recency = halfLife === Infinity ? 1 : 0.5 ** (age / halfLife);
    const s = m * (0.3 * (e.kind && counts.has(e.kind) ? 1 : 0.6) + 0.25 * e.depth + 0.2 * recency + 0.15 * Math.min(1, e.linksIn / 3) + 0.1 * (e.picture ? 1 : 0));
    return Math.round((e.stale ? s / 2 : s) * 1e4) / 1e4;
  };

  // each strength's pins and its automatic candidates, ranked
  const caps = showcase.capabilities;
  const pins = new Map<string, Pick[]>();
  const auto = new Map<string, (Pick & { time: number })[]>();
  for (const c of caps) {
    const own = (c.proof ?? []).map((p) => pinPick(p, evidence)).filter((p): p is Pick => !!p);
    pins.set(c.id, own);
    const pinned = new Set(own.flatMap((p) => (p.id ? [p.id] : [])));
    const hidden = new Set((c.hide ?? []).map(refId));
    const free = (e: Evidence) => !pinned.has(e.id) && !hidden.has(e.id);
    if (held) {
      const stored = (showcase.held!.proof[c.id] ?? []).map((r) => evidence.byId.get(refId(r))).filter((e): e is Evidence => !!e && free(e));
      auto.set(c.id, stored.map((e) => ({ ...pagePick(e, { pinned: false, reason: 'Held: as it was when you held it' }), time: e.time })));
      continue;
    }
    const M = matcherFor(c, vocab);
    const pool = eligible.filter(free);
    let matched: { e: Evidence; m: number; why: string }[];
    if (pool.length > BODY_LIMIT.pages) {
      const first = pool.map((e) => ({ e, ...matchOf(e, M, false, label, evidence.sections) })).sort((a, b) => b.m - a.m || b.e.time - a.e.time || a.e.id.localeCompare(b.e.id));
      matched = first.map((x, i) => (i < BODY_LIMIT.best ? { e: x.e, ...matchOf(x.e, M, true, label, evidence.sections) } : x));
    } else matched = pool.map((e) => ({ e, ...matchOf(e, M, true, label, evidence.sections) }));
    auto.set(
      c.id,
      matched
        .filter((x) => x.m >= threshold)
        .map((x) => ({ ...pagePick(x.e, { pinned: false, score: score(x.e, x.m), reason: pageReason(x.why, x.e) }), time: x.e.time }))
        .sort(byScore),
    );
  }

  // headlines (L2), in the person's order whatever the lens, so a lens never moves proof between strengths:
  // a pinned page, else the best page no other strength leads with, else a pinned résumé line or recommendation
  const taken = new Set<string>();
  const headline = new Map<string, Pick>();
  const take = (id: string, p: Pick) => {
    headline.set(id, p);
    if (p.id) taken.add(p.id);
  };
  for (const c of caps) {
    const p = pins.get(c.id)!.find((x) => x.source === 'page' && !taken.has(x.id!));
    if (p) take(c.id, p);
  }
  for (const c of caps) {
    if (headline.has(c.id)) continue;
    const p = auto.get(c.id)!.find((x) => !taken.has(x.id!));
    if (p) take(c.id, p);
  }
  for (const c of caps) {
    if (headline.has(c.id)) continue;
    const p = pins.get(c.id)!.find((x) => x.source !== 'page');
    if (p) take(c.id, p);
  }
  // every page that proves it leads another strength: share one rather than show a claim without proof
  for (const c of caps) if (!headline.has(c.id)) {
    const p = pins.get(c.id)![0] ?? auto.get(c.id)![0];
    if (p) headline.set(c.id, p);
  }

  const detail = settings.detail;
  const base: StrengthPicks[] = caps.map((c) => {
    const own = pins.get(c.id)!;
    const found = auto.get(c.id)!.map(({ time: _, ...p }) => p);
    const all = [...own, ...found];
    const details = balanced(own, found, detail);
    const h = headline.get(c.id);
    const freq = new Map<string, number>();
    for (const p of all) for (const t of (p.id && evidence.byId.get(p.id)?.topics) || []) freq.set(t, (freq.get(t) ?? 0) + 1);
    const fromTopics = [...freq].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => label(t));
    const keywords: string[] = [];
    const seen = new Set<string>();
    for (const k of [...(c.keywords ?? []), ...fromTopics]) {
      if (keywords.length >= KEYWORDS_PER_GROUP || seen.has(normalise(k))) continue;
      seen.add(normalise(k));
      keywords.push(k);
    }
    return {
      capability: c,
      id: c.id,
      shown: all.length > 0,
      ...(h ? { headline: h } : {}),
      ...(c.media ?? h?.picture ? { picture: c.media ?? h?.picture } : {}),
      ...(c.media ? { pictures: { wide: c.media, thumbnail: c.media, square: c.media } } : h?.picture && h.id && evidence.byId.get(h.id)?.pictures ? { pictures: evidence.byId.get(h.id)!.pictures } : {}),
      ...(c.voice ? { voice: c.voice } : {}),
      details,
      all,
      total: all.length,
      keywords,
      weight: Math.round(details.reduce((s, p) => s + (p.pinned ? 1 : p.score ?? 0), 0) * 1e4) / 1e4,
    };
  });

  // a lens orders the strengths (its order, completed by the rest; else the strengths that name it first) and sets the lead voice; it never hides one
  const lens = lensId ? showcase.lenses?.find((l) => l.id === lensId) : undefined;
  let order = caps.map((c) => c.id);
  if (lens?.order) order = [...lens.order.filter((id) => order.includes(id)), ...order.filter((id) => !lens.order!.includes(id))];
  else if (lens) order = [...caps.filter((c) => c.lens?.includes(lens.id)).map((c) => c.id), ...caps.filter((c) => !c.lens?.includes(lens.id)).map((c) => c.id)];
  const strengths = order.map((id) => base.find((s) => s.id === id)!);
  const shown = strengths.filter((s) => s.shown);
  const voiced = lens?.voice ? shown.find((s) => s.voice?.recommendation === lens.voice) : shown.find((s) => s.voice);
  const leadVoice = lens?.voice ? { recommendation: lens.voice, ...(voiced?.voice ? { quote: voiced.voice.quote } : {}) } : voiced?.voice ? { ...voiced.voice } : undefined;

  // highlights: pins, then one per strength in order, the best with a picture, round after round; no page twice
  const hiddenHighlights = new Set((showcase.hideHighlights ?? []).map(refId));
  const highlights: HighlightPick[] = [];
  const used = new Set<string>();
  const push = (e: Evidence, capability: string, pinned: boolean, reason: string) => {
    highlights.push({ ref: e.ref, id: e.id, title: e.title, ...(e.picture ? { picture: e.picture } : {}), capability, pinned, reason });
    used.add(e.id);
  };
  for (const h of showcase.highlights ?? []) {
    const e = evidence.byId.get(refId(h.ref));
    if (e && !hiddenHighlights.has(e.id) && !used.has(e.id) && highlights.length < MAX_HIGHLIGHTS) push(e, h.capability, true, 'Pinned by you');
  }
  if (held) {
    for (const h of showcase.held!.highlights) {
      const e = evidence.byId.get(refId(h.ref));
      if (e && !hiddenHighlights.has(e.id) && !used.has(e.id) && highlights.length < MAX_HIGHLIGHTS) push(e, h.capability, false, 'Held: as it was when you held it');
    }
  } else {
    for (let added = true; added && highlights.length < MAX_HIGHLIGHTS; ) {
      added = false;
      for (const s of shown) {
        if (highlights.length >= MAX_HIGHLIGHTS) break;
        const p = s.all.find((x) => x.source === 'page' && x.picture && !used.has(x.id!) && !hiddenHighlights.has(x.id!));
        if (!p) continue;
        push(evidence.byId.get(p.id!)!, s.id, false, `Auto: the best of ${s.capability.short} with a picture`);
        added = true;
      }
    }
  }
  const perStrength = new Map<string, number>();
  const reel = highlights.filter((h) => {
    const n = (perStrength.get(h.capability) ?? 0) + 1;
    perStrength.set(h.capability, n);
    return n <= REEL_PER_STRENGTH;
  });

  return { goal, ...(lens ? { lens: lens.id } : {}), strengths, highlights, reel, ...(leadVoice ? { leadVoice } : {}), held };
}

/** What Hold automatic changes stores (curation §7): each strength's automatic pages, and the automatic highlights. */
export function snapshot(picks: HomePicks): NonNullable<Showcase['held']> {
  const proof: Record<string, string[]> = {};
  for (const s of picks.strengths) proof[s.id] = s.all.filter((p) => !p.pinned && p.source === 'page').map((p) => toRef(p.id!));
  return { proof, highlights: picks.highlights.filter((h) => !h.pinned).map((h) => ({ ref: h.ref, capability: h.capability })) };
}

/** Every distinct proof item among the strengths shown (a page, a résumé line or a recommendation, each once). */
export const proofItems = (picks: HomePicks): Pick[] => {
  const seen = new Map<string, Pick>();
  for (const s of picks.strengths) if (s.shown) for (const p of s.all) if (!seen.has(keyOf(p))) seen.set(keyOf(p), p);
  return [...seen.values()];
};
