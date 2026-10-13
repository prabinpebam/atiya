/**
 * Picture facts kept (documentation/engineering/performance-report.md R9, documentation/content/media.md
 * §9.3): a master's size and background measured once and kept on disk by path, size and time; a sidecar's
 * facts trusted while the master is the size they were measured at; the background warm-up; and the
 * one-off backfill script, which measures exactly as the site does.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { flushPictureFacts, keptFacts, measureFacts, pictureFacts, pictureFactsProgress, resetPictureFacts, warmPictureFacts } from '../../src/site/content/pictureFacts';
import { edgeAverage } from '../../src/site/content/edgeColour';
import { imageMedia } from '../../src/site/content/schema';
import { snapshotCache } from '../../src/site/content/source';
import { edgeAverage as scriptEdgeAverage, fillFolder, measure } from '../../scripts/fill-picture-facts.mjs';

const ROOT = join(__dirname, '../..');
const SCRATCH = join(ROOT, 'node_modules', '.cache', 'unit-picture-facts');
mkdirSync(SCRATCH, { recursive: true });
let dir: string;
let content: string;
let cacheFile: string;
const saved = { content: process.env.CONTENT_ROOT, priv: process.env.PRIVATE_ROOT, facts: process.env.SITE_PICTURE_FACTS };
const png = (w: number, h: number, colour = { r: 200, g: 120, b: 60 }) => sharp({ create: { width: w, height: h, channels: 3, background: colour } }).png().toBuffer();
const putMaster = async (rel: string, bytes: Buffer) => {
  const abs = join(content, 'media', ...rel.split('/'));
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, bytes);
  return abs;
};

beforeEach(() => {
  dir = mkdtempSync(join(SCRATCH, 'f-'));
  content = join(dir, 'content');
  cacheFile = join(dir, 'cache', 'facts.json');
  process.env.CONTENT_ROOT = content;
  process.env.PRIVATE_ROOT = join(dir, 'private-pages');
  process.env.SITE_PICTURE_FACTS = cacheFile;
  resetPictureFacts();
  snapshotCache.clear();
});
afterEach(() => {
  resetPictureFacts();
  for (const [k, v] of [['CONTENT_ROOT', saved.content], ['PRIVATE_ROOT', saved.priv], ['SITE_PICTURE_FACTS', saved.facts]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});
afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe('picture facts', () => {
  it('measures a master once, keeps it on disk, and measures again when the master changes', async () => {
    const abs = await putMaster('shared/p.png', await png(64, 48));
    const facts = await pictureFacts('/content/media/shared/p.png');
    expect(facts).toEqual({ width: 64, height: 48, format: 'png', bg: 'rgb(200 120 60)' });
    flushPictureFacts();
    expect(existsSync(cacheFile)).toBe(true);

    // after a restart the disk cache answers, without decoding (a planted value proves where it came from)
    const disk = JSON.parse(readFileSync(cacheFile, 'utf8'));
    const [key] = Object.keys(disk.files);
    disk.files[key].bg = 'rgb(1 2 3)';
    writeFileSync(cacheFile, JSON.stringify(disk));
    resetPictureFacts();
    expect((await pictureFacts('/content/media/shared/p.png')).bg).toBe('rgb(1 2 3)');

    // the master touched: its time no longer matches, so it's measured again
    const t = statSync(abs).mtime;
    utimesSync(abs, t, new Date(t.getTime() + 5000));
    expect((await pictureFacts('/content/media/shared/p.png')).bg).toBe('rgb(200 120 60)');
  });

  it('trusts a sidecar’s facts only while the master is the size they were measured at', async () => {
    const bytes = await png(40, 30);
    await putMaster('shared/s.png', bytes);
    const kept = { width: 999, height: 111, bg: 'rgb(9 9 9)', bytes: bytes.length };
    expect(await pictureFacts('/content/media/shared/s.png', kept)).toEqual({ width: 999, height: 111, bg: 'rgb(9 9 9)', format: 'png' });
    resetPictureFacts();
    expect(await pictureFacts('/content/media/shared/s.png', { ...kept, bytes: bytes.length + 1 })).toMatchObject({ width: 40, height: 30 });
  });

  it('reads the facts sidecars keep, for their masters and dark versions', () => {
    const f = { width: 1, height: 2, bg: 'rgb(0 0 0)', bytes: 3 };
    const docs = {
      '/content/media/shared/a.json': { kind: 'image', file: 'a.webp', facts: f, dark: { file: 'a.dark.webp', facts: f } },
      '/content/media/shared/b.json': { kind: 'image', file: 'b.webp' },
      '/content/media/shared/v.json': { kind: 'video', file: 'v.mp4' },
    };
    expect([...keptFacts(docs).keys()]).toEqual(['/content/media/shared/a.webp', '/content/media/shared/a.dark.webp']);
  });

  it('warms every picture master in the background, telling its progress', async () => {
    await putMaster('shared/a.png', await png(10, 10));
    await putMaster('shared/b.png', await png(12, 10, { r: 0, g: 0, b: 255 }));
    await putMaster('shared/c.png', await png(14, 10));
    writeFileSync(join(content, 'media', 'shared', 'doc.pdf'), 'not a picture');
    const seen: number[] = [];
    expect(pictureFactsProgress()).toEqual({ done: 0, total: 0, running: false });
    const end = await warmPictureFacts((p) => seen.push(p.done), { concurrency: 2 });
    expect(end).toEqual({ done: 3, total: 3, running: false });
    expect(pictureFactsProgress()).toEqual({ done: 3, total: 3, running: false });
    expect(seen.at(-1)).toBe(3);
    expect(Object.keys(JSON.parse(readFileSync(cacheFile, 'utf8')).files)).toHaveLength(3);
  });

  it('the backfill script measures exactly as the site does, and fills each sidecar once', async () => {
    const bytes = await png(50, 20, { r: 10, g: 20, b: 30 });
    expect(await measure(bytes)).toEqual(await measureFacts(bytes));
    const rgba = Uint8Array.from({ length: 6 * 6 * 4 }, (_, i) => (i * 37) % 256);
    expect(scriptEdgeAverage(rgba, 6)).toBe(edgeAverage(rgba, 6));

    await putMaster('shared/x.png', bytes);
    await putMaster('shared/x.dark.png', await png(50, 20, { r: 1, g: 2, b: 3 }));
    const sidecar = join(content, 'media', 'shared', 'x.json');
    writeFileSync(sidecar, `${JSON.stringify({ kind: 'image', file: 'x.png', alt: 'A test picture', dark: { file: 'x.dark.png' }, visibility: 'public' }, null, 2)}\n`);
    expect(await fillFolder(join(content, 'media'))).toEqual({ pictures: 1, filled: 1, failed: 0 });
    expect(JSON.parse(readFileSync(sidecar, 'utf8')).facts).toBeUndefined();
    expect(await fillFolder(join(content, 'media'), { write: true })).toEqual({ pictures: 1, filled: 1, failed: 0 });
    const doc = JSON.parse(readFileSync(sidecar, 'utf8'));
    expect(Object.keys(doc)).toEqual(['kind', 'file', 'alt', 'dark', 'facts', 'visibility']);
    expect(doc.facts).toEqual({ width: 50, height: 20, bg: 'rgb(10 20 30)', bytes: bytes.length });
    expect(doc.dark.facts).toMatchObject({ width: 50, height: 20, bg: 'rgb(1 2 3)' });
    expect(imageMedia.safeParse(doc).success).toBe(true);
    expect(await fillFolder(join(content, 'media'), { write: true })).toEqual({ pictures: 1, filled: 0, failed: 0 });
  });

  it('the content contract takes facts as optional, and only well formed', () => {
    const base = { kind: 'image', file: 'x.webp', alt: 'A test picture', visibility: 'public' };
    expect(imageMedia.safeParse(base).success).toBe(true);
    expect(imageMedia.safeParse({ ...base, facts: { width: 2, height: 2, bg: 'rgb(1 2 3)', bytes: 10 } }).success).toBe(true);
    expect(imageMedia.safeParse({ ...base, facts: { width: 2, height: 2, bg: '#fff', bytes: 10 } }).success).toBe(false);
    expect(imageMedia.safeParse({ ...base, facts: { width: 2, height: 2, bg: 'rgb(1 2 3)' } }).success).toBe(false);
  });
});
