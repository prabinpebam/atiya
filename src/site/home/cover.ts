/**
 * Cover's issue (documentation/home-views/cover.md §3, §4; for-every-site.md §4): a numbered cover line per strength
 * shown (L1, L2), each with its feature's words, picture and evidence (L3), and the cover story and picture. The
 * person's choices win: Cover story and Cover picture; a lens puts its first strength's story on the cover. Pure.
 */
import { evidenceLabel } from './bento';
import type { HomePicks } from './curate';
import { evidenceOf, strengthsInOrder, type EvidenceItem, type PresentEnv } from './present';

export interface CoverSettings {
  /** Full: a feature per strength, with its picture; calm: a compact list of the same. */
  density: 'calm' | 'full';
  /** The person's order, or by the depth of their proof (a lens overrides both). */
  order: 'yours' | 'strongest';
  /** The cover picture (a public media ID), over the story's. */
  picture?: string;
  /** The cover story: a highlight's ID or its page's ref. */
  story?: string;
}

export const COVER_DEFAULTS: CoverSettings = { density: 'full', order: 'yours' };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The view's settings as Cover reads them, anything unknown taken as its default. */
export function coverSettings(s: Record<string, unknown> = {}): CoverSettings {
  const picture = text(s.picture);
  const story = text(s.story);
  return {
    density: s.density === 'calm' || s.density === 'full' ? s.density : COVER_DEFAULTS.density,
    order: s.order === 'yours' || s.order === 'strongest' ? s.order : COVER_DEFAULTS.order,
    ...(picture ? { picture } : {}),
    ...(story ? { story } : {}),
  };
}

/** A strength as a cover line and its feature. */
export interface CoverLine {
  id: string;
  /** Its place in the issue, two figures: "01". */
  number: string;
  name: string;
  short: string;
  line: string;
  /** Its strongest kind and how much proves it: "Led · 4 pieces of evidence". */
  label: string;
  /** A media ID. */
  picture?: string;
  details: EvidenceItem[];
}

export interface CoverStory {
  /** The page's ID and address. */
  id: string;
  href: string;
  title: string;
  /** The strength it's a story of. */
  capability: string;
  /** A media ID. */
  picture?: string;
}

export interface CoverIssue {
  lines: CoverLine[];
  story?: CoverStory;
  /** The cover picture: the person's, else the story's, else the first strength's. A media ID. */
  picture?: string;
}

/** The cover story: the person's, else (with a lens) its first strength's first highlight, else the first highlight. Only an open page of a strength shown. */
function storyOf(picks: HomePicks, settings: CoverSettings, lines: CoverLine[], env: PresentEnv): CoverStory | undefined {
  const shown = new Set(lines.map((l) => l.id));
  const candidates = picks.highlights.filter((h) => shown.has(h.capability) && env.pageHref(h.id));
  const chosen = settings.story ? candidates.find((h) => h.id === settings.story || h.ref === settings.story) : undefined;
  const lensFirst = picks.lens ? candidates.find((h) => h.capability === lines[0]?.id) : undefined;
  const h = chosen ?? lensFirst ?? candidates[0];
  if (!h) return undefined;
  return { id: h.id, href: env.pageHref(h.id)!, title: h.title, capability: h.capability, ...(h.picture ? { picture: h.picture } : {}) };
}

export function coverIssue(picks: HomePicks, settings: CoverSettings, env: PresentEnv): CoverIssue {
  const lines: CoverLine[] = strengthsInOrder(picks, settings.order).map((s, i) => ({
    id: s.id,
    number: String(i + 1).padStart(2, '0'),
    name: s.capability.name,
    short: s.capability.short,
    line: s.capability.line,
    label: evidenceLabel(s, picks.goal),
    ...(s.picture ? { picture: s.picture } : {}),
    details: evidenceOf(s, env),
  }));
  const story = storyOf(picks, settings, lines, env);
  const picture = settings.picture ?? story?.picture ?? lines.find((l) => l.picture)?.picture;
  return { lines, ...(story ? { story } : {}), ...(picture ? { picture } : {}) };
}
