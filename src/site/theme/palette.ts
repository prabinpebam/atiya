/**
 * A theme's colours (documentation/site-ui/theming.md §6): a palette generated from a seed in OKLCH, following
 * the site's own design logic (each role keeps the ramp step the site's tokens give it), then held to WCAG 2.2
 * AA by moving the lightness of whatever fails; roles a person sets one by one go on top, checked but untouched.
 */
import type { ThemeBase } from './base';
import { alphaOf, contrastOf, hexToLch, hueDistance, isHex, lchToHex, parseRgb, toHex, type Lch } from './color';
import { COLOR_ROLES, type ColorRole, type Colors, type Neutral, type Seed } from './model';

export type Mode = 'light' | 'dark';
export type RoleMap = Record<string, string>;

export interface ThemePalette {
  light: RoleMap;
  dark: RoleMap;
  /** Generated roles moved to pass contrast, as `mode:role`. */
  adjusted: string[];
}

// ---------- the contrast rules (the same as tests/unit/siteDesignSystem.test.ts holds the site's own palette to) ----------

export interface Rule {
  fg: ColorRole;
  on: ColorRole[];
  min: number;
  /** What moves when it fails: the foreground, the background, or the foreground picked from light or dark. */
  fix: 'fg' | 'bg' | 'pick';
}

const SURFACES: ColorRole[] = ['bg', 'bg-raised', 'bg-sunk', 'bg-hover'];

export const RULES: readonly Rule[] = [
  ...(['text', 'text-muted', 'accent', 'accent-hover', 'positive', 'negative', 'highlight-ink'] as ColorRole[]).map((fg): Rule => ({ fg, on: SURFACES, min: 4.5, fix: 'fg' })),
  { fg: 'muted-strong', on: ['bg'], min: 7, fix: 'fg' },
  { fg: 'border-strong', on: ['bg'], min: 4.5, fix: 'fg' },
  { fg: 'rule-strong', on: ['bg'], min: 3, fix: 'fg' },
  { fg: 'border', on: ['bg', 'bg-raised'], min: 3, fix: 'fg' },
  { fg: 'focus', on: ['bg', 'bg-raised'], min: 3, fix: 'fg' },
  { fg: 'icon-secondary', on: ['bg', 'bg-raised'], min: 3, fix: 'fg' },
  { fg: 'indicator', on: ['bg'], min: 3, fix: 'fg' },
  { fg: 'on-accent', on: ['accent', 'accent-hover'], min: 4.5, fix: 'pick' },
  { fg: 'on-accent-soft', on: ['accent-soft'], min: 4.5, fix: 'fg' },
  { fg: 'on-highlight', on: ['highlight'], min: 4.5, fix: 'pick' },
  { fg: 'text', on: ['mark', 'positive-soft', 'negative-soft', 'accent-soft'], min: 4.5, fix: 'bg' },
];

export interface Issue {
  mode: Mode;
  fg: ColorRole;
  on: ColorRole;
  ratio: number;
  min: number;
}

/** Every pair below its rule's contrast, in both modes. */
export function contrastIssues(p: { light: RoleMap; dark: RoleMap }): Issue[] {
  const out: Issue[] = [];
  for (const mode of ['light', 'dark'] as Mode[])
    for (const r of RULES)
      for (const on of r.on) {
        const ratio = contrastOf(p[mode][r.fg], p[mode][on]);
        if (ratio < r.min - 1e-6) out.push({ mode, fg: r.fg, on, ratio: Math.round(ratio * 100) / 100, min: r.min });
      }
  return out;
}

const passes = (fg: string, ons: string[], min: number) => ons.every((b) => contrastOf(fg, b) >= min);
const worst = (fg: string, ons: string[]) => Math.min(...ons.map((b) => contrastOf(fg, b)));

