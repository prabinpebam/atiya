import { describe, expect, it } from 'vitest';
import {
  counterText,
  downloadable,
  downloadLabel,
  downloadName,
  entryState,
  extOf,
  fullOf,
  groupFrom,
  historyMode,
  idFromHash,
  isEntry,
  itemFrom,
  itemHash,
  itemIdOf,
  ring,
  thumbName,
  thumbOf,
  viewerName,
  warmable,
  warmOrder,
  weight,
  WARM_REACH,
  WARM_WHOLE,
  HISTORY_KEY,
  type LightboxItem,
  albumUrlOf,
  bandFallback,
  bandGroup,
  fromAlbum,
  infoKept,
  itemAddress,
  largestWidth,
  lengthWords,
  pendingItem,
  posterOf,
  seeAllWords,
  fileSlug,
  stageKind,
  stageOf,
  stillOf,
  takenLine,
  tracksFrom,
  watchOn,
} from '../../src/site/scripts/lightboxRules';

const item = (over: Partial<LightboxItem> = {}): LightboxItem => ({ href: '/a.webp', thumb: '/a-t.webp', caption: '', alt: '', shadow: false, kind: 'picture', ...over });

describe('lightbox rules: an item from its link', () => {
  it('reads the data attributes', () => {
    const it1 = itemFrom({
      href: 'https://x.test/full.webp',
      data: { lightbox: 'article', thumb: '/t.webp', fullDark: '/full.dark.webp', thumbDark: '/t.dark.webp', caption: 'A harbour', alt: 'Boats', shadow: '', kind: 'drawing', albumTitle: 'Summer sketches' },
    });
    expect(it1).toEqual({
      href: 'https://x.test/full.webp',
      thumb: '/t.webp',
      hrefDark: '/full.dark.webp',
      thumbDark: '/t.dark.webp',
      caption: 'A harbour',
      alt: 'Boats',
      shadow: true,
      kind: 'drawing',
      id: undefined,
      albumTitle: 'Summer sketches',
    });
  });

  it('falls back to the picture inside, then the link, and to a picture with no shadow', () => {
    const a = itemFrom({ href: '/f.webp', data: {}, img: { src: '/shown.webp', alt: 'Shown' } });
    expect(a).toMatchObject({ thumb: '/shown.webp', alt: 'Shown', caption: '', shadow: false, kind: 'picture', hrefDark: undefined });
    expect(itemFrom({ href: '/f.webp', data: {} }).thumb).toBe('/f.webp');
    expect(itemFrom({ href: '/f.webp', data: { kind: 'sound' } }).kind).toBe('picture');
  });

  it("takes the album item's ID from data-item-id, else the cell's item-<id>", () => {
    expect(itemIdOf('abc', 'item-xyz')).toBe('abc');
    expect(itemIdOf(undefined, 'item-xyz')).toBe('xyz');
    expect(itemIdOf(undefined, 'figure-1')).toBeUndefined();
    expect(itemIdOf(undefined, undefined)).toBeUndefined();
    expect(itemFrom({ href: '/f', data: {}, cellId: 'item-h7' }).id).toBe('h7');
  });

  it('shows the dark version only while the page is dark, and only if there is one', () => {
    const d = item({ hrefDark: '/a.dark.webp', thumbDark: '/a-t.dark.webp' });
    expect(fullOf(d, true)).toBe('/a.dark.webp');
    expect(fullOf(d, false)).toBe('/a.webp');
    expect(thumbOf(d, true)).toBe('/a-t.dark.webp');
    expect(fullOf(item(), true)).toBe('/a.webp');
    expect(thumbOf(item(), true)).toBe('/a-t.webp');
  });
});

describe('lightbox rules: the group', () => {
  it('is every link in the same group, in page order, and where the opened one is', () => {
    const links = [{ group: 'a', n: 1 }, { group: 'b', n: 2 }, { group: 'a', n: 3 }, { group: 'a', n: 4 }];
    const { members, index } = groupFrom(links, links[2]);
    expect(members.map((m) => m.n)).toEqual([1, 3, 4]);
    expect(index).toBe(1);
  });

  it('the empty group name is a group too', () => {
    const links = [{ group: '' }, { group: 'x' }, { group: '' }];
    expect(groupFrom(links, links[2])).toEqual({ members: [links[0], links[2]], index: 1 });
  });
});

