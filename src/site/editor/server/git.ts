/**
 * Publishing (documentation/editor/spec.md §7): git, run as a child process with its arguments as a list
 * (never a shell), never prompting, with a time limit. Publish holds the store's writer lock, checks the
 * content, stages the content folder, confirms the staged blobs are the files it checked, commits the
 * content folder only (whatever else is staged stays staged), then pushes. A failed push leaves the
 * commit local, reported as not pushed, with Push again.
 */
import { execFile } from 'node:child_process';
import { relative } from 'node:path';
import { contentRoot, readSnapshot } from '../../content/source';
import { ContentError, loadContent, type Issue } from '../../content/load';
import { commit, readFile, versionOf, withWriterLock, type Result } from './store';

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
  return new Promise((resolve) => {
    const child = execFile('git', args, { cwd: opts.cwd ?? contentRoot(), timeout: opts.timeout ?? 30_000, env: { ...process.env, ...ENV }, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : 1) : 0;
      const killed = err && (err as { killed?: boolean }).killed;
      resolve({ code, stdout: String(stdout), stderr: killed ? `git took too long and was stopped (${args[0]})` : String(stderr) });
    });
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });
}

/** The repository holding the content folder, and the folder's path inside it (with forward slashes). */
export async function repo(): Promise<{ top: string; path: string } | null> {
  const r = await git(['rev-parse', '--show-toplevel']);
  if (r.code) return null;
  const top = r.stdout.trim();
  return { top, path: relative(top, contentRoot()).split(/[\\/]/).join('/') || '.' };
}

export interface ChangedFile {
  /** Under the content folder, as `/content/…`. */
  key: string;
  status: 'added' | 'changed' | 'deleted';
}

export interface Changes {
  files: ChangedFile[];
  branch: string | null;
  upstream: string | null;
  /** Commits on this branch the remote doesn't have yet (a push that failed). */
  ahead: number;
}

export async function changes(): Promise<Changes> {
  const where = await repo();
  if (!where) return { files: [], branch: null, upstream: null, ahead: 0 };
  const st = await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', where.path], { cwd: where.top });
  const files: ChangedFile[] = [];
  const parts = st.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const xy = p.slice(0, 2);
    const path = p.slice(3);
    if (xy.startsWith('R') || xy.startsWith('C')) i++; // the renamed-from path follows
    const rel = where.path === '.' ? path : path.slice(where.path.length + 1);
    if (/(^|\/)\.[^/]*$|\.tmp$/.test(rel)) continue;
    const status = xy.includes('D') ? 'deleted' : xy === '??' || xy.includes('A') ? 'added' : 'changed';
    files.push({ key: `/content/${rel}`, status });
  }
  const branch = (await git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: where.top })).stdout.trim() || null;
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: where.top });
  const upstream = up.code ? null : up.stdout.trim();
  const ahead = upstream ? Number((await git(['rev-list', '--count', '@{u}..HEAD'], { cwd: where.top })).stdout.trim() || 0) : 0;
  return { files: files.sort((a, b) => a.key.localeCompare(b.key)), branch, upstream, ahead };
}

