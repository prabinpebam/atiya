/**
 * Change view's stills (documentation/home-views/switcher.md §1): a small schematic drawing of each view's
 * first screen, made from the site's own numbers (how many strengths it shows, or the hub's sections), so a
 * card shows what the view looks like before it's chosen. Pure geometry in an 8:5 box, drawn by ViewStill;
 * a `mark` is one per strength (or section), which the tests count. Tier 0: nothing here reads the content.
 */

/** The drawing's box, in its own units (the SVG's viewBox). */
export const STILL_BOX = { w: 160, h: 100 } as const;

/** How a shape is filled: a text bar (`ink`, `faint`), the spot colour (`accent`, `soft`), a sunk area, a card (`tile`) or an outline (`ring`). */
export type StillTone = 'ink' | 'faint' | 'accent' | 'soft' | 'sunk' | 'tile' | 'ring';

/** One rounded rectangle of a still (a circle is a square with half its side as radius). */
export interface StillShape {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius. */
  r: number;
  tone: StillTone;
  /** It stands for one strength (or one of the hub's sections). */
  mark?: boolean;
}

/** The views that have a drawing of their own; any other draws the lead and an empty area. */
export const STILL_VIEWS = ['classic', 'bento', 'cover', 'proof-grid', 'spotlight', 'keywords', 'questions'] as const;

const PAD = 8;
const GAP = 4;
const TOP = 26;
const BOTTOM = STILL_BOX.h - PAD;
const WIDE = STILL_BOX.w - PAD * 2;

const round = (n: number) => Math.round(n * 100) / 100;

/** How many marks a view draws: one to six strengths, one to four of the hub's sections. */
export function stillCount(view: string, count: number): number {
  const most = view === 'classic' ? 4 : 6;
  const n = Number.isFinite(count) ? Math.floor(count) : 1;
  return Math.min(most, Math.max(1, n));
}

type Draw = (n: number, add: (s: StillShape) => void) => void;

const shape = (x: number, y: number, w: number, h: number, r: number, tone: StillTone, mark?: boolean): StillShape => ({ x, y, w, h, r, tone, ...(mark ? { mark } : {}) });

/** The name and the one line every view opens with. */
const lead: Draw = (_n, add) => {
  add(shape(PAD, PAD, 52, 6, 3, 'ink'));
  add(shape(PAD, 17, 84, 3, 1.5, 'faint'));
};

const bento: Draw = (n, add) => {
  const cols = n <= 3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const h = (BOTTOM - TOP - GAP * (rows - 1)) / rows;
  for (let row = 0, i = 0; row < rows; row++) {
    const k = Math.min(cols, n - row * cols);
    const w = (WIDE - GAP * (k - 1)) / k;
    for (let c = 0; c < k; c++, i++) {
      const x = PAD + c * (w + GAP);
      const y = TOP + row * (h + GAP);
      add(shape(x, y, w, h, 3, i === 0 ? 'soft' : 'tile'));
      add(shape(x + 4, y + 4, 4, 4, 2, 'accent', true));
      add(shape(x + 4, y + 11, w * 0.6, 3, 1.5, 'ink'));
      if (h >= 22) add(shape(x + 4, y + 17, w * 0.75, 2, 1, 'faint'));
    }
  }
};

const cover: Draw = (n, add) => {
  add(shape(PAD, TOP, 76, BOTTOM - TOP, 3, 'soft'));
  add(shape(14, 78, 48, 4, 2, 'ink'));
  add(shape(14, 85, 34, 2, 1, 'faint'));
  const x = 92;
  add(shape(x, TOP, 36, 3, 1.5, 'faint'));
  const top = 34;
  const pitch = Math.min(10, (BOTTOM - top + GAP) / n);
  const s = Math.min(6, pitch - GAP);
  const widths = [44, 36, 40, 32, 42, 34];
  for (let i = 0; i < n; i++) {
    const y = top + i * pitch;
    add(shape(x, y, s, s, 1.5, 'accent', true));
    add(shape(x + s + 4, y + s / 2 - 1.5, widths[i], 3, 1.5, 'ink'));
  }
};

const proofGrid: Draw = (n, add) => {
  const cols = 5;
  const left = 62;
  const cell = 18;
  for (let j = 0; j < cols; j++) add(shape(left + j * cell + 3, TOP, 12, 3, 1.5, 'faint'));
  const top = 34;
  const pitch = (BOTTOM - top) / n;
  const c = Math.min(pitch - 3, 7);
  const names = [40, 32, 44, 36, 28, 38];
  for (let i = 0; i < n; i++) {
    const y = top + i * pitch;
    const mid = y + pitch / 2;
    if (i > 0) add(shape(PAD, y, WIDE, 0.6, 0, 'faint'));
    add(shape(PAD, mid - 1.5, names[i], 3, 1.5, 'ink', true));
    for (let j = 0; j < cols; j++) {
      const level = (i * 2 + j * 3) % 4;
      const d = level === 2 ? c * 0.7 : c;
      const cx = left + j * cell + cell / 2;
      add(shape(cx - d / 2, mid - d / 2, d, d, d / 2, level === 0 ? 'ring' : level === 1 ? 'soft' : 'accent'));
    }
  }
};

