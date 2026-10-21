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
  /** The pictures' corners: square, unless the person asks for rounded. */
  corners: 'square' | 'rounded';
}

export const BENTO_DEFAULTS: BentoSettings = { lead: 'who', density: 'calm', pictures: 'work', order: 'yours', words: 'on', corners: 'square' };

const pickOf = <K extends keyof BentoSettings>(key: K, v: unknown, values: readonly BentoSettings[K][]): BentoSettings[K] => (values.includes(v as BentoSettings[K]) ? (v as BentoSettings[K]) : BENTO_DEFAULTS[key]);

/** The view's settings as Bento reads them, anything unknown taken as its default. */
export const bentoSettings = (s: Record<string, unknown> = {}): BentoSettings => ({
  lead: pickOf('lead', s.lead, ['who', 'highlight', 'voice']),
  density: pickOf('density', s.density, ['calm', 'full']),
  pictures: pickOf('pictures', s.pictures, ['work', 'chosen', 'none']),
  order: pickOf('order', s.order, ['yours', 'strongest']),
  words: pickOf('words', s.words, ['on', 'off']),
  corners: pickOf('corners', s.corners, ['square', 'rounded']),
});

/**
 * A tile's place in the tray (for-every-site §4), its picture carrying it: a feature is two columns by two rows, a
 * tall tile one by two (its square picture), a wide tile two by one (its wide picture), a single one by one (its
 * 3:2 picture). Two to a row, a feature and a wide tile take the row; one to a row, every tile does.
 */
export type BentoRole = 'feature' | 'tall' | 'wide' | 'single';

/** Each role's columns and rows: at the tray's widest (four columns) and two to a row. */
export const ROLE_SIZE: Record<BentoRole, { four: [number, number]; two: [number, number] }> = {
  feature: { four: [2, 2], two: [2, 1] },
  tall: { four: [1, 2], two: [1, 2] },
  wide: { four: [2, 1], two: [2, 1] },
  single: { four: [1, 1], two: [1, 1] },
};

/** The roles for n strengths, a whole rectangle of four columns (two for one strength): the bigger the role, the more its picture shows. */
export const ROLES: Record<number, BentoRole[]> = {
  1: ['wide'],
  2: ['feature', 'feature'],
  3: ['feature', 'wide', 'wide'],
  4: ['feature', 'tall', 'single', 'single'],
  5: ['feature', 'single', 'single', 'single', 'single'],
  6: ['feature', 'tall', 'single', 'single', 'wide', 'wide'],
};

/** The tray's columns at its widest, by how many strengths: four, or two for one. */
export const bentoColumns = (n: number): 2 | 4 => (n <= 1 ? 2 : 4);

/**
 * Where a grid of `columns` puts tiles of these sizes, in order, as CSS grid's dense auto-placement does (each
 * at the first place it fits, from the top): their top-left cells and whether they fill a whole rectangle.
 */
export function pack(sizes: [number, number][], columns: number): { at: [number, number][]; whole: boolean; inOrder: boolean } {
  const taken = new Set<string>();
  const at: [number, number][] = [];
  for (const [w, h] of sizes) {
    const cols = Math.min(w, columns);
    let placed: [number, number] | undefined;
    for (let r = 0; !placed; r++) {
      for (let c = 0; c + cols <= columns && !placed; c++) {
        let free = true;
        for (let dr = 0; dr < h && free; dr++) for (let dc = 0; dc < cols && free; dc++) if (taken.has(`${r + dr},${c + dc}`)) free = false;
        if (free) placed = [r, c];
      }
    }
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < cols; dc++) taken.add(`${placed[0] + dr},${placed[1] + dc}`);
    at.push(placed);
  }
  const rows = Math.max(0, ...[...taken].map((k) => Number(k.split(',')[0]) + 1));
  const inOrder = at.every((p, i) => i === 0 || p[0] > at[i - 1][0] || (p[0] === at[i - 1][0] && p[1] > at[i - 1][1]));
  return { at, whole: taken.size === rows * columns, inOrder };
}

