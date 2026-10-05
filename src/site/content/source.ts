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
/** Defined by integrations/editor.mjs: private-pages/, or the fixtures in a test build (documentation/access/spec.md §3). */
declare const __SITE_PRIVATE_ROOT__: string | undefined;

export interface Snapshot {
  /** The JSON documents, keyed `/content/<path>` or `/private/<path>` (their path under their folder). */
  docs: Record<string, unknown>;
  /** The media masters, as `/content/media/<path>` or `/private/media/<path>`. */
  masters: Set<string>;
  /** Files that couldn't be read as JSON, with why. */
  errors: string[];
  /** Changes when any file is added, removed, resized or touched. */
  digest: string;
}

export const MASTER_FILE = /\.(webp|jpe?g|png|avif|pdf|mp4|webm)$/i;
/** The editor's temporary files and anything hidden: never content. */
export const IGNORED_FILE = /^\.|\.tmp$/;
/** A private file's key starts with this; a public one's with `/content/`. */
export const PRIVATE_PREFIX = '/private/';
/** The private folder's files that aren't content (its README, a .gitattributes): never read. */
const PRIVATE_IGNORED = /^(README\.md|LICENSE|\.git.*)$/i;

/** The content folder, absolute. */
export function contentRoot(): string {
  if (typeof __SITE_CONTENT_ROOT__ === 'string') return __SITE_CONTENT_ROOT__;
  return process.env.CONTENT_ROOT ?? join(process.cwd(), 'content');
}

/** The private folder (the private-pages submodule, or the fixtures), absolute; it may not exist. */
export function privateRoot(): string {
  if (typeof __SITE_PRIVATE_ROOT__ === 'string') return __SITE_PRIVATE_ROOT__;
  return process.env.PRIVATE_ROOT ?? join(process.cwd(), 'private-pages');
}

/** Whether a key is a private file's. */
export const isPrivateKey = (key: string) => key.startsWith(PRIVATE_PREFIX);

/** A file's key (`/content/…`) from its absolute path, and back; a private key (`/private/…`) maps to the private folder. */
export const keyOf = (abs: string, root = contentRoot(), prefix = '/content/') => prefix + relative(root, abs).split(sep).join('/');
export const fileOf = (key: string, root = contentRoot(), priv = privateRoot()) =>
  isPrivateKey(key) ? join(priv, ...key.slice(PRIVATE_PREFIX.length).split('/')) : join(root, ...key.replace(/^\/content\//, '').split('/'));
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

/** The private folder counts once it holds its access file (a fresh clone of the submodule holds only its README). */
export const hasPrivate = (priv: string | null | undefined): priv is string => !!priv && existsSync(join(priv, 'access.json'));

/**
 * Both folders, read into one snapshot: the public content folder, and the private one when it exists
 * (a clone without access to it, or without its submodule, builds the public site alone).
 * @param priv the private folder; null reads the public folder alone
 */
export function readSnapshot(root = contentRoot(), priv: string | null = privateRoot()): Snapshot {
  const docs: Record<string, unknown> = {};
  const masters = new Set<string>();
  const errors: string[] = [];
  const hash = createHash('sha1');
  const folders: [string, string][] = [[root, '/content/']];
  if (hasPrivate(priv) && resolve(priv) !== resolve(root)) folders.push([priv, PRIVATE_PREFIX]);
  for (const [dir, prefix] of folders) {
    for (const file of walk(dir).sort()) {
      const key = keyOf(file, dir, prefix);
      // the private repository's own files at its top (its README) aren't content
      if (prefix === PRIVATE_PREFIX && !key.slice(prefix.length).includes('/') && PRIVATE_IGNORED.test(key.slice(prefix.length))) continue;
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
  }
  return { docs, masters, errors, digest: hash.digest('hex') };
}

/** Shared by the dev server's modules and the editor integration (one process), so both see one generation. */
export interface ContentState {
  generation: number;
  /**
   * The hash of the bytes the open pages know each file by: the store records what it writes (and tells
   * the pages itself), the watcher what it announces, so a write reported twice is told once.
   */
  writes: Map<string, string>;
  /**
   * Set by the dev integration: tells the dev server what changed (the route cache) and every open page,
   * with the editor tab that made the change (`origin`, null for a change made outside the editor), so
   * that tab can tell its own save from someone else's.
   */
  notify?: (files: string[], fromEditor: boolean, origin?: string | null) => void;
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
