/**
 * Pictures remembered in dev (documentation/engineering/performance-report.md R7): a picture worked out
 * once per master, slot and rules, and again when its master (or poster) is replaced or touched.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { resetPictureFacts } from '../../src/site/content/pictureFacts';

const getImage = vi.fn(async ({ src, width }: { src: { src: string }; width: number }) => ({ src: `${src.src}&w=${width}` }));
vi.mock('astro:assets', () => ({ getImage: (o: { src: { src: string }; width: number }) => getImage(o) }));
const media = new Map<string, Record<string, unknown>>();
vi.mock('../../src/site/content/repository', () => ({
  getMedia: (id: string) => media.get(id),
  getVideo: () => undefined,
  videoHref: () => '',
}));

const { picture, pictureMemoKey } = await import('../../src/site/content/pictures');

const ROOT = join(__dirname, '../..');
const SCRATCH = join(ROOT, 'node_modules', '.cache', 'unit-picture-memo');
mkdirSync(SCRATCH, { recursive: true });
let dir: string;
let master: string;
const saved = { content: process.env.CONTENT_ROOT, facts: process.env.SITE_PICTURE_FACTS };

beforeEach(async () => {
  dir = mkdtempSync(join(SCRATCH, 'm-'));
  process.env.CONTENT_ROOT = join(dir, 'content');
  process.env.SITE_PICTURE_FACTS = join(dir, 'facts.json');
  master = join(dir, 'content', 'media', 'shared', 'p.png');
  mkdirSync(join(master, '..'), { recursive: true });
  writeFileSync(master, await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer());
  media.set('shared/p', { id: 'shared/p', kind: 'image', file: 'p.png', alt: 'P', master: '/content/media/shared/p.png', visibility: 'public' });
  resetPictureFacts();
  (globalThis as { __sitePictureMemo?: Map<string, unknown> }).__sitePictureMemo?.clear();
  getImage.mockClear();
});
afterEach(() => {
  for (const [k, v] of [['CONTENT_ROOT', saved.content], ['SITE_PICTURE_FACTS', saved.facts]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});
afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe('pictures remembered', () => {
  it('works a picture out once per slot, and again when its master changes', async () => {
    const first = await picture('shared/p', 'card');
    const calls = getImage.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(first.bg).toBe('rgb(1 2 3)');
    const again = await picture('shared/p', 'card');
    expect(getImage.mock.calls.length).toBe(calls);
    expect(again).toEqual(first);
    expect(again).not.toBe(first);

    // another slot is another picture
    await picture('shared/p', 'content');
    const withContent = getImage.mock.calls.length;
    expect(withContent).toBeGreaterThan(calls);

    // the master replaced (its time moves): worked out again
    const key = pictureMemoKey('/content/media/shared/p.png', 'card');
    const t = statSync(master).mtime;
    utimesSync(master, t, new Date(t.getTime() + 5000));
    expect(pictureMemoKey('/content/media/shared/p.png', 'card')).not.toBe(key);
    await picture('shared/p', 'card');
    expect(getImage.mock.calls.length).toBeGreaterThan(withContent);
  });

  it('shares one working out between pictures asked for at once', async () => {
    await Promise.all([picture('shared/p', 'card'), picture('shared/p', 'card'), picture('shared/p', 'card')]);
    const once = getImage.mock.calls.length;
    getImage.mockClear();
    (globalThis as { __sitePictureMemo?: Map<string, unknown> }).__sitePictureMemo?.clear();
    await picture('shared/p', 'card');
    expect(getImage.mock.calls.length).toBe(once);
  });
});
