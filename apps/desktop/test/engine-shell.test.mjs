// @ts-check
import { describe, expect, it } from 'vitest';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEngineShell } from '../src/core/setup/engine-shell.mjs';
import { linkedFolders } from '../../../integrations/dev-isolation.mjs';

/** The engine run from a read-only folder through a writable folder of links (desktop plan 9S, the Microsoft Store). */
describe('the engine shell', () => {
  const engine = () => {
    const dir = mkdtempSync(join(tmpdir(), 'atiya-engine-'));
    for (const d of ['src', 'node_modules/astro', 'integrations']) mkdirSync(join(dir, d), { recursive: true });
    writeFileSync(join(dir, 'src', 'page.astro'), 'page');
    writeFileSync(join(dir, 'astro.config.mjs'), 'export default {}');
    writeFileSync(join(dir, 'package.json'), '{}');
    return dir;
  };

  it("links each of the engine's folders, copies its files and makes a real .astro; the engine's files are read through it", () => {
    const e = engine();
    const shell = makeEngineShell(e, join(mkdtempSync(join(tmpdir(), 'atiya-shell-')), 'root'));
    expect(lstatSync(join(shell, 'src')).isSymbolicLink()).toBe(true);
    expect(realpathSync(join(shell, 'src')).toLowerCase()).toBe(realpathSync(join(e, 'src')).toLowerCase());
    expect(readFileSync(join(shell, 'src', 'page.astro'), 'utf8')).toBe('page');
    expect(lstatSync(join(shell, 'astro.config.mjs')).isSymbolicLink()).toBe(false);
    expect(lstatSync(join(shell, '.astro')).isDirectory()).toBe(true);
    expect(lstatSync(join(shell, '.astro')).isSymbolicLink()).toBe(false);
  });

  it('a second run changes nothing, keeps .astro, and follows a new engine without touching the old one', () => {
    const e = engine();
    const shell = makeEngineShell(e, join(mkdtempSync(join(tmpdir(), 'atiya-shell-')), 'root'));
    writeFileSync(join(shell, '.astro', 'types.d.ts'), 'kept');
    writeFileSync(join(shell, 'stale.txt'), 'x');
    makeEngineShell(e, shell);
    expect(readFileSync(join(shell, '.astro', 'types.d.ts'), 'utf8')).toBe('kept');
    expect(existsSync(join(shell, 'stale.txt'))).toBe(false);
    const next = engine();
    writeFileSync(join(next, 'src', 'page.astro'), 'new');
    makeEngineShell(next, shell);
    expect(readFileSync(join(shell, 'src', 'page.astro'), 'utf8')).toBe('new');
    // the old engine's files are untouched (a link was removed, not what it pointed to)
    expect(readFileSync(join(e, 'src', 'page.astro'), 'utf8')).toBe('page');
  });

  it("Vite is allowed the engine's real folder when the root is such a shell, and nothing more in a checkout", () => {
    const e = engine();
    const shell = makeEngineShell(e, join(mkdtempSync(join(tmpdir(), 'atiya-shell-')), 'root'));
    expect(linkedFolders(shell).map((f) => f.toLowerCase())).toEqual([realpathSync(e).toLowerCase()]);
    expect(linkedFolders(e)).toEqual([]);
  });
});
