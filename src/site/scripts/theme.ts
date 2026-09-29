/**
 * The colour theme (docs: documentation/site-ui/design-system.md §2): the page follows the system
 * unless the visitor picks light or dark. The choice lives in localStorage['site.theme'] and on
 * <html data-theme>; PageShell's inline script applies it before the first paint (no flash).
 */

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = 'site.theme';

export const THEME_LABEL: Record<Theme, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
};

export function parseTheme(v: string | null | undefined): Theme {
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** The mode a theme shows, given the system's preference. */
export function resolveTheme(t: Theme, systemDark: boolean): 'light' | 'dark' {
  return t === 'system' ? (systemDark ? 'dark' : 'light') : t;
}

export function readTheme(storage: Pick<Storage, 'getItem'> | null): Theme {
  try {
    return parseTheme(storage?.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

/** Store the choice and set it on the root (system clears both). */
export function applyTheme(t: Theme, root: HTMLElement, storage: Pick<Storage, 'setItem' | 'removeItem'> | null): void {
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  try {
    if (t === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, t);
  } catch {
    /* private mode: the choice lasts for the page */
  }
}
