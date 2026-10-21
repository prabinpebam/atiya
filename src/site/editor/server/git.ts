/**
 * Publishing (documentation/editor/spec.md §7; documentation/access/spec.md §8.3): git, run as a child
 * process with its arguments as a list (never a shell), never prompting, with a time limit. Publish holds
 * the store's writer lock and checks the content of both folders. Private changes go first: staged in the
 * private-pages submodule, confirmed to be the files it checked, committed on its main and pushed. Then the
 * public repository: content/ and the submodule's moved pointer, confirmed the same way, committed (those
 * paths only, whatever else is staged stays staged) and pushed, which deploys. Your message goes on the
 * public commit only when nothing private changed. A failed push leaves its commit local, with Push again.
 * A save can take only the changes ticked: then each repository commits just their files, after the check
 * has passed the content as those commits will hold it (every change left out as last committed).
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { contentRoot, generation as contentGeneration, hasPrivate, MASTER_FILE, privateRoot, readSnapshot, type Snapshot } from '../../content/source';
import { ContentError, loadContent, type Issue } from '../../content/load';
import { timedAsync } from '../../content/timing';
import { commit, readFile, versionOf, withWriterLock, type Result } from './store';
import { suggestMessage, type Titles } from '../model/names';
import { chosenFiles } from '../model/selection';

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

const ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'never',
  GIT_ASKPASS: '',
  SSH_ASKPASS: '',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
  LC_ALL: 'C',
};

type GitOptions = { cwd?: string; timeout?: number; input?: string; env?: Record<string, string> };

export function git(args: string[], opts: GitOptions = {}): Promise<GitResult> {
  return timedAsync('git', () => run(args, opts));
}

function run(args: string[], opts: GitOptions): Promise<GitResult> {
  return new Promise((resolvePromise) => {
    const child = execFile('git', args, { cwd: opts.cwd ?? contentRoot(), timeout: opts.timeout ?? 30_000, env: { ...process.env, ...ENV, ...opts.env }, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : 1) : 0;
      const killed = err && (err as { killed?: boolean }).killed;
      resolvePromise({ code, stdout: String(stdout), stderr: killed ? `git took too long and was stopped (${args[0]})` : String(stderr) });
    });
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });
}

/** Where each folder's repository is: asked once per folder (a folder doesn't move repositories while the server runs). */
const repos = new Map<string, { top: string; path: string }>();

/** The repository holding a folder, and the folder's path inside it (with forward slashes). */
async function repoOf(dir: string): Promise<{ top: string; path: string } | null> {
  const known = repos.get(dir);
  if (known) return known;
  const r = await git(['rev-parse', '--show-toplevel', '--show-prefix'], { cwd: dir });
  if (r.code) return null;
  // git's own prefix, not a path computed here: Windows short names (PRABIN~2) and junctions name one folder two ways
  const [top, prefix = ''] = r.stdout.split('\n').map((l) => l.trim());
  const found = { top, path: prefix.replace(/\/$/, '') || '.' };
  repos.set(dir, found);
  return found;
}

/** The repository holding the content folder, and the folder's path inside it. */
export const repo = () => repoOf(contentRoot());

/** The private-pages repository (the submodule), when the private folder is one of its own. */
async function privateRepo(): Promise<{ top: string } | null> {
  const dir = privateRoot();
  if (!hasPrivate(dir)) return null;
  const r = await repoOf(dir);
  return r && r.path === '.' ? { top: r.top } : null;
}

export interface ChangedFile {
  /** Under its folder, as `/content/…` or `/private/…`. */
  key: string;
  status: 'added' | 'changed' | 'deleted';
}

export interface RepoState {
  branch: string | null;
  upstream: string | null;
  /** Commits on this branch the remote doesn't have yet (a push that failed). */
  ahead: number;
}

export interface Changes extends RepoState {
  files: ChangedFile[];
  /** The public repository's last commit (its full id), when git said. */
  head: string | null;
  /** The private repository's own state, when there is one. */
  private: RepoState | null;
  /** The private-pages folder's path in the public repository, and whether its pointer has moved (an unpublished private commit). */
  pointer: { path: string; moved: boolean } | null;
  /** Why git couldn't say what changed (then `files` is unknown, not empty), or null. */
  error: string | null;
}

