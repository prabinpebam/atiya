#!/usr/bin/env node
// @ts-check
/**
 * atiya: Atiya Studio's command line, for people and AI agents (documentation/desktop/spec.md §5).
 *
 *   atiya setup [--name "<name>"] [--repo <name>] [--explore little-planet|site] [--no-samples]
 *               [--dir <folder>] [--token env|gh|device] [--yes] [--no-wait] [--dry-run] [--json]
 *   atiya status [--dir <folder>] [--json]
 *   atiya doctor [--dir <folder>] [--json]
 *   atiya sites [--json]
 *   atiya private setup [--dir <folder>] [--yes] [--dry-run] [--json]
 *
 * --github <url> points it at another GitHub API (the fake GitHub in the tests). Exit codes: 0 done,
 * 10 needs the person, 20 a conflict, 30 GitHub refused, 1 anything else.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { engineInfo } from '../src/core/setup/engine.mjs';
import { pollForToken, requestCode } from '../src/core/setup/device.mjs';
import { checkSite } from '../src/core/setup/doctor.mjs';
import { GitHub, GitHubError } from '../src/core/setup/github.mjs';
import { EXIT, runSetup, STEPS } from '../src/core/setup/machine.mjs';
import { runPrivateSetup } from '../src/core/setup/private.mjs';
import { findToken, redact } from '../src/core/setup/tokens.mjs';
import { githubClientId } from '../src/core/setup/client-id.mjs';

/** Atiya Studio's OAuth App (registered by the owner; stage 5). Until then, sign in with GH_TOKEN or the GitHub CLI. */
// the OAuth App's client ID: the environment's, else the one in the app's package.json (plan 5.1, 9P.5)
const CLIENT_ID = githubClientId(process.env, readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** @param {string[]} argv */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      rest.push(a);
      continue;
    }
    const [k, v] = a.slice(2).split('=', 2);
    if (k.startsWith('no-')) flags[k.slice(3)] = false;
    else if (v !== undefined) flags[k] = v;
    else if (['yes', 'json', 'dry-run', 'wait', 'samples', 'help'].includes(k)) flags[k] = true;
    else flags[k] = argv[++i] ?? '';
  }
  return { command: rest[0] ?? 'help', sub: rest[1] ?? null, flags };
}

/** @param {{ json: boolean, secrets: string[] }} o */
function printer(o) {
  return {
    json: o.json,
    /** @param {any} e */
    event(e) {
      if (o.json) {
        process.stdout.write(redact(JSON.stringify(e), o.secrets) + '\n');
        return;
      }
      const line =
        e.type === 'step' ? (['checking', 'doing'].includes(e.state) ? null : `${e.state.padEnd(8)} ${e.message}`)
        : e.type === 'action' ? `ACTION   ${e.message}${e.url ? ` ${e.url}` : ''}${e.code ? ` Code: ${e.code}` : ''}`
        : e.type === 'plan' ? `Site     ${e.site.url} (${e.site.repository}), files in ${e.site.dir}`
        : e.type === 'milestone' ? 'Ready    Your site can be edited now (open it in Atiya Studio).'
        : e.type === 'result' && e.repository !== undefined ? (e.ok ? (e.applied ? `Done     Private pages are set up, kept in ${e.repository}.` : 'Nothing changed. Run again with --yes to do it.') : `Stopped  ${e.message}`)
        : e.type === 'result' ? (e.ok ? (e.applied ? (e.live ? `Done     Your site is live: ${e.site?.url}` : 'Done     Saved. Your site goes live in a few minutes.') : 'Nothing changed. Run again with --yes to do it.') : `Stopped  ${e.message}`)
        : null;
      if (line) process.stdout.write(redact(line, o.secrets) + '\n');
    },
  };
}

/**
 * The token, from the source asked for (spec §5.2).
 * @param {string} source @param {{ web: string, emit: (e: any) => void, clientId: string | null }} o
 */
async function signIn(source, o) {
  if (source !== 'device') {
    const found = await findToken(source === 'gh' ? 'gh' : source === 'env' ? 'env' : 'auto');
    if (found) return found.token;
    if (source !== 'auto') return null;
  }
  if (!o.clientId) return null;
  const code = await requestCode({ web: o.web, clientId: o.clientId });
  o.emit({ type: 'action', needs: 'sign-in', message: `Open ${code.verificationUri} and enter the code ${code.userCode}, then choose Authorize.`, url: code.verificationUri, code: code.userCode });
  const r = await pollForToken({ web: o.web, clientId: o.clientId, deviceCode: code.deviceCode, interval: code.interval, expiresIn: code.expiresIn });
  return r.ok ? r.token : null;
}

