/**
 * Visitor-facing copy says what's true (documentation/sections/spec.md §2, V20): nothing a visitor can
 * read, on the site or on the planet, is a placeholder. It checks the copy's sources: every string in
 * content/, the landmark files, the pages, the site's layouts and compounds, and the game's lines and
 * HUD. Comments and code (an input's `placeholder` attribute, a token's name) aren't copy.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '../..');
const MARKERS = [/(?<![-.:\w])placeholder(?![-\w=:?(])/i, /\blorem\b/i, /\bipsum\b/i, /\bTBD\b/, /\bTODO\b/, /\bPOC\b/, /\bFIXME\b/];

function files(dir: string, ext: RegExp, skip: RegExp = /$^/): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const p = join(abs, name);
    const rel = relative(ROOT, p).replace(/\\/g, '/');
    if (skip.test(rel)) return [];
    if (statSync(p).isDirectory()) return files(rel, ext, skip);
    return ext.test(name) ? [rel] : [];
  });
}

/** Code without its comments: block, line (not a URL's `//`) and HTML. */
const withoutComments = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Every string value in a JSON document. */
const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);

const found = (text: string) => MARKERS.filter((m) => m.test(text)).map(String);

describe('visitor-facing copy has no placeholder markers (V20)', () => {
  it('content/: every string in every document', () => {
    const bad = files('content', /\.json$/).flatMap((f) => strings(JSON.parse(readFileSync(join(ROOT, f), 'utf8'))).flatMap((s) => found(s).map((m) => `${f}: ${m} in "${s.slice(0, 80)}"`)));
    expect(bad).toEqual([]);
  });

  it('the landmark files, the pages, the layouts and compounds, and the game’s lines and HUD', () => {
    const sources = [
      ...files('src/content', /\.md$/),
      ...files('src/pages', /\.(astro|ts)$/, /^src\/pages\/design\//),
      ...files('src/layouts', /\.astro$/),
      ...files('src/site/layouts', /\.astro$/),
      ...files('src/site/components/compounds', /\.astro$/),
      ...files('src/game/world/home', /\.ts$/),
      ...files('src/game/ui', /\.tsx?$/),
    ];
    expect(sources.length).toBeGreaterThan(20);
    const bad = sources.flatMap((f) => found(withoutComments(readFileSync(join(ROOT, f), 'utf8'))).map((m) => `${f}: ${m}`));
    expect(bad).toEqual([]);
  });

  it('catches a placeholder in words, and not an attribute or a token’s name', () => {
    expect(found('Placeholder — contact options')).not.toEqual([]);
    expect(found('Case study A (placeholder)')).not.toEqual([]);
    expect(found('Lorem ipsum dolor')).not.toEqual([]);
    expect(found('<input placeholder={hint} />')).toEqual([]);
    expect(found('background: var(--c-image-placeholder);')).toEqual([]);
    expect(found('.input::placeholder { color: red }')).toEqual([]);
    expect(found(withoutComments('const a = 1; // TODO: later'))).toEqual([]);
    expect(found(withoutComments("const u = 'https://example.com/TODO';"))).not.toEqual([]);
  });
});
