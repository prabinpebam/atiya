// @ts-check
/**
 * Signing in to GitHub (documentation/desktop/spec.md §4.1, §5.2; decision O8): through the GitHub CLI, never an
 * app of ours. Atiya Studio registers nothing with GitHub and runs no server: the one-time code the person enters
 * on github.com/login/device is the GitHub CLI's (an app GitHub publishes, and GitHub's page names it), and the
 * token belongs to that sign-in. One sign-in for the computer: the token stays where the CLI keeps it (the
 * system's keychain), shared with the person's terminal; the app asks the CLI for it (`gh auth token`) and keeps
 * it only in memory. The CLI is the person's own if they have one, else the one the app carries.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/** The GitHub CLI the app carries (scripts/fetch-gh.mjs), pinned. */
export const GH_VERSION = '2.102.0';
/** How long a device code lasts on GitHub: a sign-in that takes longer has run out. */
export const SIGN_IN_MS = 15 * 60 * 1000;
/** Beyond the CLI's own (repo, read:org, gist): setup writes the site's workflow. */
export const SCOPES = ['workflow'];

/**
 * @typedef {{ command: string, args: string[], carried?: boolean }} GhCommand
 * @typedef {'declined' | 'expired' | 'offline' | 'missing' | 'failed'} SignInProblem
 * @typedef {{ env?: NodeJS.ProcessEnv, configDir?: string, host?: string }} GhOptions
 */

/** A program on the PATH, or null. @param {string} name @param {NodeJS.ProcessEnv} env */
function onPath(name, env) {
  const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD').split(';').filter(Boolean) : [''];
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean))
    for (const ext of exts) {
      const file = join(dir, `${name}${ext.toLowerCase()}`);
      if (existsSync(file)) return file;
    }
  return null;
}

/**
 * The GitHub CLI to run: a stand-in for tests and trying the app (ATIYA_GH, as JSON `{ command, args }`), else the
 * person's own (on the PATH: one sign-in with their terminal), else the one the app carries (a packaged app's
 * resources, or apps/desktop/vendor in a checkout), else none.
 * @param {{ env?: NodeJS.ProcessEnv, resources?: string, appDir: string, own?: boolean }} o `own: false` skips the PATH
 * @returns {GhCommand | null}
 */
export function ghCommand(o) {
  const env = o.env ?? process.env;
  if (env.ATIYA_GH) {
    try {
      const c = JSON.parse(env.ATIYA_GH);
      if (typeof c.command === 'string' && Array.isArray(c.args)) return { command: c.command, args: c.args.map(String) };
    } catch {
      // not a stand-in: the person's, or the carried one
    }
  }
  const own = o.own === false ? null : onPath('gh', env);
  if (own) return { command: own, args: [] };
  const exe = process.platform === 'win32' ? 'gh.exe' : 'gh';
  for (const dir of [o.resources && join(o.resources, 'gh'), join(o.appDir, 'vendor', 'gh')]) {
    const file = dir && join(dir, 'bin', exe);
    if (file && existsSync(file)) return { command: file, args: [], carried: true };
  }
  return null;
}

/** The one-time code and the page to enter it on, from what the CLI writes. @param {string} text */
export function deviceCode(text) {
  const code = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/.exec(text)?.[1];
  const url = /(https?:\/\/\S+\/login\/device)\b/.exec(text)?.[1];
  return code ? { code, url: url ?? 'https://github.com/login/device' } : null;
}

/** Why a sign-in ended without a token, from the CLI's own words. @param {string} text @returns {SignInProblem} */
export function signInProblem(text) {
  if (/access[_ ]denied|denied|declined|cancel/i.test(text)) return 'declined';
  if (/expired|timed? ?out waiting|token_expired/i.test(text)) return 'expired';
  if (/could not resolve|network|unable to connect|connection (refused|reset|timed out)|offline|no such host|ENOTFOUND|ECONNREFUSED|dial tcp/i.test(text)) return 'offline';
  return 'failed';
}

/** What the person reads for each. @type {Record<SignInProblem, string>} */
export const PROBLEM_WORDS = {
  declined: "GitHub wasn't connected. Atiya Studio needs it to keep and publish your site.",
  expired: 'That code has run out.',
  offline: "Can't reach GitHub. Check your connection, then try again.",
  missing: 'This copy of Atiya Studio is missing the GitHub sign-in it carries. Install it again, then try again.',
  failed: "GitHub didn't finish signing in. Try again.",
};

