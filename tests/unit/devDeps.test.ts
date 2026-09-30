/**
 * Every package the game imports in the browser is pre-bundled when the dev server starts
 * (astro.config.mjs, optimizeDeps.include), never discovered while it runs. A late discovery re-bundles
 * every dependency under a new hash; the game's lazily loaded modules, already served with the old one,
 * then get "504 Outdated Optimize Dep", a second copy of three ("Multiple instances of Three.js") and a
 * broken React ("_jsxDEV is not a function"). The site's browser code imports no packages.
 * And every kind of run has its own caches: a build pre-bundles the same list, in production mode, and
 * in a shared folder it did so under the running dev server (integrations/dev-isolation.mjs).
 * Docs: documentation/engineering/app-separation.md.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import config from '../../astro.config.mjs';
import devIsolation, { astroCacheFor, viteCacheFor } from '../../integrations/dev-isolation.mjs';

const ROOT = join(__dirname, '../..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The packages a module loads at run time: static, side-effect and dynamic imports, but not type-only ones. */
function runtimeImports(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/^\s*import\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    const [, typeOnly, clause, spec] = m;
    if (typeOnly) continue;
    const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
    if (named && named[1].split(',').every((s) => !s.trim() || /^type\s/.test(s.trim()))) continue;
    found.push(spec);
  }
  for (const m of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) found.push(m[1]);
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1]);
  return found.filter((s) => !/^(\.|\/|astro:|node:|virtual:)/.test(s));
}

describe('dev dependencies', () => {
  it('reads runtime imports, and leaves type-only ones out', () => {
    const src = [
      "import { a } from 'pkg-a';",
      "import type { T } from 'pkg-type';",
      "import { type T, type U } from 'pkg-types';",
      "import { type T, b } from 'pkg-mixed';",
      "import 'pkg-side';",
      "const m = await import('pkg-lazy');",
      "import { c } from './local';",
    ].join('\n');
    expect(runtimeImports(src).sort()).toEqual(['pkg-a', 'pkg-lazy', 'pkg-mixed', 'pkg-side']);
  });

  it('pre-bundles every package the game imports', () => {
    const include = new Set(config.vite?.optimizeDeps?.include ?? []);
    const missing = new Map<string, string>();
    for (const file of files(join(ROOT, 'src/game'))) {
      for (const spec of runtimeImports(readFileSync(file, 'utf8'))) {
        if (!include.has(spec) && !missing.has(spec)) missing.set(spec, relative(ROOT, file).replaceAll('\\', '/'));
      }
    }
    expect(Object.fromEntries(missing), 'add these to optimizeDeps.include in astro.config.mjs').toEqual({});
  });
});

describe("the dev server's caches", () => {
  it('is its own: every command (and a build\'s mode) gets a folder, never Vite\'s shared default', () => {
    const dirs = ['dev', 'build', 'preview', 'sync'].map((c) => viteCacheFor(c, undefined, undefined));
    expect(new Set(dirs).size).toBe(dirs.length);
    expect(viteCacheFor('build', 'test', undefined)).not.toBe(viteCacheFor('build', undefined, undefined));
    for (const d of [...dirs, viteCacheFor('build', 'test', undefined)]) expect(d).not.toBe(join('node_modules', '.vite'));
    // a second dev server (the editor's test server) names its own; a build ignores that
    expect(viteCacheFor('dev', undefined, 'node_modules/.vite-editor-test')).toBe('node_modules/.vite-editor-test');
    expect(viteCacheFor('build', undefined, 'node_modules/.vite-editor-test')).not.toBe('node_modules/.vite-editor-test');
    // Astro's own (its content store): dev keeps the default, anything else its own
    const astro = ['dev', 'build', 'sync', 'preview'].map((c) => astroCacheFor(c, undefined));
    expect(new Set(astro).size).toBe(astro.length);
    expect(astroCacheFor('dev', undefined)).toBe(join('node_modules', '.astro'));
  });

  it('is set by the config, through the integration and nowhere else', () => {
    const names = (config.integrations ?? []).flat().map((i) => (i as { name?: string }).name);
    expect(names).toContain('dev-isolation');
    expect(config.vite?.cacheDir).toBeUndefined();
    expect(config.cacheDir).toBeUndefined();
    let set: string | undefined;
    let astro: URL | undefined;
    const hook = devIsolation().hooks['astro:config:setup'] as unknown as (o: unknown) => void;
    const saved = process.env.SITE_VITE_CACHE;
    delete process.env.SITE_VITE_CACHE;
    hook({ command: 'dev', config: { root: pathToFileURL(`${ROOT}/`) }, updateConfig: (c: { cacheDir: URL; vite: { cacheDir: string } }) => ((set = c.vite.cacheDir), (astro = c.cacheDir)) });
    if (saved !== undefined) process.env.SITE_VITE_CACHE = saved;
    expect(set).toBe(join(ROOT, 'node_modules', '.vite', 'astro-dev'));
    expect(astro?.href).toBe(pathToFileURL(`${join(ROOT, 'node_modules', '.astro')}/`).href);
  });
});
