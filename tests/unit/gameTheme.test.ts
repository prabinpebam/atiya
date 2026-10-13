import { describe, expect, it } from 'vitest';
import { applyGameTheme, gameScheme, gameTheme, gameThemeFromStorage, GAME_THEME_KEY, isGameTheme } from '../../src/game/platform/theme';

describe('the game theme', () => {
  it('accepts only the three theme choices and follows the system unless one is chosen', () => {
    for (const theme of ['light', 'dark', 'system']) expect(isGameTheme(theme)).toBe(true);
    for (const value of [undefined, null, {}, 'sepia', true]) expect(isGameTheme(value)).toBe(false);
    expect(gameScheme('system', true)).toBe('dark');
    expect(gameScheme('system', false)).toBe('light');
    expect(gameScheme('light', true)).toBe('light');
    expect(gameScheme('dark', false)).toBe('dark');
    expect(gameTheme({ dataset: { theme: 'sepia' } })).toBe('system');
  });

  it('shares the site preference and clears it for Match system', () => {
    const root = { dataset: {} as DOMStringMap };
    const saved = new Map<string, string>();
    const storage = { setItem: (k: string, v: string) => void saved.set(k, v), removeItem: (k: string) => void saved.delete(k) };
    applyGameTheme('dark', root, storage);
    expect(gameTheme(root)).toBe('dark');
    expect(saved.get(GAME_THEME_KEY)).toBe('dark');
    applyGameTheme('light', root, storage);
    expect(gameTheme(root)).toBe('light');
    expect(saved.get(GAME_THEME_KEY)).toBe('light');
    applyGameTheme('system', root, storage);
    expect(root.dataset.theme).toBeUndefined();
    expect(saved.has(GAME_THEME_KEY)).toBe(false);
  });

  it('still applies the theme when preference storage is unavailable', () => {
    const root = { dataset: {} as DOMStringMap };
    const denied = { setItem: () => { throw new Error('Storage denied'); }, removeItem: () => { throw new Error('Storage denied'); } };
    applyGameTheme('dark', root, denied);
    expect(gameTheme(root)).toBe('dark');
    applyGameTheme('system', root, denied);
    expect(gameTheme(root)).toBe('system');
    applyGameTheme('light', root, null);
    expect(gameTheme(root)).toBe('light');
  });

  it('follows only theme changes and storage clears, not other preferences', () => {
    expect(gameThemeFromStorage({ key: 'site.theme', newValue: 'light' })).toBe('light');
    expect(gameThemeFromStorage({ key: 'site.theme', newValue: 'dark' })).toBe('dark');
    expect(gameThemeFromStorage({ key: 'site.theme', newValue: 'invalid' })).toBe('system');
    expect(gameThemeFromStorage({ key: 'site.theme', newValue: null })).toBe('system');
    expect(gameThemeFromStorage({ key: null, newValue: null })).toBe('system');
    expect(gameThemeFromStorage({ key: 'site.sound', newValue: 'dark' })).toBeNull();
  });
});
