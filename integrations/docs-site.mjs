// @ts-check
/**
 * The documentation site (Slate: documentation/) is published beside the game at <base>/docs/.
 * This integration copies it into the build output, and serves it at /docs/ from the dev server,
 * so the docs are always one link away from the site (docs: documentation/engineering/overview.md).
 */
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** @param {{ source?: string; route?: string }} [options] @returns {import('astro').AstroIntegration} */
export default function docsSite({ source = 'documentation', route = 'docs' } = {}) {
  const root = resolve(source);
  return {
    name: 'docs-site',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url ?? '').split('?')[0]);
          const prefix = `/${route}`;
          if (url !== prefix && !url.startsWith(`${prefix}/`)) return next();
          if (url === prefix) {
            res.statusCode = 301;
            res.setHeader('Location', `${prefix}/`);
            return res.end();
          }
          let file = normalize(join(root, url.slice(prefix.length)));
          if (file !== root && !file.startsWith(root + sep)) return next();
          if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
          if (!existsSync(file)) return next();
          const type = TYPES[/** @type {keyof typeof TYPES} */ (extname(file).toLowerCase())];
          res.setHeader('Content-Type', type ?? 'application/octet-stream');
          res.end(readFileSync(file));
        });
      },
      'astro:build:done': ({ dir }) => {
        cpSync(root, join(fileURLToPath(dir), route), { recursive: true });
      },
    },
  };
}
