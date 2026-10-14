// @ts-check
/**
 * git for setup and sync (documentation/desktop/spec.md §7.5): never prompts, ignores the person's own
 * git settings, and gets the token only as an HTTP header for the one call, through the environment
 * (GIT_CONFIG_COUNT), never in a URL, an argument or a file.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { redact } from './tokens.mjs';
import { bundledGit } from './bundled-git.mjs';

export class GitError extends Error {}

export class Git {
  /**
   * @param {{ git?: string, token?: string | null, tokenHost?: string, identity: { name: string, email: string }, configFile: string }} o
   */
  constructor(o) {
    this.git = o.git ?? bundledGit().git;
    this.token = o.token ?? null;
    this.tokenHost = o.tokenHost ?? 'https://github.com/';
    this.identity = o.identity;
    this.configFile = o.configFile;
    if (!existsSync(this.configFile)) {
      mkdirSync(dirname(this.configFile), { recursive: true });
      writeFileSync(this.configFile, '');
    }
  }

  /** The environment every git call gets. @param {boolean} withToken */
  env(withToken) {
    /** @type {NodeJS.ProcessEnv} */
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)$/.test(k)) delete env[k];
    Object.assign(env, {
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
      GIT_ASKPASS: '',
      SSH_ASKPASS: '',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: this.configFile,
      GIT_AUTHOR_NAME: this.identity.name,
      GIT_AUTHOR_EMAIL: this.identity.email,
      GIT_COMMITTER_NAME: this.identity.name,
      GIT_COMMITTER_EMAIL: this.identity.email,
    });
    if (withToken && this.token) {
      env.GIT_CONFIG_COUNT = '1';
      env.GIT_CONFIG_KEY_0 = `http.${this.tokenHost}.extraheader`;
      env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${this.token}`).toString('base64')}`;
    }
    return env;
  }

  /**
   * @param {string[]} args
   * @param {{ cwd: string, network?: boolean, timeout?: number, env?: NodeJS.ProcessEnv }} o
   * @returns {Promise<string>}
   */
  run(args, o) {
    return new Promise((resolvePromise, reject) =>
      execFile(this.git, ['-c', 'core.autocrlf=false', '-c', 'credential.helper=', ...args], { cwd: o.cwd, env: { ...this.env(!!o.network), ...o.env }, timeout: o.timeout ?? 120_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) reject(new GitError(redact(`git ${args[0]} failed: ${String(stderr || err.message).trim()}`, [this.token ?? ''])));
        else resolvePromise(String(stdout).trim());
      }),
    );
  }

  /** @param {string} cwd */
  async head(cwd) {
    return this.run(['rev-parse', 'HEAD'], { cwd }).catch(() => null);
  }

  /** @param {string} cwd */
  async origin(cwd) {
    return this.run(['remote', 'get-url', 'origin'], { cwd }).catch(() => null);
  }
}

/** Two remote addresses name the same repository (case, a trailing .git or slash, file paths' slashes). @param {string | null} a @param {string | null} b */
export function sameRemote(a, b) {
  if (!a || !b) return false;
  const n = (/** @type {string} */ s) => s.trim().replace(/\\/g, '/').replace(/\/+$/, '').replace(/\.git$/, '').toLowerCase();
  return n(a) === n(b);
}
