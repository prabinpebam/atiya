/** The site's pure behaviour modules: the select's keyboard, the theme, the media helpers, typography, tokens. */
import { describe, expect, it } from 'vitest';
import { keyAction, matchIndex, printable } from '../../src/site/scripts/listbox';
import { applyTheme, parseTheme, readTheme, resolveTheme, THEME_KEY } from '../../src/site/scripts/theme';
import { clampIndex, counter, nearest, reveal, swipe, wrap } from '../../src/site/scripts/media';
import { dragTo, thumbGeometry } from '../../src/site/scripts/scrollbars';
import { accessibleName, currentIndex, readingLine, JUMP_RATIO, edgeSpeed, isMeaningfulImage, jumpTarget, kindText, repeatsTitle, signature, tidy, waveAt, WAVE } from '../../src/site/scripts/minimap';
import { tuck, TUCK_SLACK } from '../../src/site/scripts/header';
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

  it('reveals a filmstrip frame: no scroll while it shows, just enough when it doesn\u2019t', () => {
    expect(reveal(100, 180, 0, 400, 8)).toBe(0);
    expect(reveal(-50, 30, 0, 400, 8)).toBe(-58);
    expect(reveal(380, 460, 0, 400, 8)).toBe(68);
    // wider than the strip: its start wins
    expect(reveal(20, 520, 0, 400, 8)).toBe(12);
  });
});

describe('overlay scrollbars: where the handle sits, and dragging it', () => {
  it('no handle when everything fits', () => {
    expect(thumbGeometry(400, 400, 0, 394, 40)).toBeNull();
    expect(thumbGeometry(400, 400.5, 0, 394, 40)).toBeNull();
  });

  it('as long as the view is of the content, never shorter than the minimum, never longer than the track', () => {
    expect(thumbGeometry(400, 800, 0, 400, 40)).toEqual({ size: 200, offset: 0 });
    expect(thumbGeometry(400, 100000, 0, 400, 40)!.size).toBe(40);
    expect(thumbGeometry(400, 401, 0, 30, 40)!.size).toBe(30);
  });

  it('runs from one end of its track to the other as the content scrolls, and stays inside it', () => {
    expect(thumbGeometry(400, 800, 400, 400, 40)).toEqual({ size: 200, offset: 200 });
    expect(thumbGeometry(400, 800, 200, 400, 40)!.offset).toBe(100);
    expect(thumbGeometry(400, 800, 9999, 400, 40)!.offset).toBe(200);
    expect(thumbGeometry(400, 800, -50, 400, 40)!.offset).toBe(0);
  });

  it('dragging the handle scrolls in proportion, clamped to the content', () => {
    // 400 px of content to scroll through, 200 px of track for the handle to travel
    expect(dragTo(0, 100, 400, 800, 400, 200)).toBe(200);
    expect(dragTo(200, -500, 400, 800, 400, 200)).toBe(0);
    expect(dragTo(200, 500, 400, 800, 400, 200)).toBe(400);
    expect(dragTo(120, 30, 400, 400, 400, 400)).toBe(120);
  });
});