/** The colour moved in lightness, away from `from`, until it has `min` against every one of `ons` (or can't move further). */
function moveAway(c: string, ons: string[], min: number): string {
  if (passes(c, ons, min)) return c;
  const lch = hexToLch(c);
  const ref = hexToLch(ons[0]);
  const dir = lch.l <= ref.l ? -1 : 1;
  let best = c;
  for (let i = 1; i <= 100; i++) {
    const l = lch.l + dir * i * 0.01;
    if (l < 0 || l > 1) break;
    const next = lchToHex({ ...lch, l });
    best = next;
    if (passes(next, ons, min)) return next;
  }
  // the other way, if this way couldn't (a mid-grey surface)
  for (let i = 1; i <= 100; i++) {
    const l = lch.l - dir * i * 0.01;
    if (l < 0 || l > 1) break;
    const next = lchToHex({ ...lch, l });
    if (passes(next, ons, min)) return next;
  }
  return worst(best, ons) > worst(c, ons) ? best : c;
}

/** Holds a palette to the rules: returns the roles it had to move. */
export function enforce(roles: RoleMap, mode: Mode, light: { white: string; ink: string }): string[] {
  const moved = new Set<string>();
  const set = (role: string, v: string) => {
    if (roles[role] !== v) {
      roles[role] = v;
      moved.add(`${mode}:${role}`);
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const r of RULES) {
      const ons = r.on.map((o) => roles[o]);
      if (passes(roles[r.fg], ons, r.min)) continue;
      changed = true;
      if (r.fix === 'fg') set(r.fg, moveAway(roles[r.fg], ons, r.min));
      else if (r.fix === 'bg') for (const o of r.on) set(o, moveAway(roles[o], [roles[r.fg]], r.min));
      else {
        // text on a fill: white or ink, whichever reads; if neither does, the fill moves away from the better
        const pick = [light.white, light.ink].sort((a, b) => worst(b, ons) - worst(a, ons))[0];
        set(r.fg, pick);
        if (!passes(pick, ons, r.min)) for (const o of r.on) set(o, moveAway(roles[o], [pick], r.min));
      }
    }
    if (!changed) break;
  }
  return [...moved];
}

// ---------- generating a palette from a seed ----------

type Family = 'accent' | 'highlight' | 'neutral';

const familyOf = (path: string): Family | null =>
  /^p\.color\.indigo\./.test(path) ? 'accent' : /^p\.color\.marigold\./.test(path) ? 'highlight' : /^p\.color\.(stock\.|ink$|chalk$)/.test(path) ? 'neutral' : null;

/** A ramp re-hued and re-saturated for a seed, its anchor step moved to the seed's own lightness and its neighbours with it. */
function shiftRamp(steps: [string, string][], anchor: string, seed: Lch): Record<string, string> {
  const a = hexToLch(steps.find(([p]) => p === anchor)?.[1] ?? steps[0][1]);
  const out: Record<string, string> = {};
  for (const [path, hex] of steps) {
    const s = hexToLch(hex);
    const w = Math.max(0, 1 - Math.abs(s.l - a.l) / 0.5);
    const c = a.c > 0.005 ? s.c * (seed.c / a.c) : seed.c;
    out[path] = lchToHex({ l: s.l + (seed.l - a.l) * w, c, h: seed.h });
  }
  return out;
}

const NEUTRAL_HUE: Record<Exclude<Neutral, 'warm' | 'tinted'>, number | null> = { neutral: null, cool: 250 };

function neutralRamp(steps: [string, string][], neutral: Neutral, accent: Lch): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, hex] of steps) {
    if (neutral === 'warm') {
      out[path] = hex;
      continue;
    }
    const s = hexToLch(hex);
    if (neutral === 'neutral') out[path] = lchToHex({ ...s, c: 0 });
    else if (neutral === 'cool') out[path] = lchToHex({ ...s, h: NEUTRAL_HUE.cool! });
    else out[path] = lchToHex({ l: s.l, c: Math.min(0.03, s.c * 1.2), h: accent.h });
  }
  return out;
}

