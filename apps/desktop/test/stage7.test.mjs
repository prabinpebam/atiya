// @ts-check
/** Stage 7 (documentation/desktop/plan.md): sync between two computers, the shared checks, the launch token. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECKS } from '../src/core/setup/doctor.mjs';
import { Git } from '../src/core/setup/git.mjs';
import { resourceName, sync } from '../src/core/setup/sync.mjs';
// @ts-ignore the engine's integration, plain JavaScript
import { launchAllows } from '../../../integrations/launch.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'atiya-s7-'));
const sh = (/** @type {string[]} */ args, /** @type {string} */ cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();

/** A bare remote and two computers' workspaces of one site. */
function twoComputers() {
  const root = tmp();
  const bare = join(root, 'site.git');
  execFileSync('git', ['init', '--bare', '--initial-branch=main', bare]);
  const git = new Git({ identity: { name: 'Ada', email: 'ada@example.com' }, configFile: join(root, 'gitconfig') });
  const here = join(root, 'here');
  mkdirSync(join(here, 'content', 'articles'), { recursive: true });
  sh(['init', '--initial-branch=main'], here);
  writeFileSync(join(here, 'content', 'site.json'), JSON.stringify({ name: 'Ada' }, null, 2) + '\n');
  writeFileSync(join(here, 'content', 'articles', 'about-me.json'), JSON.stringify({ title: 'About me', body: 'one' }, null, 2) + '\n');
  sh(['add', '-A'], here);
  sh(['-c', 'user.name=A', '-c', 'user.email=a@a', 'commit', '-m', 'Create my site'], here);
  sh(['remote', 'add', 'origin', bare], here);
  sh(['push', '-u', 'origin', 'main'], here);
  const there = join(root, 'there');
  sh(['clone', bare, there], root);
  /** Saves a change on the other computer and pushes it. @param {string} file @param {unknown} doc */
  const elsewhere = (file, doc) => {
    writeFileSync(join(there, file), JSON.stringify(doc, null, 2) + '\n');
    sh(['add', '-A'], there);
    sh(['-c', 'user.name=B', '-c', 'user.email=b@b', 'commit', '-m', 'Elsewhere'], there);
    sh(['push'], there);
  };
  /** Saves a change on this computer, as edit mode does (no commit). @param {string} file @param {unknown} doc */
  const save = (file, doc) => writeFileSync(join(here, file), JSON.stringify(doc, null, 2) + '\n');
  const read = (/** @type {string} */ file) => JSON.parse(readFileSync(join(here, file), 'utf8'));
  return { git, here, there, elsewhere, save, read };
}

describe('sync (7.3)', () => {
  it('is up to date when nothing changed, and ahead when only this computer did', async () => {
    const t = twoComputers();
    expect(await sync(t.git, t.here)).toEqual({ state: 'up-to-date', committed: false });
    t.save('content/site.json', { name: 'Ada L.' });
    expect(await sync(t.git, t.here)).toEqual({ state: 'ahead', committed: true });
  });

  it('fast-forwards to what another computer saved', async () => {
    const t = twoComputers();
    t.elsewhere('content/site.json', { name: 'Ada Lovelace' });
    expect(await sync(t.git, t.here)).toEqual({ state: 'fast-forwarded', committed: false });
    expect(t.read('content/site.json').name).toBe('Ada Lovelace');
  });

  it('merges changes to different pages from both computers', async () => {
    const t = twoComputers();
    t.elsewhere('content/site.json', { name: 'Ada Lovelace' });
    t.save('content/articles/about-me.json', { title: 'About me', body: 'two' });
    expect(await sync(t.git, t.here)).toEqual({ state: 'rebased', committed: true });
    expect(t.read('content/site.json').name).toBe('Ada Lovelace');
    expect(t.read('content/articles/about-me.json').body).toBe('two');
  });

  it('asks which to keep when one page changed on both, then keeps the choice', async () => {
    for (const choice of /** @type {const} */ (['mine', 'theirs'])) {
      const t = twoComputers();
      t.elsewhere('content/articles/about-me.json', { title: 'About me', body: 'there' });
      t.save('content/articles/about-me.json', { title: 'About me', body: 'here' });
      const asked = await sync(t.git, t.here);
      expect(asked).toEqual({ state: 'conflict', committed: true, conflicts: [{ file: 'content/articles/about-me.json', name: 'Page: About me' }] });
      // nothing is half done while it asks: this computer's work is still there
      expect(t.read('content/articles/about-me.json').body).toBe('here');
      const r = await sync(t.git, t.here, { choices: { 'content/articles/about-me.json': choice } });
      expect(r.state).toBe('rebased');
      expect(t.read('content/articles/about-me.json').body).toBe(choice === 'mine' ? 'here' : 'there');
      expect(sh(['status', '--porcelain'], t.here)).toBe('');
    }
  });

  it('names resources in words', () => {
    const dir = tmp();
    mkdirSync(join(dir, 'content', 'articles'), { recursive: true });
    writeFileSync(join(dir, 'content', 'articles', 'x.json'), JSON.stringify({ title: 'My work at Contoso' }));
    expect(resourceName(dir, 'content/articles/x.json')).toBe('Page: My work at Contoso');
    expect(resourceName(dir, 'content/structures/site.json')).toBe('The sections and navigation');
    expect(resourceName(dir, 'content/site.json')).toBe('The site settings');
    expect(resourceName(dir, 'content/media/articles/x/pic.webp')).toBe('Picture: pic.webp');
  });
});

describe('the shared checks and the launch token (7.2, 7.4)', () => {
  it('the app and the CLI report the same checks, from one module', () => {
    expect(CHECKS).toEqual(['atiya.json', 'content', 'repository', 'saved', 'pushed', 'built', 'publishing']);
    const cli = readFileSync(resolve(import.meta.dirname, '..', 'bin', 'atiya.mjs'), 'utf8');
    const main = readFileSync(resolve(import.meta.dirname, '..', 'src', 'main', 'main.mjs'), 'utf8');
    for (const src of [cli, main]) expect(src).toMatch(/import \{ checkSite \} from '[./]+(src\/)?core\/setup\/doctor\.mjs'/);
  });

  it('a managed site answers only the token it was given', () => {
    expect(launchAllows(undefined, undefined)).toBe(true);
    expect(launchAllows('abc', undefined)).toBe(true);
    expect(launchAllows(undefined, 'secret-token')).toBe(false);
    expect(launchAllows('secret-tokeX', 'secret-token')).toBe(false);
    expect(launchAllows('short', 'secret-token')).toBe(false);
    expect(launchAllows(['secret-token'], 'secret-token')).toBe(false);
    expect(launchAllows('secret-token', 'secret-token')).toBe(true);
  });
});