/** @param {string[]} argv */
export async function main(argv) {
  const { command, sub, flags } = parseArgs(argv);
  const json = !!flags.json;
  const api = typeof flags.github === 'string' ? flags.github : 'https://api.github.com';
  const web = typeof flags.github === 'string' ? flags.github : 'https://github.com';
  const home = process.env.ATIYA_HOME ?? homedir();
  const clientId = typeof flags.github === 'string' ? 'fake-client' : CLIENT_ID;
  /** @type {string[]} */
  const secrets = [];
  const out = printer({ json, secrets });

  if (command === 'help' || flags.help) {
    process.stdout.write(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(3, 16).map((l) => l.replace(/^ \* ?/, '')).join('\n') + '\n');
    return EXIT.ok;
  }

  const token = await signIn(String(flags.token ?? 'auto'), { web, emit: out.event, clientId });
  if (!token) {
    out.event({ type: 'action', needs: 'sign-in', message: 'Sign in to GitHub: set GH_TOKEN, sign in with the GitHub CLI (gh auth login), or use Atiya Studio.' });
    out.event({ type: 'result', ok: false, live: false, applied: false, site: null, code: EXIT.needsPerson, message: "Not signed in to GitHub." });
    return EXIT.needsPerson;
  }
  secrets.push(token);
  const github = new GitHub({ token, api, web });
  const gitConfigFile = join(home, '.atiya-studio', 'gitconfig');

  if (command === 'setup') {
    const apply = !!flags.yes && !flags['dry-run'];
    const r = await runSetup({
      github,
      inputs: {
        name: typeof flags.name === 'string' ? flags.name : null,
        repo: typeof flags.repo === 'string' ? flags.repo : null,
        explore: flags.explore === 'site' ? 'site' : 'little-planet',
        samples: flags.samples !== false,
        dir: typeof flags.dir === 'string' ? resolve(flags.dir) : null,
        home,
      },
      apply,
      wait: flags.wait !== false,
      engine: engineInfo(),
      gitConfigFile,
      emit: out.event,
      pollMs: Number(process.env.ATIYA_POLL_MS ?? 5000),
      firstRunWaitMs: Number(process.env.ATIYA_FIRST_RUN_WAIT_MS ?? 30_000),
    });
    return r.ok ? EXIT.ok : r.code ?? EXIT.other;
  }

  if (command === 'status' || command === 'doctor') {
    const dir = resolve(typeof flags.dir === 'string' ? flags.dir : '.');
    return status(dir, { github, gitConfigFile, out, doctor: command === 'doctor' });
  }

  if (command === 'sites') {
    const sites = await github.atiyaSites();
    if (json) process.stdout.write(JSON.stringify({ type: 'sites', sites }) + '\n');
    else for (const s of sites) process.stdout.write(`${s.owner}/${s.name}\n`);
    return EXIT.ok;
  }

  if (command === 'private') {
    if (sub !== 'setup') {
      out.event({ type: 'result', ok: false, applied: false, code: EXIT.other, message: 'Try atiya private setup.' });
      return EXIT.other;
    }
    const r = await runPrivateSetup({
      github,
      dir: resolve(typeof flags.dir === 'string' ? flags.dir : '.'),
      apply: !!flags.yes && !flags['dry-run'],
      gitConfigFile,
      emit: out.event,
    });
    return r.ok ? EXIT.ok : r.code ?? EXIT.other;
  }

  out.event({ type: 'result', ok: false, live: false, applied: false, site: null, code: EXIT.other, message: `Unknown command: ${command}. Try atiya help.` });
  return EXIT.other;
}

/**
 * A site's state (status), or every check with its fix (doctor): the same checks as the app's Check my site.
 * @param {string} dir @param {{ github: GitHub, gitConfigFile: string, out: ReturnType<typeof printer>, doctor: boolean }} o
 */
async function status(dir, o) {
  const r = await checkSite(dir, { github: o.github, gitConfigFile: o.gitConfigFile });
  o.out.event({ type: o.doctor ? 'doctor' : 'status', dir, ok: r.ok, checks: r.checks });
  if (!o.out.json) for (const c of r.checks) process.stdout.write(`${c.ok ? 'ok      ' : 'problem '} ${c.check}: ${c.message}${c.fix ? ` Fix: ${c.fix}` : ''}${c.url ? ` ${c.url}` : ''}\n`);
  return o.doctor && !r.ok ? EXIT.other : EXIT.ok;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  // exitCode, not exit(): exiting while fetch's sockets close trips an assertion in Node on Windows
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(redact(`atiya: ${e instanceof GitHubError ? e.message : e?.stack ?? e}`) + '\n');
      process.exitCode = EXIT.other;
    },
  );
}
export { STEPS };
