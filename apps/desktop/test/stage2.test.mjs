// @ts-check
/** Stage 2 (documentation/desktop/plan.md): setup and the agent CLI, on the fake GitHub. */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deviceCode, ghCommand, ghLogin, ghLogout, ghToken, signInProblem } from '../src/core/setup/gh-login.mjs';
import { ADA, startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { Git, sameRemote } from '../src/core/setup/git.mjs';
import { GitHub, missingScopes } from '../src/core/setup/github.mjs';
import { runSetup, siteUrl, STEPS } from '../src/core/setup/machine.mjs';
import { redact } from '../src/core/setup/tokens.mjs';

const APP = resolve(import.meta.dirname, '..');
const CLI = join(APP, 'bin', 'atiya.mjs');
const STARTER = resolve(APP, '..', '..', 'starter', 'content');
const ENGINE = { version: '0.1.0', commit: 'abc123', sha256: null };
const tmp = () => mkdtempSync(join(tmpdir(), 'atiya-s2-'));

/** @type {Awaited<ReturnType<typeof startFakeGitHub>>[]} */
const fakes = [];
afterEach(async () => {
  while (fakes.length) await fakes.pop()?.close();
});

/** @param {Partial<Parameters<typeof startFakeGitHub>[0]>} [o] */
async function fake(o = {}) {
  const f = await startFakeGitHub({ root: join(tmp(), 'remotes'), buildMs: 150, deviceInterval: 0, ...o });
  fakes.push(f);
  return f;
}

/**
 * @param {Awaited<ReturnType<typeof fake>>} f
 * @param {{ home?: string, token?: string, apply?: boolean, failAfter?: string, inputs?: Record<string, unknown> }} [o]
 */
async function setup(f, o = {}) {
  const home = o.home ?? tmp();
  /** @type {any[]} */
  const events = [];
  const result = await runSetup({
    github: new GitHub({ token: o.token ?? 'fake-ada', api: f.url, web: f.url }),
    inputs: { home, explore: 'little-planet', samples: true, ...o.inputs },
    apply: o.apply ?? true,
    engine: ENGINE,
    gitConfigFile: join(home, '.atiya-studio', 'gitconfig'),
    starter: STARTER,
    emit: (e) => events.push(e),
    pollMs: 30,
    firstRunWaitMs: 2000,
    failAfter: o.failAfter,
  });
  return { result, events, home, dir: result.site?.dir ?? join(home, 'Atiya', 'ada.github.io') };
}

/**
 * Runs the CLI as an agent would. @param {string[]} args @param {Record<string, string | undefined>} env
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function cli(args, env) {
  return new Promise((resolvePromise) => {
    /** @type {Record<string, string | undefined>} */
    const childEnv = { ...process.env, ATIYA_POLL_MS: '30', ATIYA_FIRST_RUN_WAIT_MS: '2000', GH_TOKEN: undefined, GITHUB_TOKEN: undefined, ...env };
    for (const k of Object.keys(childEnv)) if (childEnv[k] === undefined) delete childEnv[k];
    execFile(process.execPath, [CLI, ...args], { env: childEnv, timeout: 60_000, windowsHide: true }, (err, stdout, stderr) =>
      resolvePromise({ code: err ? Number(/** @type {any} */ (err).code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) }),
    );
  });
}
const lines = (/** @type {string} */ s) => s.split('\n').filter(Boolean).map((l) => JSON.parse(l));
/** @param {string} dir @returns {string[]} */
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