describe('the article minimap', () => {
  it('the current landmark is the last whose top has passed the reading line; before the first, the first', () => {
    expect(currentIndex([300, 900, 1500], 200)).toBe(0);
    expect(currentIndex([150, 900, 1500], 200)).toBe(0);
    expect(currentIndex([-400, 180, 1500], 200)).toBe(1);
    expect(currentIndex([-900, -300, -10], 200)).toBe(2);
    expect(currentIndex([], 200)).toBe(0);
  });

  it('the reading line sits a quarter down what the sticky header leaves, so a jumped-to landmark is always past it', () => {
    expect(readingLine(800)).toBe(200);
    expect(readingLine(900, 72)).toBe(72 + 0.25 * 828);
    for (const [h, sticky] of [[900, 72], [700, 72], [500, 56], [1400, 0]]) {
      const landing = sticky + Math.max(JUMP_RATIO * h, 24);
      expect(landing, `${h} tall, ${sticky} header`).toBeLessThan(readingLine(h, sticky));
    }
  });

  it('the wave: the active indicator grows most, three either side less and less, none beyond', () => {
    expect(waveAt(5, null)).toBe(0);
    expect(waveAt(5, 5)).toBe(1);
    expect([waveAt(4, 5), waveAt(6, 5)]).toEqual([WAVE[1], WAVE[1]]);
    expect(waveAt(2, 5)).toBe(WAVE[3]);
    expect(waveAt(1, 5)).toBe(0);
    expect(WAVE[1]).toBeGreaterThan(WAVE[2]);
    expect(WAVE[2]).toBeGreaterThan(WAVE[3]);
  });

  it('edge auto-scroll: faster nearer the edge, up to the maximum; nothing in the middle', () => {
    expect(edgeSpeed(200, 400, 56, 14)).toBe(0);
    expect(edgeSpeed(0, 400, 56, 14)).toBe(-14);
    expect(edgeSpeed(400, 400, 56, 14)).toBe(14);
    expect(edgeSpeed(28, 400, 56, 14)).toBe(-7);
    expect(Math.abs(edgeSpeed(10, 400, 56, 14))).toBeGreaterThan(Math.abs(edgeSpeed(40, 400, 56, 14)));
    // a short strip splits itself between the two zones
    expect(edgeSpeed(50, 60, 56, 14)).toBeGreaterThan(0);
  });

  it('a jump lands 18% down (never under 24 px) below any sticky header, and never above the start', () => {
    expect(jumpTarget(2000, 1000, 72, 24)).toBe(2000 - 180 - 72);
    expect(jumpTarget(2000, 100, 0, 24)).toBe(2000 - 24);
    expect(jumpTarget(50, 1000, 72, 24)).toBe(0);
  });

  it('the list is drawn again only when its count, kinds, levels or labels change', () => {
    const a = [{ kind: 'heading' as const, level: 2, label: 'Paper' }, { kind: 'image' as const, label: 'The plaza' }];
    expect(signature(a)).toBe(signature(a.map((x) => ({ ...x }))));
    expect(signature(a)).not.toBe(signature([{ ...a[0], level: 3 }, a[1]]));
    expect(signature(a)).not.toBe(signature([a[0], { ...a[1], label: 'The pond' }]));
    expect(signature(a)).not.toBe(signature([a[0]]));
  });

  it('what the tooltip and the button say', () => {
    expect(kindText({ kind: 'heading', level: 2, label: 'x' })).toBe('Heading 2');
    expect(kindText({ kind: 'image', label: 'x' })).toBe('Image');
    expect(kindText({ kind: 'gallery', label: 'x', count: 6 })).toBe('Gallery · 6 images');
    expect(kindText({ kind: 'gallery', label: 'x', count: 1 })).toBe('Gallery · 1 image');
    expect(accessibleName({ kind: 'heading', level: 2, label: 'Pictures, given room' })).toBe('Jump to heading: Pictures, given room');
    expect(accessibleName({ kind: 'gallery', label: 'Five views' })).toBe('Jump to gallery: Five views');
    expect(tidy('  a\n  b  ')).toBe('a b');
    expect(tidy('x'.repeat(200), 20)).toHaveLength(20);
  });

  it('only meaningful pictures: said something, not decorative, not an icon or emoji', () => {
    expect(isMeaningfulImage({ alt: 'The plaza', hidden: false, width: 640, height: 400 })).toBe(true);
    expect(isMeaningfulImage({ alt: null, caption: 'The plaza', hidden: false, width: 640, height: 400 })).toBe(true);
    expect(isMeaningfulImage({ alt: 'The plaza', hidden: true, width: 640, height: 400 })).toBe(false);
    expect(isMeaningfulImage({ alt: '  ', hidden: false, width: 640, height: 400 })).toBe(false);
    expect(isMeaningfulImage({ alt: 'Prabin', hidden: false, width: 56, height: 56 })).toBe(false);
    expect(isMeaningfulImage({ alt: 'smile', hidden: false, width: 20, height: 20 })).toBe(false);
  });

  it('the article title is left out when it only repeats the page title', () => {
    expect(repeatsTitle('A printed page for a little planet', 'A printed page for a little planet — Prabin Pebam')).toBe(true);
    expect(repeatsTitle('Paper and ink', 'A printed page for a little planet — Prabin Pebam')).toBe(false);
  });
});

describe('the header on a phone: tucks away reading down, back on the way up', () => {
  const H = 56;
  it('down tucks it, up brings it back, a jitter keeps what it was', () => {
    expect(tuck(400, 480, H, false, false)).toBe(true);
    expect(tuck(480, 440, H, true, false)).toBe(false);
    expect(tuck(480, 480 + TUCK_SLACK - 1, H, true, false)).toBe(true);
    expect(tuck(480, 480 - (TUCK_SLACK - 1), H, false, false)).toBe(false);
  });

  it('never near the top, and never while it is busy (the menu or a list open, focus inside)', () => {
    expect(tuck(0, 40, H, false, false)).toBe(false);
    expect(tuck(300, 600, H, false, true)).toBe(false);
    expect(tuck(600, 40, H, true, false)).toBe(false);
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
