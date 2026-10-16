// @ts-check
/**
 * Which parts of the engine a site has (documentation/desktop/spec.md §9.1), decided once for every
 * integration: the planet when its ways in turn the little planet on (plan stage 8A); the design library and the
 * documentation for the engine's own repository (no atiya.json), and for a managed site only when its
 * atiya.json turns them on.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Is the little planet on? The ways file says (plan stage 8A, D-W1: `content/structures/ways.json`); without
 * one, a site with a planet structure has it, as before. The same rule as `effectiveWays`
 * (src/site/modes/ways.ts), which the content check holds the file to.
 * @param {string} contentRoot
 */
export function planetOn(contentRoot) {
  const ways = join(contentRoot, 'structures', 'ways.json');
  if (existsSync(ways)) {
    try {
      const modes = JSON.parse(readFileSync(ways, 'utf8')).modes;
      return Array.isArray(modes) && modes.some((/** @type {any} */ m) => m?.id === 'little-planet' && m?.on === true);
    } catch {
      // not JSON: the content check names it; until it's fixed, the planet stays as the structure says
    }
  }
  return hasPlanetStructure(contentRoot);
}

/** Little planet's structure in the modes' folder (M1.1), and its old place, still read during the move. */
export const PLANET_FILES = ['structures/modes/little-planet.json', 'structures/planet.json'];

/** Does the content have Little planet's structure, in either place? @param {string} contentRoot */
export function hasPlanetStructure(contentRoot) {
  return PLANET_FILES.some((f) => existsSync(join(contentRoot, ...f.split('/'))));
}

/**
 * @param {{ root: string, contentRoot: string }} o the project's root and the content folder in use
 * @returns {{ planet: boolean, designLibrary: boolean, docs: boolean, managed: boolean, residents: boolean }}
 */
export function siteFeatures({ root, contentRoot }) {
  // a managed site's atiya.json sits beside its content: at the root in its build, beside CONTENT_ROOT in dev
  const atiyaFile = [join(dirname(contentRoot), 'atiya.json'), join(root, 'atiya.json')].find((f) => existsSync(f));
  /** @type {any} */
  let atiya = null;
  if (atiyaFile) {
    try {
      atiya = JSON.parse(readFileSync(atiyaFile, 'utf8'));
    } catch {
      throw new Error(`${atiyaFile} can't be read as JSON: fix it, or restore it from git.`);
    }
  }
  return {
    planet: planetOn(contentRoot),
    designLibrary: atiya ? atiya.features?.designLibrary === true : true,
    docs: atiya ? atiya.features?.docs === true : existsSync(join(root, 'documentation', 'docs-manifest.json')),
    managed: !!atiya,
    // the planet's residents (Chopper, the family, Prabin) and the owner's music are his alone (plan M3a, O5, O6): on for the
    // engine's own repository, and for a site whose atiya.json turns them on (his, built from a release); never by default
    residents: atiya ? atiya.features?.residents === true : true,
  };
}
