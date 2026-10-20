/**
 * The home page's health report (documentation/home-views/curation.md §8) and which views a site can offer
 * (for-every-site.md §5): what's missing, what's weak and what's ready, from the picks alone. Pure.
 */
import { CATALOGUE, type Minimum } from './catalogue';
import { proofItems, type HomePicks } from './curate';
import type { EvidenceIndex } from './evidence';
import { VIEW_IDS, type ViewId } from './ids';
import { refId, type Showcase } from './schema';

export type HealthLevel = 'blocking' | 'warning' | 'opportunity';

export interface HealthItem {
  level: HealthLevel;
  code:
    | 'no-proof'
    | 'resume-only'
    | 'one-proof'
    | 'no-picture'
    | 'old-proof'
    | 'below-minimum'
    | 'stale'
    | 'shared-headline'
    | 'unused-pages'
    | 'unused-voices'
    | 'no-topics'
    | 'view-ready';
  message: string;
  capability?: string;
  view?: ViewId;
  /** The pages or recommendations it's about. */
  items?: string[];
}

/** The ways file's home key (modes/contract.ts): the default view, the views offered and each one's settings. */
export interface HomeWays {
  default?: ViewId;
  offered?: ViewId[];
  settings?: Partial<Record<ViewId, Record<string, unknown>>>;
}

/** What a site has towards the views' minimums. */
export interface Counts {
  strengths: number;
  pictures: number;
  highlights: number;
  everyPicture: boolean;
  keywords: number;
  proof: number;
  kinds: number;
  answers: number;
}

export function countsOf(picks: HomePicks, showcase: Showcase): Counts {
  const shown = picks.strengths.filter((s) => s.shown);
  const pictures = new Set([...shown.flatMap((s) => (s.picture ? [s.picture] : [])), ...picks.highlights.flatMap((h) => (h.picture ? [h.picture] : []))]);
  const keywords = new Set(shown.flatMap((s) => s.keywords.map((k) => k.toLowerCase())));
  const items = proofItems(picks);
  return {
    strengths: shown.length,
    pictures: pictures.size,
    highlights: picks.highlights.filter((h) => h.picture).length,
    everyPicture: shown.length > 0 && shown.every((s) => s.picture),
    keywords: keywords.size,
    proof: items.length,
    kinds: new Set(items.flatMap((p) => (p.kind ? [p.kind] : []))).size,
    answers: showcase.questions?.length ?? 0,
  };
}

const NEEDS: Record<keyof Minimum, (n: number) => string> = {
  strengths: (n) => `${n} ${n === 1 ? 'strength' : 'strengths'} with proof`,
  pictures: (n) => `${n} ${n === 1 ? 'picture' : 'pictures'}`,
  highlights: (n) => `${n} highlights with pictures`,
  everyPicture: () => 'a picture for every strength',
  keywords: (n) => `${n} keywords`,
  proof: (n) => `${n} proof items`,
  kinds: (n) => `${n} kinds of proof`,
  answers: (n) => `${n} answered questions`,
};

/** What a view still needs, as sentences ("Spotlight needs 4 highlights with pictures; you have 2"); empty when it's ready. */
export function shortOf(view: ViewId, c: Counts): string[] {
  const spec = CATALOGUE.views[view];
  const out: string[] = [];
  for (const [key, need] of Object.entries(spec.minimum) as [keyof Minimum, number | boolean][]) {
    if (key === 'everyPicture') {
      if (need && !c.everyPicture) out.push(`${spec.label} needs ${NEEDS.everyPicture(0)}`);
      continue;
    }
    const have = c[key] as number;
    if (have < (need as number)) out.push(`${spec.label} needs ${NEEDS[key](need as number)}; you have ${have}`);
  }
  return out;
}

/** Can a view be offered: built in this engine, and the site meets its minimum. */
export const canOffer = (view: ViewId, c: Counts) => CATALOGUE.views[view].built && shortOf(view, c).length === 0;

/**
 * The views visitors get (switcher.md §5): the person's offered views that are built and meet their minimum, and the
 * default among them; else Bento when it can be offered, else Classic, which is always there.
 */
export function effectiveViews(home: HomeWays, c: Counts): { default: ViewId; offered: ViewId[] } {
  const chosen = home.offered ?? (home.default ? [home.default] : []);
  const offered = VIEW_IDS.filter((v) => chosen.includes(v) && canOffer(v, c));
  const def: ViewId = home.default && offered.includes(home.default) ? home.default : canOffer('bento', c) ? 'bento' : 'classic';
  return { default: def, offered: offered.includes(def) ? offered : [def, ...offered] };
}

const FIVE_YEARS = 5 * 365.25 * 24 * 3600 * 1000;

