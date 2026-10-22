/**
 * A picture master's facts (documentation/engineering/performance-report.md R9): its size, its format and
 * its automatic background colour (the average of its opaque edge pixels, or its dominant colour where
 * they're transparent: documentation/content/media.md §9.1). Working them out means decoding the whole
 * master with sharp, so they're kept: in memory by path, size and time; in the master's sidecar (`facts`,
 * written by the editor when it's uploaded, trusted while the master's size is the one measured); and, in
 * dev, in a disk cache that outlives a restart (`node_modules/.cache/site-picture-facts.json`), filled in
 * the background by `warmPictureFacts`.
 *
 * Pure of astro: the dev integration may load it to warm the facts before any page asks.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { edgeAverage } from './edgeColour';
import { fileOf, readSnapshot } from './source';
import { timedAsync } from './timing';

export interface PictureFacts {
  width: number;
  height: number;
  /** As astro:assets names it (jpg, png, webp, avif, gif). */
  format: string;
  /** The automatic background: `rgb(r g b)`. */
  bg: string;
}

/** What a sidecar keeps of its master (the schema's `facts`): `bytes` is the master's size when measured. */
export interface SidecarFacts {
  width: number;
  height: number;
  bg: string;
  bytes: number;
}

export interface PictureFactsProgress {
  done: number;
  total: number;
  running: boolean;
}

const FORMAT: Record<string, string> = { jpeg: 'jpg', heif: 'avif' };
const PICTURE = /\.(webp|jpe?g|png|avif|gif|svg)$/i;
/** A master's format from its name, for facts a sidecar kept (uploads are named by what they are). */
const formatOfName = (path: string) => {
  const ext = (/\.(\w+)$/.exec(path)?.[1] ?? 'webp').toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
};

type Entry = { size: number; mtimeMs: number; facts: PictureFacts };

interface FactsState {
  memory: Map<string, Entry>;
  pending: Map<string, Promise<PictureFacts>>;
  disk?: { file: string; entries: Map<string, Entry> };
  dirty: Map<string, Entry>;
  timer?: ReturnType<typeof setTimeout>;
  progress: PictureFactsProgress;
  warming?: Promise<PictureFactsProgress>;
  listeners: Set<(p: PictureFactsProgress) => void>;
}

/** On globalThis: the dev server's modules, the integration and a module reloaded by HMR share one. */
function state(): FactsState {
  const g = globalThis as typeof globalThis & { __sitePictureFacts?: FactsState };
  return (g.__sitePictureFacts ??= { memory: new Map(), pending: new Map(), dirty: new Map(), progress: { done: 0, total: 0, running: false }, listeners: new Set() });
}

const pathKey = (abs: string) => resolve(abs);

/** A build reads every master once anyway: only dev keeps the disk cache. */
const useDisk = () => !import.meta.env?.PROD;

/** Where the disk cache is: SITE_PICTURE_FACTS (the tests), else node_modules/.cache, beside the other caches. */
export const pictureFactsFile = () => process.env.SITE_PICTURE_FACTS ?? join(process.cwd(), 'node_modules', '.cache', 'site-picture-facts.json');

function readDisk(file: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  try {
    if (!existsSync(file)) return entries;
    const data = JSON.parse(readFileSync(file, 'utf8')) as { version?: number; files?: Record<string, { size: number; mtimeMs: number } & PictureFacts> };
    if (data.version !== 1 || !data.files) return entries;
    for (const [k, v] of Object.entries(data.files)) {
      if (typeof v?.size === 'number' && typeof v.mtimeMs === 'number' && typeof v.width === 'number' && typeof v.height === 'number' && typeof v.bg === 'string' && typeof v.format === 'string') {
        entries.set(k, { size: v.size, mtimeMs: v.mtimeMs, facts: { width: v.width, height: v.height, format: v.format, bg: v.bg } });
      }
    }
  } catch {
    // unreadable: measured again, and written afresh
  }
  return entries;
}

/** The disk cache, loaded once (again if its file is changed, as the tests do). */
function disk(): Map<string, Entry> | null {
  if (!useDisk()) return null;
  const s = state();
  const file = pictureFactsFile();
  if (!s.disk || s.disk.file !== file) s.disk = { file, entries: readDisk(file) };
  return s.disk.entries;
}

const MAX_DISK = 5000;

/** Writes what's been measured since the last write: merged with the file as it is now (another dev server may share it), through a temporary file. */
export function flushPictureFacts(): void {
  const s = state();
  if (s.timer) clearTimeout(s.timer);
  s.timer = undefined;
  if (!s.dirty.size || !useDisk()) return;
  const file = pictureFactsFile();
  const merged = readDisk(file);
  for (const [k, v] of s.dirty) merged.set(k, v);
  s.dirty.clear();
  const kept = [...merged].slice(-MAX_DISK);
  const files = Object.fromEntries(kept.map(([k, v]) => [k, { size: v.size, mtimeMs: v.mtimeMs, ...v.facts }]));
  const tmp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(tmp, JSON.stringify({ version: 1, files }));
    renameSync(tmp, file);
    if (s.disk?.file === file) for (const [k, v] of kept) s.disk.entries.set(k, v);
  } catch {
    // best effort: a cache
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // nothing more to do
    }
  }
}

function remember(abs: string, entry: Entry, persist: boolean) {
  const s = state();
  s.memory.set(pathKey(abs), entry);
  if (!persist || !useDisk()) return;
  disk()?.set(pathKey(abs), entry);
  s.dirty.set(pathKey(abs), entry);
  if (!s.timer) {
    s.timer = setTimeout(flushPictureFacts, 1000);
    (s.timer as { unref?: () => void }).unref?.();
  }
}