/** git failed to report a folder's status. */
export class GitStatusError extends Error {}

/** How many things wait to be saved to remote: changed files, commits not pushed (either repository), a private commit not yet recorded. */
export const pendingCount = (c: Changes): number => c.files.length + c.ahead + (c.private?.ahead ?? 0) + (c.pointer?.moved ? 1 : 0);

async function stateOf(top: string): Promise<RepoState> {
  const branch = (await git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: top })).stdout.trim() || null;
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: top });
  const upstream = up.code ? null : up.stdout.trim();
  const ahead = upstream ? Number((await git(['rev-list', '--count', '@{u}..HEAD'], { cwd: top })).stdout.trim() || 0) : 0;
  return { branch, upstream, ahead };
}

/** The private folder's path in the public repository (forward slashes), if it's inside it. */
function pointerPath(publicTop: string, privateTop: string): string | null {
  const rel = relative(resolve(publicTop), resolve(privateTop)).split('\\').join('/');
  return rel && !rel.startsWith('..') ? rel : null;
}

const PRIVATE_SKIP = (rel: string) => !rel.includes('/') && /^(README\.md|LICENSE|\.git\w*)$/i.test(rel);

/** One repository's status in one call (porcelain v2: the branch, its upstream, how far ahead, and the files). */
export interface StatusV2 extends RepoState {
  /** The last commit's full id (null before the first commit). */
  head: string | null;
  /** Each entry's XY (dots for unchanged) and its path. */
  entries: { xy: string; path: string }[];
}

/** Reads `git status --porcelain=v2 --branch -z` output. */
export function parseStatusV2(out: string): StatusV2 {
  const parts = out.split('\0');
  let branch: string | null = null;
  let upstream: string | null = null;
  let head: string | null = null;
  let ahead = 0;
  const entries: StatusV2['entries'] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (p.startsWith('# branch.oid ')) {
      const oid = p.slice('# branch.oid '.length);
      head = /^[0-9a-f]{7,}$/.test(oid) ? oid : null;
    } else if (p.startsWith('# branch.head ')) {
      const b = p.slice('# branch.head '.length);
      branch = b === '(detached)' ? null : b;
    } else if (p.startsWith('# branch.upstream ')) upstream = p.slice('# branch.upstream '.length);
    else if (p.startsWith('# branch.ab ')) ahead = Math.max(0, Number(/\+(\d+)/.exec(p)?.[1] ?? 0));
    else if (p.startsWith('1 ')) entries.push({ xy: p.slice(2, 4), path: p.split(' ').slice(8).join(' ') });
    else if (p.startsWith('2 ')) {
      entries.push({ xy: p.slice(2, 4), path: p.split(' ').slice(9).join(' ') });
      i++; // the renamed-from path follows
    } else if (p.startsWith('u ')) entries.push({ xy: p.slice(2, 4), path: p.split(' ').slice(10).join(' ') });
    else if (p.startsWith('? ')) entries.push({ xy: '??', path: p.slice(2) });
  }
  return { branch, upstream, head, ahead, entries };
}

/** Files under `path` from a status's entries, keyed with `prefix` (hidden and temporary files left out). */
export function filesOf(entries: StatusV2['entries'], path: string, prefix: string, skip: (rel: string) => boolean = () => false): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const { xy, path: file } of entries) {
    if (path !== '.' && !file.startsWith(`${path}/`)) continue;
    const rel = path === '.' ? file : file.slice(path.length + 1);
    if (/(^|\/)\.[^/]*$|\.tmp$/.test(rel) || skip(rel)) continue;
    const status = xy.includes('D') ? 'deleted' : xy === '??' || xy.includes('A') ? 'added' : 'changed';
    files.push({ key: `${prefix}${rel}`, status });
  }
  return files;
}

