/**
 * Spotlight's show (documentation/home-views/spotlight.md §3, §5; for-every-site.md §4): one highlight at a time on
 * the stage (L2) with its details (L3), the rail naming every highlight and Jump to naming every strength shown (L1).
 * In the person's order the highlights keep the picks' (pins first); a lens or Strongest first deals them out over
 * the strengths in that order, one each before any gets a second, so the first is the lens's own (P2). Pure.
 */
import { CATALOGUE } from './catalogue';
import type { HighlightPick, HomePicks, StrengthPicks } from './curate';
import { evidenceItem, evidenceOf, strengthsInOrder, type EvidenceItem, type PresentEnv } from './present';

export interface SpotlightSettings {
  /** How a change of highlight moves: still (a swap), gentle (a fade), lively (a slide). Never on its own. */
  motion: 'still' | 'gentle' | 'lively';
  /** The person's order, or by the depth of their proof (a lens overrides both). */
  order: 'yours' | 'strongest';
  /** How many highlights, 4 to 8. */
  count: number;
  /** The rail: titles, or thumbnails (not built yet: shown as titles). */
  rail: 'titles' | 'thumbnails';
}

const COUNT = CATALOGUE.views.spotlight.settings.count;
const MIN = COUNT.min ?? 4;
const MAX = COUNT.max ?? 8;

export const SPOTLIGHT_DEFAULTS: SpotlightSettings = { motion: 'gentle', order: 'yours', count: MAX, rail: 'titles' };

const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);

/** The view's settings as Spotlight reads them, anything unknown taken as its default. */
export function spotlightSettings(s: Record<string, unknown> = {}): SpotlightSettings {
  const n = typeof s.count === 'number' && Number.isFinite(s.count) ? Math.round(s.count) : SPOTLIGHT_DEFAULTS.count;
  return {
    motion: oneOf(s.motion, ['still', 'gentle', 'lively'], SPOTLIGHT_DEFAULTS.motion),
    order: oneOf(s.order, ['yours', 'strongest'], SPOTLIGHT_DEFAULTS.order),
    count: Math.min(MAX, Math.max(MIN, n)),
    rail: oneOf(s.rail, ['titles', 'thumbnails'], SPOTLIGHT_DEFAULTS.rail),
  };
}

/** A highlight on the stage. */
export interface SpotlightSlide {
  /** Its page's ID: its address is #h-<id>. */
  id: string;
  href: string;
  title: string;
  /** The strength it proves. */
  capability: { id: string; name: string; short: string };
  /** A media ID. */
  picture?: string;
  /** Its page first, then the rest of its strength's evidence: at most 5. */
  details: EvidenceItem[];
}

/** A strength in Jump to. */
export interface SpotlightJump {
  id: string;
  name: string;
  short: string;
  /** Its highlights' IDs, in the show's order: a press goes to the first, again to the next. */
  slides: string[];
  /** Its first highlight's address; with none on the stage, its first evidence that leads somewhere. */
  href?: string;
}

export interface SpotlightShow {
  slides: SpotlightSlide[];
  jump: SpotlightJump[];
}

export const MAX_DETAILS = 5;

/** The highlights dealt out over the strengths in order, one each per round, each strength's in the picks' order. */
function dealt(highlights: HighlightPick[], order: StrengthPicks[]): HighlightPick[] {
  const queues = order.map((s) => highlights.filter((h) => h.capability === s.id));
  const out: HighlightPick[] = [];
  for (let round = 0; out.length < highlights.length && queues.some((q) => q.length > round); round++) for (const q of queues) if (q[round]) out.push(q[round]);
  return out;
}

function detailsOf(h: HighlightPick, s: StrengthPicks, href: string, env: PresentEnv): EvidenceItem[] {
  const own = s.all.find((p) => p.source === 'page' && p.id === h.id);
  const first = (own && evidenceItem(own, s, env)) ?? { key: `page:${h.id}`, source: 'page' as const, title: h.title, href };
  return [first, ...evidenceOf(s, env).filter((e) => e.key !== first.key)].slice(0, MAX_DETAILS);
}

export function spotlightShow(picks: HomePicks, settings: SpotlightSettings, env: PresentEnv): SpotlightShow {
  const strengths = strengthsInOrder(picks, settings.order);
  const byId = new Map(strengths.map((s) => [s.id, s]));
  const open = picks.highlights.filter((h) => byId.has(h.capability) && env.pageHref(h.id));
  const ordered = settings.order === 'yours' && !picks.lens ? open : dealt(open, strengths);
  const slides: SpotlightSlide[] = ordered.slice(0, settings.count).map((h) => {
    const s = byId.get(h.capability)!;
    const href = env.pageHref(h.id)!;
    return {
      id: h.id,
      href,
      title: h.title,
      capability: { id: s.id, name: s.capability.name, short: s.capability.short },
      ...(h.picture ? { picture: h.picture } : {}),
      details: detailsOf(h, s, href, env),
    };
  });
  const jump: SpotlightJump[] = strengths.map((s) => {
    const own = slides.filter((x) => x.capability.id === s.id).map((x) => x.id);
    const href = own[0] ? `#h-${own[0]}` : evidenceOf(s, env).find((e) => e.href)?.href;
    return { id: s.id, name: s.capability.name, short: s.capability.short, slides: own, ...(href ? { href } : {}) };
  });
  return { slides, jump };
}
