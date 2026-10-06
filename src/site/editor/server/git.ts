/**
 * Publishing (documentation/editor/spec.md §7; documentation/access/spec.md §8.3): git, run as a child
 * process with its arguments as a list (never a shell), never prompting, with a time limit. Publish holds
 * the store's writer lock and checks the content of both folders. Private changes go first: staged in the
 * private-pages submodule, confirmed to be the files it checked, committed on its main and pushed. Then the
 * public repository: content/ and the submodule's moved pointer, confirmed the same way, committed (those
 * paths only, whatever else is staged stays staged) and pushed, which deploys. Your message goes on the
 * public commit only when nothing private changed. A failed push leaves its commit local, with Push again.
 */
import { execFile } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { contentRoot, hasPrivate, privateRoot, readSnapshot } from '../../content/source';
import { ContentError, loadContent, type Issue } from '../../content/load';
import { commit, readFile, versionOf, withWriterLock, type Result } from './store';
import { suggestMessage, type Titles } from '../model/names';

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

export function git(args: string[], opts: { cwd?: string; timeout?: number; input?: string } = {}): Promise<GitResult> {
  return new Promise((resolvePromise) => {
    const child = execFile('git', args, { cwd: opts.cwd ?? contentRoot(), timeout: opts.timeout ?? 30_000, env: { ...process.env, ...ENV }, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : 1) : 0;
      const killed = err && (err as { killed?: boolean }).killed;
      resolvePromise({ code, stdout: String(stdout), stderr: killed ? `git took too long and was stopped (${args[0]})` : String(stderr) });
    });
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });
}

/** The repository holding a folder, and the folder's path inside it (with forward slashes). */
async function repoOf(dir: string): Promise<{ top: string; path: string } | null> {
  const r = await git(['rev-parse', '--show-toplevel', '--show-prefix'], { cwd: dir });
  if (r.code) return null;
  // git's own prefix, not a path computed here: Windows short names (PRABIN~2) and junctions name one folder two ways
  const [top, prefix = ''] = r.stdout.split('\n').map((l) => l.trim());
  return { top, path: prefix.replace(/\/$/, '') || '.' };
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
  /** The private repository's own state, when there is one. */
  private: RepoState | null;
  /** The private-pages folder's path in the public repository, and whether its pointer has moved (an unpublished private commit). */
  pointer: { path: string; moved: boolean } | null;
}

/** Files under `path` that differ from the last commit, as git sees them, keyed with `prefix`. */
async function statusOf(top: string, path: string, prefix: string, skip: (rel: string) => boolean = () => false): Promise<ChangedFile[]> {
  const st = await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', path], { cwd: top });
  const files: ChangedFile[] = [];
  const parts = st.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const xy = p.slice(0, 2);
    const file = p.slice(3);
    if (xy.startsWith('R') || xy.startsWith('C')) i++; // the renamed-from path follows
    const rel = path === '.' ? file : file.slice(path.length + 1);
    if (/(^|\/)\.[^/]*$|\.tmp$/.test(rel) || skip(rel)) continue;
    const status = xy.includes('D') ? 'deleted' : xy === '??' || xy.includes('A') ? 'added' : 'changed';
    files.push({ key: `${prefix}${rel}`, status });
  }
  return files;
}

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

export async function changes(): Promise<Changes> {
  const where = await repo();
  if (!where) return { files: [], branch: null, upstream: null, ahead: 0, private: null, pointer: null };
  const files = await statusOf(where.top, where.path, '/content/');
  const state = await stateOf(where.top);
  const priv = await privateRepo();
  let privateState: RepoState | null = null;
  let pointer: Changes['pointer'] = null;
  if (priv) {
    files.push(...(await statusOf(priv.top, '.', '/private/', (rel) => !rel.includes('/') && /^(README\.md|LICENSE|\.git\w*)$/i.test(rel))));
    privateState = await stateOf(priv.top);
    const path = pointerPath(where.top, priv.top);
    if (path) {
      const st = await git(['status', '--porcelain=v1', '--ignore-submodules=dirty', '--', path], { cwd: where.top });
      pointer = { path, moved: st.stdout.trim().length > 0 };
    }
  }
  return { files: files.sort((a, b) => a.key.localeCompare(b.key)), ...state, private: privateState, pointer };
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
  return r;
}

