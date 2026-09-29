/** The site's pure behaviour modules: the select's keyboard, the theme, the media helpers, typography, tokens. */
import { describe, expect, it } from 'vitest';
import { keyAction, matchIndex, printable } from '../../src/site/scripts/listbox';
import { applyTheme, parseTheme, readTheme, resolveTheme, THEME_KEY } from '../../src/site/scripts/theme';
import { clampIndex, counter, nearest, swipe, wrap } from '../../src/site/scripts/media';
import { smart } from '../../src/site/design/typography';
import { loadSite, resolveDocument, cssValue, merge, type Resolver } from '../../src/site/design/tokenModel';

describe('the select: WAI-ARIA select-only combobox keys', () => {
  const closed = { open: false, active: 2, count: 12 };
  const open = { open: true, active: 2, count: 12 };

  it('closed: Down, Enter and Space open on the chosen option; Up, Home and End open at an end', () => {
    expect(keyAction({ key: 'ArrowDown' }, closed)).toEqual({ type: 'open', active: 2 });
    expect(keyAction({ key: 'Enter' }, closed)).toEqual({ type: 'open', active: 2 });
    expect(keyAction({ key: ' ' }, closed)).toEqual({ type: 'open', active: 2 });
    expect(keyAction({ key: 'ArrowUp' }, closed)).toEqual({ type: 'open', active: 0 });
    expect(keyAction({ key: 'ArrowUp', altKey: true }, closed)).toEqual({ type: 'open', active: 2 });
    expect(keyAction({ key: 'Home' }, closed)).toEqual({ type: 'open', active: 0 });
    expect(keyAction({ key: 'End' }, closed)).toEqual({ type: 'open', active: 11 });
    expect(keyAction({ key: 'Tab' }, closed)).toEqual({ type: 'none' });
    expect(keyAction({ key: 'Escape' }, closed)).toEqual({ type: 'none' });
  });

  it('open: arrows move without wrapping, Home/End and Page keys jump', () => {
    expect(keyAction({ key: 'ArrowDown' }, open)).toEqual({ type: 'move', active: 3 });
    expect(keyAction({ key: 'ArrowUp' }, open)).toEqual({ type: 'move', active: 1 });
    expect(keyAction({ key: 'ArrowUp' }, { ...open, active: 0 })).toEqual({ type: 'move', active: 0 });
    expect(keyAction({ key: 'ArrowDown' }, { ...open, active: 11 })).toEqual({ type: 'move', active: 11 });
    expect(keyAction({ key: 'Home' }, open)).toEqual({ type: 'move', active: 0 });
    expect(keyAction({ key: 'End' }, open)).toEqual({ type: 'move', active: 11 });
    expect(keyAction({ key: 'PageDown' }, open)).toEqual({ type: 'move', active: 11 });
    expect(keyAction({ key: 'PageUp' }, { ...open, active: 11 })).toEqual({ type: 'move', active: 1 });
  });

  it('open: Enter, Space and Alt+Up choose and keep focus; Tab chooses and moves on; Escape closes without choosing', () => {
    expect(keyAction({ key: 'Enter' }, open)).toEqual({ type: 'commit', active: 2, close: true, keepFocus: true });
    expect(keyAction({ key: ' ' }, open)).toEqual({ type: 'commit', active: 2, close: true, keepFocus: true });
    expect(keyAction({ key: 'ArrowUp', altKey: true }, open)).toEqual({ type: 'commit', active: 2, close: true, keepFocus: true });
    expect(keyAction({ key: 'Tab' }, open)).toEqual({ type: 'commit', active: 2, close: true, keepFocus: false });
    expect(keyAction({ key: 'Escape' }, open)).toEqual({ type: 'close' });
  });

  it('letters type ahead; modified keys and an empty list do nothing', () => {
    expect(keyAction({ key: 'g' }, closed)).toEqual({ type: 'type', char: 'g' });
    expect(keyAction({ key: 'g', ctrlKey: true }, closed)).toEqual({ type: 'none' });
    expect(keyAction({ key: 'ArrowDown' }, { open: false, active: -1, count: 0 })).toEqual({ type: 'none' });
    expect(printable({ key: 'Shift' })).toBe(false);
  });

  it('typeahead finds the next match after the current option, and a repeated letter cycles', () => {
    const labels = ['Amphitheater', 'Greenhouse', 'Library', 'Lighthouse', 'Post Office', 'Town Hall', 'The plaza'];
    expect(matchIndex(labels, 'l', 0)).toBe(2);
    expect(matchIndex(labels, 'l', 2)).toBe(3);
    expect(matchIndex(labels, 'll', 3)).toBe(2);
    expect(matchIndex(labels, 'lig', 0)).toBe(3);
    expect(matchIndex(labels, 'th', 5)).toBe(6);
    expect(matchIndex(labels, 'zz', 0)).toBe(-1);
    expect(matchIndex([], 'a', 0)).toBe(-1);
  });
});

