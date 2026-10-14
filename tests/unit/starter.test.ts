/**
 * The desktop app's starter content (documentation/desktop/spec.md §9.3): every combination a new site
 * can start from (the planet on or off, sample pages or not) passes the content contract, carries the
 * person's name, and names nothing of the owner's.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/site/content/load';
import { readSnapshot } from '../../src/site/content/source';
import { listFiles, writeStarter } from '../../apps/desktop/src/core/setup/starter.mjs';
import { privateSeed } from '../../apps/desktop/src/core/setup/private.mjs';

const ROOT = join(__dirname, '../..');
const STARTER = join(ROOT, 'starter', 'content');

describe('the starter content', () => {
  for (const planet of [true, false]) {
    for (const samples of [true, false]) {
      it(`passes the content contract with the planet ${planet ? 'on' : 'off'} and ${samples ? 'sample pages' : 'no sample pages'}`, () => {
        const dir = mkdtempSync(join(tmpdir(), 'atiya-starter-'));
        writeStarter(dir, { name: 'Ada Lovelace', planet, samples, today: '2026-10-14', starter: STARTER });
        const snap = readSnapshot(join(dir, 'content'), null);
        const index = loadContent(snap.docs, snap.masters, snap.errors);
        expect(index).toBeTruthy();
        const site = JSON.parse(readFileSync(join(dir, 'content', 'site.json'), 'utf8'));
        expect(site.name).toBe('Ada Lovelace');
        const files = listFiles(join(dir, 'content'));
        expect(files.includes('structures/planet.json')).toBe(planet);
        expect(files.some((f: string) => f.startsWith('articles/'))).toBe(samples);
      });
    }
  }

  it("names nothing of the owner's", () => {
    const text = listFiles(STARTER).map((f: string) => readFileSync(join(STARTER, f), 'utf8')).join('\n');
    expect(text).not.toMatch(/Prabin|Pebam|prabinpebam|Chopper|Microsoft/i);
  });

  it('with private pages set up (their first files), still passes the contract and names no one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'atiya-starter-'));
    writeStarter(dir, { name: 'Ada Lovelace', planet: false, samples: true, today: '2026-10-14', starter: STARTER });
    const seed = privateSeed('https://ada.github.io/');
    for (const [f, text] of Object.entries(seed) as [string, string][]) {
      mkdirSync(dirname(join(dir, 'private-pages', f)), { recursive: true });
      writeFileSync(join(dir, 'private-pages', f), text);
    }
    const snap = readSnapshot(join(dir, 'content'), join(dir, 'private-pages'));
    expect(Object.keys(snap.docs).filter((k) => k.startsWith('/private/')).sort()).toEqual(['/private/access-message.json', '/private/access.json', '/private/structures/overlay.json']);
    expect(loadContent(snap.docs, snap.masters, snap.errors)).toBeTruthy();
    expect(Object.values(seed).join('\n')).not.toMatch(/Prabin|Pebam|prabinpebam|Chopper|Microsoft/i);
  });
});
