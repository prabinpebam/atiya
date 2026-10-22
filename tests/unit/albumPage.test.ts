import { describe, expect, it } from 'vitest';
import { badgeOf, cellHref, cellName, clockOf, entryRuns, isTextCard, levelRows, PROVIDER_NAMES, spokenLength, type AlbumCell } from '../../src/site/scripts/albumGrid';
import { albumCells, albumDateWords, albumMeasure, cellPicture, EMBED_SHAPE, itemFragment } from '../../src/site/content/albumPage';
import { renderMarkdown } from '../../src/site/content/markdown';
import { resolveAlbum, type AlbumMedia } from '../../src/site/content/album';
import { PROVIDERS, pageUrl } from '../../src/site/content/providers';
import { justifyGallery } from '../../src/site/scripts/justifiedGallery';
import type { Picture, VideoFile } from '../../src/site/content/pictures';
import type { Album } from '../../src/site/content/schema';

type Words = { caption?: string; description?: string; place?: string; taken?: string; credit?: string };
const image = (file: string, extra: Partial<Extract<AlbumMedia, { kind: 'image' }>> & Words = {}) => ({ kind: 'image' as const, file, alt: file, facts: { width: 1200, height: 800, bytes: 1 }, ...extra });
// an item's words are its library item's (spec §3.3): the sidecar holds them, never the album
const MEDIA = new Map([
  ['gallery/a/plaza', image('plaza.webp', { taken: '2026-03-12', caption: 'The plaza.', description: 'Where **every** path begins.', place: 'The plaza' })],
  ['gallery/a/loop', image('loop.gif', { animation: {}, taken: '2026-05-02T10:00:00Z' })],
  ['gallery/a/mark', image('mark.svg')],
]);
const VIDEOS = new Map([['gallery/a/tour', { kind: 'video' as const, file: 'tour.mp4', width: 960, height: 540, caption: 'Its own caption', credit: 'Someone' }]]);
const EMBEDS = new Map([
  ['gallery/a/talk', { kind: 'embed' as const, provider: 'youtube' as const, video: 'abc123', title: 'A talk', duration: 3725 }],
  ['gallery/a/short', { kind: 'embed' as const, provider: 'youtube' as const, video: 'x', title: 'Short', shape: { width: 1080, height: 1920 } }],
]);
const lookup = (id: string): AlbumMedia | undefined => MEDIA.get(id) ?? VIDEOS.get(id) ?? EMBEDS.get(id);

const pic = (id: string, extra: Partial<Picture> = {}): Picture => ({ src: `/${id}-800.webp`, srcset: `/${id}-800.webp 800w`, alt: `Alt of ${id}`, width: 1200, height: 800, full: `/${id}-1600.webp`, thumb: `/${id}-thumb.webp`, bg: '#abcdef', ...extra });
const vid = (id: string): VideoFile => ({ src: `/media/${id}.mp4`, type: 'video/mp4', width: 960, height: 540, title: 'The tour', duration: 140, caption: 'Its own caption', credit: 'Someone', poster: { src: `/${id}-poster.webp`, srcset: '', width: 960, height: 540, thumb: `/${id}-poster-thumb.webp` } });
const sources = {
  pictureOf: async (id: string) => (id.endsWith('mark') ? pic(id, { drawing: true }) : id.endsWith('loop') ? pic(id, { poster: `/${id}-still.webp` }) : pic(id, { focus: '50% 30%', largest: { src: `/${id}-2400.webp`, width: 2400 }, dark: { src: '/d.webp', srcset: '', width: 1200, height: 800, full: '/d-1600.webp', thumb: '/d-thumb.webp', bg: '#000000' } })),
  videoOf: async (id: string) => vid(id),
  posterOf: async (id: string) => pic(`${id}-poster`, { alt: 'Poster' }),
};

const ALBUM: Album = {
  description: 'A walk.',
  items: [
    { id: 'plaza', media: 'gallery/a/plaza' },
    { id: 'loop', media: 'gallery/a/loop', download: false },
    { id: 'mark', media: 'gallery/a/mark' },
    { id: 'tour', media: 'gallery/a/tour' },
    { id: 'talk', media: 'gallery/a/talk' },
    { id: 'gone', media: 'gallery/a/missing' },
  ],
  download: true,
} as Album;

