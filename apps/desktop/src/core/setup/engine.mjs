// @ts-check
/**
 * The engine this copy of the app runs: where its starter content is, and its version and commit for a
 * new site's atiya.json (documentation/desktop/spec.md §6.3). In development the engine is the checkout
 * the app lives in; a packaged app (stage 7) points ATIYA_ENGINE_ROOT at its bundled release.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCheckoutAbove } from '../checkout.mjs';

/**
 * The engine's root folder: ATIYA_ENGINE_ROOT, else a bundled release (a packaged app's resources, or
 * apps/desktop/engine from scripts/bundle-engine.mjs), else the checkout the app lives in.
 * @returns {string}
 */
export function engineRoot() {
  if (process.env.ATIYA_ENGINE_ROOT) return resolve(process.env.ATIYA_ENGINE_ROOT);
  const here = dirname(fileURLToPath(import.meta.url));
  const packaged = /** @type {any} */ (process).resourcesPath;
  for (const dir of [packaged && join(packaged, 'engine'), resolve(here, '..', '..', '..', 'engine')]) if (dir && existsSync(join(dir, 'engine.json'))) return dir;
  const found = findCheckoutAbove(here);
  if (!found) throw new Error("The site's engine wasn't found next to the app.");
  return found;
}

/**
 * The engine's version, commit and checksum for a new site's atiya.json: from a release's manifest (a
 * bundled release carries `engine.json`; ATIYA_ENGINE_MANIFEST names another), else this checkout's
 * version and commit, with no checksum (a site made so can't be built by site-build.yml until it's
 * updated to a release).
 * @param {string} [root] @returns {{ version: string, commit: string | null, sha256: string | null }}
 */
export function engineInfo(root = engineRoot()) {
  const manifest = [process.env.ATIYA_ENGINE_MANIFEST, join(root, 'engine.json')].find((f) => f && existsSync(f));
  if (manifest) {
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    return { version: String(m.version), commit: String(m.commit), sha256: String(m.sha256) };
  }
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? '0.0.0';
  let commit = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim() || null;
  } catch {
    // a release carries its commit in its manifest instead (stage 6)
  }
  return { version, commit, sha256: null };
}

/** The repository the engine's reusable workflow lives in. */
export const ENGINE_REPOSITORY = 'prabinpebam/atiya';
