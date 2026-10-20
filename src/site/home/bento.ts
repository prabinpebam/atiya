/**
 * Bento's tiles (documentation/home-views/bento.md §4, for-every-site.md §4): one per strength shown, each with its
 * name, line, label, quote and picture (L1, L2) and its evidence (L3), laid out for 3 to 6 strengths. Pure.
 */
import type { HomePicks, StrengthPicks } from './curate';
import { KIND_LABEL, evidenceOf, strongestKind, type EvidenceItem, type PresentEnv, type Voice } from './present';

export interface BentoSettings {
  /** What the first and largest place shows. */
  lead: 'who' | 'highlight' | 'voice';
  /** Calm: the quote on hover and focus; Full: the quote at rest too. */
  density: 'calm' | 'full';
  /** From the work, Chosen only, Type only. */
  pictures: 'work' | 'chosen' | 'none';
  /** The person's order, or by the depth of their proof (a lens overrides both). */
  order: 'yours' | 'strongest';
  /** In their words, beside the lead. */
  words: 'on' | 'off';
}

export const BENTO_DEFAULTS: BentoSettings = { lead: 'who', density: 'calm', pictures: 'work', order: 'yours', words: 'on' };

const pickOf = <K extends keyof BentoSettings>(key: K, v: unknown, values: readonly BentoSettings[K][]): BentoSettings[K] => (values.includes(v as BentoSettings[K]) ? (v as BentoSettings[K]) : BENTO_DEFAULTS[key]);

/** The view's settings as Bento reads them, anything unknown taken as its default. */
export const bentoSettings = (s: Record<string, unknown> = {}): BentoSettings => ({
  lead: pickOf('lead', s.lead, ['who', 'highlight', 'voice']),
  density: pickOf('density', s.density, ['calm', 'full']),
  pictures: pickOf('pictures', s.pictures, ['work', 'chosen', 'none']),
  order: pickOf('order', s.order, ['yours', 'strongest']),
  words: pickOf('words', s.words, ['on', 'off']),
});

/** How many of the 12 columns each tile takes, by how many strengths there are (for-every-site §4). */
export const SPANS: Record<number, number[]> = {
  1: [12],
  2: [6, 6],
  3: [4, 4, 4],
  4: [6, 6, 6, 6],
  5: [6, 6, 4, 4, 4],
  6: [4, 4, 4, 4, 4, 4],
};

export interface BentoTile {
  id: string;
  name: string;
  short: string;
  line: string;
  /** Its strongest kind and how much proves it: "Led · 4 pieces of evidence". */
  label: string;
  quote?: Voice;
  /** A media ID. */
  picture?: string;
  /** Columns of 12 on a wide screen. */
  span: number;
  details: EvidenceItem[];
}

export const evidenceLabel = (s: Pick<StrengthPicks, 'all' | 'total'>, goal: HomePicks['goal']) => {
  const kind = strongestKind(s, goal);
  const count = `${s.total} ${s.total === 1 ? 'piece' : 'pieces'} of evidence`;
  return kind ? `${KIND_LABEL[kind]} · ${count}` : count;
};

/** The tiles, in order: the lens's, else the person's, else strongest first; only strengths with proof (CU7). */
export function bentoTiles(picks: HomePicks, settings: BentoSettings, env: PresentEnv): BentoTile[] {
  const shown = picks.strengths.filter((s) => s.shown);
  const ordered = settings.order === 'strongest' && !picks.lens ? shown.map((s, i) => ({ s, i })).sort((a, b) => b.s.weight - a.s.weight || a.i - b.i).map((x) => x.s) : shown;
  const spans = SPANS[Math.min(6, Math.max(1, ordered.length))] ?? [];
  return ordered.map((s, i) => {
    const who = s.voice ? env.person(s.voice.recommendation) : undefined;
    const picture = settings.pictures === 'none' ? undefined : settings.pictures === 'chosen' ? s.capability.media : s.picture;
    return {
      id: s.id,
      name: s.capability.name,
      short: s.capability.short,
      line: s.capability.line,
      label: evidenceLabel(s, picks.goal),
      ...(s.voice && who ? { quote: { recommendation: s.voice.recommendation, quote: s.voice.quote, name: who.name, ...(who.title ? { title: who.title } : {}) } } : {}),
      ...(picture ? { picture } : {}),
      span: spans[i] ?? 4,
      details: evidenceOf(s, env),
    };
  });
}
