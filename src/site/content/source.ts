/**
 * The files adapter's reading half: the content folder read from disk into a snapshot (every JSON
 * document, every media master, a digest), keyed by its path under the folder as `/content/…`. The api
 * adapter will replace this module with one that calls /v1 (documentation/content/api.md).
 *
 * Content is read, not imported: an imported JSON file is a module, and the dev server reloads every
 * open page when a server-only module changes, so every save in the editor would reload the editor
 * (documentation/editor/spec.md §8.4). When to read again is the content generation's job: the editor's
 * store advances it when a write commits, and the dev integration when anything else changes a file.
 * Parsed documents are kept by path, size and time, so a read parses only what changed, and the store
 * hands the snapshot it wrote to the next reader (documentation/engineering/performance-report.md R8).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { mergeOverlayStructure, overlayRole } from './overlay';

/** Defined by integrations/editor.mjs from Astro's root (or CONTENT_ROOT, in dev only). */
declare const __SITE_CONTENT_ROOT__: string | undefined;
/** Defined by integrations/editor.mjs: private-pages/, or the fixtures in a test build (documentation/access/spec.md §3). */
declare const __SITE_PRIVATE_ROOT__: string | undefined;
/** Defined by integrations/editor.mjs: a test build's public overlay (integrations/roots.mjs), else null. */
declare const __SITE_OVERLAY_ROOT__: string | null | undefined;

export interface Snapshot {
  /** The JSON documents, keyed `/content/<path>` or `/private/<path>` (their path under their folder). */
  docs: Record<string, unknown>;
  /** The media masters, as `/content/media/<path>` or `/private/media/<path>`. */
  masters: Set<string>;
  /** Files that couldn't be read as JSON, with why. */
  errors: string[];
  /** Changes when any file is added, removed, resized or touched. */
  digest: string;
  /** Each master's size in bytes, by its key (the rules on a drawing's or a playing tile's weight). */
  sizes?: Map<string, number>;
}

export const MASTER_FILE = /\.(webp|jpe?g|png|avif|gif|svg|pdf|mp4|webm|vtt|woff2)$/i;
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

/**
 * The public overlay a test build reads beside the content (src/site/content/overlay.ts), absolute; null
 * everywhere else. Set by the editor integration only for `astro build --mode test`, and honoured only in
 * that mode, so dev and every other build read the real content alone.
 */
export function overlayRoot(): string | null {
  return typeof __SITE_OVERLAY_ROOT__ === 'string' && import.meta.env?.MODE === 'test' ? __SITE_OVERLAY_ROOT__ : null;
}

/** Whether a key is a private file's. */
export const isPrivateKey = (key: string) => key.startsWith(PRIVATE_PREFIX);

/**
 * A file's key (`/content/…`) from its absolute path, and back; a private key (`/private/…`) maps to the
 * private folder, and a public one the content folder lacks to the overlay's file, when there's one.
 */
export const keyOf = (abs: string, root = contentRoot(), prefix = '/content/') => prefix + relative(root, abs).split(sep).join('/');
export const fileOf = (key: string, root = contentRoot(), priv = privateRoot(), overlay = overlayRoot()) => {
  if (isPrivateKey(key)) return join(priv, ...key.slice(PRIVATE_PREFIX.length).split('/'));
  const rel = key.replace(/^\/content\//, '').split('/');
  const own = join(root, ...rel);
  if (overlay && !existsSync(own) && existsSync(join(overlay, ...rel))) return join(overlay, ...rel);
  return own;
};
/** How the store and the dev integration's watcher name a written file: absolute, case-blind on Windows. */
export const writeKey = (abs: string) => (process.platform === 'win32' ? resolve(abs).toLowerCase() : resolve(abs));

/** Every file under a folder: its absolute path and its path under the folder (with `/`). */
function walk(dir: string, rel = ''): { abs: string; rel: string }[] {
  if (!rel && !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORED_FILE.test(e.name)) return [];
    const p = { abs: join(dir, e.name), rel: rel ? `${rel}/${e.name}` : e.name };
    return e.isDirectory() ? walk(p.abs, p.rel) : [p];
  });
}

/** The private folder counts once it holds its access file (a fresh clone of the submodule holds only its README). */
export const hasPrivate = (priv: string | null | undefined): priv is string => !!priv && existsSync(join(priv, 'access.json'));

/** A JSON document as last parsed, with the size and time it had then. */
type Parsed = { size: number; mtimeMs: number } & ({ value: unknown } | { error: string });

interface DocCache {
  /** Keyed by absolute path, so another content folder (CONTENT_ROOT, a test build's fixtures) never sees this one's. */
  files: Map<string, Parsed>;
  /** For the tests: freeze what's parsed, so a reader that changes a shared document fails loudly. */
  freeze?: boolean;
  /** For the tests: how many documents were parsed (not reused). */
  parsed: number;
}