/** A master's facts from its bytes (never from its path: sharp keeps files it opened by path open, and Windows then refuses to replace or delete them). */
export async function decodeFacts(bytes: Buffer): Promise<PictureFacts> {
  const { default: sharp } = await import('sharp');
  const m = await timedAsync('picture.metadata', () => sharp(bytes).metadata());
  const N = 24;
  // a GIF is kept as it is, and browsers show ones a strict decoder warns about: read it leniently
  const bg = await timedAsync('picture.edge', async () => {
    const { data } = await sharp(bytes, { failOn: 'none' }).resize(N, N, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const edge = edgeAverage(data, N);
    if (edge) return edge;
    const { dominant } = await sharp(bytes, { failOn: 'none' }).stats();
    return `rgb(${dominant.r} ${dominant.g} ${dominant.b})`;
  });
  return { width: m.width!, height: m.pageHeight ?? m.height!, format: FORMAT[m.format ?? ''] ?? m.format ?? 'webp', bg };
}

/** What the editor writes into a sidecar when it saves a master (the schema's `facts`). */
export async function measureFacts(bytes: Buffer): Promise<SidecarFacts> {
  const f = await decodeFacts(bytes);
  return { width: f.width, height: f.height, bg: f.bg, bytes: bytes.length };
}

/**
 * A master's facts, by its key (`/content/media/…` or `/private/media/…`): from memory, from its sidecar's
 * `facts` (when the master is still the size they were measured at), from the disk cache, or decoded
 * once (two asking at once share the one decoding).
 */
export async function pictureFacts(master: string, kept?: SidecarFacts | null): Promise<PictureFacts> {
  const abs = fileOf(master);
  const st = statSync(abs);
  const key = pathKey(abs);
  const s = state();
  const hit = s.memory.get(key);
  if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.facts;
  if (kept && kept.bytes === st.size) {
    const facts = { width: kept.width, height: kept.height, bg: kept.bg, format: formatOfName(abs) };
    remember(abs, { size: st.size, mtimeMs: st.mtimeMs, facts }, false);
    return facts;
  }
  const saved = disk()?.get(key);
  if (saved && saved.size === st.size && saved.mtimeMs === st.mtimeMs) {
    s.memory.set(key, saved);
    return saved.facts;
  }
  const id = `${key}|${st.size}|${st.mtimeMs}`;
  let p = s.pending.get(id);
  if (!p) {
    p = decodeFacts(readFileSync(abs)).then(
      (facts) => {
        remember(abs, { size: st.size, mtimeMs: st.mtimeMs, facts }, true);
        s.pending.delete(id);
        return facts;
      },
      (e) => {
        s.pending.delete(id);
        throw e;
      },
    );
    s.pending.set(id, p);
  }
  return p;
}

/** Every picture master's sidecar facts, from a snapshot's documents: its own master's and its dark version's. */
export function keptFacts(docs: Record<string, unknown>): Map<string, SidecarFacts> {
  const out = new Map<string, SidecarFacts>();
  for (const [key, doc] of Object.entries(docs)) {
    if (!/^\/(?:content|private)\/media\/.+\.json$/.test(key)) continue;
    const d = doc as { kind?: string; file?: string; facts?: SidecarFacts; dark?: { file?: string; facts?: SidecarFacts } } | null;
    if (d?.kind !== 'image') continue;
    const dir = key.slice(0, key.lastIndexOf('/') + 1);
    if (d.file && d.facts) out.set(dir + d.file, d.facts);
    if (d.dark?.file && d.dark.facts) out.set(dir + d.dark.file, d.dark.facts);
  }
  return out;
}

/** How far the background warm-up has got (R12's first-start notice reads it). */
export function pictureFactsProgress(): PictureFactsProgress {
  return { ...state().progress };
}

const tick = () => new Promise<void>((r) => setImmediate(r));

/**
 * Works out, in the background, the facts of every picture master not yet known (by its sidecar or the
 * disk cache), a few at a time, yielding between them so the dev server keeps answering. Calling it while
 * it runs joins the run. A master that can't be read is skipped (its page says so when it's drawn).
 * @param onProgress told after each master
 */
export function warmPictureFacts(onProgress?: (p: PictureFactsProgress) => void, opts: { concurrency?: number } = {}): Promise<PictureFactsProgress> {
  const s = state();
  if (onProgress) s.listeners.add(onProgress);
  if (s.warming) return s.warming;
  const run = async (): Promise<PictureFactsProgress> => {
    const snap = readSnapshot();
    const kept = keptFacts(snap.docs);
    const list = [...snap.masters].filter((m) => PICTURE.test(m));
    s.progress = { done: 0, total: list.length, running: true };
    const tell = () => {
      for (const l of s.listeners) {
        try {
          l({ ...s.progress });
        } catch {
          // a listener's problem isn't the warm-up's
        }
      }
    };
    tell();
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const master = list[next++];
        try {
          await pictureFacts(master, kept.get(master));
        } catch {
          // skipped
        }
        s.progress.done++;
        tell();
        await tick();
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 3, 8)) }, worker));
    s.progress.running = false;
    flushPictureFacts();
    tell();
    return { ...s.progress };
  };
  s.warming = run().finally(() => {
    s.warming = undefined;
    s.listeners.clear();
    s.progress.running = false;
  });
  return s.warming;
}

/** For the tests: forget everything held in memory (the disk cache stays on disk). */
export function resetPictureFacts(): void {
  const s = state();
  if (s.timer) clearTimeout(s.timer);
  s.memory.clear();
  s.pending.clear();
  s.dirty.clear();
  s.disk = undefined;
  s.timer = undefined;
  s.progress = { done: 0, total: 0, running: false };
}