const entriesOf = (album: Album) => albumCells(album, resolveAlbum(album, MEDIA, VIDEOS, EMBEDS).items, sources);
const cellsOf = async (album: Album) => (await entriesOf(album)).filter((e): e is AlbumCell => !isTextCard(e));
describe('album page: lengths and names', () => {
  it('writes a length as a clock and in words', () => {
    expect(clockOf(140)).toBe('2:20');
    expect(clockOf(59.6)).toBe('1:00');
    expect(clockOf(3725)).toBe('1:02:05');
    expect(clockOf(undefined)).toBeUndefined();
    expect(spokenLength(140)).toBe('2 minutes 20 seconds');
    expect(spokenLength(3601)).toBe('1 hour 1 second');
    expect(spokenLength(0)).toBeUndefined();
  });

  it("names a cell's link by what it shows (spec §12)", () => {
    const picture = { src: '', width: 1, height: 1, alt: 'A pond', full: '', thumb: '' };
    expect(cellName({ kind: 'picture', picture }, 0, 3)).toBe('A pond');
    expect(cellName({ kind: 'animated', picture }, 0, 3)).toBe('A pond, animated');
    expect(cellName({ kind: 'video', title: 'The tour', duration: 140 }, 0, 3)).toBe('Video: The tour, 2 minutes 20 seconds');
    expect(cellName({ kind: 'embed', title: 'A talk' }, 0, 3)).toBe('Video: A talk');
    expect(cellName({ kind: 'picture', picture: { ...picture, alt: '' }, caption: 'Its caption' }, 1, 3)).toBe('Its caption');
    expect(cellName({ kind: 'drawing' }, 1, 3)).toBe('Item 2 of 3');
  });

  it('badges videos, embeds (with their provider) and animated pictures, nothing else', () => {
    expect(badgeOf({ kind: 'picture' })).toBeUndefined();
    expect(badgeOf({ kind: 'drawing' })).toBeUndefined();
    expect(badgeOf({ kind: 'animated' })).toEqual({ icon: 'animated' });
    expect(badgeOf({ kind: 'video' })).toEqual({ icon: 'play' });
    expect(badgeOf({ kind: 'video', duration: 140 })).toEqual({ icon: 'play', words: '2:20' });
    expect(badgeOf({ kind: 'embed', embed: { provider: 'vimeo', id: '1' }, duration: 65 })).toEqual({ icon: 'play', words: 'Vimeo · 1:05' });
  });

  it("names the providers as providers.ts does", () => {
    for (const p of Object.keys(PROVIDER_NAMES) as (keyof typeof PROVIDER_NAMES)[]) expect(PROVIDER_NAMES[p]).toBe(PROVIDERS[p].name);
    expect(Object.keys(PROVIDER_NAMES).sort()).toEqual(Object.keys(PROVIDERS).sort());
  });

  it('links each cell where it works without scripts', () => {
    const picture = { src: '/s.webp', width: 1, height: 1, alt: '', full: '/full.webp', thumb: '' };
    expect(cellHref({ kind: 'picture', picture }, pageUrl)).toBe('/full.webp');
    expect(cellHref({ kind: 'video', picture, video: { src: '/v.mp4', type: 'video/mp4' } }, pageUrl)).toBe('/v.mp4');
    expect(cellHref({ kind: 'embed', picture, embed: { provider: 'youtube', id: 'abc123' } }, pageUrl)).toBe(pageUrl('youtube', 'abc123'));
  });
});

describe('album page: level rows', () => {
  const sizes = [
    { width: 1200, height: 800 },
    { width: 800, height: 1200 },
    { width: 1600, height: 900 },
    { width: 1000, height: 1000 },
    { width: 1200, height: 800 },
  ];

  it('leaves the boxes as they are without captions', () => {
    const g = justifyGallery(sizes, 1000, 200, 8);
    const level = levelRows(g.boxes, g.rows, g.height, 0);
    expect(level.height).toBe(g.height);
    level.boxes.forEach((b, i) => expect([b.top, b.height, b.block]).toEqual([g.boxes[i]!.top, g.boxes[i]!.height, g.boxes[i]!.height]));
  });

  it('makes room for a caption under every cell, keeping each row level', () => {
    const g = justifyGallery(sizes, 1000, 200, 8, { span: false });
    const room = 40;
    const level = levelRows(g.boxes, g.rows, g.height, room);
    expect(level.height).toBe(g.height + g.rows * room);
    for (const b of level.boxes) {
      const box = g.boxes[b.index]!;
      expect(b.top).toBe(box.top + box.row * room);
      expect(b.block).toBe(b.height + room);
    }
    // the cells of a row share a top and a bottom
    const rows = new Map<number, number[]>();
    for (const b of level.boxes) rows.set(b.top, [...(rows.get(b.top) ?? []), b.top + b.block]);
    for (const bottoms of rows.values()) expect(new Set(bottoms.map((n) => n.toFixed(3))).size).toBe(1);
    // and no row overlaps the one below it
    const tops = [...rows.keys()].sort((a, b) => a - b);
    tops.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(tops[i]! + room));
  });
});

