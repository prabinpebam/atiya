// @ts-check
/**
 * The engine this copy of the app runs: where its starter content is, and its version and commit for a
 * new site's atiya.json (documentation/desktop/spec.md §6.3). In development the engine is the checkout
 * the app lives in; a packaged app (stage 7) points ATIYA_ENGINE_ROOT at its bundled release.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCheckoutAbove } from '../checkout.mjs';

/** @returns {string} the engine's root folder */
export function engineRoot() {
  if (process.env.ATIYA_ENGINE_ROOT) return resolve(process.env.ATIYA_ENGINE_ROOT);
  const found = findCheckoutAbove(dirname(fileURLToPath(import.meta.url)));
  if (!found) throw new Error("The site's engine wasn't found next to the app.");
  return found;
}

/** @param {string} [root] @returns {{ version: string, commit: string | null, sha256: string | null }} */
export function engineInfo(root = engineRoot()) {
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
