// @ts-check
/**
 * Where the private folder is (documentation/access/spec.md §3), decided once for every integration:
 * the fixtures in a test build (`astro build --mode test`, so the E2E tests never read real private
 * content), `PRIVATE_ROOT` in dev only (the editor's tests point it at a copy), else private-pages/,
 * the submodule. A build with `PRIVATE_ROOT` set fails, like one with `CONTENT_ROOT`.
 */
import { isAbsolute, join, resolve } from 'node:path';

/** The mode Astro was started in (`--mode test`), which the integrations' hooks aren't given. */
export function astroMode() {
  const i = process.argv.indexOf('--mode');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith('--mode='));
  return eq ? eq.slice('--mode='.length) : undefined;
}

/** The fixtures that stand in for private-pages/ in a test build and the unit tests. */
export const FIXTURES = 'tests/fixtures/private-pages';

/**
 * @param {string} root the project's root, absolute
 * @param {string} command Astro's command (dev, build, preview)
 * @returns {string} the private folder, absolute
 */
export function privateRootFor(root, command) {
  const override = process.env.PRIVATE_ROOT;
  if (override && command === 'build') throw new Error('PRIVATE_ROOT is only for the editor in dev and its tests: unset it to build, so the build reads private-pages/ (or, with --mode test, the fixtures).');
  if (astroMode() === 'test') return join(root, FIXTURES);
  if (override && command === 'dev') return isAbsolute(override) ? override : resolve(root, override);
  return join(root, 'private-pages');
}
