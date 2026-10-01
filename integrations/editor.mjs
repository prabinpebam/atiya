// @ts-check
/**
 * Edit mode, the site's local CMS (documentation/editor/spec.md §8): this integration is everything it
 * needs from Astro, and none of it reaches a build.
 *
 * - For every command, it defines where the content folder is (from Astro's root), so nothing depends on
 *   the working directory. `CONTENT_ROOT` may point elsewhere in dev (the editor's tests use a copy); a
 *   build with it set fails, so a build always reads and imports the same content.
 * - In dev, it watches the content folder. Content is read from disk, not imported, so a change reloads
 *   nothing by itself: on every change this clears Astro's route cache (so a new or newly published
 *   page has its route at once) and tells every open page, with the editor tab that made it (none for a
 *   change made by hand): site pages reload, and edit mode's screens bring the change in live (one with
 *   unsaved input keeps it and says so). A change the editor didn't make also moves the content
 *   generation on (the store does that for its own).
 * - In dev, unless SITE_EDITOR=off, it injects the editor's routes (all on demand, under /_edit/) and
 *   the middleware that guards them.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTES = [
  ['/_edit', 'dashboard.astro'],
  ['/_edit/articles', 'articles.astro'],
  ['/_edit/articles/[id]', 'article.astro'],
  ['/_edit/canvas/articles/[id]', 'canvas.astro'],
  ['/_edit/sections', 'sections.astro'],
  ['/_edit/navigation', 'navigation.astro'],
  ['/_edit/planet', 'planet.astro'],
  ['/_edit/media', 'media.astro'],
  ['/_edit/settings', 'settings.astro'],
  ['/_edit/publish', 'publish.astro'],
  ['/_edit/api/[...path]', 'api.ts'],
];

/** @param {string} file */
const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');
/** The editor's temporary files and anything hidden: never content (the same rule as source.ts). */
const ignored = (/** @type {string} */ file) => /^\.|\.tmp$/.test(basename(file));
/** How the store and the watcher name a file: absolute, and case-blind on Windows (source.ts writeKey). */
const writeKey = (/** @type {string} */ file) => (process.platform === 'win32' ? resolve(file).toLowerCase() : resolve(file));

/**
 * The content state shared with the dev server's modules (source.ts reads it): one process, one object.
 * @returns {{ generation: number, writes: Map<string, string>, notify?: (files: string[], fromEditor: boolean, origin?: string | null) => void }}
 */
function contentState() {
  const g = /** @type {any} */ (globalThis);
  return (g.__siteContent ??= { generation: 0, writes: new Map() });
}

/** @returns {import('astro').AstroIntegration} */
export default function editor() {
  /** @type {string} */
  let contentRoot = '';
  /** @type {boolean} */
  let editing = false;
  return {
    name: 'site-editor',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, injectScript, addMiddleware, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const override = process.env.CONTENT_ROOT;
        if (override && command === 'build') throw new Error('CONTENT_ROOT is only for the editor in dev and its tests: unset it to build, so the build reads the real content.');
        contentRoot = override && command === 'dev' ? (isAbsolute(override) ? override : resolve(root, override)) : join(root, 'content');
        updateConfig({
          vite: {
            define: { __SITE_CONTENT_ROOT__: JSON.stringify(contentRoot) },
            server: {
              ...(process.env.SITE_STRICT_PORT ? { strictPort: true } : {}),
              // a picture's master (an upload, a crop) is never a module, but a new one made the dev server
              // reload every open page, losing unsaved typing in other tabs; the store tells the pages itself,
              // and the sidecar beside each master is what they show (documentation/editor/spec.md §8.4)
              ...(command === 'dev' ? { watch: { ignored: [/[\\/]content[\\/]media[\\/].+\.(?:webp|jpe?g|png|avif|gif)$/i] } } : {}),
            },
          },
        });
        editing = command === 'dev' && process.env.SITE_EDITOR !== 'off';
        if (!editing) return;
        for (const [pattern, file] of ROUTES) {
          injectRoute({ pattern, entrypoint: `./src/site/editor/pages/${file}` });
        }
        addMiddleware({ entrypoint: join(root, 'src/site/editor/server/middleware.ts'), order: 'pre' });
        // the way in: a button on every page the dev server serves (never in a build)
        injectScript('page', `import { launch } from '/src/site/editor/scripts/launcher.ts'; launch();`);
        if (override) logger.info(`editing the content in ${contentRoot}`);
      },

      'astro:server:setup': ({ server }) => {
        const state = contentState();
        state.notify = (files, fromEditor, origin = null) => {
          // Astro's own signal that content changed: it clears the route cache (getStaticPaths)
          for (const name of ['ssr', 'prerender']) server.environments[name]?.hot.send('astro:content-changed', {});
          // every open page hears every change: a site page reloads, an editor screen brings in what
          // another tab (or a hand edit) changed, and the tab that made it (origin) knows it's its own;
          // the generation lets a page drawn after the change (a screen that reloaded) know it has it
          server.environments.client.hot.send('site:content-changed', { files, fromEditor, origin, generation: state.generation });
        };
        server.watcher.add(contentRoot);
        server.watcher.on('all', (event, file) => {
          if (!['add', 'change', 'unlink'].includes(event) || ignored(file)) return;
          const rel = relative(contentRoot, file);
          if (rel.startsWith('..') || isAbsolute(rel)) return;
          const hash = event === 'unlink' || !existsSync(file) ? 'deleted' : sha1(file);
          const key = '/content/' + rel.split(/[\\/]/).join('/');
          // the bytes the open pages already know of: the editor's own write (its store told them), or a
          // change already announced (Windows reports one write as several events): nothing to tell
          if (state.writes.get(writeKey(file)) === hash) return;
          state.writes.set(writeKey(file), hash);
          state.generation++;
          state.notify?.([key], false);
        });
      },

      'astro:server:start': ({ address, logger }) => {
        if (!editing) return;
        const host = address.family === 'IPv6' ? `[${address.address}]` : address.address;
        const shown = ['::1', '127.0.0.1', '::'].includes(address.address) ? 'localhost' : host;
        logger.info(`Edit mode: http://${shown}:${address.port}/_edit/`);
      },
    },
  };
}
