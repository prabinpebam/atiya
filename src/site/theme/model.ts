/**
 * The theme model (documentation/site-ui/theming.md): what a theme is, its controls and their ranges, the preset
 * faces and pairings, the type scales, the colour palettes and the preset themes. Pure data and types: the
 * content contract (content/schema.ts), the build and the editor's Theme screen all read them from here.
 */

export type Spacing = 'tight' | 'balanced' | 'loose';
export type Corners = 'sharp' | 'balanced' | 'rounded';
export type FontRole = 'display' | 'text' | 'ui';
export type Neutral = 'warm' | 'neutral' | 'cool' | 'tinted';

export const SPACINGS: readonly Spacing[] = ['tight', 'balanced', 'loose'];
export const CORNERS: readonly Corners[] = ['sharp', 'balanced', 'rounded'];
export const FONT_ROLES: readonly FontRole[] = ['display', 'text', 'ui'];
export const NEUTRALS: readonly Neutral[] = ['warm', 'neutral', 'cool', 'tinted'];

/** What spacing scales: the space scale inside components, and the layout's whitespace (gutter, block, section). */
export const SPACING_FACTOR: Record<Spacing, { space: number; layout: number }> = {
  tight: { space: 0.875, layout: 0.75 },
  balanced: { space: 1, layout: 1 },
  loose: { space: 1.125, layout: 1.25 },
};

/** What corners scale: the radius scale (xs to xl); `pill` goes square only when sharp; `round` (circles) never changes. */
export const CORNER_FACTOR: Record<Corners, { radius: number; pill: boolean }> = {
  sharp: { radius: 0, pill: false },
  balanced: { radius: 1, pill: true },
  rounded: { radius: 1.5, pill: true },
};

// ---------- type ----------

/** The type ramp's controls, in whole steps (theming.md §5.3). */
export interface TypeSettings {
  /** Every size, up or down by 5 % a step. */
  size: number;
  /** The biggest sizes (display, jumbo) by 10 % a step, the sizes between them and body text in proportion. */
  largest: number;
  /** The smallest sizes (small UI text) by 5 % a step, the sizes between them and body text in proportion. */
  smallest: number;
  /** How far apart the sizes are, 10 % a step: more is more dramatic, less is quieter. */
  contrast: number;
}

export const TYPE_RANGE: Record<keyof TypeSettings, { min: number; max: number; step: number }> = {
  size: { min: -3, max: 5, step: 0.05 },
  largest: { min: -3, max: 3, step: 0.1 },
  smallest: { min: -2, max: 3, step: 0.05 },
  contrast: { min: -2, max: 2, step: 0.1 },
};

export const TYPE_NEUTRAL: TypeSettings = { size: 0, largest: 0, smallest: 0, contrast: 0 };

export interface TypeScale {
  id: string;
  name: string;
  about: string;
  settings: TypeSettings;
}

/** The type ramp presets: variations of the site's own ramp. */
export const TYPE_SCALES: readonly TypeScale[] = [
  { id: 'balanced', name: 'Balanced', about: "The site's own ramp.", settings: TYPE_NEUTRAL },
  { id: 'compact', name: 'Compact', about: 'Smaller headlines, closer together: more fits on a screen.', settings: { size: 0, largest: -2, smallest: 0, contrast: -1 } },
  { id: 'dramatic', name: 'Dramatic', about: 'Big display type over quiet body text.', settings: { size: 0, largest: 2, smallest: 0, contrast: 2 } },
  { id: 'large-print', name: 'Large print', about: 'Everything bigger and easier to read.', settings: { size: 3, largest: 0, smallest: 2, contrast: -1 } },
];

// ---------- fonts ----------

export interface Face {
  id: string;
  name: string;
  /** The CSS font stack: the face, then its fallbacks (the stack always ends in a generic family). */
  stack: string;
  category: 'serif' | 'sans-serif';
  /** Downloaded from the site (one of its own self-hosted faces), or the reader's system font. */
  hosted: boolean;
}

