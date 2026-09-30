/**
 * The colour theme (docs: documentation/site-ui/design-system.md §2): the page follows the system
 * unless the visitor picks light or dark. The choice lives in localStorage['site.theme'] and on
 * <html data-theme>; PageShell's inline script applies it before the first paint (no flash). A switch
 * (the header's, edit mode's) sets it, and every other open page of the site follows at once: another
 * tab, or the page edit mode shows in its canvas.
 */
import type { IconName } from '../design/icons';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = 'site.theme';

export const THEME_LABEL: Record<Theme, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
};

export const THEME_ICON: Record<Theme, IconName> = {
  system: 'theme-system',
  light: 'theme-light',
  dark: 'theme-dark',
};

/** A theme switch's options (the Select's), in order. */
export const THEME_OPTIONS = THEMES.map((t) => ({ value: t, label: THEME_LABEL[t], icon: THEME_ICON[t] }));

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

/** Sent on the document when the theme changed from outside this page, so a switch can show it. */
export const THEME_EVENT = 'site:theme';

/**
 * A theme Select: it shows the saved choice (and keeps showing it when another page changes it), and
 * applies a new one. The header's and edit mode's switch are this.
 */
export function bindThemeSwitch(sw: HTMLElement, root: HTMLElement, storage: Storage | null, signal?: AbortSignal): void {
  const show = () => sw.dispatchEvent(new CustomEvent('select-set', { detail: { value: readTheme(storage) } }));
  if (sw.dataset.ready !== undefined) show();
  else sw.addEventListener('select-ready', show, { once: true, signal });
  document.addEventListener(THEME_EVENT, show, { signal });
  sw.addEventListener(
    'select-change',
    (e) => {
      const v = (e as CustomEvent<{ value: string }>).detail.value as Theme;
      if ((THEMES as readonly string[]).includes(v)) applyTheme(v, root, storage);
    },
    { signal },
  );
}

/**
 * The theme a storage change asks for, or null if it isn't about the theme. The storage event reaches
 * every other page of the site (other tabs, and frames such as edit mode's canvas), never the page that
 * made the change; a cleared storage (key null) is the system's theme again.
 */
export function themeFromStorage(e: { key: string | null; newValue: string | null }): Theme | null {
  return e.key === THEME_KEY || e.key === null ? parseTheme(e.newValue) : null;
}

/** Follows a theme chosen on another page of the site, without storing it again. */
export function followTheme(root: HTMLElement, target: Pick<Window, 'addEventListener'> = window): void {
  target.addEventListener('storage', (e) => {
    const t = themeFromStorage(e as StorageEvent);
    if (!t) return;
    if (t === 'system') delete root.dataset.theme;
    else root.dataset.theme = t;
    document.dispatchEvent(new Event(THEME_EVENT));
  });
}
