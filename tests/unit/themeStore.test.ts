/**
 * Themes and fonts through the store (documentation/site-ui/theming.md §5.2, §8): saving a person's theme, refusing a
 * preset, applying and deleting (the site going back to Atiya in the same save), and importing a font from a
 * stylesheet or a .woff2 address with its files checked: against temporary folders and a stand-in font host.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { jsonBytes } from '../../src/site/editor/server/store';
import { applyTheme, deleteTheme, saveTheme } from '../../src/site/editor/server/themes';
import { importFont } from '../../src/site/editor/server/fonts';
import { copyTheme, presetById } from '../../src/site/theme/model';
import type { ThemeFile } from '../../src/site/content/schema';

let dir: string;
let content: string;
const env = { CONTENT_ROOT: process.env.CONTENT_ROOT, PRIVATE_ROOT: process.env.PRIVATE_ROOT };
const put = (rel: string, value: unknown) => {
  const abs = join(content, ...rel.split('/'));
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, jsonBytes(value));
};
const read = (rel: string) => JSON.parse(readFileSync(join(content, ...rel.split('/')), 'utf8'));
const WOFF2 = () => {
  const b = Buffer.alloc(256, 7);
  b.write('wOF2', 0, 'latin1');
  return b;
};
const reply = (body: string | Buffer, type: string, url = '') => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': type, 'content-length': String(body.length) }), text: async () => String(body), arrayBuffer: async () => new Uint8Array(Buffer.isBuffer(body) ? body : Buffer.from(body)).buffer });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'themes-'));
  content = join(dir, 'content');
  process.env.CONTENT_ROOT = content;
  process.env.PRIVATE_ROOT = join(dir, 'private-pages');
  put('site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en' });
  put('people/p.json', { id: 'p', name: 'P' });
  put('structures/site.json', { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [] } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('themes through the store', () => {
  const mine = () => copyTheme(presetById('garden')!, 'Night garden', []) as ThemeFile;

  it('saves a person’s theme, applies it, and deleting it puts the site back on Atiya in the same save', async () => {
    expect(await saveTheme(mine(), null)).toMatchObject({ ok: true });
    expect(read('themes/night-garden.json')).toMatchObject({ id: 'night-garden', basedOn: 'garden' });
    const applied = await applyTheme('night-garden', null);
    expect(applied, JSON.stringify(applied)).toMatchObject({ ok: true });
    expect(read('site.json').theme).toBe('night-garden');
    const deleted = await deleteTheme('night-garden', null);
    expect(deleted, JSON.stringify(deleted)).toMatchObject({ ok: true });
    expect(existsSync(join(content, 'themes', 'night-garden.json'))).toBe(false);
    expect(read('site.json').theme).toBeUndefined();
  });

  it('refuses a write over a preset, deleting one, a theme that isn’t saved, and a new theme over a taken ID', async () => {
    expect(await saveTheme({ ...mine(), id: 'studio' }, null)).toMatchObject({ ok: false, status: 422 });
    expect(await deleteTheme('studio', null)).toMatchObject({ ok: false, status: 422 });
    expect(await applyTheme('nowhere', null)).toMatchObject({ ok: false, status: 422 });
    await saveTheme(mine(), null);
    expect(await saveTheme(mine(), null)).toMatchObject({ ok: false, status: 409 });
    // applying a preset needs no file, and Atiya leaves no field
    expect(await applyTheme('journal', null)).toMatchObject({ ok: true });
    expect(read('site.json').theme).toBe('journal');
    expect(await applyTheme('atiya', null)).toMatchObject({ ok: true });
    expect(read('site.json').theme).toBeUndefined();
  });
});

describe('importing a font', () => {
  const CSS = `@font-face{font-family:'Lora';font-style:normal;font-weight:400 700;src:url(https://fonts.gstatic.com/s/lora/latin.woff2) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:'Lora';font-style:italic;font-weight:400 700;src:url(https://fonts.gstatic.com/s/lora/latin-i.woff2) format('woff2');unicode-range:U+0000-00FF}`;

  it('from a Google Fonts stylesheet: one Latin file per style, self-hosted, licence noted', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url);
      return /\.woff2$/.test(url) ? reply(WOFF2(), 'font/woff2') : reply(CSS, 'text/css', url);
    });
    const r = await importFont('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700', 'serif');
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true, font: { id: 'lora', family: 'Lora', category: 'serif', licence: expect.stringMatching(/Open Font License/) } });
    expect(read('fonts/lora.json').faces).toEqual([
      { style: 'normal', weight: '400 700', file: 'lora-normal.woff2' },
      { style: 'italic', weight: '400 700', file: 'lora-italic.woff2' },
    ]);
    expect(readFileSync(join(content, 'fonts', 'lora-normal.woff2')).subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(asked).toHaveLength(3);
  });

  it('refuses what isn’t a font, an address that isn’t HTTPS, a stylesheet with no WOFF2, and a file too big', async () => {
    vi.stubGlobal('fetch', async (url: string) => (/\.woff2$/.test(url) ? reply('<!doctype html><p>Not found, but a page anyway, long enough to look like a font', 'text/html') : reply(CSS, 'text/css', url)));
    expect(await importFont('https://fonts.googleapis.com/css2?family=Lora')).toMatchObject({ ok: false, message: expect.stringMatching(/isn't a WOFF2 font/) });
    expect(await importFont('http://fonts.googleapis.com/css2?family=Lora')).toMatchObject({ ok: false, message: expect.stringMatching(/HTTPS/) });
    vi.stubGlobal('fetch', async () => reply('@font-face{font-family:X;src:url(x.ttf) format("truetype")}', 'text/css'));
    expect(await importFont('https://cdn.example.com/x.css')).toMatchObject({ ok: false, message: expect.stringMatching(/No WOFF2 font/) });
    vi.stubGlobal('fetch', async () => reply(Buffer.alloc(2 * 1024 * 1024), 'font/woff2'));
    expect(await importFont('https://cdn.example.com/Big-Font.woff2')).toMatchObject({ ok: false, message: expect.stringMatching(/over 1\.5 MB/) });
    expect(existsSync(join(content, 'fonts'))).toBe(false);
  });

  it('from a .woff2 address: its family from its name; importing again replaces it', async () => {
    vi.stubGlobal('fetch', async () => reply(WOFF2(), 'font/woff2'));
    expect(await importFont('https://cdn.example.com/fonts/Inter-Variable.woff2')).toMatchObject({ ok: true, font: { id: 'inter-variable', family: 'Inter Variable', category: 'sans-serif' } });
    expect(await importFont('https://cdn.example.com/fonts/Inter-Variable.woff2')).toMatchObject({ ok: true });
    expect(read('fonts/inter-variable.json').faces).toHaveLength(1);
  });
});