describe('lightbox rules: warming', () => {
  it('measures distance round the ring', () => {
    expect(ring(0, 5, 6)).toBe(1);
    expect(ring(1, 4, 6)).toBe(3);
    expect(ring(2, 2, 6)).toBe(0);
  });

  it(`warms a group of ${WARM_WHOLE} or fewer whole, nearest first (the next before the previous)`, () => {
    expect(warmOrder(2, 6)).toEqual([2, 3, 1, 4, 0, 5]);
    expect(warmOrder(0, 1)).toEqual([0]);
    const whole = warmOrder(10, WARM_WHOLE);
    expect(whole).toHaveLength(WARM_WHOLE);
    expect(new Set(whole).size).toBe(WARM_WHOLE);
    expect(whole.slice(0, 3)).toEqual([10, 11, 9]);
  });

  it(`warms ${WARM_REACH} either side of the item shown in a larger group, wrapping`, () => {
    expect(warmOrder(10, 25)).toEqual([10, 11, 9, 12, 8, 13, 7, 14, 6]);
    expect(warmOrder(0, 200)).toEqual([0, 1, 199, 2, 198, 3, 197, 4, 196]);
    expect(warmOrder(0, 0)).toEqual([]);
  });

  it('warms pictures only, never a sealed file, a video or an embed', () => {
    expect(warmable(item(), '/a.webp')).toBe(true);
    expect(warmable(item({ kind: 'drawing' }), '/a.svg')).toBe(true);
    expect(warmable(item({ kind: 'animated' }), '/a.webp')).toBe(true);
    expect(warmable(item(), '/atiya/_sealed/b1/x.bin')).toBe(false);
    expect(warmable(item({ kind: 'video' }), '/v.mp4')).toBe(false);
    expect(warmable(item({ kind: 'embed' }), '/poster.webp')).toBe(false);
    expect(warmable(item(), '')).toBe(false);
  });
});

describe('lightbox rules: history', () => {
  it("adds the item's address on the album page, a state elsewhere, and nothing in the planet's frame", () => {
    expect(historyMode({ inFrame: false, group: 'album', id: 'h7' })).toBe('hash');
    expect(historyMode({ inFrame: false, group: 'album' })).toBe('state');
    expect(historyMode({ inFrame: false, group: 'article', id: 'h7' })).toBe('state');
    expect(historyMode({ inFrame: true, group: 'album', id: 'h7' })).toBe('none');
    expect(historyMode({ inFrame: true, group: 'article' })).toBe('none');
  });

  it('writes and reads #item-<id>', () => {
    expect(itemHash('h7')).toBe('#item-h7');
    expect(idFromHash('#item-h7')).toBe('h7');
    expect(idFromHash(itemHash('a-b-c'))).toBe('a-b-c');
    expect(idFromHash('#item-%C3%A9t%C3%A9')).toBe('été');
    expect(idFromHash('#item-%E0%A4')).toBe('%E0%A4');
    expect(idFromHash('#item-')).toBeNull();
    expect(idFromHash('#figure-2')).toBeNull();
    expect(idFromHash('')).toBeNull();
  });

  it("keeps the router's state in its entry, marked as the lightbox's", () => {
    const s = entryState({ index: 3, scrollX: 0, scrollY: 120 });
    expect(s).toEqual({ index: 3, scrollX: 0, scrollY: 120, [HISTORY_KEY]: true });
    expect(entryState(null)).toEqual({ [HISTORY_KEY]: true });
    expect(isEntry(s)).toBe(true);
    expect(isEntry({ index: 3 })).toBe(false);
    expect(isEntry(null)).toBe(false);
  });
});

