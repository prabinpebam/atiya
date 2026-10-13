// @ts-check
/**
 * Where the dev server's time goes (documentation/engineering/performance.md §3). In dev only, every
 * request the dev server answers (pages, the editor's screens and API, Vite's modules, `/_image`
 * transforms, static files) is timed from its arrival to its last byte, with the named spans the site's
 * code adds while serving it (`src/site/content/timing.ts`: a content reload, an image, a git process, the
 * store's check). The last 2,000 are kept in memory for `GET /_edit/api/perf` (the benchmark reads them),
 * and each response carries a `Server-Timing` header for the browser's developer tools. A build, a preview
 * and the unit tests are untouched: nothing here runs outside `astro dev`.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const KEEP = 2000;

/** The kind of a dev request, by its address: a page, an editor screen, the API, a module, an image, an asset. */
export function kindOf(/** @type {string} */ url) {
  const path = url.split('?')[0];
  if (path.startsWith('/_edit/api/')) return 'api';
  if (path.startsWith('/_edit/canvas/')) return 'canvas';
  if (path === '/_edit' || path.startsWith('/_edit/')) return 'editor';
  if (path.startsWith('/_image')) return 'image';
  if (path.startsWith('/@') || path.startsWith('/node_modules/') || path.startsWith('/src/') || /\.(m?[jt]sx?|astro|css|vue)$/.test(path)) return 'module';
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return 'asset';
  return 'page';
}

/** @returns {import('astro').AstroIntegration} */
export default function perf() {
  return {
    name: 'site-perf',
    hooks: {
      'astro:server:setup': ({ server }) => {
        const g = /** @type {any} */ (globalThis);
        /** @type {AsyncLocalStorage<{ add(name: string, ms: number): void }>} */
        const store = (g.__siteTiming ??= new AsyncLocalStorage());
        /** @type {object[]} */
        const recent = (g.__siteRequests ??= []);
        server.middlewares.use((req, res, next) => {
          const start = performance.now();
          const at = Date.now();
          /** @type {Map<string, { count: number; ms: number }>} */
          const spans = new Map();
          const sink = {
            add(/** @type {string} */ name, /** @type {number} */ ms) {
              const s = spans.get(name) ?? { count: 0, ms: 0 };
              s.count++;
              s.ms += ms;
              spans.set(name, s);
            },
          };
          let head = 0;
          const writeHead = res.writeHead;
          // the header carries what was known when the response started; the record has the whole of it
          res.writeHead = /** @type {any} */ (function (/** @type {any[]} */ ...args) {
            head = performance.now() - start;
            if (!res.headersSent) {
              const parts = [...spans].map(([n, s]) => `${n.replace(/[^\w.-]/g, '_')};dur=${s.ms.toFixed(1)}`);
              res.setHeader('Server-Timing', [...parts, `head;dur=${head.toFixed(1)}`].join(', '));
            }
            return writeHead.apply(this, /** @type {any} */ (args));
          });
          res.once('close', () => {
            recent.push({
              at,
              method: req.method,
              url: req.url,
              kind: kindOf(req.url ?? '/'),
              status: res.statusCode,
              head: Math.round(head * 10) / 10,
              total: Math.round((performance.now() - start) * 10) / 10,
              bytes: Number(res.getHeader('content-length')) || undefined,
              spans: Object.fromEntries([...spans].map(([n, s]) => [n, { count: s.count, ms: Math.round(s.ms * 10) / 10 }])),
            });
            if (recent.length > KEEP) recent.splice(0, recent.length - KEEP);
          });
          store.run(sink, next);
        });
      },
    },
  };
}
