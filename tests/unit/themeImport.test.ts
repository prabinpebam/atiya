import { describe, expect, it } from 'vitest';
import { coversLatin, familyFromFile, fontIdFor, importable, isWoff2, parseFontCss, pickFaces } from '../../src/site/theme/fontImport';
import { DRAFT_KEY, draftCss, draftScript, takesDraft } from '../../src/site/theme/draft';

/** What Google Fonts' CSS2 API answers a modern browser (trimmed). */
const GOOGLE = `/* cyrillic */
@font-face {
  font-family: 'Lora';
  font-style: italic;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/lora/v35/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491;
}
/* latin */
@font-face {
  font-family: 'Lora';
  font-style: italic;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/lora/v35/latin-italic.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}
/* latin */
@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/lora/v35/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}`;

describe('importing a font', () => {
  it('reads a Google Fonts stylesheet and keeps the Latin file of each style', () => {
    const faces = pickFaces(parseFontCss(GOOGLE, 'https://fonts.googleapis.com/css2?family=Lora'));
    expect(faces).toEqual([
      expect.objectContaining({ family: 'Lora', style: 'normal', weight: '400 700', url: 'https://fonts.gstatic.com/s/lora/v35/latin.woff2' }),
      expect.objectContaining({ family: 'Lora', style: 'italic', url: 'https://fonts.gstatic.com/s/lora/v35/latin-italic.woff2' }),
    ]);
  });

  it('makes relative sources absolute, skips a rule without WOFF2, and reads weights', () => {
    const css = `@font-face{font-family:"My Sans";src:url(fonts/my.woff2) format("woff2"),url(fonts/my.woff) format("woff");font-weight:bold}
      @font-face{font-family:"My Sans";font-style:italic;src:url(fonts/my-i.ttf) format("truetype")}`;
    expect(parseFontCss(css, 'https://cdn.example.com/kit/style.css')).toEqual([{ family: 'My Sans', style: 'normal', weight: '700', url: 'https://cdn.example.com/kit/fonts/my.woff2' }]);
  });

  it('only HTTPS addresses off this computer, and only WOFF2 bytes', () => {
    expect(importable('http://fonts.googleapis.com/css2?family=Lora')).toBeNull();
    expect(importable('https://localhost/x.css')).toBeNull();
    expect(importable('https://192.168.1.2/x.css')).toBeNull();
    expect(importable('not a url')).toBeNull();
    expect(importable('https://fonts.googleapis.com/css2?family=Lora')?.hostname).toBe('fonts.googleapis.com');
    const woff2 = new Uint8Array(64);
    woff2.set([0x77, 0x4f, 0x46, 0x32]);
    expect(isWoff2(woff2)).toBe(true);
    expect(isWoff2(new TextEncoder().encode('<!doctype html><html>nope, not a font at all, just a page'))).toBe(false);
  });

  it('names a font from its file and its family', () => {
    expect(familyFromFile('https://cdn.example.com/Inter-Variable.woff2?v=4')).toBe('Inter Variable');
    expect(fontIdFor('Playfair Display')).toBe('playfair-display');
    expect(coversLatin('U+0400-045F')).toBe(false);
    expect(coversLatin('U+0000-00FF, U+0131')).toBe(true);
    expect(coversLatin(undefined)).toBe(true);
  });
});

describe('live drafts', () => {
  it('a draft outranks the saved theme and can pick the light or dark page', () => {
    expect(draftCss(':root:root {\n  --x: 1;\n}', 'dark')).toBe(':root:root:root {\n  --x: 1;\n}\n:root:root:root { color-scheme: dark; }');
    expect(draftCss(':root:root { --x: 1; }', null)).toBe(':root:root:root { --x: 1; }');
  });

  it('applies to site pages, never edit mode, the design library, the docs or the game itself', () => {
    expect(['/', '/work/', '/work/a/', '/play/library/x/'].every(takesDraft)).toBe(true);
    expect(['/_edit/', '/_edit/theme/', '/design/', '/docs/', '/play/'].some(takesDraft)).toBe(false);
  });

  it('the page script applies a fresh draft before paint, follows changes and drops a stale one', () => {
    const style: { textContent: string; removed?: boolean; remove(): void; setAttribute(): void } = { textContent: '', remove() { this.removed = true; }, setAttribute() {} };
    const store: Record<string, string> = {};
    const listeners: ((e: { key: string }) => void)[] = [];
    const appended: unknown[] = [];
    const env = {
      location: { pathname: '/atiya/work/' },
      localStorage: { getItem: (k: string) => store[k] ?? null },
      document: { head: { appendChild: (el: unknown) => appended.push(el) }, documentElement: {}, createElement: () => style },
      addEventListener: (_: string, fn: (e: { key: string }) => void) => listeners.push(fn),
      setInterval: () => 0,
    };
    store[DRAFT_KEY] = JSON.stringify({ css: ':root:root:root{--a:1}', at: Date.now() });
    new Function(...Object.keys(env), draftScript('/atiya/'))(...Object.values(env));
    expect(appended).toHaveLength(1);
    expect(style.textContent).toBe(':root:root:root{--a:1}');
    store[DRAFT_KEY] = JSON.stringify({ css: ':root:root:root{--a:2}', at: Date.now() });
    listeners[0]({ key: DRAFT_KEY });
    expect(style.textContent).toBe(':root:root:root{--a:2}');
    store[DRAFT_KEY] = JSON.stringify({ css: 'x', at: Date.now() - 60_000 });
    listeners[0]({ key: DRAFT_KEY });
    expect(style.removed).toBe(true);
  });

  it('leaves edit mode alone', () => {
    const appended: unknown[] = [];
    const env = {
      location: { pathname: '/_edit/theme/' },
      localStorage: { getItem: () => JSON.stringify({ css: 'x', at: Date.now() }) },
      document: { head: { appendChild: (el: unknown) => appended.push(el) }, documentElement: {}, createElement: () => ({}) },
      addEventListener: () => {},
      setInterval: () => 0,
    };
    new Function(...Object.keys(env), draftScript('/'))(...Object.values(env));
    expect(appended).toEqual([]);
  });
});
