/**
 * The editor's store (documentation/editor/spec.md §8.3): every write to the content folder is one
 * transaction. Holding one writer lock (publishing takes it too), it checks the version of every file
 * it may touch, applies the change set to a fresh snapshot and runs the whole content check, then writes
 * each file to a flushed temporary file beside it and renames them into place in an order that keeps
 * every step valid, retrying the brief locks Windows takes, and puts everything back if a step still
 * fails. Then it records what it wrote (so the dev integration can tell its own writes from others),
 * moves the content generation on and tells the dev server.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmdirSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { contentRoot, contentState, fileOf, readSnapshot, writeKey, MASTER_FILE, type Snapshot } from '../../content/source';
import { ContentError, describe, loadContent, type Issue } from '../../content/load';

/** The editor tab a request came from (its X-Editor-Tab header): the API runs each request inside it. */
const tabs = new AsyncLocalStorage<string | null>();

/** Runs `fn` as a request from an editor tab, so what it writes is told to the other tabs as that tab's. */
export const asTab = <T>(tab: string | null, fn: () => T): T => tabs.run(tab, fn);

/** One file's new bytes, or null to delete it. */
export interface Change {
  key: string;
  bytes: Buffer | null;
}

export interface Transaction {
  changes: Change[];
  /** The version each touched file was read at (null: it mustn't exist yet). Every change needs one. */
  ifMatch: Record<string, string | null>;
}

export type Result = { ok: true; versions: Record<string, string | null> } | { ok: false; status: 409 | 422; issues: Issue[] };

export interface StoreOptions {
  root?: string;
  /** For the tests: stands in for renaming a temporary file into place. */
  rename?: (from: string, to: string) => void;
  /** For the tests: stands in for deleting a file. */
  unlink?: (path: string) => void;
}

export const versionOf = (bytes: Buffer | null): string | null => (bytes ? createHash('sha1').update(bytes).digest('hex') : null);
export const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');

/** A resource path the content model allows: lowercase kebab-case folders and names, known extensions. */
const KEY = /^\/content\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:json|webp|jpe?g|png|avif)$/;

/** The absolute path of a key, or null when the key isn't one the content model allows or leaves the folder. */
export function pathOf(key: string, root = contentRoot()): string | null {
  if (!KEY.test(key)) return null;
  const abs = resolve(fileOf(key, root));
  const rel = relative(resolve(root), abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  return abs;
}

export function readFile(key: string, root = contentRoot()): Buffer | null {
  const abs = pathOf(key, root);
  return abs && existsSync(abs) ? readFileSync(abs) : null;
}

/** A JSON document and its version. */
export function readDoc<T = unknown>(key: string, root = contentRoot()): { value: T; version: string } | null {
  const bytes = readFile(key, root);
  return bytes ? { value: JSON.parse(bytes.toString('utf8')) as T, version: versionOf(bytes)! } : null;
}

/** Writes first (masters, then sidecars, then documents, then the structures), then deletions (documents, then masters). */
function rank(c: Change): number {
  const master = MASTER_FILE.test(c.key);
  const media = c.key.startsWith('/content/media/');
  const structure = c.key.startsWith('/content/structures/');
  if (c.bytes) return master ? 0 : media ? 1 : structure ? 3 : 2;
  return master ? 7 : media ? 6 : structure ? 4 : 5;
}

const RETRY = new Set(['EPERM', 'EBUSY', 'EACCES']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs a file operation, retrying while Windows briefly holds the file (an indexer, an antivirus). */
async function withRetries(op: () => void): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      op();
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (!RETRY.has(code) || attempt >= 8) throw e;
      await sleep(20 * 2 ** attempt);
    }
  }
}

/** The content check: the issues the content would have. */
function check(snap: Pick<Snapshot, 'docs' | 'masters' | 'errors'>): { issues: Issue[] } {
  try {
    loadContent(snap.docs, snap.masters, snap.errors);
    return { issues: [] };
  } catch (e) {
    if (e instanceof ContentError) return { issues: e.issues };
    throw e;
  }
}

export function commit(tx: Transaction, opts: StoreOptions = {}): Promise<Result> {
  const state = contentState() as ReturnType<typeof contentState> & { lock?: Promise<unknown> };
  // read now, in the request's own context: the lock's chain runs it later
  const origin = tabs.getStore() ?? null;
  const run = () => apply(tx, opts, origin);
  const result = (state.lock ?? Promise.resolve()).then(run, run);
  state.lock = result.catch(() => undefined);
  return result;
}

/** Runs `fn` holding the writer lock (publishing uses it, so nothing changes while it checks and commits). */
export function withWriterLock<T>(fn: () => Promise<T>): Promise<T> {
  const state = contentState() as ReturnType<typeof contentState> & { lock?: Promise<unknown> };
  const result = (state.lock ?? Promise.resolve()).then(fn, fn);
  state.lock = result.catch(() => undefined);
  return result;
}