const permutations = (roles: BentoRole[]): BentoRole[][] => {
  if (roles.length <= 1) return [roles];
  const out: BentoRole[][] = [];
  const seen = new Set<BentoRole>();
  roles.forEach((r, i) => {
    if (seen.has(r)) return;
    seen.add(r);
    for (const rest of permutations([...roles.slice(0, i), ...roles.slice(i + 1)])) out.push([r, ...rest]);
  });
  return out;
};

const AREA: Record<BentoRole, number> = { feature: 4, tall: 2, wide: 2, single: 1 };

/**
 * Each tile's role, in the person's order (never reordered): of the arrangements that fill a whole rectangle at
 * four columns and at two, read in order, the one that gives the most room to the tiles with a picture, then a
 * colleague's words, then the most proof, then the earlier.
 */
export function bentoRoles(tiles: { picture: boolean; quote: boolean; total: number }[]): BentoRole[] {
  const n = tiles.length;
  const base = ROLES[n] ?? tiles.map(() => 'single' as const);
  if (!ROLES[n]) return base;
  const columns = bentoColumns(n);
  const worth = tiles.map((t, i) => (t.picture ? 1000 : 0) + (t.quote ? 100 : 0) + Math.min(t.total, 50) + (n - i) / 100);
  let best = base;
  let bestScore = -Infinity;
  for (const roles of permutations(base)) {
    const four = pack(roles.map((r) => ROLE_SIZE[r].four), columns);
    const two = pack(roles.map((r) => ROLE_SIZE[r].two), 2);
    if (!four.whole || !four.inOrder || !two.whole || !two.inOrder) continue;
    const score = roles.reduce((s, r, i) => s + AREA[r] * worth[i], 0);
    if (score > bestScore) {
      best = roles;
      bestScore = score;
    }
  }
  return best;
}

/** The shape a role's picture is shown in at the tray's widest: its frame's shape, so the picture shows whole, uncropped. */
export const ROLE_SHAPE: Record<BentoRole, ThumbnailShape> = { feature: 'thumbnail', tall: 'square', wide: 'wide', single: 'thumbnail' };

export interface BentoTile {
  id: string;
  name: string;
  short: string;
  line: string;
  /** Its strongest kind and how much proves it: "Led · 4 pieces of evidence". */
  label: string;
  /** A few of its keywords, other than its name. */
  keywords: string[];
  quote?: Voice;
  /** Media IDs, one per shape (the same picture when it has only one): the tile shows the one its frame takes, whole. */
  pictures?: Partial<Record<ThumbnailShape, string>>;
  /** Its place in the tray. */
  role: BentoRole;
  details: EvidenceItem[];
}

/** How many keywords a tile shows under its line. */
export const TILE_KEYWORDS = 4;

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
  const roles = bentoRoles(ordered.map((s, i) => ({ picture: !!shapes[i]?.thumbnail, quote: !!s.voice, total: s.total })));
  return ordered.map((s, i) => {
    const who = s.voice ? env.person(s.voice.recommendation) : undefined;
    const pictures = shapes[i]?.thumbnail ? shapes[i] : undefined;
    const own = s.capability.name.toLowerCase();
    const keywords = s.keywords.filter((k) => k.toLowerCase() !== own).slice(0, TILE_KEYWORDS);
    return {
      id: s.id,
      name: s.capability.name,
      short: s.capability.short,
      line: s.capability.line,
      label: evidenceLabel(s, picks.goal),
      keywords,
      ...(s.voice && who ? { quote: { recommendation: s.voice.recommendation, quote: s.voice.quote, name: who.name, ...(who.title ? { title: who.title } : {}) } } : {}),
      ...(pictures ? { pictures } : {}),
      role: roles[i],
      details: evidenceOf(s, env),
    };
  });
}