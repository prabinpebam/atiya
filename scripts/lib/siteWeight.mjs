/**
 * The published site's weight against GitHub Pages' 1 GB limit (documentation/gallery/spec.md §11):
 * a warning past 750 MB, a failure past 950 MB, so a build never publishes what Pages would refuse.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MB = 1024 * 1024;
export const WEIGHT_WARN = 750 * MB;
export const WEIGHT_FAIL = 950 * MB;

/** Every file's bytes under `dir`, added up. */
export function weighDir(/** @type {string} */ dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += weighDir(path);
    else if (entry.isFile()) total += statSync(path).size;
  }
  return total;
}

/**
 * What the build says about a site of `bytes`: nothing, a warning or a failure, in words.
 * @param {number} bytes
 * @returns {{ level: 'ok' | 'warn' | 'fail', words: string }}
 */
export function weightVerdict(bytes) {
  const size = `${Math.round(bytes / MB)} MB`;
  if (bytes > WEIGHT_FAIL)
    return { level: 'fail', words: `The site weighs ${size}, past the 950 MB this build allows (GitHub Pages stops at 1 GB): remove or shrink some videos or pictures.` };
  if (bytes > WEIGHT_WARN)
    return { level: 'warn', words: `The site weighs ${size}, past 750 MB: GitHub Pages stops at 1 GB, so watch what you add.` };
  return { level: 'ok', words: `The site weighs ${size}.` };
}
