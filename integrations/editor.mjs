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
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overlayRootFor, privateRootFor } from './roots.mjs';
import { PLANET_FILES, planetOn, siteFeatures } from './features.mjs';
import { LAUNCH_HEADER, launchAllows } from './launch.mjs';
import { draftScript } from '../src/site/theme/draft.ts';
import { FRAME_HEADERS, guard } from '../src/site/editor/model/guard.ts';
import { STARTING_HEADERS, startingGuard, startingPage } from '../src/site/editor/model/starting.ts';

/** How long edit mode must have been idle before a new site name or planet restarts the server. */
const RESTART_QUIET_MS = 1500;

const ROUTES = [
  ['/_edit', 'dashboard.astro'],
  ['/_edit/articles', 'articles.astro'],
  ['/_edit/articles/[id]', 'article.astro'],
  ['/_edit/canvas/articles/[id]', 'canvas.astro'],
  ['/_edit/sections', 'sections.astro'],
  ['/_edit/navigation', 'navigation.astro'],
  ['/_edit/planet', 'planet.astro'],
  ['/_edit/ways', 'ways.astro'],
  ['/_edit/media', 'media.astro'],
  ['/_edit/albums', 'albums.astro'],
  ['/_edit/albums/[id]', 'album.astro'],
  ['/_edit/recommendations', 'recommendations.astro'],
  ['/_edit/highlights', 'highlights.astro'],
  ['/_edit/settings', 'settings.astro'],
  ['/_edit/access', 'access.astro'],
  ['/_edit/ai', 'ai.astro'],
  ['/_edit/publish', 'publish.astro'],
  ['/_edit/theme', 'theme.astro'],
  ['/_edit/tests', 'tests.astro'],
  ['/_edit/library', 'library.astro'],
  ['/_edit/library/[slug]', 'libraryPart.astro'],
  ['/_edit/api/[...path]', 'api.ts'],
];

/**
 * The host the site is published under, which links stay in the same tab for: its SITE_URL's host, else
 * `<owner>.github.io` from the content's own git remote, else '' (desktop spec §9.2: never the code's owner).
 * @param {string | undefined} siteUrl @param {string} repoDir
 */