/** The address of the remote the branch pushes to (for the link to its deploy), or null. */
export async function remoteUrl(upstream: string | null): Promise<string | null> {
  const where = await repo();
  if (!where || !upstream) return null;
  const r = await git(['remote', 'get-url', upstream.split('/')[0]], { cwd: where.top });
  return r.code ? null : r.stdout.trim();
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

export function publish(message: string, titles: Titles = { article: () => undefined, person: () => undefined }): Promise<PublishResult> {
  return withWriterLock(async (): Promise<PublishResult> => {
    const where = await repo();
    if (!where) return { ok: false, reason: 'the content folder is not in a git repository' };
    const state = await changes();
    if (!state.branch) return { ok: false, reason: 'git is not on a branch (a detached HEAD): check out a branch, then save to remote' };
    if (!state.upstream) return { ok: false, reason: `the branch ${state.branch} has no upstream to push to: set one (git push -u), then save to remote` };
    const priv = state.files.filter((f) => f.key.startsWith('/private/'));
    const pub = state.files.filter((f) => f.key.startsWith('/content/'));
    if (!state.files.length && !state.pointer?.moved) return { ok: false, reason: 'there is nothing to save' };
    const msg = message.trim();
    if (!msg) return { ok: false, reason: 'a save needs a message' };
    const privTop = (await privateRepo())?.top;
    if (priv.length || state.pointer?.moved) {
      if (!privTop || !state.private) return { ok: false, reason: 'private-pages/ is not a git repository: run scripts/setup-private-pages.ps1, then save to remote' };
      if (state.private.branch !== 'main') return { ok: false, reason: 'private-pages/ is not on its main branch (a submodule starts on a detached commit): run scripts/setup-private-pages.ps1, then save to remote' };
      if (!state.private.upstream) return { ok: false, reason: 'private-pages/ has no upstream to push to: run scripts/setup-private-pages.ps1, then save to remote' };
    }
    // 1. both folders, checked as the build will check them
    const snap = readSnapshot();
    try {
      loadContent(snap.docs, snap.masters, snap.errors);
    } catch (e) {
      if (e instanceof ContentError) return { ok: false, reason: 'the content has problems: fix them, then save to remote', issues: e.issues };
      throw e;
    }
    // 2. the private repository first: staged, exactly what was checked, committed on main, pushed
    let privateCommit: string | undefined;
    if (priv.length && privTop) {
      const add = await git(['add', '-A', '--', '.'], { cwd: privTop });
      if (add.code) return { ok: false, reason: `git couldn't stage the private pages: ${add.stderr.trim()}` };
      const checked = await stagedAsChecked(privTop, ['.']);
      if (!checked.ok) {
        await git(['restore', '--staged', '--', '.'], { cwd: privTop });
        return { ok: false, reason: `private-pages/${checked.path} changed while saving: save again` };
      }
      const list = priv.map((f) => `- ${f.status} ${f.key.slice('/private/'.length)}`).join('\n');
      const c = await git(['commit', '-m', msg, '-m', list], { cwd: privTop, timeout: 60_000 });
      if (c.code) return { ok: false, reason: `git couldn't commit the private pages: ${(c.stderr || c.stdout).trim()}` };
      privateCommit = (await git(['rev-parse', '--short', 'HEAD'], { cwd: privTop })).stdout.trim();
    }
    // a refused private push still gets its public commit, but that one waits: it must never point at a private commit GitHub lacks
    let privatePushError: string | undefined;
    if (privTop && state.private && (privateCommit || state.private.ahead)) {
      const p = await pushIn(privTop);
      if (!p.ok) privatePushError = `the private pages: ${p.reason}`;
    }
    // 3. the public repository: content/ and the moved pointer, exactly what was checked, then pushed (the deploy)
    const paths = [...(pub.length ? [where.path] : []), ...(state.pointer && (privateCommit || state.pointer.moved) ? [state.pointer.path] : [])];
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
    const publicMsg = publicMessage(msg, state.files, titles);
    const c = await git(['commit', '-m', publicMsg, '--', ...paths], { cwd: where.top, timeout: 60_000 });
    if (c.code) return { ok: false, reason: `git couldn't commit: ${(c.stderr || c.stdout).trim()}` };
    const sha = (await git(['rev-parse', '--short', 'HEAD'], { cwd: where.top })).stdout.trim();
    if (privatePushError) return { ok: true, commit: sha, ...(privateCommit ? { privateCommit } : {}), pushed: false, pushError: privatePushError, files: checked.staged.length + priv.length, message: publicMsg };
    const p = await pushIn(where.top);
    return { ok: true, commit: sha, ...(privateCommit ? { privateCommit } : {}), pushed: p.ok, ...(p.ok ? {} : { pushError: p.reason }), files: checked.staged.length + priv.length, message: publicMsg };
  });
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
  return withWriterLock(async () => {
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
  });
}