/**
 * Runs the CLI with fixed words: never a token, a name or a path of the person's in its arguments.
 * @param {GhCommand} gh @param {string[]} args
 * @param {GhOptions & { onOutput?: (text: string) => void, signal?: AbortSignal, timeoutMs?: number }} o
 * @returns {Promise<{ code: number | null, out: string, err: string }>}
 */
export function runGh(gh, args, o = {}) {
  return new Promise((resolve) => {
    /** @type {NodeJS.ProcessEnv} */
    const env = {
      ...(o.env ?? process.env),
      GH_PROMPT_DISABLED: '1',
      GH_NO_UPDATE_NOTIFIER: '1',
      GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
      NO_COLOR: '1',
      // the app shows the code and opens GitHub's page itself
      GH_BROWSER: process.platform === 'win32' ? 'cmd /c rem' : 'true',
    };
    if (o.configDir) env.GH_CONFIG_DIR = o.configDir;
    // the CLI's own sign-in, never one from the environment
    delete env.GH_TOKEN;
    delete env.GITHUB_TOKEN;
    const p = spawn(gh.command, [...gh.args, ...args], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => {
      out += d;
      o.onOutput?.(String(d));
    });
    p.stderr.on('data', (d) => {
      err += d;
      o.onOutput?.(String(d));
    });
    p.stdin.on('error', () => {});
    p.stdin.end('');
    const stop = () => p.kill();
    o.signal?.addEventListener('abort', stop, { once: true });
    const timer = o.timeoutMs ? setTimeout(stop, o.timeoutMs) : undefined;
    p.on('error', () => resolve({ code: -1, out, err: `${err}\nENOENT` }));
    p.on('exit', (code) => {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', stop);
      resolve({ code, out, err });
    });
  });
}

/** The CLI's token for GitHub, if it's signed in. @param {GhCommand | null} gh @param {GhOptions} [o] @returns {Promise<string | null>} */
export async function ghToken(gh, o = {}) {
  if (!gh) return null;
  const r = await runGh(gh, ['auth', 'token', '--hostname', o.host ?? 'github.com'], { ...o, timeoutMs: 30_000 });
  return r.code === 0 ? r.out.trim() || null : null;
}

/** Signs the CLI out of GitHub on this computer (one sign-in: the terminal's too). @param {GhCommand | null} gh @param {GhOptions} [o] */
export async function ghLogout(gh, o = {}) {
  if (!gh) return false;
  const r = await runGh(gh, ['auth', 'logout', '--hostname', o.host ?? 'github.com'], { ...o, timeoutMs: 30_000 });
  return r.code === 0;
}

/**
 * Device login: the CLI asks GitHub for a code, the app shows it (`onCode`), the person enters it on GitHub and
 * approves, and the CLI keeps the token, which the app then asks it for. `refresh` adds the scopes a sign-in
 * already there lacks (the same code, on the same page).
 * @param {GhOptions & { gh: GhCommand | null, refresh?: boolean, onCode: (c: { code: string, url: string }) => void, signal?: AbortSignal, timeoutMs?: number }} o
 * @returns {Promise<{ ok: true, token: string } | { ok: false, problem: SignInProblem }>}
 */
export async function ghLogin(o) {
  if (!o.gh) return { ok: false, problem: 'missing' };
  const host = o.host ?? 'github.com';
  let shown = false;
  const args = o.refresh
    ? ['auth', 'refresh', '--hostname', host, '--scopes', SCOPES.join(',')]
    : ['auth', 'login', '--hostname', host, '--git-protocol', 'https', '--web', '--scopes', SCOPES.join(',')];
  const r = await runGh(o.gh, args, {
    env: o.env,
    configDir: o.configDir,
    signal: o.signal,
    timeoutMs: o.timeoutMs ?? SIGN_IN_MS,
    onOutput: (text) => {
      const c = shown ? null : deviceCode(text);
      if (!c) return;
      shown = true;
      o.onCode(c);
    },
  });
  if (o.signal?.aborted) return { ok: false, problem: 'declined' };
  if (r.code !== 0) return { ok: false, problem: r.err.includes('ENOENT') ? 'missing' : r.code === null ? 'expired' : signInProblem(`${r.out}\n${r.err}`) };
  const token = await ghToken(o.gh, { env: o.env, configDir: o.configDir, host });
  return token ? { ok: true, token } : { ok: false, problem: 'failed' };
}