/** Puts one file back as last committed (a file new since then is deleted), through the store, so the result is checked. */
export async function discard(key: string): Promise<Result> {
  const where = await repo();
  if (!where) return { ok: false, status: 422, issues: [{ file: key.replace(/^\//, ''), message: 'the content folder is not in a git repository' }] };
  if (!/^\/content\/[a-z0-9/._-]+$/.test(key) || key.includes('..')) return { ok: false, status: 422, issues: [{ file: key.replace(/^\//, ''), message: 'not a content file' }] };
  const rel = key.slice('/content/'.length);
  const repoPath = where.path === '.' ? rel : `${where.path}/${rel}`;
  // the committed bytes, read as bytes (never decoded as text), or null if the file is new
  const committed = await showBinary(where.top, repoPath);
  const r = await commit({ changes: [{ key, bytes: committed }], ifMatch: { [key]: versionOf(readFile(key)) } });
  if (r.ok) await git(['restore', '--staged', '--', repoPath], { cwd: where.top });
  return r;
}

function showBinary(cwd: string, path: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    execFile('git', ['show', `HEAD:${path}`], { cwd, encoding: 'buffer', env: { ...process.env, ...ENV }, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => resolve(err ? null : (stdout as unknown as Buffer)));
  });
}

export type PublishResult =
  | { ok: true; commit: string; pushed: boolean; pushError?: string; files: number }
  | { ok: false; reason: string; issues?: Issue[] };

export function publish(message: string): Promise<PublishResult> {
  return withWriterLock(async (): Promise<PublishResult> => {
    const where = await repo();
    if (!where) return { ok: false, reason: 'the content folder is not in a git repository' };
    const state = await changes();
    if (!state.branch) return { ok: false, reason: 'git is not on a branch (a detached HEAD): check out a branch, then publish' };
    if (!state.upstream) return { ok: false, reason: `the branch ${state.branch} has no upstream to push to: set one (git push -u), then publish` };
    if (!state.files.length) return { ok: false, reason: 'there is nothing to publish' };
    const msg = message.trim();
    if (!msg) return { ok: false, reason: 'a publish needs a message' };
    // 1. the content, checked as the build will check it
    const snap = readSnapshot();
    try {
      loadContent(snap.docs, snap.masters, snap.errors);
    } catch (e) {
      if (e instanceof ContentError) return { ok: false, reason: 'the content has problems: fix them, then publish', issues: e.issues };
      throw e;
    }
    // 2. staged, and 3. exactly what was checked
    const add = await git(['add', '-A', '--', where.path], { cwd: where.top });
    if (add.code) return { ok: false, reason: `git couldn't stage the content: ${add.stderr.trim()}` };
    const staged = (await git(['diff', '--cached', '--name-only', '-z', '--', where.path], { cwd: where.top })).stdout.split('\0').filter(Boolean);
    for (const path of staged) {
      const index = await git(['rev-parse', `:${path}`], { cwd: where.top });
      if (index.code) continue; // a deletion
      const disk = await git(['hash-object', '--', path], { cwd: where.top });
      if (index.stdout.trim() !== disk.stdout.trim()) {
        await git(['restore', '--staged', '--', where.path], { cwd: where.top });
        return { ok: false, reason: `${path} changed while publishing: publish again` };
      }
    }
    if (snap.digest !== readSnapshot().digest) {
      await git(['restore', '--staged', '--', where.path], { cwd: where.top });
      return { ok: false, reason: 'the content changed while publishing: publish again' };
    }
    // 4. the content folder only, whatever else is staged
    const c = await git(['commit', '-m', msg, '--', where.path], { cwd: where.top, timeout: 60_000 });
    if (c.code) return { ok: false, reason: `git couldn't commit: ${(c.stderr || c.stdout).trim()}` };
    const sha = (await git(['rev-parse', '--short', 'HEAD'], { cwd: where.top })).stdout.trim();
    // 5. pushed (or left local, to push again)
    const p = await push();
    return { ok: true, commit: sha, pushed: p.ok, ...(p.ok ? {} : { pushError: p.reason }), files: staged.length };
  });
}

export async function push(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const where = await repo();
  if (!where) return { ok: false, reason: 'the content folder is not in a git repository' };
  const r = await git(['push'], { cwd: where.top, timeout: 120_000 });
  if (!r.code) return { ok: true };
  const err = (r.stderr || r.stdout).trim();
  const why = /rejected|non-fast-forward|fetch first/i.test(err)
    ? 'the remote has newer commits: pull, then push again'
    : /could not read|authentication|permission denied|terminal prompts disabled/i.test(err)
      ? "git couldn't sign in to the remote without asking: sign in once in a terminal (git push), then push again"
      : err.split('\n').slice(-2).join(' ');
  return { ok: false, reason: why };
}
