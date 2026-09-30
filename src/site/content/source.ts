/**
 * The files adapter's reading half: the content folder read from disk into a snapshot (every JSON
 * document, every media master, a digest), keyed by its path under the folder as `/content/…`. The api
 * adapter will replace this module with one that calls /v1 (documentation/content/api.md).
 *
 * Content is read, not imported: an imported JSON file is a module, and the dev server reloads every
 * open page when a server-only module changes, so every save in the editor would reload the editor
 * (documentation/editor/spec.md §8.4). When to read again is the content generation's job: the editor's
 * store advances it when a write commits, and the dev integration when anything else changes a file.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

/** Defined by integrations/editor.mjs from Astro's root (or CONTENT_ROOT, in dev only). */
declare const __SITE_CONTENT_ROOT__: string | undefined;

export interface Snapshot {
  /** The JSON documents, keyed `/content/<path>` (their path under the content folder). */
  docs: Record<string, unknown>;
  /** The media masters, as `/content/media/<path>`. */
  masters: Set<string>;
  /** Files that couldn't be read as JSON, with why. */
  errors: string[];
  /** Changes when any file is added, removed, resized or touched. */
  digest: string;
}

export const MASTER_FILE = /\.(webp|jpe?g|png|avif)$/i;
/** The editor's temporary files and anything hidden: never content. */
export const IGNORED_FILE = /^\.|\.tmp$/;

/** The content folder, absolute. */
export function contentRoot(): string {
  if (typeof __SITE_CONTENT_ROOT__ === 'string') return __SITE_CONTENT_ROOT__;
  return process.env.CONTENT_ROOT ?? join(process.cwd(), 'content');
}

/** A file's key (`/content/…`) from its absolute path, and back. */
export const keyOf = (abs: string, root = contentRoot()) => '/content/' + relative(root, abs).split(sep).join('/');
export const fileOf = (key: string, root = contentRoot()) => join(root, ...key.replace(/^\/content\//, '').split('/'));
/** How the store and the dev integration's watcher name a written file: absolute, case-blind on Windows. */
export const writeKey = (abs: string) => (process.platform === 'win32' ? resolve(abs).toLowerCase() : resolve(abs));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORED_FILE.test(e.name)) return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export function readSnapshot(root = contentRoot()): Snapshot {
  const docs: Record<string, unknown> = {};
  const masters = new Set<string>();
  const errors: string[] = [];
  const hash = createHash('sha1');
  for (const file of walk(root).sort()) {
    const key = keyOf(file, root);
    const st = statSync(file);
    hash.update(`${key}\0${st.size}\0${st.mtimeMs}\n`);
    if (file.endsWith('.json')) {
      try {
        docs[key] = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        errors.push(`${key.slice(1)}: not valid JSON (${(e as Error).message})`);
      }
    } else if (MASTER_FILE.test(file)) masters.add(key);
    else errors.push(`${key.slice(1)}: not a file the content model knows`);
  }
  return { docs, masters, errors, digest: hash.digest('hex') };
}

/** Shared by the dev server's modules and the editor integration (one process), so both see one generation. */
export interface ContentState {
  generation: number;
  /** Files the editor's store wrote, with their bytes' hash, so the watcher can tell its own writes from others. */
  writes: Map<string, string>;
  /** Set by the dev integration: tells the dev server what changed (the route cache; open pages if not the editor). */
  notify?: (files: string[], fromEditor: boolean) => void;
}

export function contentState(): ContentState {
  const g = globalThis as typeof globalThis & { __siteContent?: ContentState };
  return (g.__siteContent ??= { generation: 0, writes: new Map() });
}

/** The generation readers compare before using what they read: -1 means read once (a build, the unit tests). */
export function generation(): number {
  if (import.meta.env.PROD) return -1;
  const g = globalThis as typeof globalThis & { __siteContent?: ContentState };
  return g.__siteContent?.generation ?? -1;
}