const spotlight: Draw = (n, add) => {
  const w = Math.min(22, (WIDE - GAP * (n - 1)) / n);
  for (let i = 0; i < n; i++) add(shape(PAD + i * (w + GAP), TOP, w, 6, 3, i === 0 ? 'accent' : 'tile', true));
  add(shape(PAD, 36, WIDE, 42, 3, 'sunk'));
  add(shape(12, 40, 56, 34, 2, 'soft'));
  add(shape(74, 44, 52, 4, 2, 'ink'));
  add(shape(74, 52, 64, 2, 1, 'faint'));
  add(shape(74, 57, 56, 2, 1, 'faint'));
  add(shape(74, 66, 26, 6, 3, 'accent'));
  const thumbs = 6;
  const t = (WIDE - GAP * (thumbs - 1)) / thumbs;
  for (let i = 0; i < thumbs; i++) add(shape(PAD + i * (t + GAP), 82, t, BOTTOM - 82, 2, i === 0 ? 'soft' : 'tile'));
};

const keywords: Draw = (n, add) => {
  const pitch = Math.min(14, (BOTTOM - TOP + GAP) / n);
  const h = Math.min(8, pitch - GAP);
  const sets = [
    [22, 12, 18, 14],
    [18, 20, 10, 16],
    [24, 10, 16, 12],
  ];
  const heads = [40, 32, 44, 36];
  for (let i = 0; i < n; i++) {
    const y = TOP + i * pitch;
    let x = PAD;
    sets[i % sets.length].forEach((w, k) => {
      add(shape(x, k === 0 ? y : y + 1, w, k === 0 ? h : h - 2, (k === 0 ? h : h - 2) / 2, k === 0 ? 'soft' : 'tile'));
      x += w + 3;
    });
    add(shape(106, y + h / 2 - 1.5, heads[i % heads.length], 3, 1.5, 'ink', true));
  }
};

const questions: Draw = (n, add) => {
  const tabs = 6;
  const th = 8;
  const tp = (BOTTOM - TOP - th) / (tabs - 1);
  const labels = [30, 26, 34, 24, 28, 32];
  for (let i = 0; i < tabs; i++) {
    const y = TOP + i * tp;
    if (i === 0) {
      add(shape(PAD, y, 46, th, 2, 'soft'));
      add(shape(PAD, y, 2, th, 1, 'accent'));
    }
    add(shape(12, y + 2.5, labels[i], 3, 1.5, i === 0 ? 'ink' : 'faint'));
  }
  add(shape(60, TOP, 92, BOTTOM - TOP, 3, 'sunk'));
  add(shape(66, 32, 56, 4, 2, 'ink'));
  const top = 42;
  const pitch = n > 1 ? Math.min(9, 44 / (n - 1)) : 0;
  const items = [60, 52, 66, 48, 58, 54];
  for (let i = 0; i < n; i++) {
    const y = top + i * pitch;
    add(shape(66, y, 4, 4, 2, 'accent', true));
    add(shape(74, y + 1, items[i], 2, 1, 'faint'));
  }
};

/** The classic hub: its opening (a name, a line, two buttons) and a row per section with its pages. */
const classic: Draw = (n, add) => {
  add(shape(PAD, PAD, 52, 6, 3, 'ink'));
  add(shape(PAD, 17, 84, 3, 1.5, 'faint'));
  add(shape(PAD, 24, 22, 6, 3, 'accent'));
  add(shape(34, 24, 22, 6, 3, 'ring'));
  const top = 40;
  const pitch = (BOTTOM - top + GAP) / n;
  const h = Math.min(18, pitch - GAP);
  const titles = [28, 22, 32, 26];
  const left = 48;
  const w = (STILL_BOX.w - PAD - left - GAP * 2) / 3;
  for (let i = 0; i < n; i++) {
    const y = top + i * pitch;
    add(shape(PAD, y + h / 2 - 1.5, titles[i], 3, 1.5, 'ink', true));
    for (let k = 0; k < 3; k++) add(shape(left + k * (w + GAP), y, w, h, 2, 'tile'));
  }
};

const empty: Draw = (_n, add) => add(shape(PAD, TOP, WIDE, BOTTOM - TOP, 3, 'sunk'));

const DRAW: Record<(typeof STILL_VIEWS)[number], Draw> = { classic, bento, cover, 'proof-grid': proofGrid, spotlight, keywords, questions };

/** A view's still: its shapes in drawing order, for `count` strengths (the classic hub: its sections). */
export function stillShapes(view: string, count: number): StillShape[] {
  const out: StillShape[] = [];
  const add = (s: StillShape) => out.push({ ...s, x: round(s.x), y: round(s.y), w: round(s.w), h: round(s.h), r: round(s.r) });
  const n = stillCount(view, count);
  const draw = (DRAW as Record<string, Draw | undefined>)[view];
  if (view !== 'classic') lead(n, add);
  (draw ?? empty)(n, add);
  return out;
}
