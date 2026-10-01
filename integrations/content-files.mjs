// @ts-check
/**
 * Files to download from the content (documentation/content/media.md §11): a PDF in content/media/ with a
 * `document` sidecar (the résumé's) is published at <base>/media/<id>.pdf. This integration serves those
 * files from the dev server and copies them into the build, public ones only, so a page links to one with
 * `ref:media/<id>` and the file keeps its own name.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = new Set(['public', 'publicRedacted', 'summaryOnly']);

/** The published file for a media ID, if it's a public document: its absolute path. */
function documentFile(/** @type {string} */ mediaRoot, /** @type {string} */ id) {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)+$/.test(id)) return null;
  const sidecar = normalize(join(mediaRoot, `${id}.json`));
  if (!sidecar.startsWith(mediaRoot + sep) || !existsSync(sidecar)) return null;
  try {
    const s = JSON.parse(readFileSync(sidecar, 'utf8'));
    if (s?.kind !== 'document' || !PUBLIC.has(s.visibility) || s.file !== `${id.split('/').pop()}.pdf`) return null;
    const file = join(dirname(sidecar), s.file);
    return existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

/** Every public document under the media folder, by media ID. */
function documents(/** @type {string} */ mediaRoot) {
  /** @type {string[]} */
  const ids = [];
  const walk = (/** @type {string} */ dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.json')) ids.push(relative(mediaRoot, p).split(sep).join('/').replace(/\.json$/, ''));
    }
  };
  walk(mediaRoot);
  return ids.filter((id) => documentFile(mediaRoot, id));
}

/** @returns {import('astro').AstroIntegration} */
export default function contentFiles() {
  let mediaRoot = '';
  let base = '/';
  return {
    name: 'content-files',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        const root = fileURLToPath(config.root);
        // as the editor integration: CONTENT_ROOT is another content folder, in dev only
        const override = process.env.CONTENT_ROOT;
        const content = override && command === 'dev' ? (isAbsolute(override) ? override : resolve(root, override)) : join(root, 'content');
        mediaRoot = join(content, 'media');
        base = config.base.replace(/\/$/, '');
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url ?? '').split('?')[0]);
          const at = url.startsWith(`${base}/media/`) ? base.length : url.startsWith('/media/') ? 0 : -1;
          if (at < 0 || !url.endsWith('.pdf')) return next();
          const file = documentFile(mediaRoot, url.slice(at + '/media/'.length, -'.pdf'.length));
          if (!file) return next();
          res.setHeader('Content-Type', 'application/pdf');
          res.end(readFileSync(file));
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const ids = documents(mediaRoot);
        for (const id of ids) {
          const target = join(out, 'media', `${id}.pdf`);
          mkdirSync(dirname(target), { recursive: true });
          copyFileSync(/** @type {string} */ (documentFile(mediaRoot, id)), target);
        }
        if (ids.length) logger.info(`copied ${ids.length} file${ids.length === 1 ? '' : 's'} to download into media/`);
      },
    },
  };
}
