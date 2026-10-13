/** The game follows the site's saved theme without importing the site's design system. */
export type GameTheme = 'system' | 'light' | 'dark';
export const GAME_THEME_KEY = 'site.theme';
export const GAME_THEME_EVENT = 'game:theme';

export const isGameTheme = (value: unknown): value is GameTheme => value === 'system' || value === 'light' || value === 'dark';
export const gameTheme = (root: Pick<HTMLElement, 'dataset'>): GameTheme => isGameTheme(root.dataset.theme) ? root.dataset.theme : 'system';
export const gameScheme = (theme: GameTheme, systemDark: boolean): 'light' | 'dark' => theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

/** Storage can be unavailable; a choice still applies for this visit and to the reading frame. */
export function gameThemeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function applyGameTheme(theme: GameTheme, root: Pick<HTMLElement, 'dataset'>, storage: Pick<Storage, 'setItem' | 'removeItem'> | null): void {
  if (theme === 'system') {
    if (root.dataset.theme !== undefined) delete root.dataset.theme;
  } else if (root.dataset.theme !== theme) root.dataset.theme = theme;
  try {
    if (theme === 'system') storage?.removeItem(GAME_THEME_KEY);
    else storage?.setItem(GAME_THEME_KEY, theme);
  } catch {
    // As with the other game preferences, privacy mode keeps the choice only for this visit.
  }
}

export function gameThemeFromStorage(e: { key: string | null; newValue: string | null }): GameTheme | null {
  if (e.key !== GAME_THEME_KEY && e.key !== null) return null;
  return isGameTheme(e.newValue) ? e.newValue : 'system';
}

/** One observer for the loading shell, the HUD and every modal; no React or three on this path. */
export function followGameTheme(root: HTMLElement): void {
  const changed = () => window.dispatchEvent(new Event(GAME_THEME_EVENT));
  new MutationObserver(changed).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', changed);
  window.addEventListener('storage', (e) => {
    const theme = gameThemeFromStorage(e);
    if (theme) applyGameTheme(theme, root, null);
  });
}
