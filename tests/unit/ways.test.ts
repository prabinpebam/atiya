/**
 * Ways to explore, on and off (plan stage 8A: 8A.1 to 8A.3): the ways file in the content contract, the
 * loader holding it to V33 to V37, and the planet following it, in the content and in what the build ships.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentError, loadContent } from '../../src/site/content/load';
import { readSnapshot } from '../../src/site/content/source';
import { effectiveWays } from '../../src/site/modes/ways';
import { planetOn, siteFeatures } from '../../integrations/features.mjs';
import { writeStarter } from '../../apps/desktop/src/core/setup/starter.mjs';

const ROOT = join(__dirname, '../..');
const ON = { modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'site' };
const OFF = { modes: [{ id: 'little-planet', on: false, mount: 'play' }], primary: 'site' };

/** A starter site (Ada's), with or without a planet structure, and this ways file (none when undefined). */
function site(o: { planet?: boolean; ways?: unknown } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'atiya-ways-'));
  writeStarter(dir, { name: 'Ada Lovelace', planet: o.planet ?? true, samples: true, today: '2026-10-14', starter: join(ROOT, 'starter', 'content') });
  const content = join(dir, 'content');
  // the starter's own ways file is the test's to choose
  rmSync(join(content, 'structures', 'ways.json'), { force: true });
  if (o.ways !== undefined) writeFileSync(join(content, 'structures', 'ways.json'), JSON.stringify(o.ways));
  return { dir, content };
}
const load = (content: string) => {
  const snap = readSnapshot(content, null);
  return loadContent(snap.docs, snap.masters, snap.errors);
};
/** The issues a load refuses with ([] when it loads). */
const issuesOf = (content: string) => {
  try {
    load(content);
    return [];
  } catch (e) {
    if (e instanceof ContentError) return e.issues;
    throw e;
  }
};

describe('the ways file (8A.1)', () => {
  it('is optional: without it, a site with a planet structure has the little planet on and offered first, as its home page always had', () => {
    expect(effectiveWays({ ways: null, hasPlanet: true })).toEqual({ ...ON, primary: 'little-planet' });
    expect(effectiveWays({ ways: null, hasPlanet: false })).toEqual({ modes: [], primary: 'site' });
    const s = site();
    expect(load(s.content).ways).toBeNull();
  });

  it('is read into the index when it is there, and wins over the default', () => {
    const s = site({ ways: OFF });
    const index = load(s.content);
    expect(index.ways).toEqual(OFF);
    expect(effectiveWays({ ways: index.ways, hasPlanet: !!index.planet })).toEqual(OFF);
  });

  it('is strict: an unknown field or a missing primary is refused', () => {
    expect(issuesOf(site({ ways: { ...ON, extra: 1 } }).content).map((i) => i.file)).toEqual(['content/structures/ways.json']);
    expect(issuesOf(site({ ways: { modes: [] } }).content).length).toBeGreaterThan(0);
  });
});

describe('the loader holds the ways to V33 to V37 (8A.2)', () => {
  const rule = (content: string) => issuesOf(content).map((i) => `${i.file} ${/\((V3\d)\)$/.exec(i.message)?.[1]}`);

  it('passes the starter with the planet on, off, or never there', () => {
    expect(issuesOf(site({ ways: ON }).content)).toEqual([]);
    expect(issuesOf(site({ ways: OFF }).content)).toEqual([]);
    expect(issuesOf(site({ planet: false, ways: { modes: [], primary: 'site' } }).content)).toEqual([]);
  });

  it('refuses each broken case, naming the ways file and the rule', () => {
    const W = 'content/structures/ways.json';
    expect(rule(site({ ways: { modes: [{ id: 'little-planet', on: true, mount: 'work' }], primary: 'site' } }).content)).toEqual([`${W} V34`]);
    expect(rule(site({ planet: false, ways: ON }).content)).toEqual(['content/structures/planet.json V35']);
    expect(rule(site({ planet: false, ways: OFF }).content)).toEqual(['content/structures/planet.json V37']);
    expect(rule(site({ ways: { modes: [{ id: 'orbit', on: true }], primary: 'site' } }).content)).toEqual([`${W} V33`]);
    expect(rule(site({ ways: { ...OFF, primary: 'little-planet' } }).content)).toEqual([`${W} V33`]);
  });
});

describe('the planet follows the ways (8A.3)', () => {
  it("the planet's page imports none of the site's layouts or components, whose styles would land on it", () => {
    const page = readFileSync(join(ROOT, 'src/pages/play.astro'), 'utf8');
    const imports = [...page.matchAll(/^import [^;]* from '([^']+)'/gm)].map((m) => m[1]);
    expect(imports.filter((p) => /\.astro$/.test(p) && p !== '../layouts/BaseLayout.astro')).toEqual([]);
    expect(imports.filter((p) => /site\/(layouts|components)\//.test(p))).toEqual([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('for what the build ships: on, off, or as the structure says without a ways file', () => {
    expect(planetOn(site({ ways: ON }).content)).toBe(true);
    expect(planetOn(site({ ways: OFF }).content)).toBe(false);
    expect(planetOn(site().content)).toBe(true);
    expect(planetOn(site({ planet: false }).content)).toBe(false);
    const s = site({ ways: OFF });
    expect(siteFeatures({ root: s.dir, contentRoot: s.content }).planet).toBe(false);
    // the engine's own repository: no ways file, a planet structure
    expect(siteFeatures({ root: ROOT, contentRoot: join(ROOT, 'content') }).planet).toBe(true);
  });

  it('for the pages: off, the repository gives no planet and no mode data, but keeps the structure', async () => {
    const s = site({ ways: OFF });
    vi.stubEnv('CONTENT_ROOT', s.content);
    vi.stubEnv('PRIVATE_ROOT', join(s.dir, 'private-pages'));
    vi.resetModules();
    const repo = await import('../../src/site/content/repository');
    expect(repo.getPlanet()).toBeNull();
    expect(repo.getModeData('little-planet')).toBeNull();
    expect(repo.content().planet).not.toBeNull();
    expect(repo.getWays()).toEqual(OFF);
  });
});