describe('setup on the fake GitHub', () => {
  it('2.1 makes the repository and workspace, saves, turns on publishing, follows the build to live', async () => {
    const f = await fake();
    const { result, dir, events } = await setup(f);
    expect(result).toMatchObject({ ok: true, live: true, applied: true, site: { repository: 'ada/ada.github.io', url: 'https://ada.github.io/' } });
    for (const file of ['atiya.json', '.github/workflows/site.yml', 'AGENTS.md', 'README.md', '.gitattributes', '.gitignore', 'content/site.json', 'content/structures/modes/little-planet.json', 'content/articles/about-me.json']) expect(existsSync(join(dir, file)), file).toBe(true);
    const atiya = JSON.parse(readFileSync(join(dir, 'atiya.json'), 'utf8'));
    expect(atiya).toMatchObject({ schema: 1, engine: ENGINE, owner: { login: 'ada', id: ADA.id } });
    // which ways in are on is content (plan stage 8A): the little planet, chosen in the first run
    expect(atiya.modes).toBeUndefined();
    expect(JSON.parse(readFileSync(join(dir, 'content/structures/ways.json'), 'utf8'))).toEqual({ modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'site' });
    expect(readFileSync(join(dir, '.github/workflows/site.yml'), 'utf8')).toContain('uses: prabinpebam/atiya/.github/workflows/site-build.yml@abc123');
    expect(JSON.parse(readFileSync(join(dir, 'content/site.json'), 'utf8')).name).toBe('Ada Lovelace');
    // no address that's read: no contact yet (edit mode's Contact card sets it); the services skill is there for agents (11.7)
    expect(JSON.parse(readFileSync(join(dir, 'content/site.json'), 'utf8')).services).toBeUndefined();
    expect(readFileSync(join(dir, '.github/skills/site-services/SKILL.md'), 'utf8')).toMatch(/^---\nname: site-services\n/);
    expect(f.writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /user/repos', 'POST /repos/ada/ada.github.io/pages']);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    expect(await new GitHub({ token: 'fake-ada', api: f.url }).branchSha('ada', 'ada.github.io', 'main')).toBe(head);
    expect(events.some((e) => e.type === 'milestone' && e.name === 'ready-to-edit')).toBe(true);
    const author = execFileSync('git', ['log', '-1', '--format=%an <%ae>'], { cwd: dir, encoding: 'utf8' }).trim();
    expect(author).toBe(`Ada Lovelace <${ADA.id}+ada@users.noreply.github.com>`);
  });

  it('2.1 just the site, without sample pages, reached by Email me at the address given (11.7)', async () => {
    const f = await fake();
    const { result, dir } = await setup(f, { inputs: { explore: 'site', samples: false, email: 'ada@example.com' } });
    expect(result.ok).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'content/site.json'), 'utf8')).services).toEqual({ contact: { kind: 'email', address: 'ada@example.com' } });
    expect(existsSync(join(dir, 'content/structures/modes/little-planet.json'))).toBe(false);
    expect(existsSync(join(dir, 'content/articles'))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, 'content/structures/ways.json'), 'utf8'))).toEqual({ modes: [], primary: 'site' });
    expect(JSON.parse(readFileSync(join(dir, 'atiya.json'), 'utf8')).modes).toBeUndefined();
  });

  it('2.1 turns publishing on after the first save when GitHub refuses it on an empty repository', async () => {
    const f = await fake({ pagesNeedsCommit: true });
    const { result, events } = await setup(f);
    expect(result).toMatchObject({ ok: true, live: true });
    expect(events.some((e) => e.type === 'step' && e.step === 'publishing' && e.state === 'waiting')).toBe(true);
    expect(f.writes().map((c) => c.path)).toContain('/repos/ada/ada.github.io/actions/workflows/site.yml/dispatches');
  });

  for (const stop of ['repository', 'workspace', 'publishing', 'first-save']) {
    it(`2.3 stopped after "${stop}", a second run finishes, and a third changes nothing`, async () => {
      const f = await fake();
      const home = tmp();
      const first = await setup(f, { home, failAfter: stop });
      expect(first.result.ok).toBe(false);
      const second = await setup(f, { home });
      expect(second.result).toMatchObject({ ok: true, live: true });
      const writes = f.writes().length;
      const commits = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: second.dir, encoding: 'utf8' }).trim();
      const third = await setup(f, { home });
      expect(third.result).toMatchObject({ ok: true, live: true });
      expect(f.writes().length).toBe(writes);
      expect(f.writes().filter((c) => c.path === '/user/repos')).toHaveLength(1);
      expect(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: second.dir, encoding: 'utf8' }).trim()).toBe(commits);
      expect(commits).toBe('1');
    });
  }

  it('2.5 with <login>.github.io holding something else, the site is made as "site"', async () => {
    const f = await fake();
    const gh = new GitHub({ token: 'fake-ada', api: f.url });
    const other = await gh.createRepo('ada.github.io', 'my old page');
    const scratch = tmp();
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: scratch });
    writeFileSync(join(scratch, 'index.html'), '<h1>Old</h1>');
    execFileSync('git', ['add', '-A'], { cwd: scratch });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'old'], { cwd: scratch });
    execFileSync('git', ['push', other.cloneUrl, 'main'], { cwd: scratch });
    const { result } = await setup(f);
    expect(result).toMatchObject({ ok: true, site: { repository: 'ada/site', url: 'https://ada.github.io/site/' } });
  });

  it('builds the address from the repository (F5)', () => {
    expect(siteUrl('Ada', 'ada.github.io')).toBe('https://ada.github.io/');
    expect(siteUrl('Ada', 'site')).toBe('https://ada.github.io/site/');
  });
});

