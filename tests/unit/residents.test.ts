import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteFeatures } from '../../integrations/features.mjs';
import { RESIDENT_ASSETS, RESIDENT_CHUNKS } from '../../integrations/site-only.mjs';
import { MUSIC } from '../../src/game/audio/musicManifest';
import { initialsOf, siteWelcomeLines } from '../../src/game/platform/siteWelcome';
import { welcomeLines } from '../../src/game/world/home/welcome';
import { planetStructure } from '../../src/site/content/schema';

/** Little planet for anyone (desktop plan M3a): the owner's residents and music are his site's alone. */
describe('the residents follow the site', () => {
  it("on for the engine's own repository, off for a site made by Atiya Studio", () => {
    expect(siteFeatures({ root: process.cwd(), contentRoot: join(process.cwd(), 'content') }).residents).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'atiya-residents-'));
    mkdirSync(join(dir, 'content'));
    writeFileSync(join(dir, 'atiya.json'), JSON.stringify({ schema: 1 }));
    expect(siteFeatures({ root: dir, contentRoot: join(dir, 'content') })).toMatchObject({ managed: true, residents: false });
  });

  it("a build without them leaves out every file of theirs and the owner's music", () => {
    for (const t of MUSIC) expect(RESIDENT_ASSETS, t.url).toContain(t.url.replace(/^\//, ''));
    for (const f of ['chopper', 'models/skins', 'avatars/npc']) {
      expect(RESIDENT_ASSETS).toContain(f);
      expect(existsSync(join('public', f)), f).toBe(true);
    }
    expect(['Chopper.Y0boVhLG.js', 'ChopperCard.Kwb8N5YO.js', 'home.-SvReClL.js'].every((f) => RESIDENT_CHUNKS.test(f))).toBe(true);
    expect(['homestead.abc.js', 'game-mount.abc.js', 'craft.abc.js'].some((f) => RESIDENT_CHUNKS.test(f))).toBe(false);
  });
});

describe("the welcome on a site without them is the site's own person's", () => {
  it('a generic hello by name, then the same controls and tips as Prabin\'s', () => {
    const lines = siteWelcomeLines({ name: 'Ada Lovelace', touch: null, back: false });
    expect(lines[0]).toBe('Hi, I’m Ada Lovelace. Welcome to my little planet! Each building holds part of my site: walk up to one to see what’s inside.');
    expect(lines.slice(1)).toEqual(welcomeLines(null, false).slice(1));
    expect(lines.join(' ')).not.toMatch(/Prabin/);
  });
  it("their own words when Little planet's structure has some; the touch version; a returning visitor's short one", () => {
    const own = siteWelcomeLines({ name: 'Ada', lines: ['Hello! I build engines.', 'Have a wander.'], touch: ['Drag to walk.'], back: false });
    expect(own.slice(0, 3)).toEqual(['Hello! I build engines.', 'Have a wander.', 'Drag to walk.']);
    expect(siteWelcomeLines({ name: 'Ada', touch: null, back: true })).toEqual(welcomeLines(null, true));
  });
  it('initials when there is no picture', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('Ada King Lovelace')).toBe('AL');
    expect(initialsOf('ada')).toBe('A');
    expect(initialsOf('  ')).toBe('?');
  });
  it("Little planet's structure may carry the words, a few short lines", () => {
    expect(planetStructure.safeParse({ places: [], welcome: ['Hello!'] }).success).toBe(true);
    expect(planetStructure.safeParse({ places: [], welcome: [] }).success).toBe(false);
    expect(planetStructure.safeParse({ places: [], welcome: ['x'.repeat(281)] }).success).toBe(false);
  });
});
