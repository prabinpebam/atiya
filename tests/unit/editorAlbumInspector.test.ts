import { describe, expect, it } from 'vitest';
import { libraryWords, parseSelected, pickSelected, selectedParam, selectionSummary, shared, sharedChange, sharedWords, SELECTED_MAX, type ItemWords } from '../../src/site/editor/model/albumInspector';
import type { AlbumMedia } from '../../src/site/content/album';
import type { AlbumItem } from '../../src/site/content/schema';

const media: Record<string, AlbumMedia> = {
  a: { kind: 'image', file: 'a.webp' },
  b: { kind: 'image', file: 'b.webp' },
  v: { kind: 'video', file: 'v.mp4', width: 16, height: 9 },
  e: { kind: 'embed', provider: 'youtube' },
  d: { kind: 'image', file: 'd.svg' },
};
const lookup = (id: string) => media[id];
const items = [
  { id: 'i1', media: 'a' },
  { id: 'i2', media: 'b', download: true },
  { id: 'i3', media: 'v', download: false },
  { id: 'i4', media: 'e' },
  { id: 'i5', text: 'Hello' },
  { id: 'i6', media: 'd' },
  { id: 'i7', media: 'gone' },
] as unknown as AlbumItem[];
const album = { items };

describe('the inspector selection in the address', () => {
  it('keeps only the album’s items, each once, in order', () => {
    expect(parseSelected('i3, i1,nope,i3,,i5', album)).toEqual(['i3', 'i1', 'i5']);
  });
  it('is empty without a parameter', () => {
    expect(parseSelected(null, album)).toEqual([]);
    expect(parseSelected('', album)).toEqual([]);
  });
  it('is capped', () => {
    const many = { items: Array.from({ length: SELECTED_MAX + 20 }, (_, i) => ({ id: `x${i}`, media: 'a' })) as unknown as AlbumItem[] };
    expect(parseSelected(many.items.map((i) => i.id).join(','), many)).toHaveLength(SELECTED_MAX);
  });
  it('round-trips', () => {
    expect(parseSelected(selectedParam(['i2', 'i1']), album)).toEqual(['i2', 'i1']);
    expect(selectedParam([])).toBe('');
  });
});

describe('what several items share', () => {
  it('none when none has a value', () => expect(shared([undefined, '', ' '])).toEqual({ state: 'none' }));
  it('the same value', () => expect(shared(['Goa', 'Goa '])).toEqual({ state: 'same', value: 'Goa' }));
  it('mixed when they differ, or only some have one', () => {
    expect(shared(['Goa', 'Pune'])).toEqual({ state: 'mixed' });
    expect(shared(['Goa', undefined])).toEqual({ state: 'mixed' });
  });
});

describe('a selection’s summary', () => {
  it('counts by kind, text cards too', () => {
    const s = selectionSummary(album, ['i1', 'i3', 'i5', 'i6'], lookup);
    expect(s.count).toBe(4);
    expect(s.words).toBe('1 picture, 1 video, 1 drawing, 1 text card');
    expect(s.media).toEqual(['a', 'v', 'd']);
  });
  it('downloads: the same for all, or mixed, or none can', () => {
    expect(selectionSummary(album, ['i1', 'i6'], lookup).download).toBe('follow');
    expect(selectionSummary(album, ['i2'], lookup).download).toBe('allow');
    expect(selectionSummary(album, ['i1', 'i3'], lookup).download).toBe('mixed');
    expect(selectionSummary(album, ['i4', 'i5', 'i7'], lookup).download).toBeNull();
  });
  it('leaves out items the album no longer has', () => {
    const s = selectionSummary(album, ['i1', 'nope'], lookup);
    expect(s.count).toBe(1);
  });
  it('names items whose library item is missing by their number', () => {
    expect(selectionSummary(album, ['i7'], lookup).words).toBe('1 item');
  });
});

describe('the Media screen’s picked items in the address', () => {
  it('keeps only those the library knows, each once, in order', () => {
    expect(pickSelected('b, a,zz,b', (id) => id in media)).toEqual(['b', 'a']);
    expect(pickSelected(undefined, () => true)).toEqual([]);
  });
});

describe('several items’ words', () => {
  const words: Record<string, ItemWords> = {
    a: { caption: 'Pond', alt: 'A pond', taken: '2026-05-03', place: 'Goa' },
    b: { caption: 'Bridge', alt: 'A pond', taken: '2026-05-03', place: 'Goa' },
    v: { kind: 'video', caption: 'Pond', taken: '2026-05-03' },
    e: { kind: 'embed' },
  };
  const of = (id: string) => words[id];
  it('what they share, what differs and what none has', () => {
    expect(sharedWords(['a', 'b'], of)).toEqual({
      caption: { state: 'mixed' },
      description: { state: 'none' },
      alt: { state: 'same', value: 'A pond' },
      taken: { state: 'same', value: '2026-05-03' },
      place: { state: 'same', value: 'Goa' },
    });
  });
  it('a video’s or a linked video’s missing alt text doesn’t count', () => {
    expect(sharedWords(['a', 'v', 'e'], of).alt).toEqual({ state: 'same', value: 'A pond' });
    expect(sharedWords(['a', 'v'], of).place).toEqual({ state: 'mixed' });
  });
  it('an item without words has none', () => expect(sharedWords(['gone', 'e'], of).caption).toEqual({ state: 'none' }));
});

describe('a value typed for several', () => {
  it('left empty over values that differ, or none: nothing changes', () => {
    expect(sharedChange('caption', '', 'mixed', 3)).toEqual({ act: 'skip' });
    expect(sharedChange('caption', '', 'none', 3)).toEqual({ act: 'skip' });
  });
  it('emptied where they all had the same: cleared on all', () => expect(sharedChange('caption', '', 'same', 3)).toEqual({ act: 'set' }));
  it('over values that differ: asks first', () => {
    const r = sharedChange('place', 'Goa', 'mixed', 4);
    expect(r.act).toBe('ask');
    expect(r.act === 'ask' && r.question).toBe('They have different places. Set this one on all 4?');
  });
  it('one alt text for several: always asks, even where none had any', () => {
    const r = sharedChange('alt', 'A pond', 'none', 2);
    expect(r.act).toBe('ask');
    expect(r.act === 'ask' && r.question).toMatch(/screen reader hears the same words/);
    expect(sharedChange('alt', '', 'mixed', 2)).toEqual({ act: 'skip' });
  });
  it('where none had one, or all had the same: set', () => {
    expect(sharedChange('caption', 'Pond', 'none', 3)).toEqual({ act: 'set' });
    expect(sharedChange('taken', '2026-05-04', 'same', 3)).toEqual({ act: 'set' });
  });
});

describe('several library items in words', () => {
  it('counts them by kind', () => expect(libraryWords(['a', 'b', 'v'], lookup)).toMatch(/^2 pictures, 1 video$/));
  it('names those it can’t find by their number', () => expect(libraryWords(['gone', 'zz'], lookup)).toBe('2 items'));
});