async function apply(tx: Transaction, opts: StoreOptions, origin: string | null = null): Promise<Result> {
  const root = opts.root ?? contentRoot();
  const rename = opts.rename ?? renameSync;
  const unlink = opts.unlink ?? unlinkSync;
  const issues: Issue[] = [];

  // 1. every path allowed, every change versioned, every version current
  const targets = tx.changes.map((c) => ({ ...c, abs: pathOf(c.key, root) }));
  for (const t of targets) {
    if (!t.abs) issues.push({ file: t.key.replace(/^\//, ''), message: 'not a path the content model allows' });
    else if (!(t.key in tx.ifMatch)) issues.push({ file: t.key.replace(/^\//, ''), message: 'changed without saying which version it started from' });
  }
  if (issues.length) return { ok: false, status: 422, issues };
  for (const [key, expected] of Object.entries(tx.ifMatch)) {
    const current = versionOf(readFile(key, root));
    if (current !== expected) issues.push({ file: key.replace(/^\//, ''), message: 'changed since it was opened (edited elsewhere?)' });
  }
  if (issues.length) return { ok: false, status: 409, issues };

  // 2. the whole content check, on the snapshot as it would be; only new issues refuse the change
  const snap = readSnapshot(root);
  const was = check(snap);
  const before = new Set(was.issues.map(describe));
  const docs = { ...snap.docs };
  const masters = new Set(snap.masters);
  for (const t of targets) {
    if (t.key.endsWith('.json')) {
      if (!t.bytes) delete docs[t.key];
      else {
        try {
          docs[t.key] = JSON.parse(t.bytes.toString('utf8'));
        } catch {
          issues.push({ file: t.key.replace(/^\//, ''), message: 'not valid JSON' });
        }
      }
    } else if (t.bytes) masters.add(t.key);
    else masters.delete(t.key);
  }
  if (issues.length) return { ok: false, status: 422, issues };
  // (a page's address can change freely: moving it to another section is taking it down and putting it up
  // again there, with no redirect: documentation/sections/spec.md §7.2)
  const now = check({ docs, masters, errors: snap.errors });
  const after = now.issues.filter((i) => !before.has(describe(i)));
  if (after.length) return { ok: false, status: 422, issues: after };

  // 3. temporary files, flushed, beside their targets
  const ordered = [...targets].sort((a, b) => rank(a) - rank(b));
  const temps = new Map<string, string>();
  try {
    for (const t of ordered) {
      if (!t.bytes) continue;
      mkdirSync(dirname(t.abs!), { recursive: true });
      const tmp = join(dirname(t.abs!), `.${basename(t.abs!)}.${randomBytes(4).toString('hex')}.tmp`);
      const fd = openSync(tmp, 'w');
      try {
        writeSync(fd, t.bytes);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      temps.set(t.abs!, tmp);
    }
  } catch (e) {
    for (const tmp of temps.values()) if (existsSync(tmp)) unlinkSync(tmp);
    return { ok: false, status: 422, issues: [{ file: 'content', message: `couldn't write: ${(e as Error).message}` }] };
  }

  // 4. into place, in order; 5. or back as they were
  const done: { abs: string; before: Buffer | null }[] = [];
  const state = contentState();
  try {
    for (const t of ordered) {
      const abs = t.abs!;
      const prior = existsSync(abs) ? readFileSync(abs) : null;
      // recorded before the rename: the watcher may see the change before this function returns
      state.writes.set(writeKey(abs), versionOf(t.bytes) ?? 'deleted');
      if (t.bytes) await withRetries(() => rename(temps.get(abs)!, abs));
      else if (prior) await withRetries(() => unlink(abs));
      done.push({ abs, before: prior });
    }
  } catch (e) {
    for (const d of done.reverse()) {
      state.writes.delete(writeKey(d.abs));
      try {
        if (d.before) writeFileSync(d.abs, d.before);
        else if (existsSync(d.abs)) unlinkSync(d.abs);
      } catch {
        // best effort: the error below names the change that failed
      }
    }
    for (const t of ordered) state.writes.delete(writeKey(t.abs!));
    for (const tmp of temps.values()) if (existsSync(tmp)) unlinkSync(tmp);
    return { ok: false, status: 422, issues: [{ file: 'content', message: `couldn't save, nothing was changed: ${(e as Error).message}` }] };
  }
  for (const t of ordered) if (!t.bytes) removeEmptyFolders(dirname(t.abs!), root);

  // 6. tell the dev server, every open page (with the tab that made the change), and whoever reads next
  state.generation++;
  state.notify?.(ordered.map((t) => t.key), true, origin);
  return { ok: true, versions: Object.fromEntries(targets.map((t) => [t.key, versionOf(t.bytes)])) };
}

function removeEmptyFolders(dir: string, root: string) {
  let d = resolve(dir);
  const top = resolve(root);
  while (d !== top && d.startsWith(top) && existsSync(d) && readdirSync(d).length === 0) {
    rmdirSync(d);
    d = dirname(d);
  }
}