describe('lightbox rules: words', () => {
  it("names the viewer by the album, else 'Image viewer'", () => {
    expect(viewerName('Summer sketches')).toBe('Summer sketches, album viewer');
    expect(viewerName()).toBe('Image viewer');
    expect(viewerName('')).toBe('Image viewer');
  });

  it('counts from 1', () => {
    expect(counterText(2, 21)).toBe('3 of 21');
    expect(counterText(0, 1)).toBe('1 of 1');
  });

  it("names the filmstrip's thumbnails: an album's by number and kind, any other group's as before", () => {
    expect(thumbName(6, { alt: 'The harbour at low tide', kind: 'picture' }, true)).toBe('Show 7: The harbour at low tide');
    expect(thumbName(6, { alt: 'The harbour', kind: 'video' }, true)).toBe('Show 7: The harbour (video)');
    expect(thumbName(6, { alt: 'A walk', kind: 'embed' }, true)).toBe('Show 7: A walk (video)');
    expect(thumbName(0, { alt: 'Rain', kind: 'animated' }, true)).toBe('Show 1: Rain (animated)');
    expect(thumbName(0, { alt: '', kind: 'drawing' }, true)).toBe('Show 1');
    expect(thumbName(1, { alt: 'Boats', kind: 'picture' }, false)).toBe('Show picture 2: Boats');
    expect(thumbName(1, { alt: '', kind: 'picture' }, false)).toBe('Show picture 2');
  });

  it("says a file's weight", () => {
    expect(weight(2_100_000)).toBe('2.1 MB');
    expect(weight(12_400_000)).toBe('12 MB');
    expect(weight(640_000)).toBe('640 KB');
    expect(weight(12)).toBe('1 KB');
  });

  it("labels Download with the file's kind and weight", () => {
    expect(downloadLabel('picture', 2_100_000)).toBe('Download picture, 2.1 MB');
    expect(downloadLabel('drawing', 48_000)).toBe('Download drawing, 48 KB');
    expect(downloadLabel('animated')).toBe('Download animated picture');
    expect(downloadLabel('video', 31_000_000)).toBe('Download video, 31 MB');
  });

  it('offers Download where the item or else the album allows it, never for an embed', () => {
    expect(downloadable('picture', true, undefined)).toBe(true);
    expect(downloadable('picture', true, false)).toBe(false);
    expect(downloadable('picture', false, true)).toBe(true);
    expect(downloadable('picture', undefined, undefined)).toBe(false);
    expect(downloadable('embed', true, true)).toBe(false);
  });

  it('names the file <album slug>-<item id>.<ext>, from the published file', () => {
    expect(extOf('/atiya/media/h7-3840.webp')).toBe('webp');
    expect(extOf('https://x.test/m/h7.SVG?v=2#x')).toBe('svg');
    expect(extOf('/m/noext')).toBe('');
    expect(extOf('/m.d/noext')).toBe('');
    expect(downloadName('summer-sketches', 'h7', '/atiya/media/h7-3840.webp')).toBe('summer-sketches-h7.webp');
    expect(downloadName('summer-sketches', 'k2', '/media/k2.mp4')).toBe('summer-sketches-k2.mp4');
    expect(downloadName('summer-sketches', 'k2', 'blob:https://x.test/1234')).toBe('summer-sketches-k2');
    expect(downloadName('summer-sketches', 'k2', 'blob:https://x.test/1234', 'webp')).toBe('summer-sketches-k2.webp');
  });
});

describe('the stage', () => {
  it('shows the stage size of a large picture, its dark version while dark', () => {
    const big = item({ href: '/big-3840.webp', stage: '/big-2560.webp', hrefDark: '/big.dark.webp' });
    expect(stageOf(big, false)).toBe('/big-2560.webp');
    expect(stageOf(big, true)).toBe('/big.dark.webp');
    expect(stageOf(item(), false)).toBe('/a.webp');
  });

  it('picks posters and stills by the theme', () => {
    const v = item({ poster: '/p.webp', posterDark: '/p.dark.webp', still: '/s.webp' });
    expect(posterOf(v, true)).toBe('/p.dark.webp');
    expect(posterOf(v, false)).toBe('/p.webp');
    expect(stillOf(v, true)).toBe('/s.webp');
    expect(posterOf(item(), false)).toBeUndefined();
  });

  it('shows what it cannot play as a picture, and a pending place as pending', () => {
    expect(stageKind(item({ kind: 'video' }))).toBe('picture');
    expect(stageKind(item({ kind: 'video', videoType: 'video/mp4' }))).toBe('video');
    expect(stageKind(item({ kind: 'embed' }))).toBe('picture');
    expect(stageKind(item({ kind: 'embed', embedSrc: 'https://www.youtube-nocookie.com/embed/x' }))).toBe('embed');
    expect(stageKind(item({ kind: 'drawing' }))).toBe('drawing');
    expect(stageKind(pendingItem())).toBe('pending');
  });

  it('zooms up to the kept-large width, else the full width', () => {
    expect(largestWidth({ width: 5000, stage: '/s.webp' })).toBe(3840);
    expect(largestWidth({ width: 5000 })).toBe(2560);
    expect(largestWidth({ width: 1200 })).toBe(1200);
    expect(largestWidth({})).toBe(0);
  });

  it('reads caption tracks, and ignores what is not a list of tracks', () => {
    expect(tracksFrom('[{"src":"/c.vtt","srclang":"en","label":"English","default":true}]')).toEqual([{ src: '/c.vtt', srclang: 'en', label: 'English', default: true }]);
    expect(tracksFrom('{"src":"/c.vtt"}')).toBeUndefined();
    expect(tracksFrom('[{"src":1}]')).toBeUndefined();
    expect(tracksFrom('not json')).toBeUndefined();
    expect(tracksFrom(undefined)).toBeUndefined();
  });

  it('reads an album link’s new facts', () => {
    const it2 = itemFrom({
      href: '/v.mp4',
      data: { kind: 'video', videoType: 'video/mp4', loop: '', duration: '94', tracks: '[{"src":"/c.vtt","srclang":"en","label":"English"}]', poster: '/p.webp', stage: '/s.webp', embedSrc: '' },
      cellId: 'item-clip',
      cellWidth: '1920',
      cellHeight: '1080',
      words: { credit: 'Me' },
    });
    expect(it2).toMatchObject({ kind: 'video', videoType: 'video/mp4', loop: true, duration: 94, poster: '/p.webp', stage: '/s.webp', id: 'clip', width: 1920, height: 1080, words: { credit: 'Me' } });
    expect(it2.tracks).toHaveLength(1);
    expect(it2.embedSrc).toBeUndefined();
    expect(itemFrom({ href: '/a.webp', data: { duration: 'x' } }).duration).toBeUndefined();
  });

  it('never warms a pending place', () => {
    expect(warmable(pendingItem(), '/a.webp')).toBe(false);
  });
});