describe('the CLI, as an agent runs it', () => {
  it('2.2 without --yes, and with --dry-run, it plans and changes nothing', async () => {
    const f = await fake();
    const home = tmp();
    for (const extra of [[], ['--yes', '--dry-run']]) {
      const r = await cli(['setup', '--github', f.url, '--token', 'env', '--json', ...extra], { GH_TOKEN: 'fake-ada', ATIYA_HOME: home });
      expect(r.code).toBe(0);
      const ev = lines(r.stdout);
      expect(ev.at(-1)).toMatchObject({ type: 'result', ok: true, applied: false });
      expect(ev.filter((e) => e.type === 'step' && e.state === 'todo').map((e) => e.step)).toEqual(['repository', 'workspace', 'publishing', 'first-save', 'first-build', 'live']);
    }
    expect(f.writes()).toEqual([]);
    expect(existsSync(join(home, 'Atiya'))).toBe(false);
  });

  it('2.9 --json writes one JSON event per line: plan, steps, a milestone and the result', async () => {
    const f = await fake();
    const r = await cli(['setup', '--github', f.url, '--token', 'env', '--yes', '--json'], { GH_TOKEN: 'fake-ada', ATIYA_HOME: tmp() });
    expect(r.code).toBe(0);
    const ev = lines(r.stdout);
    expect(new Set(ev.map((e) => e.type))).toEqual(new Set(['step', 'plan', 'milestone', 'result']));
    expect(ev.find((e) => e.type === 'plan')).toMatchObject({ steps: STEPS, site: { repository: 'ada/ada.github.io' } });
    expect(ev.at(-1)).toMatchObject({ type: 'result', ok: true, live: true, applied: true });
  });

  it('2.4 exit 10 with an action when the email is unconfirmed, or when there is no token', async () => {
    const f = await fake({ users: { 'fake-ada': { ...ADA, emailVerified: false } } });
    const r = await cli(['setup', '--github', f.url, '--token', 'env', '--yes', '--json'], { GH_TOKEN: 'fake-ada', ATIYA_HOME: tmp() });
    expect(r.code).toBe(10);
    expect(lines(r.stdout).find((e) => e.type === 'action')).toMatchObject({ needs: 'confirm-email', url: `${f.url}/settings/emails` });
    expect(f.writes()).toEqual([]);

    const none = await cli(['setup', '--github', f.url, '--token', 'env', '--yes', '--json'], { ATIYA_HOME: tmp() });
    expect(none.code).toBe(10);
    expect(lines(none.stdout).find((e) => e.type === 'action')).toMatchObject({ needs: 'sign-in' });
  });

  it('2.4 signs in with device login through the GitHub CLI, showing the code as an action', async () => {
    const f = await fake({ deviceApproveAfterMs: 200, deviceInterval: 0 });
    const r = await cli(['setup', '--github', f.url, '--token', 'device', '--yes', '--json', '--no-wait'], { ATIYA_HOME: tmp() });
    expect(r.code).toBe(0);
    const action = lines(r.stdout).find((e) => e.type === 'action');
    expect(action).toMatchObject({ needs: 'sign-in', code: 'WDJB-MJHT', url: `${f.url}/login/device` });
    expect(lines(r.stdout).at(-1)).toMatchObject({ ok: true, applied: true, live: false });
  });

  it('2.4 exit 20 when the folder holds something else', async () => {
    const f = await fake();
    const dir = join(tmp(), 'busy');
    mkdirSync(dir);
    writeFileSync(join(dir, 'notes.txt'), 'mine');
    const r = await cli(['setup', '--github', f.url, '--token', 'env', '--yes', '--json', '--dir', dir], { GH_TOKEN: 'fake-ada', ATIYA_HOME: tmp() });
    expect(r.code).toBe(20);
    expect(lines(r.stdout).at(-1).message).toMatch(/already holds something else/);
  });

  it('2.4 exit 30 naming the fix when the token lacks the workflow scope', async () => {
    const f = await fake({ users: { 'fake-ada': { ...ADA, scopes: 'repo, read:org' } } });
    const r = await cli(['setup', '--github', f.url, '--token', 'env', '--yes', '--json'], { GH_TOKEN: 'fake-ada', ATIYA_HOME: tmp() });
    expect(r.code).toBe(30);
    expect(lines(r.stdout).at(-1).message).toContain('gh auth refresh -s workflow');
    expect(f.writes()).toEqual([]);
  });

  it('2.7 the token is never in the output, the files written or git\'s configuration', async () => {
    const secret = 'gho_SecretTokenValue1234567890abcdef';
    const f = await fake({ users: { [secret]: { ...ADA } } });
    const home = tmp();
    const r = await cli(['setup', '--github', f.url, '--token', 'env', '--yes', '--json'], { GH_TOKEN: secret, ATIYA_HOME: home });
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).not.toContain(secret);
    for (const file of walk(home)) expect(readFileSync(file).includes(secret), file).toBe(false);
  });

  it('status and doctor read the site\'s state', async () => {
    const f = await fake();
    const home = tmp();
    await cli(['setup', '--github', f.url, '--token', 'env', '--yes'], { GH_TOKEN: 'fake-ada', ATIYA_HOME: home });
    const r = await cli(['doctor', '--github', f.url, '--token', 'env', '--json', '--dir', join(home, 'Atiya', 'ada.github.io')], { GH_TOKEN: 'fake-ada', ATIYA_HOME: home });
    expect(r.code).toBe(0);
    const d = lines(r.stdout).find((e) => e.type === 'doctor');
    expect(d.ok).toBe(true);
    expect(d.checks.map((/** @type {any} */ c) => c.check)).toEqual(['atiya.json', 'content', 'repository', 'saved', 'pushed', 'built', 'publishing']);
  });
});

