/**
 * The themes panel's pure rules (documentation/site-ui/theming.md §8): the themes it lists, each one's draft, what
 * its status line says, which actions it offers, and how the type controls' percentages map to the model's steps.
 */
import { contrastOf } from '../../theme/color';
import type { ResolvedTheme } from '../../theme/css';
import { DEFAULT_THEME, TYPE_RANGE, isPreset, presetById, type ColorRole, type Theme, type TypeSettings } from '../../theme/model';
import { RULES, type Mode } from '../../theme/palette';

/** A theme the panel lists: a preset, or one of the person's own with the version it was read at. */
export interface ThemeEntry {
  theme: Theme;
  /** The file's version (null for a preset). */
  version: string | null;
}

/** Two themes are the same in everything a person can change. */
export const sameTheme = (a: Theme, b: Theme): boolean => {
  const pick = (t: Theme) => JSON.stringify([t.name, t.spacing, t.corners, t.fonts, t.type, t.colors]);
  return pick(a) === pick(b);
};

export interface Offer {
  save: boolean;
  saveAs: boolean;
  apply: boolean;
  revert: boolean;
  reset: boolean;
  rename: boolean;
  remove: boolean;
}

/** What the panel offers for the chosen theme: Save never on a preset, Apply unless it's in use and unchanged. */
export function offers(id: string, changed: boolean, active: string): Offer {
  const preset = isPreset(id);
  return { save: !preset && changed, saveAs: true, apply: changed || id !== active, revert: changed, reset: !preset, rename: !preset, remove: !preset };
}

/** The line under the theme's name. */
export function statusLine(t: Theme, changed: boolean, active: string): string {
  const parts: string[] = [];
  if (isPreset(t.id)) parts.push('Preset');
  else if (t.basedOn && presetById(t.basedOn)) parts.push(`Based on ${presetById(t.basedOn)!.name}`);
  if (t.id === active) parts.push('In use');
  if (changed) parts.push('Unsaved changes');
  return parts.join(' · ');
}

/** The name a copy of a theme is offered. */
export const copyName = (name: string, taken: Iterable<string>): string => {
  const names = new Set([...taken].map((n) => n.toLowerCase()));
  const base = `${name} copy`;
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
};

// ---------- the type controls, as percentages ----------

/** Each type control's slider, in percent of the site's own (100 %). */
export const TYPE_SLIDERS: { key: keyof TypeSettings; label: string; hint: string }[] = [
  { key: 'size', label: 'Overall size', hint: 'Every size, up or down.' },
  { key: 'largest', label: 'Largest text', hint: 'Display type and big headings; body text stays as it is.' },
  { key: 'smallest', label: 'Smallest text', hint: 'Captions and labels; body text stays as it is.' },
  { key: 'contrast', label: 'Step between sizes', hint: 'More is more dramatic; less is quieter.' },
];

export const sliderRange = (k: keyof TypeSettings) => ({ min: 100 + TYPE_RANGE[k].min * TYPE_RANGE[k].step * 100, max: 100 + TYPE_RANGE[k].max * TYPE_RANGE[k].step * 100, step: TYPE_RANGE[k].step * 100 });
export const toPercent = (k: keyof TypeSettings, v: number): number => Math.round(100 + v * TYPE_RANGE[k].step * 100);
export const fromPercent = (k: keyof TypeSettings, pct: number): number => Math.round((pct - 100) / (TYPE_RANGE[k].step * 100));

// ---------- colour ----------

/** The swatches a theme is known by in the list: page, text, accent, highlight. */
export const swatchesOf = (r: ResolvedTheme, mode: Mode = 'light'): string[] => (['bg', 'text', 'accent', 'highlight'] as const).map((role) => r.palette[mode][role]);

/** A role's weakest contrast against what it's read on, and the rule's minimum (none: it isn't read on anything). */
export function roleContrast(r: ResolvedTheme, mode: Mode, role: ColorRole): { ratio: number; min: number; on: ColorRole } | null {
  let worst: { ratio: number; min: number; on: ColorRole } | null = null;
  for (const rule of RULES) {
    if (rule.fg !== role) continue;
    for (const on of rule.on) {
      const ratio = contrastOf(r.palette[mode][role], r.palette[mode][on]);
      if (!worst || ratio / rule.min < worst.ratio / worst.min) worst = { ratio, min: rule.min, on };
    }
  }
  return worst;
}

/** The words for a contrast: its ratio and whether it passes. */
export const contrastWords = (c: { ratio: number; min: number }): string => `${(Math.floor(c.ratio * 10) / 10).toFixed(1)}:1 ${c.ratio >= c.min ? 'passes' : `under ${c.min}:1`}`;

/** The panel's starting theme: the one in use, if it exists. */
export const startingTheme = (active: string | undefined, ids: string[]): string => (active && ids.includes(active) ? active : DEFAULT_THEME);

// the data the panel's markup lists (a part reads the theme model through the editor model)
export { CORNERS, COLOR_GROUPS, FACES, NEUTRALS, PAIRINGS, PALETTES, PRESETS, SPACINGS, TYPE_SCALES } from '../../theme/model';
export { FONT_CATEGORIES } from '../../theme/fonts';
export type { ThemeBase } from '../../theme/base';
export type { FontFile } from '../../theme/fonts';
