// @ts-check
/**
 * Which parts of the engine a site has (documentation/desktop/spec.md §9.1), decided once for every
 * integration: the planet when its content has a planet structure; the design library and the
 * documentation for the engine's own repository (no atiya.json), and for a managed site only when its
 * atiya.json turns them on.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * @param {{ root: string, contentRoot: string }} o the project's root and the content folder in use
 * @returns {{ planet: boolean, designLibrary: boolean, docs: boolean, managed: boolean }}
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
    planet: existsSync(join(contentRoot, 'structures', 'planet.json')),
    designLibrary: atiya ? atiya.features?.designLibrary === true : true,
    docs: atiya ? atiya.features?.docs === true : existsSync(join(root, 'documentation', 'docs-manifest.json')),
    managed: !!atiya,
  };
}
