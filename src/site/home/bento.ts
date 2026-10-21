/**
 * Bento's tiles (documentation/home-views/bento.md §4, for-every-site.md §4): one per strength shown, each with its
 * name, line, label, quote and picture (L1, L2) and its evidence (L3), laid out for 3 to 6 strengths. Pure.
 */
import type { HomePicks, StrengthPicks } from './curate';
import type { ThumbnailShape } from '../design/pictures';
import { KIND_LABEL, evidenceOf, strengthsInOrder, strongestKind, type EvidenceItem, type PresentEnv, type Voice } from './present';

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

/**
 * Tiles two rows tall, for a strength whose picture earns the room: n strengths in k columns, so 2k − n of the
 * first k stand two rows tall and every tile is still in the first two rows (its name on the first screen). The
 * counts not here, or too few pictures among the first k, keep SPANS, one row each.
 */
export const TALL_COLUMNS: Record<number, number> = { 3: 2, 4: 3, 5: 3, 6: 4 };

/** The picture a two-row tile shows, by how wide it is: its frame is about square at 3 of 12 columns, 3:2 at 4, wide at 6. */
export const tallShape = (span: number): ThumbnailShape => (span <= 3 ? 'square' : span <= 4 ? 'thumbnail' : 'wide');

/** Each tile's columns and rows, in order: the richest of the first k with a picture (a quote, then the most proof) stand tall. */
export function bentoLayout(tiles: { picture: boolean; quote: boolean; total: number }[]): { span: number; rows: 1 | 2 }[] {
  const n = tiles.length;
  const flat = tiles.map((_, i) => ({ span: SPANS[Math.min(6, Math.max(1, n))]?.[i] ?? 4, rows: 1 as const }));
  const k = TALL_COLUMNS[n];
  if (!k) return flat;
  const tall = tiles
    .slice(0, k)
    .map((t, i) => ({ ...t, i }))
    .filter((t) => t.picture)
    .sort((a, b) => Number(b.quote) - Number(a.quote) || b.total - a.total || a.i - b.i)
    .slice(0, 2 * k - n)
    .map((t) => t.i);
  if (tall.length < 2 * k - n) return flat;
  return tiles.map((_, i) => ({ span: 12 / k, rows: tall.includes(i) ? 2 : 1 }));
}

export interface BentoTile {
  id: string;
  name: string;
  short: string;
  line: string;
  /** Its strongest kind and how much proves it: "Led · 4 pieces of evidence". */
  label: string;
  quote?: Voice;
  /** Media IDs: tall, the picture a two-row tile shows (tallShape); side, the square beside a tile's words on a narrower screen. */
  pictures?: { tall?: string; side: string };
  /** Columns of 12 on a wide screen. */
  span: number;
  /** Rows on a wide screen: 2 for a tile whose picture earns the room. */
  rows: 1 | 2;
  details: EvidenceItem[];
}

export const evidenceLabel = (s: Pick<StrengthPicks, 'all' | 'total'>, goal: HomePicks['goal']) => {
  const kind = strongestKind(s, goal);
  const count = `${s.total} ${s.total === 1 ? 'piece' : 'pieces'} of evidence`;
  return kind ? `${KIND_LABEL[kind]} · ${count}` : count;
};

/** The tiles, in order: the lens's, else the person's, else strongest first; only strengths with proof (CU7). */
export function bentoTiles(picks: HomePicks, settings: BentoSettings, env: PresentEnv): BentoTile[] {
  const ordered = strengthsInOrder(picks, settings.order);
  const shapes = ordered.map((s): Partial<Record<ThumbnailShape, string>> | undefined => {
    if (settings.pictures === 'none') return undefined;
    const one = settings.pictures === 'chosen' ? s.capability.media : s.pictures ? undefined : s.picture;
    return one ? { wide: one, thumbnail: one, square: one } : settings.pictures === 'work' ? s.pictures : undefined;
  });
  const layout = bentoLayout(ordered.map((s, i) => ({ picture: !!shapes[i]?.square, quote: !!s.voice, total: s.total })));
  return ordered.map((s, i) => {
    const who = s.voice ? env.person(s.voice.recommendation) : undefined;
    const { span, rows } = layout[i];
    const shape = shapes[i];
    const pictures = shape?.square ? { side: shape.square, ...(rows === 2 ? { tall: shape[tallShape(span)] ?? shape.square } : {}) } : undefined;
    return {
      id: s.id,
      name: s.capability.name,
      short: s.capability.short,
      line: s.capability.line,
      label: evidenceLabel(s, picks.goal),
      ...(s.voice && who ? { quote: { recommendation: s.voice.recommendation, quote: s.voice.quote, name: who.name, ...(who.title ? { title: who.title } : {}) } } : {}),
      ...(pictures ? { pictures } : {}),
      span,
      rows,
      details: evidenceOf(s, env),
    };
  });
}
