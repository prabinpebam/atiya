// @ts-check
/**
 * The content's own files (documentation/content/media.md §11, §12): a PDF with a `document` sidecar (the
 * résumé's) is published at <base>/media/<id>.pdf, and a video file with a `video` sidecar at
 * <base>/media/<id>.<mp4|webm>. This integration serves those files from the dev server (videos with byte
 * ranges, so a reader can seek) and copies them into the build, public ones only, so a page links to a PDF
 * with `ref:media/<id>` and shows a video by its media ID, and each file keeps its own name.
 */
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateRootFor } from './roots.mjs';
import { recordProvenance } from '../src/site/content/provenance.ts';

const PUBLIC = new Set(['public', 'publicRedacted', 'summaryOnly']);
/** What each kind of sidecar publishes, by the file's extension. */
const KINDS = /** @type {const} */ ({ document: ['pdf'], video: ['mp4', 'webm'] });
const TYPE = /** @type {Record<string, string>} */ ({ pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm' });

/** The published file for a media ID and extension, if it's a public document or video in one of the media folders: its absolute path and whether it's private. */
function publishedFile(/** @type {{ root: string; private: boolean }[]} */ mediaRoots, /** @type {string} */ id, /** @type {string} */ ext) {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)+$/.test(id)) return null;
  for (const m of mediaRoots) {
    const sidecar = normalize(join(m.root, `${id}.json`));
    if (!sidecar.startsWith(m.root + sep) || !existsSync(sidecar)) continue;
    try {
      const s = JSON.parse(readFileSync(sidecar, 'utf8'));
      const exts = /** @type {readonly string[] | undefined} */ (KINDS[/** @type {keyof typeof KINDS} */ (s?.kind)]);
      if (!exts?.includes(ext) || !PUBLIC.has(s.visibility) || s.file !== `${id.split('/').pop()}.${ext}`) continue;
      const file = join(dirname(sidecar), s.file);
      if (existsSync(file)) return { file, private: m.private };
    } catch {
      continue;
    }
  }
  return null;
}

/** Every public document and video under the media folders: its media ID and extension. */
function published(/** @type {{ root: string; private: boolean }[]} */ mediaRoots) {
  /** @type {{ id: string; ext: string }[]} */
  const out = [];
  for (const { root } of mediaRoots) {
    const walk = (/** @type {string} */ dir) => {
      if (!existsSync(dir)) return;
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (e.endsWith('.json')) {
          const id = relative(root, p).split(sep).join('/').replace(/\.json$/, '');
          for (const ext of Object.values(KINDS).flat()) if (publishedFile([{ root, private: false }], id, ext)) out.push({ id, ext });
        }
      }
    };
    walk(root);
  }
  return out;
}

/**
 * A byte range from a Range header ("bytes=0-", "bytes=100-199", "bytes=-500") within a file of `size`, or
 * null for the whole file; `false` when it can't be satisfied.
 * @returns {{ start: number; end: number } | null | false}
 */
export function byteRange(/** @type {string | undefined} */ header, /** @type {number} */ size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((header ?? '').trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  if (start < 0) start = 0;
  if (end > size - 1) end = size - 1;
  return start > end || start >= size ? false : { start, end };
}

/** @returns {import('astro').AstroIntegration} */
export default function contentFiles() {
  /** @type {{ root: string; private: boolean }[]} */
  let mediaRoots = [];
  let base = '/';
  return {
    name: 'content-files',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        const root = fileURLToPath(config.root);
        // as the editor integration: CONTENT_ROOT is another content folder, in dev only
        const override = process.env.CONTENT_ROOT;
        const content = override && command === 'dev' ? (isAbsolute(override) ? override : resolve(root, override)) : join(root, 'content');
        // a private video is copied into the build only to be sealed (documentation/access/spec.md §6.2)
        mediaRoots = [
          { root: join(content, 'media'), private: false },
          { root: join(privateRootFor(root, command), 'media'), private: true },
        ];
        base = config.base.replace(/\/$/, '');
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url ?? '').split('?')[0]);
          const at = url.startsWith(`${base}/media/`) ? base.length : url.startsWith('/media/') ? 0 : -1;
          const ext = /\.(pdf|mp4|webm)$/.exec(url)?.[1];
          if (at < 0 || !ext) return next();
          const found = publishedFile(mediaRoots, url.slice(at + '/media/'.length, -(ext.length + 1)), ext);
          if (!found) return next();
          const file = found.file;
          const size = statSync(file).size;
          res.setHeader('Content-Type', TYPE[ext]);
          res.setHeader('Accept-Ranges', 'bytes');
          const range = byteRange(req.headers.range, size);
          if (range === false) {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${size}`);
            return res.end();
          }
          if (range) {
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
            res.setHeader('Content-Length', String(range.end - range.start + 1));
            return void createReadStream(file, range).pipe(res);
          }
          res.setHeader('Content-Length', String(size));
          createReadStream(file).pipe(res);
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const files = published(mediaRoots);
        for (const { id, ext } of files) {
          const found = /** @type {{ file: string; private: boolean }} */ (publishedFile(mediaRoots, id, ext));
          const target = join(out, 'media', `${id}.${ext}`);
          mkdirSync(dirname(target), { recursive: true });
          copyFileSync(found.file, target);
          if (found.private) recordProvenance({ kind: 'asset', url: `${base}/media/${id}.${ext}`, master: `/private/media/${id}.${ext}` });
        }
        if (files.length) logger.info(`copied ${files.length} file${files.length === 1 ? '' : 's'} (to download and videos) into media/`);
      },
    },
  };
}