function parentDomainOf(siteUrl, repoDir) {
  if (siteUrl) {
    try {
      return new URL(siteUrl).hostname.toLowerCase();
    } catch {
      // fall through to the remote
    }
  }
  try {
    const remote = execFileSync('git', ['-C', repoDir, 'config', '--get', 'remote.origin.url'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
    const owner = /github\.com[:/]([^/]+)\//i.exec(remote)?.[1];
    return owner ? `${owner.toLowerCase()}.github.io` : '';
  } catch {
    return '';
  }
}

/** The site's name from its settings (content/site.json), or '' when it can't be read. @param {string} root */
function siteNameOf(root) {
  try {
    const name = JSON.parse(readFileSync(join(root, 'site.json'), 'utf8')).name;
    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}

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

/**
 * The first start (performance-report.md R12): once `astro dev` is listening, each screen is asked for
 * once, so its modules compile before anyone waits on them, and then every picture's facts are read (or
 * found in their disk cache). Meanwhile a screen opened in the browser gets the starting page.
 */
const warm = { running: false, done: false, phase: '', screens: { done: 0, total: 0 }, pictures: { done: 0, total: 0 }, error: '' };

/**
 * @param {string} edit the editor's address on this server
 * @param {string} contentRoot
 * @param {any} server Vite's dev server
 * @param {import('astro').AstroIntegrationLogger} logger
 */
async function warmUp(edit, contentRoot, server, logger) {
  if (warm.running || warm.done) return;
  warm.running = true;
  const started = Date.now();
  try {
    const dir = join(contentRoot, 'articles');
    const first = existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith('.json'))?.replace(/\.json$/, '') : undefined;
    const screens = ['', 'articles/', ...(first ? [`articles/${first}/`, `canvas/articles/${first}/`] : []), 'media/', 'sections/', 'settings/', 'publish/'];
    warm.phase = 'screens';
    warm.screens = { done: 0, total: screens.length };
    for (const s of screens) {
      try {
        await (await fetch(`${edit}${s}`, { headers: { 'x-editor-warm': '1', ...(process.env.ATIYA_LAUNCH_TOKEN ? { [LAUNCH_HEADER]: process.env.ATIYA_LAUNCH_TOKEN } : {}) } })).arrayBuffer();
      } catch {
        /* a screen that fails says so when it's opened */
      }
      warm.screens.done++;
    }
    warm.phase = 'pictures';
    const load = server?.ssrLoadModule?.bind(server) ?? ((/** @type {string} */ id) => server.environments.ssr.runner.import(id));
    const facts = await load('/src/site/content/pictureFacts.ts');
    await facts.warmPictureFacts((/** @type {{ done: number, total: number }} */ p) => {
      warm.pictures = { done: p.done, total: p.total };
    });
  } catch (e) {
    warm.error = String(/** @type {Error} */ (e)?.message ?? e);
  } finally {
    warm.running = false;
    warm.done = true;
    warm.phase = 'done';
    logger.info(`Edit mode is ready (${((Date.now() - started) / 1000).toFixed(1)} s to compile its screens and read ${warm.pictures.total} pictures' facts)`);
  }
}

/**
 * A Node request in the shape edit mode's guard reads (src/site/editor/model/guard.ts).
 * @param {any} req
 * @returns {import('../src/site/editor/model/guard.ts').GuardRequest}
 */
function guardRequest(req) {
  /** @param {string} name */
  const header = (name) => {
    const v = req.headers[name.toLowerCase()];
    return v === undefined ? null : Array.isArray(v) ? v.join(', ') : String(v);
  };
  let url;
  try {
    url = new URL(String(req.url ?? '/'), 'http://localhost');
  } catch {
    url = new URL('http://localhost/');
  }
  return { method: String(req.method ?? 'GET'), url, clientAddress: req.socket?.remoteAddress, header };
}

/** @returns {import('astro').AstroIntegration} */
export default function editor() {
  /** @type {string} */
  let base = '/';
  /** @type {any} */
  let devServer = null;
  /** @type {string} */
  let contentRoot = '';
  /** @type {string} */
  let privateRoot = '';
  /** @type {boolean} */
  let editing = false;
  /** The site's name the running server was started with. */
  let siteName = '';
  /** @type {{ planet: boolean, designLibrary: boolean, docs: boolean, managed: boolean, residents: boolean }} */
  let features = { planet: true, designLibrary: true, docs: true, managed: false, residents: true };
  return {
    name: 'site-editor',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, injectScript, addMiddleware, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        base = config.base || '/';
        const override = process.env.CONTENT_ROOT;
        if (override && command === 'build') throw new Error('CONTENT_ROOT is only for the editor in dev and its tests: unset it to build, so the build reads the real content.');
        contentRoot = override && command === 'dev' ? (isAbsolute(override) ? override : resolve(root, override)) : join(root, 'content');
        privateRoot = privateRootFor(root, command);
        // a test build's made-up public content beside the real (roots.mjs); never in dev or another build
        const overlayRoot = overlayRootFor(root, command);
        // the header, footer and titles name the site from its own settings, never the code (desktop spec §9.2)
        siteName = siteNameOf(contentRoot);
        features = siteFeatures({ root, contentRoot });
        updateConfig({
          vite: {
            define: {
              __SITE_CONTENT_ROOT__: JSON.stringify(contentRoot),
              __SITE_PRIVATE_ROOT__: JSON.stringify(privateRoot),
              __SITE_OVERLAY_ROOT__: JSON.stringify(overlayRoot),
              __SITE_NAME__: JSON.stringify(siteName),
              __SITE_PARENT_DOMAIN__: JSON.stringify(parentDomainOf(config.site, override && command === 'dev' ? contentRoot : root)),
              __SITE_FEATURES__: JSON.stringify(features),
              // a plain boolean, so a build without the planet's residents drops their chunks (plan M3a)
              __GAME_RESIDENTS__: JSON.stringify(features.residents),
            },
            // the private masters a build imports, and a test build's overlay's (masters.ts globs through these
            // aliases; with no overlay, a folder that doesn't exist, in which the glob finds nothing)
            resolve: { alias: { '@private-pages': privateRoot, '@content-overlay': overlayRoot ?? join(root, 'tests/fixtures/gallery/.no-overlay') } },
            server: {
              ...(process.env.SITE_STRICT_PORT ? { strictPort: true } : {}),
              // a picture's master (an upload, a crop) is never a module, but a new one made the dev server
              // reload every open page, losing unsaved typing in other tabs; the store tells the pages itself,
              // and the sidecar beside each master is what they show (documentation/editor/spec.md §8.4)
              ...(command === 'dev' ? { watch: { ignored: [/[\\/](content|private-pages)[\\/]media[\\/].+\.(?:webp|jpe?g|png|avif|gif|svg|pdf|mp4|webm|vtt)$/i] } } : {}),
            },
          },
        });
        editing = command === 'dev' && process.env.SITE_EDITOR !== 'off';
        if (!editing) return;
        for (const [pattern, file] of ROUTES) {
          // the owner's test runner isn't part of a person's site (desktop plan, stage 7)
          // the source checkout's own screens: the test runs, and the parts library (its stories)
          if (features.managed && (pattern === '/_edit/tests' || pattern.startsWith('/_edit/library'))) continue;
          injectRoute({ pattern, entrypoint: `./src/site/editor/pages/${file}` });
        }
        addMiddleware({ entrypoint: join(root, 'src/site/editor/server/middleware.ts'), order: 'pre' });
        // the way in: a button on every page the dev server serves (never in a build)
        injectScript('page', `import { launch } from '/src/site/editor/scripts/launcher.ts'; launch();`);
        // the themes panel's live draft, on every site page before its first paint (documentation/site-ui/theming.md §7)
        injectScript('head-inline', draftScript(base));
        if (override) logger.info(`editing the content in ${contentRoot}`);
      },

      'astro:server:setup': ({ server }) => {
        devServer = server;
        // this start's own mark: a screen that waits for a restart (Ways to explore) knows the new server by it
        const started = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // a managed site's server, started by Atiya Studio, answers only the app's own views (desktop spec §7.3)
        const launchToken = process.env.ATIYA_LAUNCH_TOKEN;
        if (launchToken)
          server.middlewares.use((/** @type {any} */ req, /** @type {any} */ res, /** @type {() => void} */ next) => {
            if (launchAllows(req.headers[LAUNCH_HEADER], launchToken)) return next();
            res.statusCode = 403;
            res.setHeader('content-type', 'text/plain; charset=utf-8');
            res.end('This site is open in Atiya Studio. Open it there.');
          });
        const state = contentState();
        // edit mode's writes in flight: a restart waits for them (a save to remote just after a new name
        // would otherwise lose its answer, and the browser sends it again). Reads aren't counted: some are
        // long-lived streams (the Tests screen's), which would hold a restart off for ever
        let busy = 0;
        let quietSince = Date.now();
        if (editing)
          server.middlewares.use((/** @type {any} */ req, /** @type {any} */ res, /** @type {() => void} */ next) => {
            if (!String(req.url ?? '').includes('/_edit/api/') || req.method === 'GET' || req.method === 'HEAD') return next();
            busy++;
            let done = false;
            const end = () => {
              if (done) return;
              done = true;
              busy--;
              quietSince = Date.now();
            };
            res.on('finish', end);
            res.on('close', end);
            next();
          });
        let restarting = false;
        const restartWhenQuiet = () => {
          if (restarting) return;
          restarting = true;
          const tick = () => {
            if (busy > 0 || Date.now() - quietSince < RESTART_QUIET_MS) return void setTimeout(tick, 100);
            restarting = false;
            void server.restart();
          };
          setTimeout(tick, RESTART_QUIET_MS);
        };
        // a friendly first start (performance-report.md R12): while the screens compile and the pictures'
        // facts are read, a screen opened in the browser gets a plain page that says so, then the screen
        if (editing) {
          const edit = `${base.replace(/\/$/, '')}/_edit/`;
          server.middlewares.use((/** @type {any} */ req, /** @type {any} */ res, /** @type {() => void} */ next) => {
            const url = String(req.url ?? '');
            const path = url.split('?')[0];
            if (!path.startsWith(edit)) return next();
            /** @param {Record<string, string>} headers */
            const refuse = (headers) => {
              res.statusCode = 403;
              for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
              res.setHeader('content-type', 'text/plain; charset=utf-8');
              res.end('Forbidden');
            };
            if (path === `${edit}__warm`) {
              // edit mode's guard, as for every editor route: from this computer, to a local host name
              if (!guard(guardRequest(req)).ok) return refuse(FRAME_HEADERS);
              res.setHeader('content-type', 'application/json');
              res.setHeader('cache-control', 'no-store');
              return res.end(JSON.stringify({ ...warm, started }));
            }
            const asked = path === `${edit}__starting`;
            const opening = req.method === 'GET' && req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document' && !req.headers['x-editor'] && !req.headers['x-editor-warm'] && !path.startsWith(`${edit}api/`) && !path.startsWith(`${edit}canvas/`);
            if (!asked && !(opening && warm.running)) return next();
            // a top-level page load from this computer only (security review F1): never framed, never
            // opened by another site; a screen opened that way while warming goes on to edit mode's guard
            if (!startingGuard(guardRequest(req)).ok) return asked ? refuse(STARTING_HEADERS) : next();
            const wanted = asked ? new URLSearchParams(url.split('?')[1] ?? '').get('to') : url;
            res.statusCode = 200;
            for (const [name, value] of Object.entries(STARTING_HEADERS)) res.setHeader(name, value);
            res.end(startingPage(wanted, edit));
          });
        }
        state.notify = (files, fromEditor, origin = null) => {
          // Astro's own signal that content changed: it clears the route cache (getStaticPaths)
          for (const name of ['ssr', 'prerender']) server.environments[name]?.hot.send('astro:content-changed', {});
          // every open page hears every change: a site page reloads, an editor screen brings in what
          // another tab (or a hand edit) changed, and the tab that made it (origin) knows it's its own;
          // the generation lets a page drawn after the change (a screen that reloaded) know it has it
          server.environments.client.hot.send('site:content-changed', { files, fromEditor, origin, generation: state.generation });
        };
        server.watcher.add(contentRoot);
        if (existsSync(privateRoot)) server.watcher.add(privateRoot);
        server.watcher.on('all', (event, file) => {
          if (!['add', 'change', 'unlink'].includes(event) || ignored(file)) return;
          // a file in either folder: /content/… or /private/… (src/site/content/source.ts)
          const [dir, prefix] = [[contentRoot, '/content/'], [privateRoot, '/private/']].find(([d]) => {
            const r = relative(d, file);
            return !!r && !r.startsWith('..') && !isAbsolute(r);
          }) ?? [];
          if (!dir || !prefix) return;
          const rel = relative(dir, file);
          if (rel.split(/[\\/]/)[0] === '.git') return;
          const hash = event === 'unlink' || !existsSync(file) ? 'deleted' : sha1(file);
          const key = prefix + rel.split(/[\\/]/).join('/');
          // the bytes the open pages already know of: the editor's own write (its store told them), or a
          // change already announced (Windows reports one write as several events): nothing to tell
          if (state.writes.get(writeKey(file)) === hash) return;
          state.writes.set(writeKey(file), hash);
          state.generation++;
          state.notify?.([key], false);
        });
        // the site's name and whether it has the planet are set when the server starts: a new name (Settings),
        // or the little planet turned on or off (Ways to explore, or its structure coming or going), restarts it,
        // so every page shows it
        server.watcher.on('all', (_event, file) => {
          const rel = relative(contentRoot, file).split(/[\\/]/).join('/');
          if (rel !== 'site.json' && rel !== 'structures/ways.json' && !PLANET_FILES.includes(rel)) return;
          const now = siteNameOf(contentRoot);
          const planet = planetOn(contentRoot);
          if ((now && now !== siteName) || planet !== features.planet) {
            siteName = now || siteName;
            features = { ...features, planet };
            // a restart builds its server from the configuration it was first given, without this
            // integration's setup: the new values go into that configuration's defines, so pages see them
            for (const define of [server.config.inlineConfig?.define, server.config.define]) {
              if (!define) continue;
              define.__SITE_NAME__ = JSON.stringify(siteName);
              define.__SITE_FEATURES__ = JSON.stringify(features);
        define.__GAME_RESIDENTS__ = JSON.stringify(features.residents);
            }
            restartWhenQuiet();
          }
        });
      },

      'astro:server:start': ({ address, logger }) => {
        if (!editing) return;
        const host = address.family === 'IPv6' ? `[${address.address}]` : address.address;
        const shown = ['::1', '127.0.0.1', '::'].includes(address.address) ? 'localhost' : host;
        logger.info(`Edit mode: http://${shown}:${address.port}/_edit/`);
        if (process.env.SITE_EDITOR_WARM !== 'off') void warmUp(`http://localhost:${address.port}${base.replace(/\/$/, '')}/_edit/`, contentRoot, devServer, logger);
      },
    },
  };
}
