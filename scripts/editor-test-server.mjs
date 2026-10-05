#!/usr/bin/env node
/**
 * The editor's test server (documentation/editor/plan.md §4; documentation/access/plan.md, A6). Edit mode
 * writes content and publishing commits and pushes, so its tests never run against the real content folder,
 * the real private pages, or the real remotes:
 *
 *   1. .editor-test/ becomes a fresh git repository holding a copy of content/ (with a local identity);
 *   2. .editor-test-remote.git/ becomes a bare repository, set as its upstream (publish pushes there);
 *   3. its private-pages/ is a git submodule: a repository of the made-up fixtures (tests/fixtures/
 *      private-pages) with its own bare remote, .editor-test-private.git/, on main, as the real one is;
 *   4. astro dev starts on the port given (4330 by default, strict), with CONTENT_ROOT and PRIVATE_ROOT
 *      pointing at the copies and its own Vite cache, so it never disturbs a dev server already running.
 *
 *   node scripts/editor-test-server.mjs [--port 4330] [--prepare-only]
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = join(ROOT, '.editor-test');
export const REMOTE = join(ROOT, '.editor-test-remote.git');
export const PRIVATE_REMOTE = join(ROOT, '.editor-test-private.git');
export const PRIVATE = join(FIXTURE, 'private-pages');
const SEED = join(ROOT, '.editor-test-private-seed');
const args = process.argv.slice(2);
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '4330';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).toString();
/** A local path as a submodule's address needs the file protocol allowed (git ≥ 2.38 refuses it by default). */
const gitFile = (cwd, ...a) => git(cwd, '-c', 'protocol.file.allow=always', ...a);
const identity = (cwd) => {
  git(cwd, 'config', 'user.name', 'Editor test');
  git(cwd, 'config', 'user.email', 'editor-test@localhost');
  git(cwd, 'config', 'core.autocrlf', 'false');
};

export function prepare() {
  for (const d of [FIXTURE, REMOTE, PRIVATE_REMOTE, SEED]) rmSync(d, { recursive: true, force: true });
  // the private pages: the fixtures, committed to their own remote
  mkdirSync(SEED, { recursive: true });
  cpSync(join(ROOT, 'tests/fixtures/private-pages'), SEED, { recursive: true });
  writeFileSync(join(SEED, '.gitattributes'), '*.json text eol=lf\n');
  git(SEED, 'init', '-q', '-b', 'main');
  identity(SEED);
  git(SEED, 'add', '-A');
  git(SEED, 'commit', '-q', '-m', 'The fixture: made-up private pages');
  git(ROOT, 'init', '-q', '--bare', '-b', 'main', PRIVATE_REMOTE);
  git(SEED, 'remote', 'add', 'origin', PRIVATE_REMOTE);
  git(SEED, 'push', '-q', '-u', 'origin', 'main');
  rmSync(SEED, { recursive: true, force: true });
  // the public repository: a copy of content/, and the private pages as its submodule
  mkdirSync(FIXTURE, { recursive: true });
  cpSync(join(ROOT, 'content'), join(FIXTURE, 'content'), { recursive: true });
  writeFileSync(join(FIXTURE, '.gitattributes'), 'content/**/*.json text eol=lf\n');
  git(FIXTURE, 'init', '-q', '-b', 'main');
  identity(FIXTURE);
  gitFile(FIXTURE, 'submodule', 'add', '-q', '-b', 'main', PRIVATE_REMOTE, 'private-pages');
  identity(PRIVATE);
  // checked out again with this repository's line endings, so nothing shows as changed
  git(PRIVATE, 'reset', '-q', '--hard');
  // as scripts/setup-private-pages.ps1 sets them on a real clone
  git(FIXTURE, 'config', 'submodule.recurse', 'true');
  git(FIXTURE, 'config', 'push.recurseSubmodules', 'check');
  git(FIXTURE, 'config', 'protocol.file.allow', 'always');
  git(PRIVATE, 'switch', '-q', '-C', 'main', '--track', 'origin/main');
  git(FIXTURE, 'add', '-A');
  git(FIXTURE, 'commit', '-q', '-m', 'The fixture: a copy of content/, and the private pages');
  git(ROOT, 'init', '-q', '--bare', '-b', 'main', REMOTE);
  git(FIXTURE, 'remote', 'add', 'origin', REMOTE);
  git(FIXTURE, 'push', '-q', '-u', 'origin', 'main');
}

/**
 * Puts the fixture back as prepared, between tests that change it: both working trees and branches at their
 * first commits, nothing untracked, and both remotes' branches back there too (a test reset may force; publish never does).
 */
export function reset() {
  const firstPrivate = git(PRIVATE, 'rev-list', '--max-parents=0', 'HEAD').trim();
  git(PRIVATE, 'reset', '-q', '--hard', firstPrivate);
  git(PRIVATE, 'clean', '-q', '-fdx');
  git(PRIVATE, 'push', '-q', '--force', 'origin', `${firstPrivate}:main`);
  git(PRIVATE, 'fetch', '-q', 'origin');
  const first = git(FIXTURE, 'rev-list', '--max-parents=0', 'HEAD').trim();
  git(FIXTURE, '-c', 'submodule.recurse=false', 'reset', '-q', '--hard', first);
  git(FIXTURE, 'clean', '-q', '-fd', '-e', 'private-pages');
  git(FIXTURE, 'push', '-q', '--force', '--no-recurse-submodules', 'origin', `${first}:main`);
  git(FIXTURE, 'fetch', '-q', 'origin');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  prepare();
  if (!args.includes('--prepare-only')) {
    // alongside a dev server that may already be running (Astro 7 allows one per project unless told otherwise)
    const child = spawn('npx', ['astro', 'dev', '--port', port, '--ignore-lock'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, CONTENT_ROOT: join(FIXTURE, 'content'), PRIVATE_ROOT: PRIVATE, SITE_VITE_CACHE: join(ROOT, 'node_modules', '.vite-editor-test'), SITE_STRICT_PORT: '1' },
    });
    const stop = () => child.kill();
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    child.on('exit', (code) => process.exit(code ?? 0));
  }
}