describe('the pieces', () => {
  it('2.8 device login runs through the GitHub CLI: the code shown, and the sign-in kept by the CLI, one for the computer', async () => {
    expect(deviceCode('\n! First copy your one-time code: C683-02C3\nOpen this URL to continue in your web browser: https://github.com/login/device\n')).toEqual({ code: 'C683-02C3', url: 'https://github.com/login/device' });
    expect(deviceCode('nothing yet')).toBeNull();
    expect(signInProblem('error: access_denied: The user has denied your application access.')).toBe('declined');
    expect(signInProblem('error: the device code has expired')).toBe('expired');
    expect(signInProblem('error: could not resolve host github.com')).toBe('offline');
    expect(signInProblem('something else')).toBe('failed');

    const f = await fake({ deviceApproveAfterMs: 200, deviceInterval: 0 });
    // the stand-in CLI's keychain
    const configDir = join(tmp(), 'gh');
    const env = { ...process.env, ATIYA_FAKE_GH_WEB: f.url };
    /** @type {{ code: string, url: string }[]} */
    const shown = [];
    const gh = { command: process.execPath, args: [join(APP, 'bin', 'fake-gh.mjs')] };
    expect(await ghToken(gh, { env, configDir })).toBeNull();
    const r = await ghLogin({ gh, configDir, env, onCode: (c) => shown.push(c) });
    expect(r).toEqual({ ok: true, token: 'fake-ada' });
    expect(shown).toEqual([{ code: 'WDJB-MJHT', url: `${f.url}/login/device` }]);
    // the CLI keeps the sign-in: the next start reads it, and signing out is the CLI's too
    expect(await ghToken(gh, { env, configDir })).toBe('fake-ada');
    expect(await ghLogout(gh, { env, configDir })).toBe(true);
    expect(await ghToken(gh, { env, configDir })).toBeNull();
    // adding the scopes a sign-in lacks is the same code on the same page
    const again = await ghLogin({ gh, configDir, env, refresh: true, onCode: (c) => shown.push(c) });
    expect(again).toEqual({ ok: true, token: 'fake-ada' });
    // without a CLI, or with one that won't start, it says so
    expect(await ghLogin({ gh: null, onCode: () => {} })).toEqual({ ok: false, problem: 'missing' });
    expect(await ghLogin({ gh: { command: join(tmp(), 'no-such-gh.exe'), args: [] }, onCode: () => {} })).toEqual({ ok: false, problem: 'missing' });
    // a GitHub that can't be reached says so
    const off = await ghLogin({ gh, configDir, env: { ...process.env, ATIYA_FAKE_GH_WEB: 'http://127.0.0.1:9' }, onCode: () => {} });
    expect(off).toEqual({ ok: false, problem: 'offline' });
  });

  it("the GitHub CLI is the person's own (one sign-in with their terminal), else the one the app carries, or a stand-in", () => {
    const exe = process.platform === 'win32' ? 'gh.exe' : 'gh';
    const appDir = tmp();
    expect(ghCommand({ appDir, env: { PATH: '' } })).toBeNull();
    const carried = join(appDir, 'vendor', 'gh', 'bin');
    mkdirSync(carried, { recursive: true });
    writeFileSync(join(carried, exe), '');
    expect(ghCommand({ appDir, env: { PATH: '' } })).toEqual({ command: join(carried, exe), args: [], carried: true });
    const own = join(tmp(), 'tools');
    mkdirSync(own);
    writeFileSync(join(own, exe), '');
    expect(ghCommand({ appDir, env: { PATH: own, PATHEXT: '.EXE' } })).toEqual({ command: join(own, exe), args: [] });
    expect(ghCommand({ appDir, env: { PATH: own, PATHEXT: '.EXE' }, own: false })?.command).toBe(join(carried, exe));
    expect(ghCommand({ appDir, env: { ATIYA_GH: JSON.stringify({ command: 'node', args: ['fake-gh.mjs'] }) } })).toEqual({ command: 'node', args: ['fake-gh.mjs'] });
  });
  it('missing scopes come from the scopes header; none is checked without one', () => {
    expect(missingScopes('repo, workflow')).toEqual([]);
    expect(missingScopes('public_repo, workflow')).toEqual([]);
    expect(missingScopes('repo')).toEqual(['workflow']);
    expect(missingScopes('')).toEqual(['repo', 'workflow']);
    expect(missingScopes(null)).toEqual([]);
  });

  it('git gets the token only as a per-call header, for github.com', () => {
    const g = new Git({ token: 'gho_abcdefghijklmnopqrstuvwxyz', identity: { name: 'A', email: 'a@b' }, configFile: join(tmp(), 'gitconfig') });
    const env = g.env(true);
    expect(env.GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader');
    expect(Buffer.from(String(env.GIT_CONFIG_VALUE_0).replace('AUTHORIZATION: basic ', ''), 'base64').toString()).toBe('x-access-token:gho_abcdefghijklmnopqrstuvwxyz');
    expect(g.env(false).GIT_CONFIG_COUNT).toBeUndefined();
    expect(env).toMatchObject({ GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' });
  });

  it('redacts tokens and compares remotes', () => {
    expect(redact('push failed for ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456')).toBe('push failed for [token]');
    expect(redact('x my-secret-value y', ['my-secret-value'])).toBe('x [token] y');
    expect(sameRemote('C:\\a\\b.git', 'c:/a/b')).toBe(true);
    expect(sameRemote('https://github.com/ada/site.git', 'https://github.com/ada/other.git')).toBe(false);
  });
});
