// @ts-check
/**
 * Is a folder a checkout of the engine (the site's source), that the app can run as a developer
 * workspace? (documentation/desktop/spec.md §7.6.) Pure apart from reading the folder.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** The engine's package name: this repository's `package.json`. */
export const ENGINE_PACKAGE = 'personal-site';

/**
 * @param {string} dir
 * @returns {{ ok: true, name: string } | { ok: false, reason: string }}
 */
export function checkCheckout(dir) {
  const pkgFile = join(dir, 'package.json');
  if (!existsSync(pkgFile)) return { ok: false, reason: "This folder isn't the site's source: it has no package.json." };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  } catch {
    return { ok: false, reason: "This folder's package.json can't be read." };
  }
  if (pkg?.name !== ENGINE_PACKAGE) return { ok: false, reason: "This folder holds another project, not the site's source." };
  if (!existsSync(join(dir, 'astro.config.mjs'))) return { ok: false, reason: "This folder is missing astro.config.mjs, so it isn't a full checkout of the site." };
  if (!astroEntry(dir)) return { ok: false, reason: "Its packages aren't installed yet. Run npm install in it once, then open it again." };
  return { ok: true, name: siteName(dir) };
}

/**
 * Astro's command-line entry in a checkout, from Astro's own package.json (`bin.astro`), or null if it isn't installed.
 * @param {string} dir
 */
export function astroEntry(dir) {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'node_modules', 'astro', 'package.json'), 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.astro;
    const file = bin && join(dir, 'node_modules', 'astro', bin);
    return file && existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

/** The site's name from its settings (content/site.json), else the folder's name. @param {string} dir */
export function siteName(dir) {
  try {
    const site = JSON.parse(readFileSync(join(dir, 'content', 'site.json'), 'utf8'));
    if (typeof site?.name === 'string' && site.name) return site.name;
  } catch {
    // no settings yet
  }
  return resolve(dir).split(/[\\/]/).pop() ?? dir;
}

/** The nearest folder at or above `start` that is a checkout of the engine (by its package name), or null. @param {string} start */
export function findCheckoutAbove(start) {
  let dir = resolve(start);
  for (;;) {
    const pkgFile = join(dir, 'package.json');
    if (existsSync(pkgFile)) {
      try {
        if (JSON.parse(readFileSync(pkgFile, 'utf8'))?.name === ENGINE_PACKAGE) return dir;
      } catch {
        // keep looking
      }
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