/** The preset faces: the site's three self-hosted faces and the reader's system fonts (nothing to download). */
export const FACES: readonly Face[] = [
  { id: 'fraunces', name: 'Fraunces', stack: "'Fraunces', 'Iowan Old Style', Georgia, serif", category: 'serif', hosted: true },
  { id: 'newsreader', name: 'Newsreader', stack: "'Newsreader', Georgia, 'Times New Roman', serif", category: 'serif', hosted: true },
  { id: 'figtree', name: 'Figtree', stack: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif", category: 'sans-serif', hosted: true },
  { id: 'system-serif', name: 'System serif', stack: "ui-serif, 'Iowan Old Style', Georgia, 'Times New Roman', serif", category: 'serif', hosted: false },
  { id: 'system-sans', name: 'System sans', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", category: 'sans-serif', hosted: false },
];

export const faceById = (id: string): Face | undefined => FACES.find((f) => f.id === id);

/** A theme's choice for a role: a preset face's ID, or `font:<id>`, a font imported into content/fonts/. */
export type FontRef = string;
export const CUSTOM_FONT = /^font:([a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const FONT_REF = /^(fraunces|newsreader|figtree|system-serif|system-sans|font:[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export type Fonts = Record<FontRole, FontRef>;

export interface Pairing {
  id: string;
  name: string;
  about: string;
  fonts: Fonts;
}

/** The preset pairings: the site's own (Magazine) and variations made from the same faces. */
export const PAIRINGS: readonly Pairing[] = [
  { id: 'magazine', name: 'Magazine', about: 'A soft display serif, a reading serif and a round sans for the interface.', fonts: { display: 'fraunces', text: 'newsreader', ui: 'figtree' } },
  { id: 'editorial', name: 'Editorial', about: 'Serif headlines over clean sans-serif text.', fonts: { display: 'fraunces', text: 'figtree', ui: 'figtree' } },
  { id: 'classic', name: 'Classic', about: 'One reading serif for headlines and text.', fonts: { display: 'newsreader', text: 'newsreader', ui: 'figtree' } },
  { id: 'modern', name: 'Modern', about: 'One round sans-serif for everything.', fonts: { display: 'figtree', text: 'figtree', ui: 'figtree' } },
  { id: 'system', name: 'System', about: "The reader's own fonts: nothing to download.", fonts: { display: 'system-serif', text: 'system-serif', ui: 'system-sans' } },
];

/** The fallback a custom font falls back to in each role, before its own category's generic family. */
export const ROLE_FALLBACK: Record<FontRole, string> = { display: 'fraunces', text: 'newsreader', ui: 'figtree' };

// ---------- colour ----------

/** The colour roles a theme can set (the site's semantic roles; translucent ones are derived). */
export const COLOR_ROLES = [
  'bg',
  'bg-raised',
  'bg-sunk',
  'bg-hover',
  'text',
  'text-muted',
  'muted-strong',
  'rule',
  'rule-strong',
  'border',
  'border-strong',
  'accent',
  'accent-hover',
  'on-accent',
  'accent-soft',
  'on-accent-soft',
  'highlight',
  'on-highlight',
  'highlight-ink',
  'mark',
  'focus',
  'positive',
  'positive-soft',
  'negative',
  'negative-soft',
  'icon-secondary',
  'indicator',
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

/** How the roles are grouped and named on the Theme screen. */
export const COLOR_GROUPS: readonly { name: string; roles: readonly { role: ColorRole; label: string }[] }[] = [
  {
    name: 'Page',
    roles: [
      { role: 'bg', label: 'Page' },
      { role: 'bg-raised', label: 'Cards and controls' },
      { role: 'bg-sunk', label: 'Wells and tracks' },
      { role: 'bg-hover', label: 'Hover wash' },
    ],
  },
  {
    name: 'Text and lines',
    roles: [
      { role: 'text', label: 'Text' },
      { role: 'text-muted', label: 'Muted text' },
      { role: 'muted-strong', label: 'Muted text, more contrast' },
      { role: 'rule', label: 'Rules' },
      { role: 'rule-strong', label: 'Rules, more contrast' },
      { role: 'border', label: 'Control outlines' },
      { role: 'border-strong', label: 'Outlines, hovered' },
      { role: 'indicator', label: 'Quiet marks' },
    ],
  },
  {
    name: 'Accent',
    roles: [
      { role: 'accent', label: 'Accent' },
      { role: 'accent-hover', label: 'Accent, hovered' },
      { role: 'on-accent', label: 'Text on accent' },
      { role: 'accent-soft', label: 'Soft accent' },
      { role: 'on-accent-soft', label: 'Text on soft accent' },
      { role: 'focus', label: 'Focus ring' },
      { role: 'icon-secondary', label: "Icons' second layer" },
    ],
  },
  {
    name: 'Highlight',
    roles: [
      { role: 'highlight', label: 'Highlight' },
      { role: 'on-highlight', label: 'Text on highlight' },
      { role: 'highlight-ink', label: 'Highlight as text' },
      { role: 'mark', label: 'Marked text' },
    ],
  },
  {
    name: 'Status',
    roles: [
      { role: 'positive', label: 'Success' },
      { role: 'positive-soft', label: 'Behind success' },
      { role: 'negative', label: 'Error' },
      { role: 'negative-soft', label: 'Behind an error' },
    ],
  },
];

/** A palette's seeds: one accent, an optional highlight (else one is chosen from the accent) and the neutrals' tint. */
export interface Seed {
  accent: string;
  highlight?: string;
  neutral?: Neutral;
}

export interface Colors {
  /** The seeds the palette is generated from; none: the site's own palette. */
  seed?: Seed;
  /** Roles set one by one, over the generated palette, for the light page. */
  light?: Partial<Record<ColorRole, string>>;
  /** And for the dark page. */
  dark?: Partial<Record<ColorRole, string>>;
}

export interface Palette {
  id: string;
  name: string;
  /** Null: the site's own palette, exactly as its tokens have it. */
  seed: Seed | null;
}

/** The preset palettes: the site's own, and variations generated from a seed (always contrast-checked). */
export const PALETTES: readonly Palette[] = [
  { id: 'indigo', name: 'Indigo and marigold', seed: null },
  { id: 'forest', name: 'Forest', seed: { accent: '#2F6B4A', highlight: '#E8B04A', neutral: 'warm' } },
  { id: 'harbour', name: 'Harbour', seed: { accent: '#1D5F7A', highlight: '#F08A5D', neutral: 'cool' } },
  { id: 'plum', name: 'Plum', seed: { accent: '#6E2E6B', highlight: '#E9B949', neutral: 'warm' } },
  { id: 'ember', name: 'Ember', seed: { accent: '#A63D2A', highlight: '#F2C14E', neutral: 'warm' } },
  { id: 'ocean', name: 'Ocean', seed: { accent: '#2459A8', highlight: '#5CC8C2', neutral: 'cool' } },
  { id: 'graphite', name: 'Graphite', seed: { accent: '#3A3F47', highlight: '#F4D35E', neutral: 'neutral' } },
];

// ---------- themes ----------

export interface Theme {
  /** Its ID: `content/themes/<id>.json`; a preset's is fixed. */
  id: string;
  name: string;
  /** The preset it started from (a user theme's), so Reset knows where to go back to. */
  basedOn?: string;
  spacing: Spacing;
  corners: Corners;
  fonts: Fonts;
  type: TypeSettings;
  colors: Colors;
}

export interface Preset extends Theme {
  about: string;
}

const MAGAZINE = PAIRINGS[0].fonts;

/** The preset themes: read only; a person customises one by saving it as a new theme. */
export const PRESETS: readonly Preset[] = [
  { id: 'atiya', name: 'Atiya', about: 'A clean printed magazine: natural white paper, indigo and marigold.', spacing: 'balanced', corners: 'balanced', fonts: MAGAZINE, type: TYPE_NEUTRAL, colors: {} },
  {
    id: 'studio',
    name: 'Studio',
    about: 'Modern and precise: one sans-serif, square corners, graphite.',
    spacing: 'tight',
    corners: 'sharp',
    fonts: PAIRINGS[3].fonts,
    type: { size: 0, largest: -1, smallest: 0, contrast: -1 },
    colors: { seed: PALETTES[6].seed! },
  },
  {
    id: 'journal',
    name: 'Journal',
    about: 'A quiet book page: one reading serif, generous room, harbour blue.',
    spacing: 'loose',
    corners: 'balanced',
    fonts: PAIRINGS[2].fonts,
    type: { size: 1, largest: -1, smallest: 1, contrast: -1 },
    colors: { seed: PALETTES[2].seed! },
  },
  {
    id: 'garden',
    name: 'Garden',
    about: 'Friendly and round: serif headlines over sans text, forest green.',
    spacing: 'balanced',
    corners: 'rounded',
    fonts: PAIRINGS[1].fonts,
    type: { size: 0, largest: 1, smallest: 0, contrast: 1 },
    colors: { seed: PALETTES[1].seed! },
  },
];

/** The theme a site uses when it hasn't chosen one. */
export const DEFAULT_THEME = 'atiya';

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
export const isPreset = (id: string): boolean => PRESETS.some((p) => p.id === id);

/** A theme's ID from its name: lowercase words joined by hyphens, never a preset's ID or one already taken. */
export function themeIdFor(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'theme';
  const used = new Set([...taken, ...PRESETS.map((p) => p.id)]);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** The type scale preset these settings are, if any. */
export const typeScaleOf = (t: TypeSettings): TypeScale | undefined =>
  TYPE_SCALES.find((s) => (Object.keys(TYPE_NEUTRAL) as (keyof TypeSettings)[]).every((k) => s.settings[k] === t[k]));

/** The pairing these fonts are, if any. */
export const pairingOf = (f: Fonts): Pairing | undefined => PAIRINGS.find((p) => FONT_ROLES.every((r) => p.fonts[r] === f[r]));

/** A copy of a theme as a person's own, under a new name. */
export function copyTheme(from: Theme, name: string, taken: Iterable<string>): Theme {
  // a preset's own words (its about line) stay with the preset
  const { about: _, ...own } = from as Partial<Preset> & Theme;
  const t: Theme = JSON.parse(JSON.stringify(own));
  t.id = themeIdFor(name, taken);
  t.name = name.trim().slice(0, 60) || 'My theme';
  t.basedOn = isPreset(from.id) ? from.id : (from.basedOn ?? DEFAULT_THEME);
  return t;
}