describe('a band’s group', () => {
  const a = item({ href: '/a.webp', id: 'a', albumTitle: 'Spring' });
  const b = item({ href: '/b.webp', id: 'b' });
  const c = item({ href: '/c.webp', id: 'c' });

  it('places its tiles in the whole album, with placeholders between', () => {
    const g = bandGroup([{ item: a, index: 0 }, { item: b, index: 3 }, { item: c, index: 6 }], 1, 7);
    expect(g.items).toHaveLength(7);
    expect(g.index).toBe(3);
    expect(g.items[0]).toBe(a);
    expect(g.items[3]).toBe(b);
    expect(g.items[1].pending).toBe(true);
    expect(g.items[1].albumTitle).toBe('Spring');
  });

  it('falls back to the tiles in album order without a count or a place, or with a place past the count', () => {
    const members = [{ item: c, index: 6 }, { item: a, index: 0 }, { item: b, index: 3 }];
    expect(bandGroup(members, 0, undefined)).toEqual({ items: [a, b, c], index: 2 });
    expect(bandGroup([{ item: a }, { item: b, index: 1 }], 1, 5)).toEqual({ items: [a, b], index: 1 });
    expect(bandGroup([{ item: a, index: 9 }], 0, 3).items).toEqual([a]);
    expect(bandFallback([{ item: b }, { item: a }], 1)).toEqual({ items: [b, a], index: 1 });
  });
});

describe('addresses and words', () => {
  it('names the album page, its file name’s slug (from its title, never its address) and an item’s address', () => {
    expect(albumUrlOf('/atiya/gallery/spring/#item-p01')).toBe('/atiya/gallery/spring/');
    expect(fileSlug('A spring in the hills')).toBe('a-spring-in-the-hills');
    expect(fileSlug('Dzükou, in June!')).toBe('dzukou-in-june');
    expect(fileSlug('  ')).toBe('album');
    expect(fileSlug(undefined)).toBe('album');
    expect(itemAddress('https://example.com/gallery/spring/#item-a', 'p02')).toBe('https://example.com/gallery/spring/#item-p02');
    expect(seeAllWords(21)).toBe('See all 21 in the album');
  });

  it('keeps the info panel open only when it was left open', () => {
    expect(infoKept('open')).toBe(true);
    expect(infoKept('closed')).toBe(false);
    expect(infoKept(null)).toBe(false);
  });

  it('writes the day taken and the place', () => {
    expect(takenLine('12 March 2026', 'Shillong')).toBe('Taken 12 March 2026, Shillong');
    expect(takenLine('12 March 2026', undefined)).toBe('Taken 12 March 2026');
    expect(takenLine(undefined, 'Shillong')).toBe('Taken in Shillong');
    expect(takenLine(undefined, undefined)).toBe('');
  });

  it('names the album, the provider and the length', () => {
    expect(fromAlbum('Spring')).toBe('From the album: Spring');
    expect(watchOn('https://www.youtube.com/watch?v=x')).toBe('Watch on YouTube');
    expect(watchOn('https://youtu.be/x')).toBe('Watch on YouTube');
    expect(watchOn('https://vimeo.com/1')).toBe('Watch on Vimeo');
    expect(watchOn('https://example.com/v')).toBe('Watch at the source');
    expect(watchOn('nonsense')).toBe('Watch at the source');
    expect(lengthWords(94)).toBe('Length 1:34');
    expect(lengthWords(3725)).toBe('Length 1:02:05');
    expect(lengthWords(0)).toBe('');
    expect(lengthWords(undefined)).toBe('');
  });
});