/** On globalThis: the dev server's modules, the editor's and a module reloaded by HMR share one cache. */
function docCache(): DocCache {
  const g = globalThis as typeof globalThis & { __siteDocCache?: DocCache };
  return (g.__siteDocCache ??= { files: new Map(), parsed: 0 });
}

const cacheKey = (abs: string) => resolve(abs);

function deepFreeze(v: unknown): unknown {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}

/**
 * The parsed documents the snapshot keeps (documentation/engineering/performance-report.md R8). Readers
 * share them: never change a document read from a snapshot (copy it first).
 */
export const snapshotCache = {
  /** Forget every parsed document (the tests). */
  clear() {
    docCache().files.clear();
    docCache().parsed = 0;
  },
  /** For the tests: freeze every document parsed from now on, so a reader that changes one throws. */
  freeze(on = true) {
    docCache().freeze = on;
  },
  /** How many documents have been parsed rather than reused since the last clear. */
  get parsed() {
    return docCache().parsed;
  },
  /**
   * What the store just wrote: the document it parsed to check the change, kept as the file's parsed
   * value at its new size and time (so the next read doesn't parse it again), or forgotten if it's gone
   * (or isn't the size written: changed again since).
   */
  wrote(abs: string, value: unknown | undefined, bytes?: number) {
    const files = docCache().files;
    const key = cacheKey(abs);
    const st = value === undefined ? undefined : statSync(abs, { throwIfNoEntry: false });
    if (!st || (bytes !== undefined && st.size !== bytes)) {
      files.delete(key);
      return;
    }
    files.set(key, { size: st.size, mtimeMs: st.mtimeMs, value: docCache().freeze ? deepFreeze(value) : value });
  },
};

/** A JSON file's document, parsed again only when its size or time changed since it was last parsed. */
function parsedDoc(file: string, size: number, mtimeMs: number): Parsed {
  const cache = docCache();
  const key = cacheKey(file);
  const hit = cache.files.get(key);
  if (hit && hit.size === size && hit.mtimeMs === mtimeMs) return hit;
  let entry: Parsed;
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    entry = { size, mtimeMs, value: cache.freeze ? deepFreeze(value) : value };
  } catch (e) {
    entry = { size, mtimeMs, error: (e as Error).message };
  }
  cache.parsed++;
  cache.files.set(key, entry);
  return entry;
}

/**
 * Both folders, read into one snapshot: the public content folder, and the private one when it exists
 * (a clone without access to it, or without its submodule, builds the public site alone). Every file is
 * stat'd each time; a JSON document is parsed again only when its size or time changed, so the parsed
 * documents are shared between snapshots: a reader must never change one (copy it first). Each snapshot's
 * `docs` record is its own.
 * @param priv the private folder; null reads the public folder alone
 * @param overlay a test build's public overlay (overlayRoot); null reads none
 */
export function readSnapshot(root = contentRoot(), priv: string | null = privateRoot(), overlay: string | null = overlayRoot()): Snapshot {
  const docs: Record<string, unknown> = {};
  const masters = new Set<string>();
  const sizes = new Map<string, number>();
  const errors: string[] = [];
  const entries: Entry[] = [];
  const folders: [string, string][] = [[root, '/content/']];
  if (hasPrivate(priv) && resolve(priv) !== resolve(root)) folders.push([priv, PRIVATE_PREFIX]);
  const layered = !!overlay && resolve(overlay) !== resolve(root);
  let overlayStructure: unknown;
  for (const [dir, prefix, isOverlay] of [...folders.map(([d, p]) => [d, p, false] as const), ...(layered ? [[overlay as string, '/content/', true] as const] : [])]) {
    for (const { abs: file, rel } of walk(dir).sort((a, b) => (a.abs < b.abs ? -1 : a.abs > b.abs ? 1 : 0))) {
      const key = prefix + rel;
      // the private repository's own files at its top (its README) aren't content
      if (prefix === PRIVATE_PREFIX && !rel.includes('/') && PRIVATE_IGNORED.test(rel)) continue;
      const role = isOverlay ? overlayRole(rel) : 'add';
      if (role === 'skip') continue;
      const st = statSync(file);
      entries.push({ abs: file, key, line: `${key}\0${st.size}\0${st.mtimeMs}\n` });
      if (role === 'structure') {
        const parsed = parsedDoc(file, st.size, st.mtimeMs);
        if ('value' in parsed) overlayStructure = parsed.value;
        else errors.push(`overlay ${rel}: not valid JSON (${parsed.error})`);
        continue;
      }
      if (isOverlay && (key in docs || masters.has(key))) {
        errors.push(`${key.slice(1)}: in both the content and the test overlay (${dir}): give the overlay's its own name`);
        continue;
      }
      if (file.endsWith('.json')) {
        const parsed = parsedDoc(file, st.size, st.mtimeMs);
        if ('value' in parsed) docs[key] = parsed.value;
        else errors.push(`${key.slice(1)}: not valid JSON (${parsed.error})`);
      } else if (MASTER_FILE.test(file)) {
        masters.add(key);
        sizes.set(key, st.size);
      } else errors.push(`${key.slice(1)}: not a file the content model knows`);
    }
  }
  const structureKey = '/content/structures/site.json';
  if (overlayStructure !== undefined && docs[structureKey]) docs[structureKey] = mergeOverlayStructure(docs[structureKey], overlayStructure);
  const snap = { docs, masters, errors, digest: digestOf(entries), sizes };
  // the overlay's files aren't in the folders a write can go to (snapshotAfter): only a build reads one
  metas.set(snap, { folders, entries });
  return snap;
}

