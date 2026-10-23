import { describe, expect, it } from 'vitest';
import type { SiteStructure } from '../../src/site/content/schema';
import { chosenGallery, galleries, galleryLine, nudged, rowLine, withAlbumsInOrder, withGallerySettings, withOwnOrder } from '../../src/site/editor/model/gallery';

const structure = (): SiteStructure =>
  ({
    home: {
      kind: 'hub',
      id: 'home',
      title: 'Home',
      slug: '',
      children: [
        { kind: 'hub', id: 'work', title: 'Work', slug: 'work', view: 'list', children: [] },
        { kind: 'hub', id: 'gallery', title: 'Gallery', slug: 'gallery', view: 'albums', menuTitle: 'Photos', children: [] },
        { kind: 'hub', id: 'travel', title: 'Travel', slug: 'travel', view: 'albums', albumOrder: 'oldest', summary: 'Away', children: [] },
      ],
    },
    menus: { primary: [] },
  }) as unknown as SiteStructure;

const hub = (s: SiteStructure | undefined, id: string) => (s?.home.children ?? []).find((c) => c.id === id) as unknown as Record<string, unknown>;

describe('the gallery in edit mode (gallery spec §9.1, §9.2)', () => {
  it('finds the sections that show albums, newest first by default', () => {
    const all = galleries(structure());
    expect(all.map((g) => [g.id, g.order, g.path])).toEqual([
      ['gallery', 'newest', '/gallery/'],
      ['travel', 'oldest', '/travel/'],
    ]);
    expect(chosenGallery(all, 'travel')?.id).toBe('travel');
    expect(chosenGallery(all, 'nope')?.id).toBe('gallery');
    expect(chosenGallery([], null)).toBeUndefined();
  });

  it('puts the albums in a new order in the places albums held, the pages kept where they were', () => {
    expect(withAlbumsInOrder(['a1', 'p1', 'a2', 'a3'], ['a3', 'a1', 'a2'])).toEqual(['a3', 'p1', 'a1', 'a2']);
    // an order naming only some of them: the others keep their places
    expect(withAlbumsInOrder(['a1', 'a2'], ['a1'])).toEqual(['a1', 'a2']);
    expect(withAlbumsInOrder(['a1', 'a2'], ['a1', 'x'])).toBeUndefined();
  });

  it('moves an album one place, never past either end', () => {
    expect(nudged(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(nudged(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(nudged(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c']);
  });

  it('saves the setup, leaving newest first out of the file and keeping every other field', () => {
    const s = withGallerySettings(structure(), 'travel', { title: ' Journeys ', summary: '  ', order: 'newest' });
    const t = hub(s, 'travel');
    expect(t.title).toBe('Journeys');
    expect('summary' in t).toBe(false);
    expect('albumOrder' in t).toBe(false);
    expect(t.view).toBe('albums');
    const g = hub(withGallerySettings(structure(), 'gallery', { title: 'Gallery', summary: 'Mine', order: 'custom' }), 'gallery');
    expect(g).toMatchObject({ summary: 'Mine', albumOrder: 'custom', menuTitle: 'Photos' });
    expect(withGallerySettings(structure(), 'nope', { title: 'x', order: 'newest' })).toBeUndefined();
  });

  it('a drag makes the order your own', () => {
    expect(hub(withOwnOrder(structure(), 'gallery'), 'gallery').albumOrder).toBe('custom');
    expect(withOwnOrder(structure(), 'nope')).toBeUndefined();
  });

  it('says what a row and the gallery entry hold', () => {
    expect(rowLine({ draft: true, private: true, count: '3 pictures' })).toBe('Draft · Private · 3 pictures');
    expect(rowLine({ draft: false, private: false, count: '' })).toBe('Empty');
    expect(galleryLine(galleries(structure())[0]!, 1)).toBe('Newest first · 1 album');
    expect(galleryLine(galleries(structure())[1]!, 4)).toBe('Oldest first · 4 albums');
  });
});