describe('the theme', () => {
  it('parses, resolves and stores the choice', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('sepia')).toBe('system');
    expect(parseTheme(null)).toBe('system');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyTheme('dark', root, storage);
    expect(root.dataset.theme).toBe('dark');
    expect(store.get(THEME_KEY)).toBe('dark');
    expect(readTheme(storage)).toBe('dark');
    applyTheme('system', root, storage);
    expect(root.dataset.theme).toBeUndefined();
    expect(store.has(THEME_KEY)).toBe(false);
    expect(readTheme({ getItem: () => { throw new Error('private mode'); } })).toBe('system');
  });
});

describe('media helpers', () => {
  it('wraps, swipes, finds the nearest slide and counts', () => {
    expect(wrap(-1, 7)).toBe(6);
    expect(wrap(7, 7)).toBe(0);
    expect(wrap(3, 0)).toBe(0);
    expect(swipe(-80, 10)).toBe(1);
    expect(swipe(80, 10)).toBe(-1);
    expect(swipe(30, 0)).toBe(0);
    expect(swipe(-80, 90)).toBe(0);
    expect(nearest(410, [0, 400, 800])).toBe(1);
    expect(counter(2, 7)).toBe('3 of 7');
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(-1, 5)).toBe(0);
  });
});

describe('typography', () => {
  it('sets straight quotes and apostrophes as curly ones', () => {
    expect(smart(`It's the "classic site"`)).toBe('It\u2019s the \u201Cclassic site\u201D');
    expect(smart(`'Explore the planet', then 'Save'`)).toBe('\u2018Explore the planet\u2019, then \u2018Save\u2019');
    expect(smart('no quotes')).toBe('no quotes');
  });
});

describe('the token model resolves DTCG 2025.10', () => {
  const base = {
    p: { c: { $type: 'color', a: { $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#ffffff' } }, b: { $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.5, hex: '#000000' } } } },
    space: { $type: 'dimension', s: { $value: { value: 2, unit: 'rem' }, $extensions: { 'site.fluid': { min: { value: 1, unit: 'rem' } } } } },
    c: { x: { $type: 'color', $value: '{color.fg}' } },
  };
  const r: Resolver = {
    version: '2025.10',
    sets: { base: { sources: [{ $ref: 'base' }] } },
    modifiers: { theme: { contexts: { light: [{ $ref: 'light' }], dark: [{ $ref: 'dark' }] }, default: 'light' } },
    resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
  };
  const docs: Record<string, Record<string, unknown>> = { base, light: { color: { $type: 'color', fg: { $value: '{p.c.a}' } } }, dark: { color: { $type: 'color', fg: { $value: '{p.c.b}' } } } };

  it('merges the base set with the chosen context, and emits light-dark(), clamp() and colours', () => {
    expect(resolveDocument(r, (ref) => docs[ref], { theme: 'dark' }).color).toEqual(docs.dark.color);
    const m = loadSite(r, (ref) => docs[ref]);
    expect(cssValue(m.byPath.get('color.fg')!, m.byPath)).toBe('light-dark(var(--p-c-a), var(--p-c-b))');
    expect(cssValue(m.byPath.get('c.x')!, m.byPath)).toBe('var(--color-fg)');
    expect(cssValue(m.byPath.get('p.c.b')!, m.byPath)).toBe('rgb(0 0 0 / 0.5)');
    expect(cssValue(m.byPath.get('space.s')!, m.byPath)).toMatch(/^clamp\(1rem, .+vw, 2rem\)$/);
    expect(() => resolveDocument({ ...r, version: '2024.1' }, (ref) => docs[ref])).toThrow();
  });

  it('a token declared again replaces the earlier one; groups merge', () => {
    expect(merge({ g: { a: { $value: 1 }, b: { $value: 2 } } }, { g: { a: { $value: 3 } } })).toEqual({ g: { a: { $value: 3 }, b: { $value: 2 } } });
  });
});