/** One file in a snapshot's digest, in the order it's read (by absolute path, folder by folder). */
interface Entry {
  abs: string;
  key: string;
  line: string;
}
/** What a snapshot was read from, so the store can tell what it became after a write without reading it all again. */
const metas = new WeakMap<Snapshot, { folders: [string, string][]; entries: Entry[] }>();

function digestOf(entries: Entry[]): string {
  const hash = createHash('sha1');
  for (const e of entries) hash.update(e.line);
  return hash.digest('hex');
}

/**
 * The snapshot as it is after the store wrote these files (each JSON document's new value, or deleted):
 * exactly what `readSnapshot` would read now, with the written files stat'd again and nothing else read.
 * Null when the snapshot wasn't read by `readSnapshot` or a key isn't in its folders.
 */
export function snapshotAfter(snap: Snapshot, written: { key: string; deleted: boolean; doc?: unknown }[]): Snapshot | null {
  const meta = metas.get(snap);
  if (!meta) return null;
  const entries = [...meta.entries];
  const values = new Map<string, unknown>();
  const sizes = new Map(snap.sizes ?? []);
  for (const w of written) {
    const folder = meta.folders.find(([, prefix]) => w.key.startsWith(prefix));
    if (!folder) return null;
    const abs = join(folder[0], ...w.key.slice(folder[1].length).split('/'));
    const at = entries.findIndex((e) => e.abs === abs);
    if (at >= 0) entries.splice(at, 1);
    sizes.delete(w.key);
    if (w.deleted) continue;
    const st = statSync(abs);
    const after = entries.findIndex((e) => e.abs > abs);
    entries.splice(after < 0 ? entries.length : after, 0, { abs, key: w.key, line: `${w.key}\0${st.size}\0${st.mtimeMs}\n` });
    values.set(w.key, w.doc);
    if (!w.key.endsWith('.json')) sizes.set(w.key, st.size);
  }
  // in the order readSnapshot gives them
  const docs: Record<string, unknown> = {};
  const masters = new Set<string>();
  for (const e of entries) {
    if (values.has(e.key)) {
      if (e.key.endsWith('.json')) docs[e.key] = values.get(e.key);
      else masters.add(e.key);
    } else if (e.key in snap.docs) docs[e.key] = snap.docs[e.key];
    else if (snap.masters.has(e.key)) masters.add(e.key);
  }
  const keys = written.map((w) => `${w.key.slice(1)}: `);
  const errors = snap.errors.filter((e) => !keys.some((k) => e.startsWith(k)));
  const next = { docs, masters, errors, digest: digestOf(entries), sizes: new Map([...sizes].filter(([k]) => masters.has(k))) };
  metas.set(next, { folders: meta.folders, entries });
  return next;
}

interface HandOff {
  generation: number;
  roots: string;
  snap: Snapshot;
}
const rootsOf = (root: string, priv: string | null) => `${resolve(root)}|${hasPrivate(priv) && resolve(priv) !== resolve(root) ? resolve(priv) : ''}`;

/**
 * The store's snapshot after a write, for the next reader at that generation: the repository then has
 * nothing to read again (documentation/engineering/performance-report.md R8). Any other change moves the
 * generation on, and the reader reads the folders again.
 */
export function handOff(snap: Snapshot, generation: number, root = contentRoot(), priv: string | null = privateRoot()): void {
  (globalThis as typeof globalThis & { __siteSnapshotHandOff?: HandOff }).__siteSnapshotHandOff = { generation, roots: rootsOf(root, priv), snap };
}

/** The content as it is now: the store's snapshot when nothing has changed since its write, else read from the folders. */
export function currentSnapshot(root = contentRoot(), priv: string | null = privateRoot()): Snapshot {
  const g = globalThis as typeof globalThis & { __siteSnapshotHandOff?: HandOff };
  const h = g.__siteSnapshotHandOff;
  const now = generation();
  if (h && now !== -1 && h.generation === now && h.roots === rootsOf(root, priv)) {
    return { docs: { ...h.snap.docs }, masters: new Set(h.snap.masters), errors: [...h.snap.errors], digest: h.snap.digest, sizes: new Map(h.snap.sizes ?? []) };
  }
  return readSnapshot(root, priv);
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
