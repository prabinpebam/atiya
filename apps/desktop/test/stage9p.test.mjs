// @ts-check
/** Stage 9P (documentation/desktop/plan.md): the engine an installed app carries as one archive, and the client ID. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { githubClientId } from '../src/core/setup/client-id.mjs';
import { engineArchive, engineFolder, unpackEngine } from '../src/core/setup/engine-archive.mjs';

const roots = /** @type {string[]} */ ([]);
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'atiya-9p-'));
  roots.push(d);
  return d;
};
afterEach(() => {
  for (const d of roots.splice(0)) rmSync(d, { recursive: true, force: true });
});

const MANIFEST = { version: '0.1.0', commit: 'abc', sha256: '4a40662bb6980ad5a72fb310aa281bd290f52aac07563b50727007f58ab1680a' };

/** A small engine archive, made with the system's tar as the build makes it. @param {string} dir @param {boolean} [withManifest] */
function archiveIn(dir, withManifest = true) {
  const src = join(dir, 'src');
  mkdirSync(join(src, 'starter', 'content'), { recursive: true });
  writeFileSync(join(src, 'starter', 'content', 'site.json'), '{}');
  if (withManifest) writeFileSync(join(src, 'engine.json'), JSON.stringify(MANIFEST));
  const res = join(dir, 'resources');
  mkdirSync(res);
  execFileSync('tar', ['-cf', join(res, 'engine.tar'), '-C', src, '.']);
  writeFileSync(join(res, 'engine.json'), JSON.stringify(MANIFEST));
  return res;
}

describe('the engine as one archive', () => {
  it('is found with its manifest in a packaged app’s resources, and nowhere else', () => {
    const res = archiveIn(temp());
    expect(engineArchive(res)).toMatchObject({ version: '0.1.0', sha256: MANIFEST.sha256 });
    expect(engineArchive(undefined)).toBeNull();
    expect(engineArchive(temp())).toBeNull();
    // a manifest that isn't one isn't trusted
    writeFileSync(join(res, 'engine.json'), JSON.stringify({ version: '0.1.0', sha256: 'nope' }));
    expect(engineArchive(res)).toBeNull();
  });

  it('is unpacked once into a folder named after its release, whole or not at all, and older releases go', async () => {
    const dir = temp();
    const res = archiveIn(dir);
    const data = join(dir, 'data');
    const a = /** @type {NonNullable<ReturnType<typeof engineArchive>>} */ (engineArchive(res));
    const folder = engineFolder(data, a);
    expect(folder).toBe(join(data, 'engine', '0.1.0-4a40662bb698'));
    // an older release's folder, and a scratch folder a stopped start left
    mkdirSync(join(data, 'engine', '0.0.9-aaaaaaaaaaaa'), { recursive: true });
    mkdirSync(`${folder}.unpacking`, { recursive: true });
    expect(await unpackEngine(a, folder)).toBe(folder);
    expect(existsSync(join(folder, 'engine.json'))).toBe(true);
    expect(existsSync(join(folder, 'starter', 'content', 'site.json'))).toBe(true);
    expect(readdirSync(join(data, 'engine'))).toEqual(['0.1.0-4a40662bb698']);
    // a second start uses what's there
    writeFileSync(join(folder, 'marker'), '');
    await unpackEngine(a, folder);
    expect(existsSync(join(folder, 'marker'))).toBe(true);
  });

  it('refuses an archive without its manifest, leaving no engine behind', async () => {
    const dir = temp();
    const res = archiveIn(dir, false);
    const folder = join(dir, 'data', 'engine', '0.1.0-4a40662bb698');
    await expect(unpackEngine({ tar: join(res, 'engine.tar') }, folder)).rejects.toThrow(/no engine\.json/);
    expect(existsSync(join(folder, 'engine.json'))).toBe(false);
    await expect(unpackEngine({ tar: join(res, 'missing.tar') }, folder)).rejects.toThrow(/couldn't be unpacked/);
  });
});

describe("the OAuth App's client ID", () => {
  it("is the environment's, else the one the app was built with, else none; checked for shape", () => {
    const pkg = JSON.stringify({ name: 'atiya-studio', atiya: { githubClientId: 'Ov23liABCDEFGH123456' } });
    expect(githubClientId({ ATIYA_GITHUB_CLIENT_ID: 'Iv1.0123456789abcdef' }, pkg)).toBe('Iv1.0123456789abcdef');
    expect(githubClientId({}, pkg)).toBe('Ov23liABCDEFGH123456');
    expect(githubClientId({}, JSON.stringify({ name: 'atiya-studio' }))).toBeNull();
    expect(githubClientId({}, null)).toBeNull();
    expect(githubClientId({}, 'not json')).toBeNull();
    expect(githubClientId({}, JSON.stringify({ atiya: { githubClientId: 'x"; alert(1)' } }))).toBeNull();
    expect(githubClientId({ ATIYA_GITHUB_CLIENT_ID: 'short' }, pkg)).toBeNull();
  });
});