async function statusV2(top: string, paths: string[], what: string): Promise<StatusV2> {
  // optional locks off: status never rewrites the index, so it doesn't race a save or move the cache's key
  const st = await git(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all', '--ignore-submodules=dirty', '--', ...paths], { cwd: top, env: { GIT_OPTIONAL_LOCKS: '0' } });
  if (st.code) throw new GitStatusError(`git couldn't read what changed in ${what}: ${(st.stderr || st.stdout).trim().split('\n').slice(-1)[0] || `exit ${st.code}`}`);
  return parseStatusV2(st.stdout);
}

/** The folders git keeps a repository's state in: its own (a worktree's or a submodule's) and the shared one. */
const gitDirs = new Map<string, Promise<string[]>>();
function gitDirsOf(top: string): Promise<string[]> {
  let p = gitDirs.get(top);
  if (!p)
    gitDirs.set(
      top,
      (p = git(['rev-parse', '--absolute-git-dir', '--git-common-dir'], { cwd: top }).then((r) => {
        if (r.code) return [];
        const [own, common] = r.stdout.split('\n').map((l) => l.trim());
        return [...new Set([own, resolve(top, common || own)])];
      })),
    );
  return p;
}

/** What git's own files say about a repository's state: they change on every stage, commit, checkout, fetch and push. */
async function gitStamp(top: string, state: RepoState | null): Promise<string> {
  const dirs = await gitDirsOf(top);
  const files = ['index', 'HEAD', 'logs/HEAD', 'packed-refs', 'FETCH_HEAD', 'ORIG_HEAD'];
  if (state?.branch) files.push(`refs/heads/${state.branch}`, `logs/refs/heads/${state.branch}`);
  if (state?.upstream) files.push(`refs/remotes/${state.upstream}`, `logs/refs/remotes/${state.upstream}`);
  return dirs
    .flatMap((d) =>
      files.map((f) => {
        try {
          const s = statSync(join(d, f));
          return `${s.mtimeMs}:${s.size}`;
        } catch {
          return '-';
        }
      }),
    )
    .join(',');
}

/**
 * How long a cached status may be kept with nothing seen to change: a change git's files don't show
 * (a file edited outside the content folder's watcher) is caught within this.
 */
export const CHANGES_TTL_MS = 30_000;

interface Cached {
  at: number;
  key: string;
  value: Changes;
}
let cached: Cached | null = null;
let inFlight: Promise<Changes> | null = null;

async function cacheKey(where: { top: string } | null, priv: { top: string } | null, value: Changes | null): Promise<string> {
  const parts = [String(contentGeneration())];
  if (where) parts.push(await gitStamp(where.top, value));
  if (priv) parts.push(await gitStamp(priv.top, value?.private ?? null));
  return parts.join('|');
}

/** Forgets the cached status (after a publish, a push or a discard: anything that ran git itself). */
export function forgetChanges(): void {
  cached = null;
}

/**
 * What waits to be saved to remote. Asks each repository once, both at once, and keeps the answer until
 * the content generation, git's own files or {@link CHANGES_TTL_MS} say it may be stale; callers in the same
 * moment share one call. `fresh` always asks git (Save to remote does, before it commits).
 */
export async function changes(opts: { fresh?: boolean } = {}): Promise<Changes> {
  // nothing tells a build or a test when files change (generation -1): it always asks git
  if (contentGeneration() < 0) return readChanges();
  if (!opts.fresh && cached && Date.now() - cached.at < CHANGES_TTL_MS) {
    const where = await repo();
    const priv = await privateRepo();
    if ((await cacheKey(where, priv, cached.value)) === cached.key) return cached.value;
  }
  if (inFlight && !opts.fresh) return inFlight;
  const run = readChanges().finally(() => {
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}

/** The cached status if it's still good, without asking git (null if it isn't). */
export async function peekChanges(): Promise<Changes | null> {
  if (contentGeneration() < 0 || !cached || Date.now() - cached.at >= CHANGES_TTL_MS) return null;
  const key = await cacheKey(await repo(), await privateRepo(), cached.value);
  return key === cached.key ? cached.value : null;
}

async function readChanges(): Promise<Changes> {
  const where = await repo();
  if (!where) return { files: [], head: null, branch: null, upstream: null, ahead: 0, private: null, pointer: null, error: null };
  const priv = await privateRepo();
  const guess = cached?.value ?? null;
  const before = await cacheKey(where, priv, guess);
  let value: Changes;
  try {
    const path = priv ? pointerPath(where.top, priv.top) : null;
    const [pub, own] = await Promise.all([
      statusV2(where.top, path ? [where.path, path] : [where.path], 'content/'),
      priv ? statusV2(priv.top, ['.'], 'private-pages/') : Promise.resolve(null),
    ]);
    const files = filesOf(pub.entries, where.path, '/content/');
    if (own) files.push(...filesOf(own.entries, '.', '/private/', PRIVATE_SKIP));
    const pointer = path ? { path, moved: pub.entries.some((e) => e.path === path) } : null;
    const { branch, upstream, ahead, head } = pub;
    value = { files: files.sort((a, b) => a.key.localeCompare(b.key)), head, branch, upstream, ahead, private: own ? { branch: own.branch, upstream: own.upstream, ahead: own.ahead } : null, pointer, error: null };
  } catch (e) {
    if (!(e instanceof GitStatusError)) throw e;
    const state = await stateOf(where.top);
    // a failed read is never kept
    return { files: [], head: null, ...state, private: null, pointer: null, error: e.message };
  }
  // kept only if nothing moved while git was asked (the same key before and after), under the key for the branch and upstream now known
  cached = (await cacheKey(where, priv, guess)) === before ? { at: Date.now(), key: await cacheKey(where, priv, value), value } : null;
  return value;
}

/** Where a key lives in its repository: its repository's top, and its path there. */
async function locate(key: string): Promise<{ top: string; path: string } | null> {
  if (key.startsWith('/private/')) {
    const priv = await privateRepo();
    return priv ? { top: priv.top, path: key.slice('/private/'.length) } : null;
  }
  const where = await repo();
  if (!where) return null;
  const rel = key.slice('/content/'.length);
  return { top: where.top, path: where.path === '.' ? rel : `${where.path}/${rel}` };
}

/**
 * Puts files back as last committed (a file new since then is deleted), all in one store transaction, so
 * the result is checked as a whole: a picture's master and sidecar go back together. Private files go back
 * in their own repository.
 */
export async function discard(keys: string[]): Promise<Result> {
  const file = keys[0]?.replace(/^\//, '') ?? 'content';
  if (!keys.length) return { ok: false, status: 422, issues: [{ file, message: 'nothing to discard' }] };
  const bad = keys.find((k) => !/^\/(content|private)\/[a-z0-9/._-]+$/.test(k) || k.includes('..'));
  if (bad) return { ok: false, status: 422, issues: [{ file: bad.replace(/^\//, ''), message: 'not a content file' }] };
  const places = await Promise.all(keys.map(locate));
  if (places.some((p) => !p)) return { ok: false, status: 422, issues: [{ file, message: 'the folder is not in a git repository' }] };
  // the committed bytes, read as bytes (never decoded as text), or null if the file is new
  const changes = await Promise.all(keys.map(async (key, i) => ({ key, bytes: await showBinary(places[i]!.top, places[i]!.path) })));
  const r = await commit({ changes, ifMatch: Object.fromEntries(keys.map((k) => [k, versionOf(readFile(k))])) });
  // unstaged one at a time: a new file that was never staged doesn't match, and would fail the others
  if (r.ok) for (const p of places) await git(['restore', '--staged', '--', p!.path], { cwd: p!.top });
  forgetChanges();
  return r;
}

/** The address of the remote the branch pushes to (for the link to its deploy), or null. */
export async function remoteUrl(upstream: string | null): Promise<string | null> {
  const where = await repo();
  if (!where || !upstream) return null;
  const name = upstream.split('/')[0];
  const known = remotes.get(name);
  if (known !== undefined) return known;
  const r = await git(['remote', 'get-url', name], { cwd: where.top });
  const url = r.code ? null : r.stdout.trim();
  remotes.set(name, url);
  return url;
}
/** Each remote's address, asked once (a remote's address doesn't change while the server runs). */
const remotes = new Map<string, string | null>();

/**
 * The content repository's `origin` address, read from its git config file (no git process, so a screen can ask
 * on its way: editor spec §2.2), or null. A worktree's config is its main repository's.
 */
export function originUrl(dir = contentRoot()): string | null {
  for (let d = resolve(dir); ; d = dirname(d)) {
    const dot = join(d, '.git');
    if (existsSync(dot)) {
      try {
        let gitDir = dot;
        if (statSync(dot).isFile()) {
          gitDir = resolve(d, readFileSync(dot, 'utf8').replace(/^gitdir:\s*/, '').trim());
          const common = join(gitDir, 'commondir');
          if (existsSync(common)) gitDir = resolve(gitDir, readFileSync(common, 'utf8').trim());
        }
        const config = readFileSync(join(gitDir, 'config'), 'utf8');
        return /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/.exec(config)?.[1] ?? null;
      } catch {
        return null;
      }
    }
    if (dirname(d) === d) return null;
  }
}

function showBinary(cwd: string, path: string): Promise<Buffer | null> {
  return new Promise((resolvePromise) => {
    execFile('git', ['show', `HEAD:${path}`], { cwd, encoding: 'buffer', env: { ...process.env, ...ENV }, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => resolvePromise(err ? null : (stdout as unknown as Buffer)));
  });
}

/** Confirms that what's staged under `paths` is exactly what's on disk (the files that were checked). */
async function stagedAsChecked(top: string, paths: string[]): Promise<{ ok: true; staged: string[] } | { ok: false; path: string }> {
  const staged = (await git(['diff', '--cached', '--name-only', '-z', '--', ...paths], { cwd: top })).stdout.split('\0').filter(Boolean);
  for (const path of staged) {
    const index = await git(['ls-files', '-s', '--', path], { cwd: top });
    // a submodule's pointer (mode 160000) is a commit, not a file to compare
    if (/^160000 /.test(index.stdout)) continue;
    const blob = await git(['rev-parse', `:${path}`], { cwd: top });
    if (blob.code) continue; // a deletion
    const disk = await git(['hash-object', '--', path], { cwd: top });
    if (blob.stdout.trim() !== disk.stdout.trim()) return { ok: false, path };
  }
  return { ok: true, staged };
}

export type PublishResult =
  | { ok: true; commit: string; privateCommit?: string; pushed: boolean; pushError?: string; files: number; message: string }
  | { ok: false; reason: string; issues?: Issue[] };

/** The public commit's message (spec §8.3): yours when nothing private changed; else made from the public changes, never from private ones. */
export function publicMessage(mine: string, files: ChangedFile[], titles: Titles): string {
  const pub = files.filter((f) => f.key.startsWith('/content/'));
  const priv = files.some((f) => f.key.startsWith('/private/'));
  if (!priv) return mine;
  return pub.length ? `${suggestMessage(pub, titles)}; Private pages: update` : 'Private pages: update';
}

/**
 * The content as a commit of only the chosen changes would hold it: every change left out is as last
 * committed (its bytes from HEAD; null where the file is new, so it's absent). Pure: the check runs on it.
 */
export function asCommitted(snap: Pick<Snapshot, 'docs' | 'masters' | 'errors'>, left: { key: string; bytes: Uint8Array | null }[]): Pick<Snapshot, 'docs' | 'masters' | 'errors'> {
  const docs = { ...snap.docs };
  const masters = new Set(snap.masters);
  const out = new Set(left.map((l) => l.key));
  const errors = snap.errors.filter((e) => !out.has(`/${e.slice(0, e.indexOf(': '))}`));
  for (const { key, bytes } of left) {
    delete docs[key];
    masters.delete(key);
    if (!bytes) continue;
    if (key.endsWith('.json')) {
      try {
        docs[key] = JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, ''));
      } catch (e) {
        errors.push(`${key.slice(1)}: not valid JSON (${(e as Error).message})`);
      }
    } else if (MASTER_FILE.test(key)) masters.add(key);
  }
  return { docs, masters, errors };
}

/**
 * Saves to remote. `keys` chooses which changed files go (each resource's files together); left out, it's
 * every change. The rest stay changed, here, for a later save.
 */
export function publish(message: string, titles: Titles = { article: () => undefined, person: () => undefined }, opts: { keys?: string[] } = {}): Promise<PublishResult> {
  return withWriterLock(() => publishLocked(message, titles, opts.keys)).finally(forgetChanges);
}

async function publishLocked(message: string, titles: Titles, keys?: string[]): Promise<PublishResult> {
  {
    const where = await repo();
    if (!where) return { ok: false, reason: 'the content folder is not in a git repository' };
    const state = await changes({ fresh: true });
    if (state.error) return { ok: false, reason: `${state.error}: try again` };
    if (!state.branch) return { ok: false, reason: 'git is not on a branch (a detached HEAD): check out a branch, then save to remote' };
    if (!state.upstream) return { ok: false, reason: `the branch ${state.branch} has no upstream to push to: set one (git push -u), then save to remote` };
    const chosen = chosenFiles(state.files, keys);
    if (keys && !chosen.length && !state.pointer?.moved) return { ok: false, reason: 'none of the changes you chose is waiting any more: check the list again' };
    // only some: each path named (a folder would take the changes left out too)
    const partial = chosen.length < state.files.length;
    const left = state.files.filter((f) => !chosen.includes(f));
    const priv = chosen.filter((f) => f.key.startsWith('/private/'));
    const pub = chosen.filter((f) => f.key.startsWith('/content/'));
    if (!state.files.length && !state.pointer?.moved) return { ok: false, reason: 'there is nothing to save' };
    const msg = message.trim();
    if (!msg) return { ok: false, reason: 'a save needs a message' };
    const privTop = (await privateRepo())?.top;
    if (priv.length || state.pointer?.moved) {
      if (!privTop || !state.private) return { ok: false, reason: 'private-pages/ is not a git repository: run scripts/setup-private-pages.ps1, then save to remote' };
      if (state.private.branch !== 'main') return { ok: false, reason: 'private-pages/ is not on its main branch (a submodule starts on a detached commit): run scripts/setup-private-pages.ps1, then save to remote' };
      if (!state.private.upstream) return { ok: false, reason: 'private-pages/ has no upstream to push to: run scripts/setup-private-pages.ps1, then save to remote' };
    }
    // 1. both folders, checked as the build will check them: as the commits will hold them, with what's left out as last saved
    const snap = readSnapshot();
    try {
      if (left.length) {
        const committed = asCommitted(snap, await Promise.all(left.map(async (f) => {
          const at = await locate(f.key);
          return { key: f.key, bytes: at ? await showBinary(at.top, at.path) : null };
        })));
        loadContent(committed.docs, committed.masters, committed.errors);
      } else loadContent(snap.docs, snap.masters, snap.errors);
    } catch (e) {
      if (e instanceof ContentError) return { ok: false, reason: left.length ? "the changes you chose don't stand on their own (they need one you left out): choose it too, or save every change" : 'the content has problems: fix them, then save to remote', issues: e.issues };
      throw e;
    }
    // 2. the private repository first: staged, exactly what was checked, committed on main, pushed
    let privateCommit: string | undefined;
    if (priv.length && privTop) {
      const privPaths = partial ? priv.map((f) => f.key.slice('/private/'.length)) : ['.'];
      const add = await git(['add', '-A', '--', ...privPaths], { cwd: privTop });
      if (add.code) return { ok: false, reason: `git couldn't stage the private pages: ${add.stderr.trim()}` };
      const checked = await stagedAsChecked(privTop, privPaths);
      if (!checked.ok) {
        await git(['restore', '--staged', '--', ...privPaths], { cwd: privTop });
        return { ok: false, reason: `private-pages/${checked.path} changed while saving: save again` };
      }
      const list = priv.map((f) => `- ${f.status} ${f.key.slice('/private/'.length)}`).join('\n');
      const c = await git(['commit', '-m', msg, '-m', list, ...(partial ? ['--', ...privPaths] : [])], { cwd: privTop, timeout: 60_000 });
      if (c.code) return { ok: false, reason: `git couldn't commit the private pages: ${(c.stderr || c.stdout).trim()}` };
      privateCommit = (await git(['rev-parse', '--short', 'HEAD'], { cwd: privTop })).stdout.trim();
    }
    // a refused private push still gets its public commit, but that one waits: it must never point at a private commit GitHub lacks
    let privatePushError: string | undefined;
    if (privTop && state.private && (privateCommit || state.private.ahead)) {
      const p = await pushIn(privTop);
      if (!p.ok) privatePushError = `the private pages: ${p.reason}`;
    }
    // 3. the public repository: content/ (or the chosen files in it) and the moved pointer, exactly what was checked, then pushed (the deploy)
    const pubPaths = partial ? (await Promise.all(pub.map((f) => locate(f.key)))).map((at) => at!.path) : pub.length ? [where.path] : [];
    const paths = [...pubPaths, ...(state.pointer && (privateCommit || state.pointer.moved) ? [state.pointer.path] : [])];
    // nothing public to commit (private pages outside the public repository): never `git add -A` with no path, which takes everything
    if (!paths.length) {
      if (!privateCommit) return { ok: false, reason: 'there is nothing to save' };
      return { ok: true, commit: privateCommit, privateCommit, pushed: !privatePushError, ...(privatePushError ? { pushError: privatePushError } : {}), files: priv.length, message: msg };
    }
    const add = await git(['add', '-A', '--', ...paths], { cwd: where.top });
    if (add.code) return { ok: false, reason: `git couldn't stage the content: ${add.stderr.trim()}` };
    const checked = await stagedAsChecked(where.top, paths);
    if (!checked.ok) {
      await git(['restore', '--staged', '--', ...paths], { cwd: where.top });
      return { ok: false, reason: `${checked.path} changed while saving: save again` };
    }
    if (snap.digest !== readSnapshot().digest) {
      await git(['restore', '--staged', '--', ...paths], { cwd: where.top });
      return { ok: false, reason: 'the content changed while saving: save again' };
    }
    const publicMsg = publicMessage(msg, chosen, titles);
    const c = await git(['commit', '-m', publicMsg, '--', ...paths], { cwd: where.top, timeout: 60_000 });
    if (c.code) return { ok: false, reason: `git couldn't commit: ${(c.stderr || c.stdout).trim()}` };
    const sha = (await git(['rev-parse', '--short', 'HEAD'], { cwd: where.top })).stdout.trim();
    if (privatePushError) return { ok: true, commit: sha, ...(privateCommit ? { privateCommit } : {}), pushed: false, pushError: privatePushError, files: checked.staged.length + priv.length, message: publicMsg };
    const p = await pushIn(where.top);
    return { ok: true, commit: sha, ...(privateCommit ? { privateCommit } : {}), pushed: p.ok, ...(p.ok ? {} : { pushError: p.reason }), files: checked.staged.length + priv.length, message: publicMsg };
  }
}

async function pushIn(top: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const r = await git(['push'], { cwd: top, timeout: 120_000 });
  if (!r.code) return { ok: true };
  const err = (r.stderr || r.stdout).trim();
  const why = /rejected|non-fast-forward|fetch first/i.test(err)
    ? 'the remote has newer commits: pull, then push again'
    : /recurse-submodules|not found on any remote|submodule/i.test(err)
      ? 'the private pages have a commit that is not pushed: push again'
      : /could not read|authentication|permission denied|terminal prompts disabled/i.test(err)
        ? "git couldn't sign in to the remote without asking: sign in once in a terminal (git push), then push again"
        : err.split('\n').slice(-2).join(' ');
  return { ok: false, reason: why };
}

/**
 * Push again: the private repository first if it's ahead; then, if its head moved since the public commit
 * (you pulled and rebased it), a public commit pointing at the head GitHub now has; then the public one.
 */
export function push(): Promise<{ ok: true } | { ok: false; reason: string }> {
  return withWriterLock(pushLocked).finally(forgetChanges);
}

async function pushLocked(): Promise<{ ok: true } | { ok: false; reason: string }> {
  {
    const where = await repo();
    if (!where) return { ok: false, reason: 'the content folder is not in a git repository' };
    const priv = await privateRepo();
    if (priv) {
      const s = await stateOf(priv.top);
      if (s.ahead) {
        const p = await pushIn(priv.top);
        if (!p.ok) return { ok: false, reason: `the private pages: ${p.reason}` };
      }
      const path = pointerPath(where.top, priv.top);
      const st = path ? await git(['status', '--porcelain=v1', '--ignore-submodules=dirty', '--', path], { cwd: where.top }) : null;
      if (path && st?.stdout.trim()) {
        const add = await git(['add', '--', path], { cwd: where.top });
        if (add.code) return { ok: false, reason: `git couldn't stage the private pages' pointer: ${add.stderr.trim()}` };
        const c = await git(['commit', '-m', 'Private pages: update', '--', path], { cwd: where.top, timeout: 60_000 });
        if (c.code) return { ok: false, reason: `git couldn't commit the private pages' pointer: ${(c.stderr || c.stdout).trim()}` };
      }
    }
    return pushIn(where.top);
  }
}
