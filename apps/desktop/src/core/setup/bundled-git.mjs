// @ts-check
/**
 * The git the app carries (documentation/desktop/spec.md §7.5): GitHub Desktop's portable git, from the
 * dugite package, so a person needs no git on their computer. The system's git when it isn't there (a
 * checkout of the app before `npm install`).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {{ git: string, dir: string | null }} the git to run, and the folder to put first on a server's PATH */
export function bundledGit() {
  const app = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const packaged = /** @type {any} */ (process).resourcesPath;
  const roots = [packaged && join(packaged, 'git'), join(app, 'node_modules', 'dugite', 'git')].filter(Boolean);
  for (const root of roots) {
    const exe = process.platform === 'win32' ? join(root, 'cmd', 'git.exe') : join(root, 'bin', 'git');
    if (existsSync(exe)) return { git: exe, dir: dirname(exe) };
  }
  return { git: 'git', dir: null };
}
