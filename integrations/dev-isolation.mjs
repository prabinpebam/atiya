// @ts-check
/**
 * A running dev server's state is its own (documentation/engineering/app-separation.md §1).
 *
 * Vite pre-bundles the browser's packages (React, three, R3F…) into its cacheDir, `node_modules/.vite`
 * by default, and a dev server serves them from there for as long as it runs. `astro build` (and so
 * `npm run verify:prod` and the E2E test build) starts a Vite of its own that pre-bundles the same list,
 * in production mode, into the same folder: under the running dev server. The site's pages import no
 * packages and carry on; the planet's lazily loaded code then gets "504 Outdated Optimize Dep", a second
 * copy of three, or React's production JSX runtime ("_jsxDEV is not a function"). Site work is when
 * builds get run, which is why it looked as if site changes broke the game. Astro's own cache
 * (`node_modules/.astro`, its content store) is shared the same way: a build rewrote it and the dev
 * server reloaded every open page.
 *
 * So each command has its own of both: Vite's in `node_modules/.vite/astro-<command>[-<mode>]`, and
 * Astro's in `node_modules/.astro` for dev (as before) and `node_modules/.astro-<command>` otherwise.
 * SITE_VITE_CACHE (the editor's test server) names another Vite folder for a second dev server.
 */
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The folder a run's pre-bundled dependencies go in (Vite's cacheDir), relative to the project root. */
export function viteCacheFor(/** @type {string} */ command, /** @type {string | undefined} */ mode, /** @type {string | undefined} */ override) {
  if (command === 'dev' && override) return override;
  return join('node_modules', '.vite', `astro-${command}${mode ? `-${mode}` : ''}`);
}

/** The folder for Astro's own cache (its content store, optimised images), relative to the root: dev keeps the default. */
export function astroCacheFor(/** @type {string} */ command, /** @type {string | undefined} */ mode) {
  return command === 'dev' ? join('node_modules', '.astro') : join('node_modules', `.astro-${command}${mode ? `-${mode}` : ''}`);
}

/** The --mode a command was run with, if any (astro build --mode test). */
const modeArg = () => {
  const i = process.argv.findIndex((a) => a === '--mode' || a.startsWith('--mode='));
  if (i < 0) return undefined;
  return process.argv[i].includes('=') ? process.argv[i].split('=')[1] : process.argv[i + 1];
};

/** @returns {import('astro').AstroIntegration} */
export default function devIsolation() {
  return {
    name: 'dev-isolation',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig }) => {
        const root = fileURLToPath(config.root);
        const mode = modeArg();
        const vite = viteCacheFor(command, mode, process.env.SITE_VITE_CACHE);
        updateConfig({
          cacheDir: pathToFileURL(`${resolve(root, astroCacheFor(command, mode))}/`),
          vite: { cacheDir: isAbsolute(vite) ? vite : resolve(root, vite) },
        });
      },
    },
  };
}