/** A highlight for an accent: the site's own relation (indigo to marigold is about 160° round the wheel), at marigold's lightness. */
export function autoHighlight(accent: string, base: ThemeBase): string {
  const anchor = base.refs.light.highlight ?? 'p.color.marigold.400';
  const m = hexToLch(base.primitives[anchor]);
  const a = hexToLch(accent);
  return lchToHex({ l: m.l, c: m.c, h: (a.h + 160) % 360 });
}

/** The primitives a seed changes, by path. */
export function seedPrimitives(base: ThemeBase, seed: Seed): Record<string, string> {
  const families: Record<Family, [string, string][]> = { accent: [], highlight: [], neutral: [] };
  for (const [path, v] of Object.entries(base.primitives)) {
    const f = familyOf(path);
    if (f && isHex(v)) families[f].push([path, v]);
  }
  const accent = hexToLch(seed.accent);
  const highlight = hexToLch(seed.highlight ?? autoHighlight(seed.accent, base));
  return {
    ...shiftRamp(families.accent, base.refs.light.accent ?? 'p.color.indigo.700', accent),
    ...shiftRamp(families.highlight, base.refs.light.highlight ?? 'p.color.marigold.400', highlight),
    ...neutralRamp(families.neutral, seed.neutral ?? 'warm', accent),
  };
}

const rgba = (hex: string, a: number) => {
  const [r, g, b] = parseRgb(hex);
  return `rgb(${r} ${g} ${b} / ${a})`;
};

/** The translucent roles that follow the accent: the frosted scrollbar handle. */
function derive(roles: RoleMap, base: ThemeBase, mode: Mode) {
  for (const r of ['frost', 'frost-strong']) roles[r] = rgba(roles.accent, alphaOf(base.roles[mode][r]));
}

/** A theme's colours: the site's own, or generated from its seed and held to AA, then the roles set by hand. */
export function themePalette(base: ThemeBase, colors: Colors = {}): ThemePalette {
  const adjusted: string[] = [];
  const prims = colors.seed ? seedPrimitives(base, colors.seed) : {};
  const ends = { white: base.primitives['p.color.stock.0'] ?? '#FFFFFF', ink: prims['p.color.stock.950'] ?? base.primitives['p.color.stock.950'] ?? '#12100E' };
  const out = { light: {} as RoleMap, dark: {} as RoleMap };
  for (const mode of ['light', 'dark'] as Mode[]) {
    const roles = out[mode];
    for (const [role, v] of Object.entries(base.roles[mode])) {
      const ref = base.refs[mode][role];
      roles[role] = ref && prims[ref] ? prims[ref] : v;
    }
    if (colors.seed) adjusted.push(...enforce(roles, mode, ends));
    for (const [role, v] of Object.entries(colors[mode] ?? {})) if (isHex(v) && (COLOR_ROLES as readonly string[]).includes(role)) roles[role] = v.toUpperCase();
    if (colors.seed || colors[mode]?.accent) derive(roles, base, mode);
  }
  return { ...out, adjusted };
}

/** The roles set by hand, made to pass: what the Theme screen's "Fix contrast" writes. */
export function fixContrast(base: ThemeBase, colors: Colors): Colors {
  const p = themePalette(base, colors);
  const ends = { white: '#FFFFFF', ink: base.primitives['p.color.stock.950'] ?? '#12100E' };
  const next: Colors = { ...colors };
  for (const mode of ['light', 'dark'] as Mode[]) {
    const roles = { ...p[mode] };
    const moved = enforce(roles, mode, ends);
    if (!moved.length) continue;
    const own = { ...(colors[mode] ?? {}) };
    for (const m of moved) {
      const role = m.split(':')[1] as ColorRole;
      own[role] = roles[role];
    }
    next[mode] = own;
  }
  return next;
}

/** Two colours are distinct enough to be told apart in a palette. */
export const distinct = (a: string, b: string): boolean => {
  const x = hexToLch(a);
  const y = hexToLch(b);
  return Math.abs(x.l - y.l) > 0.12 || (Math.min(x.c, y.c) > 0.04 && hueDistance(x.h, y.h) > 25);
};

export { toHex };