describe('album page: cells', () => {
  it('turns every item into a cell, in album order, leaving out one whose media is gone', async () => {
    const cells = await cellsOf(ALBUM);
    expect(cells.map((c) => [c.id, c.kind])).toEqual([
      ['plaza', 'picture'],
      ['loop', 'animated'],
      ['mark', 'drawing'],
      ['tour', 'video'],
      ['talk', 'embed'],
    ]);
  });

  it("gives a picture its largest size, focus, dark version, words and date", async () => {
    const [plaza] = await cellsOf(ALBUM);
    expect(plaza!.picture).toMatchObject({ alt: 'Alt of gallery/a/plaza', full: '/gallery/a/plaza-2400.webp', focus: '50% 30%', dark: { src: '/d.webp', full: '/d-1600.webp', thumb: '/d-thumb.webp' } });
    expect(plaza!.picture!.srcset).toBeTruthy();
    expect(plaza).toMatchObject({ caption: 'The plaza.', place: 'The plaza', taken: '2026-03-12', takenWords: '12 March 2026', download: '/gallery/a/plaza-2400.webp' });
    expect(plaza!.description).toContain('<strong>every</strong>');
  });

  it("keeps an animated picture's still and a drawing's flag, and an item's own download choice", async () => {
    const [, loop, mark] = await cellsOf(ALBUM);
    expect(loop!.picture!.poster).toBe('/gallery/a/loop-still.webp');
    expect(loop!.download).toBeUndefined();
    expect(loop!.takenWords).toBe('2 May 2026');
    expect(mark!.picture!.drawing).toBe(true);
    expect(mark!.taken).toBeUndefined();
  });

  it("shows a video by its poster, with its title, length, caption and credit", async () => {
    const tour = (await cellsOf(ALBUM))[3]!;
    expect(tour).toMatchObject({ width: 960, height: 540, video: { src: '/media/gallery/a/tour.mp4', type: 'video/mp4' }, title: 'The tour', duration: 140, caption: 'Its own caption', credit: 'Someone', download: '/media/gallery/a/tour.mp4' });
    expect(tour.picture).toMatchObject({ src: '/gallery/a/tour-poster.webp', alt: '' });
  });

  it('shows an embed by its poster, 16:9 unless its shape is given, never offered for download', async () => {
    const talk = (await cellsOf(ALBUM))[4]!;
    expect(talk).toMatchObject({ ...EMBED_SHAPE, embed: { provider: 'youtube', id: 'abc123' }, title: 'A talk', duration: 3725 });
    expect(talk.picture).toMatchObject({ src: '/gallery/a/talk-poster-800.webp', alt: '' });
    expect(talk.download).toBeUndefined();
    const shaped = { ...ALBUM, items: [{ id: 'short', media: 'gallery/a/short' }] } as Album;
    expect((await cellsOf(shaped))[0]).toMatchObject({ width: 1080, height: 1920 });
  });

  it('keeps a text card in its place as words, and the cells between text cards as runs', async () => {
    const album = { ...ALBUM, order: 'custom', items: [ALBUM.items[0]!, { id: 'note', text: 'Then **the** walk.' }, ALBUM.items[2]!, ALBUM.items[3]!] } as Album;
    const entries = await entriesOf(album);
    expect(entries.map((e) => [e.id, e.kind])).toEqual([['plaza', 'picture'], ['note', 'text'], ['mark', 'drawing'], ['tour', 'video']]);
    const note = entries[1]!;
    expect(isTextCard(note) && note.html).toContain('<strong>the</strong>');
    expect(entryRuns(entries).map((r) => ('text' in r ? 'text' : r.cells.map((c) => c.id).join(',')))).toEqual(['plaza', 'text', 'mark,tour']);
  });

  it('leaves the dates and downloads out when the album hides them', async () => {
    const cells = await cellsOf({ ...ALBUM, dates: false, download: undefined } as Album);
    expect(cells.every((c) => !c.taken && !c.takenWords)).toBe(true);
    expect(cells.every((c) => !c.download)).toBe(true);
  });

  it('turns a picture into a cell picture without its dark version when it has none', () => {
    const p = cellPicture(pic('x'), '');
    expect(p).toMatchObject({ alt: '', full: '/x-1600.webp', bg: '#abcdef' });
    expect(p.dark).toBeUndefined();
    expect('drawing' in p).toBe(false);
  });
});

describe('album page: the opening', () => {
  it('counts what the album holds in words', () => {
    expect(albumMeasure(ALBUM, lookup)).toBe('2 pictures, 2 videos, 1 drawing');
    expect(albumMeasure({ items: [] }, lookup)).toBe('');
  });

  it("spans the days the items were taken, or falls back to the page's day", () => {
    expect(albumDateWords(ALBUM, lookup, '2026-06-01')).toBe('March to May 2026');
    expect(albumDateWords({ ...ALBUM, dates: false }, lookup, '2026-06-01')).toBe('1 June 2026');
    expect(albumDateWords({ items: [] }, lookup)).toBeUndefined();
  });
});

describe('album page: links to its own items', () => {
  const album = { items: [{ id: 'plan', media: 'articles/a/plan' }] } as unknown as Album;
  it('links to an item the album has, and only to one it has', () => {
    expect(renderMarkdown('See [the plan](#item-plan).', { fragment: itemFragment(album) })).toContain('<a href="#item-plan">the plan</a>');
    expect(() => renderMarkdown('See [it](#item-gone).', { fragment: itemFragment(album) })).toThrow(/an item of this album/);
    expect(() => renderMarkdown('See [the plan](#item-plan).')).toThrow(/links may only go/);
  });
});

