/**
 * A theme, resolved and written as CSS (documentation/site-ui/theming.md §7): the values of every token it
 * changes, as custom properties over the site's own (tokens.css), so the design system's components need no
 * change. Only what differs from the site's tokens is written: the default theme writes nothing.
 */
import { fluid } from '../design/tokenModel';
import type { Span, ThemeBase } from './base';
import { fontFaces, fontStack, type FontFile } from './fonts';
import { FONT_ROLES, PAIRINGS, type ColorRole, type FontRole, type Theme } from './model';
import { contrastIssues, themePalette, type Issue, type ThemePalette } from './palette';
import { radiusScale, spaceScale, typeRamp, typeWarnings } from './ramp';

export interface ResolvedTheme {
  id: string;
  name: string;
  palette: ThemePalette;
  text: Record<string, Span>;
  space: Record<string, Span>;
  radius: Record<string, number>;
  /** Each role's stack, and whether it's changed from the site's own. */
  fonts: Record<FontRole, { stack: string; changed: boolean; ref: string }>;
  /** The imported fonts it uses. */
  imported: FontFile[];
  /** Pairs below their contrast (roles set by hand can fail; generated ones never do). */
  issues: Issue[];
  /** Type that's hard to read. */
  warnings: string[];
}

const BASE_FONTS = PAIRINGS[0].fonts;

export function resolveTheme(theme: Theme, base: ThemeBase, fonts: ReadonlyMap<string, FontFile> = new Map()): ResolvedTheme {
  const palette = themePalette(base, theme.colors);
  const text = typeRamp(base.text, theme.type);
  const imported = new Map<string, FontFile>();
  const roleFonts = {} as ResolvedTheme['fonts'];
  for (const role of FONT_ROLES) {
    const ref = theme.fonts[role] ?? BASE_FONTS[role];
    const { stack, font } = fontStack(ref, role, fonts);
    if (font) imported.set(font.id, font);
    roleFonts[role] = { stack, changed: ref !== BASE_FONTS[role], ref };
  }
  return {
    id: theme.id,
    name: theme.name,
    palette,
    text,
    space: spaceScale(base.space, theme.spacing),
    radius: radiusScale(base.radius, theme.corners),
    fonts: roleFonts,
    imported: [...imported.values()],
    issues: contrastIssues(palette),
    warnings: typeWarnings(text),
  };
}

const rem = (x: number) => `${x}rem`;
const sameSpan = (a: Span, b: Span) => a.min === b.min && a.max === b.max;
const spanCss = (s: Span) => (s.min === s.max ? rem(s.min) : fluid(rem(s.min), rem(s.max)));

/** The custom properties a theme changes, as `[name, value]`; `all` writes every one (a draft, over whatever theme the page has). */
export function themeProperties(r: ResolvedTheme, base: ThemeBase, all = false): [string, string][] {
  const out: [string, string][] = [];
  for (const role of Object.keys(base.roles.light)) {
    const light = r.palette.light[role];
    const dark = r.palette.dark[role];
    if (!all && light === base.roles.light[role] && dark === base.roles.dark[role]) continue;
    out.push([`--color-${role}`, light === dark ? light : `light-dark(${light}, ${dark})`]);
  }
  for (const role of FONT_ROLES) if (all || r.fonts[role].changed) out.push([`--font-${role}`, r.fonts[role].stack]);
  for (const [k, s] of Object.entries(r.text)) if (all || !sameSpan(s, base.text[k])) out.push([`--text-${k}`, spanCss(s)]);
  for (const [k, s] of Object.entries(r.space)) if (all || !sameSpan(s, base.space[k])) out.push([`--space-${k}`, spanCss(s)]);
  for (const [k, v] of Object.entries(r.radius)) if (all || v !== base.radius[k]) out.push([`--radius-${k}`, rem(v)]);
  return out;
}

/**
 * The theme's stylesheet: its imported fonts, then its tokens over the site's (`:root:root` outranks tokens.css's
 * `:root` wherever the two end up in the page), then the reader's "more contrast" swaps again, so they still win.
 * `all` writes every token (a draft must override whatever theme the page was drawn in).
 */
export function themeCss(r: ResolvedTheme, base: ThemeBase, fontUrl: (file: string) => string, opts: { all?: boolean } = {}): string {
  const props = themeProperties(r, base, opts.all);
  if (!props.length) return '';
  const lines: string[] = [];
  const faces = fontFaces(r.imported, fontUrl);
  if (faces) lines.push(faces);
  lines.push(':root:root {', ...props.map(([k, v]) => `  ${k}: ${v};`), '}');
  const swapped = Object.entries(base.more).filter(([role]) => props.some(([k]) => k === `--color-${role}`));
  if (swapped.length) lines.push('@media (prefers-contrast: more) {', '  :root:root {', ...swapped.map(([from, to]) => `    --color-${from}: var(--color-${to});`), '  }', '}');
  return lines.join('\n');
}

/** The page's own colour, for the browser's chrome (<meta name="theme-color">). */
export const themeColor = (r: ResolvedTheme) => ({ light: r.palette.light.bg, dark: r.palette.dark.bg });

/** A role's colour in a mode, for the screen's swatches. */
export const roleColor = (r: ResolvedTheme, mode: 'light' | 'dark', role: ColorRole) => r.palette[mode][role];
