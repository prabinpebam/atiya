// @ts-check
/** Stage 5 (documentation/desktop/plan.md): private pages on first use, on the fake GitHub. */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { GitHub } from '../src/core/setup/github.mjs';
import { runSetup } from '../src/core/setup/machine.mjs';
import { KEY_TITLE, PRIVATE_STEPS, runPrivateSetup, SECRET } from '../src/core/setup/private.mjs';
import { sealSecret, secretKeyPair } from '../src/core/setup/seal.mjs';
import { ed25519KeyPair } from '../src/core/setup/sshkey.mjs';

const APP = resolve(import.meta.dirname, '..');
const CLI = join(APP, 'bin', 'atiya.mjs');
const STARTER = resolve(APP, '..', '..', 'starter', 'content');
const tmp = () => mkdtempSync(join(tmpdir(), 'atiya-s5-'));
const sh = (/** @type {string[]} */ args, /** @type {string} */ cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();

/** @type {Awaited<ReturnType<typeof startFakeGitHub>>[]} */
const fakes = [];
afterEach(async () => {
  while (fakes.length) await fakes.pop()?.close();
});

/** A site made by setup on a fake GitHub, not waiting for its build. */
async function site() {
  const f = await startFakeGitHub({ root: join(tmp(), 'remotes'), buildMs: 150, deviceInterval: 0 });
  fakes.push(f);
  const home = tmp();
  const github = new GitHub({ token: 'fake-ada', api: f.url, web: f.url });
  const gitConfigFile = join(home, '.atiya-studio', 'gitconfig');
  const r = await runSetup({ github, inputs: { home, explore: 'site', samples: false }, apply: true, wait: false, engine: { version: '0.1.0', commit: null, sha256: null }, gitConfigFile, starter: STARTER });
  expect(r.ok).toBe(true);
  const dir = /** @type {string} */ (r.site?.dir);
  /** @param {{ apply?: boolean, failAfter?: string }} [o] */
  const run = async (o = {}) => {
    /** @type {any[]} */
    const events = [];
    const result = await runPrivateSetup({ github, dir, apply: o.apply ?? true, gitConfigFile, failAfter: o.failAfter, emit: (e) => events.push(e) });
    return { result, events };
  };
  return { f, dir, run, home };
}

/** The public half of an OpenSSH private key, read from its own format. @param {string} pem */
function publicOf(pem) {
  const body = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64');
  let at = 'openssh-key-v1\0'.length;
  const next = () => {
    const n = body.readUInt32BE(at);
    const s = body.subarray(at + 4, at + 4 + n);
    at += 4 + n;
    return s;
  };
  next(); // cipher
  next(); // kdf
  next(); // kdf options
  at += 4; // one key
  return `ssh-ed25519 ${next().toString('base64')}`;
}

describe('the build key (5.4)', () => {
  it('is an ed25519 key in OpenSSH format that ssh-keygen reads, with its public line', () => {
    const k = ed25519KeyPair('atiya-test');
    expect(k.privateKey).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+-----END OPENSSH PRIVATE KEY-----\n$/);
    expect(k.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ atiya-test$/);
    expect(publicOf(k.privateKey)).toBe(k.publicKey.split(' ').slice(0, 2).join(' '));
    let keygen = true;
    try {
      execFileSync('ssh-keygen', ['-?'], { stdio: 'ignore' });
    } catch (e) {
      keygen = /** @type {any} */ (e).code !== 'ENOENT';
    }
    if (!keygen) return;
    const file = join(tmp(), 'id');
    writeFileSync(file, k.privateKey, { mode: 0o600 });
    // OpenSSH on Windows refuses a key others can read
    if (process.platform === 'win32') execFileSync('icacls', [file, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`], { stdio: 'ignore' });
    expect(execFileSync('ssh-keygen', ['-y', '-f', file], { encoding: 'utf8' }).trim().split(' ').slice(0, 2).join(' ')).toBe(publicOf(k.privateKey));
  });

  it('is sealed so that only the repository key opens it', async () => {
    const kp = await secretKeyPair();
    const sealed = await sealSecret(kp.publicKey, 'the value');
    expect(sealed).not.toContain('the value');
    expect(kp.open(sealed)).toBe('the value');
    expect(() => kp.open(Buffer.from('nonsense').toString('base64'))).toThrow();
  });
});

describe('private pages on first use (5.4)', () => {
  it('makes the private repository, its first files, a read-only key sealed into the site, and the submodule', async () => {
    const s = await site();
    const { result, events } = await s.run();
    expect(result).toMatchObject({ ok: true, applied: true, repository: 'ada/ada.github.io-private' });
    expect(events.filter((e) => e.type === 'step' && e.state === 'done').map((e) => e.step)).toEqual(PRIVATE_STEPS);

    const priv = /** @type {any} */ (s.f.repos.get('ada/ada.github.io-private'));
    expect(priv.private).toBe(true);
    const files = sh([`--git-dir=${priv.bare}`, 'ls-tree', '-r', '--name-only', 'main'], s.dir).split('\n').sort();
    expect(files).toEqual(['README.md', 'access-message.json', 'access.json', 'structures/overlay.json']);
    expect(JSON.parse(sh([`--git-dir=${priv.bare}`, 'show', 'main:access-message.json'], s.dir)).site).toBe('https://ada.github.io');

    expect(priv.keys).toHaveLength(1);
    expect(priv.keys[0]).toMatchObject({ title: KEY_TITLE, read_only: true });
    const pub = /** @type {any} */ (s.f.repos.get('ada/ada.github.io'));
    const secret = pub.secrets.get(SECRET);
    expect(secret).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----/);
    expect(publicOf(secret)).toBe(priv.keys[0].key);

    expect(readFileSync(join(s.dir, '.gitmodules'), 'utf8')).toMatch(/path = private-pages/);
    expect(sh(['rev-parse', '--abbrev-ref', 'HEAD'], join(s.dir, 'private-pages'))).toBe('main');
    expect(sh(['rev-parse', '--abbrev-ref', '@{upstream}'], join(s.dir, 'private-pages'))).toBe('origin/main');
    expect(existsSync(join(s.dir, 'private-pages', 'access.json'))).toBe(true);
    expect(sh([`--git-dir=${pub.bare}`, 'show', 'main:.gitmodules'], s.dir)).toMatch(/path = private-pages/);
    expect(sh(['log', '-1', '--format=%s|%ae'], s.dir)).toBe('Set up private pages|1001+ada@users.noreply.github.com');
    expect(existsSync(join(s.dir, '.atiya', 'private-seed'))).toBe(false);
    // the private half is nowhere on disk
    /** @type {(d: string) => string[]} */
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    expect(walk(s.home).filter((f) => readFileSync(f).includes('OPENSSH PRIVATE'))).toEqual([]);
  });

  it('a second run changes nothing, and a dry run plans without changing anything', async () => {
    const s = await site();
    const before = s.f.writes().length;
    const dry = await s.run({ apply: false });
    expect(dry.result).toMatchObject({ ok: true, applied: false });
    expect(dry.events.filter((e) => e.type === 'step').map((e) => e.state)).toEqual(['todo', 'todo', 'todo', 'todo']);
    expect(s.f.writes().length).toBe(before);
    await s.run();
    const made = s.f.writes().length;
    const again = await s.run();
    expect(again.result.ok).toBe(true);
    expect(again.events.filter((e) => e.type === 'step').map((e) => e.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(s.f.writes().length).toBe(made);
  });

  for (const stop of PRIVATE_STEPS.slice(0, -1))
    it(`stopped after "${stop}", a second run finishes`, async () => {
      const s = await site();
      expect((await s.run({ failAfter: stop })).result.ok).toBe(false);
      expect((await s.run()).result.ok).toBe(true);
      const priv = /** @type {any} */ (s.f.repos.get('ada/ada.github.io-private'));
      expect(priv.keys).toHaveLength(1);
      expect(publicOf(/** @type {any} */ (s.f.repos.get('ada/ada.github.io')).secrets.get(SECRET))).toBe(priv.keys[0].key);
    });

  it('a lost secret makes the key again, and removes the old one', async () => {
    const s = await site();
    await s.run();
    const pub = /** @type {any} */ (s.f.repos.get('ada/ada.github.io'));
    const priv = /** @type {any} */ (s.f.repos.get('ada/ada.github.io-private'));
    const old = priv.keys[0].key;
    pub.secrets.clear();
    expect((await s.run()).result.ok).toBe(true);
    expect(priv.keys).toHaveLength(1);
    expect(priv.keys[0].key).not.toBe(old);
    expect(publicOf(pub.secrets.get(SECRET))).toBe(priv.keys[0].key);
  });

  it('refuses a public repository of that name (exit 20), and a site that isn\'t one', async () => {
    const s = await site();
    await new GitHub({ token: 'fake-ada', api: s.f.url }).createRepo('ada.github.io-private', 'something else');
    const r = await s.run();
    expect(r.result).toMatchObject({ ok: false, code: 20 });
    expect(r.result.message).toMatch(/is public/);
    const elsewhere = await runPrivateSetup({ github: new GitHub({ token: 'fake-ada', api: s.f.url }), dir: tmp(), apply: true, gitConfigFile: join(s.home, 'gitconfig') });
    expect(elsewhere).toMatchObject({ ok: false, code: 20 });
  });

  it('atiya private setup does it from the command line, with JSON events and no token in them', async () => {
    const s = await site();
    /** @type {{ code: number, stdout: string }} */
    const r = await new Promise((done) =>
      execFile(process.execPath, [CLI, 'private', 'setup', '--yes', '--json', '--github', s.f.url, '--dir', s.dir], { env: { ...process.env, GH_TOKEN: 'fake-ada', ATIYA_HOME: s.home }, windowsHide: true, timeout: 60_000 }, (err, stdout) =>
        done({ code: err ? Number(/** @type {any} */ (err).code ?? 1) : 0, stdout: String(stdout) }),
      ),
    );
    expect(r.code).toBe(0);
    const events = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(events.at(-1)).toMatchObject({ type: 'result', ok: true, repository: 'ada/ada.github.io-private' });
    expect(r.stdout).not.toContain('fake-ada');
    expect(r.stdout).not.toContain('PRIVATE KEY');
  });
});