/** The health report: blocking items first, then warnings, then opportunities. */
export function health(picks: HomePicks, showcase: Showcase, evidence: EvidenceIndex, home: HomeWays = {}): HealthItem[] {
  const out: HealthItem[] = [];
  const recentOn = (showcase.curation?.recent ?? 'some') !== 'off';
  const name = (id: string) => picks.strengths.find((s) => s.id === id)?.capability.name ?? id;

  for (const s of picks.strengths) {
    const c = s.capability;
    if (!s.shown) {
      out.push({ level: 'blocking', code: 'no-proof', capability: s.id, message: `${c.name} has no proof, so visitors don't see it. Pin a résumé line, add a topic to a page, or remove it` });
      continue;
    }
    const pages = s.all.filter((p) => p.source === 'page');
    if (pages.length === 0 && s.all.every((p) => p.source === 'resume')) out.push({ level: 'warning', code: 'resume-only', capability: s.id, message: `${c.name} is proved only by résumé lines. Write a page that shows it` });
    if (s.total === 1) out.push({ level: 'warning', code: 'one-proof', capability: s.id, message: `${c.name} has one proof item. Pin another, or loosen matching` });
    if (!s.picture) out.push({ level: 'warning', code: 'no-picture', capability: s.id, message: `${c.name} has no picture. Choose one, or pin a page that has one` });
    if (recentOn && pages.length && pages.every((p) => evidence.now - (evidence.byId.get(p.id!)?.time ?? 0) > FIVE_YEARS))
      out.push({ level: 'warning', code: 'old-proof', capability: s.id, message: `All of ${c.name}'s pages are more than 5 years old. Review them, or turn Prefer recent work off` });
    const stale = pages.filter((p) => evidence.byId.get(p.id!)?.stale).map((p) => p.ref!);
    if (stale.length) out.push({ level: 'warning', code: 'stale', capability: s.id, items: stale, message: `${c.name} uses ${stale.length === 1 ? 'a page marked stale' : `${stale.length} pages marked stale`}` });
  }

  const leads = new Map<string, string[]>();
  for (const s of picks.strengths) if (s.shown && s.headline?.id) leads.set(s.headline.id, [...(leads.get(s.headline.id) ?? []), s.id]);
  for (const [page, by] of leads)
    if (by.length > 1) out.push({ level: 'warning', code: 'shared-headline', items: [page], message: `${by.map(name).join(' and ')} lead with the same page. Pin another page to one of them` });

  const counts = countsOf(picks, showcase);
  const views = new Set<ViewId>([...(home.offered ?? []), ...(home.default ? [home.default] : [])]);
  for (const v of views) for (const message of shortOf(v, counts)) out.push({ level: 'warning', code: 'below-minimum', view: v, message });

  const used = new Set(picks.strengths.flatMap((s) => s.all.flatMap((p) => (p.id ? [p.id] : []))));
  const unused = evidence.pages.filter((e) => !used.has(e.id)).map((e) => e.ref);
  if (unused.length) out.push({ level: 'opportunity', code: 'unused-pages', items: unused, message: `${unused.length} published ${unused.length === 1 ? 'page proves' : 'pages prove'} no strength. Add a topic, map its section, or leave ${unused.length === 1 ? 'it' : 'them'}` });

  const voices = new Set([...picks.strengths.flatMap((s) => (s.voice ? [s.voice.recommendation] : [])), ...(showcase.lenses ?? []).flatMap((l) => (l.voice ? [l.voice] : []))]);
  const quiet = evidence.recommendations.filter((r) => !voices.has(r.id)).map((r) => r.id);
  if (quiet.length) out.push({ level: 'opportunity', code: 'unused-voices', items: quiet, message: `${quiet.length} ${quiet.length === 1 ? 'recommendation isn’t' : 'recommendations aren’t'} used as a voice. Pick a sentence` });

  const bare = evidence.pages.filter((e) => e.topics.length === 0).map((e) => e.ref);
  if (bare.length) out.push({ level: 'opportunity', code: 'no-topics', items: bare, message: `${bare.length} ${bare.length === 1 ? 'page has' : 'pages have'} no topics` });

  for (const v of VIEW_IDS) if (v !== 'classic' && !views.has(v) && canOffer(v, counts)) out.push({ level: 'opportunity', code: 'view-ready', view: v, message: `${CATALOGUE.views[v].label} is ready to offer` });

  const rank: Record<HealthLevel, number> = { blocking: 0, warning: 1, opportunity: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Pages pinned or held somewhere in the spine (for the editor's "used by the home page" tags). */
export const spineRefs = (showcase: Showcase): Set<string> =>
  new Set(
    [
      ...showcase.capabilities.flatMap((c) => [...(c.proof ?? []).flatMap((p) => (p.ref ? [p.ref] : [])), ...(c.hide ?? [])]),
      ...(showcase.highlights ?? []).map((h) => h.ref),
      ...(showcase.facts ?? []).map((f) => f.source),
    ].map(refId),
  );
