#!/usr/bin/env node
/**
 * The editor's test server (documentation/editor/plan.md §4). Edit mode writes content and publishing
 * commits and pushes, so its tests never run against the real content folder or the real remote:
 *
 *   1. .editor-test/ becomes a fresh git repository holding a copy of content/ (with a local identity);
 *   2. .editor-test-remote.git/ becomes a bare repository, set as its upstream (publish pushes there);
 *   3. astro dev starts on the port given (4330 by default, strict), with CONTENT_ROOT pointing at the
 *      copy and its own Vite cache, so it never disturbs a dev server already running.
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
const args = process.argv.slice(2);
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '4330';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).toString();

export function prepare() {
  rmSync(FIXTURE, { recursive: true, force: true });
  rmSync(REMOTE, { recursive: true, force: true });
  mkdirSync(FIXTURE, { recursive: true });
  cpSync(join(ROOT, 'content'), join(FIXTURE, 'content'), { recursive: true });
  writeFileSync(join(FIXTURE, '.gitattributes'), 'content/**/*.json text eol=lf\n');
  git(FIXTURE, 'init', '-q', '-b', 'main');
  git(FIXTURE, 'config', 'user.name', 'Editor test');
  git(FIXTURE, 'config', 'user.email', 'editor-test@localhost');
  git(FIXTURE, 'config', 'core.autocrlf', 'false');
  git(FIXTURE, 'add', '-A');
  git(FIXTURE, 'commit', '-q', '-m', 'The fixture: a copy of content/');
  git(ROOT, 'init', '-q', '--bare', '-b', 'main', REMOTE);
  git(FIXTURE, 'remote', 'add', 'origin', REMOTE);
  git(FIXTURE, 'push', '-q', '-u', 'origin', 'main');
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
      env: { ...process.env, CONTENT_ROOT: join(FIXTURE, 'content'), SITE_VITE_CACHE: join(ROOT, 'node_modules', '.vite-editor-test'), SITE_STRICT_PORT: '1' },
    });
    const stop = () => child.kill();
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    child.on('exit', (code) => process.exit(code ?? 0));
  }
}
