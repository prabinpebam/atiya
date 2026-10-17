/**
 * The site's active theme, for the page's head (documentation/site-ui/theming.md §7): read from the content (the
 * theme `content/site.json` names, a preset or one of the person's own), resolved against the site's tokens and
 * written as CSS. Tier 0: PageShell reads it; the site's own theme (Atiya) writes nothing.
 */
import { content } from '../content/repository';
import type { ThemeFile } from '../content/schema';
import { themeBase, type ThemeBase } from '../theme/base';
import { resolveTheme, themeCss, themeColor, type ResolvedTheme } from '../theme/css';
import type { FontFile } from '../theme/fonts';
import { DEFAULT_THEME, PRESETS, presetById, type Theme } from '../theme/model';
import { siteTokens } from './tokens';
import { withBase } from './meta';

let base: ThemeBase | undefined;
/** The site's own token values, every theme's starting point. */
export const siteThemeBase = (): ThemeBase => (base ??= themeBase(siteTokens()));

/** Where an imported font's file is served. */
export const fontUrl = (file: string): string => withBase(`/fonts/${file}`);

/** A theme by its ID: a preset, or one of the person's own; undefined when there's no such theme. */
export function themeById(id: string): Theme | undefined {
  return presetById(id) ?? (content().themes.get(id) as ThemeFile | undefined);
}

/** Every theme: the presets, then the person's own, by name. */
export function allThemes(): { presets: Theme[]; own: Theme[] } {
  return { presets: [...PRESETS], own: [...content().themes.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

/** The imported fonts, by ID. */
export const siteFonts = (): ReadonlyMap<string, FontFile> => content().fonts as ReadonlyMap<string, FontFile>;

export interface SiteTheme {
  resolved: ResolvedTheme;
  /** The theme's CSS (empty for the site's own). */
  css: string;
  /** The page's own colour in each mode, for the browser's chrome. */
  color: { light: string; dark: string };
}

/** The active theme, resolved and written (once per theme and fonts: a build renders it on every page). */
export function siteTheme(): SiteTheme {
  const id = content().site.theme ?? DEFAULT_THEME;
  const theme = themeById(id) ?? presetById(DEFAULT_THEME)!;
  const fonts = siteFonts();
  const key = JSON.stringify([theme, [...fonts.values()]]);
  if (last?.key === key) return last.value;
  const resolved = resolveTheme(theme, siteThemeBase(), fonts);
  const value = { resolved, css: themeCss(resolved, siteThemeBase(), fontUrl), color: themeColor(resolved) };
  last = { key, value };
  return value;
}
let last: { key: string; value: SiteTheme } | undefined;
