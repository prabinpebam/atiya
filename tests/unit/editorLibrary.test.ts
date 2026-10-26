import { describe, expect, it } from 'vitest';
import { deleteVerdict, libraryFilter, matchesFilter, monthGroup, timeline, type LibraryEntry } from '../../src/site/editor/model/library';

const entry = (id: string, more: Partial<LibraryEntry> = {}): LibraryEntry => ({ id, kind: 'picture', added: '2026-05-10', albums: [], articles: [], needsAlt: false, private: false, ...more });

describe('the library (gallery spec §9.9)', () => {
  it('groups by the month taken, and those without a date by the month added', () => {
    expect(monthGroup({ taken: '2026-03-14', added: '2026-05-01' })).toBe('March 2026');
    expect(monthGroup({ added: '2026-05-01' })).toBe('Date not set, added May 2026');
  });

  it('puts the newest taken first, then those without a date, newest added first', () => {
    const shown = timeline([
      entry('old', { taken: '2025-12-01' }),
      entry('undated-early', { added: '2026-01-02' }),
      entry('new', { taken: '2026-04-20' }),
      entry('undated-late', { added: '2026-06-02' }),
      entry('mid', { taken: '2026-02-11' }),
    ]);
    expect(shown.map((e) => e.id)).toEqual(['new', 'mid', 'old', 'undated-late', 'undated-early']);
    expect(shown.map((e) => e.group)).toEqual(['April 2026', 'February 2026', 'December 2025', 'Date not set, added June 2026', 'Date not set, added January 2026']);
  });

  it('filters by albums, alt text, privacy and kind', () => {
    const all = [
      entry('a', { albums: ['Summer'] }),
      entry('b', { needsAlt: true }),
      entry('c', { kind: 'embed', private: true }),
      entry('d', { kind: 'drawing' }),
      entry('e', { kind: 'video' }),
      entry('f', { kind: 'animated' }),
    ];
    const ids = (f: Parameters<typeof matchesFilter>[1]) => all.filter((e) => matchesFilter(e, f)).map((e) => e.id);
    expect(ids('all')).toHaveLength(6);
    expect(ids('in-albums')).toEqual(['a']);
    expect(ids('not-in-album')).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(ids('needs-alt')).toEqual(['b']);
    expect(ids('private')).toEqual(['c']);
    expect(ids('linked')).toEqual(['c']);
    expect(ids('drawings')).toEqual(['d']);
    expect(ids('videos')).toEqual(['e']);
    expect(ids('animated')).toEqual(['f']);
    expect(ids('pictures')).toEqual(['a', 'b']);
    expect(timeline(all, 'needs-alt').map((e) => e.id)).toEqual(['b']);
  });

  it('reads a filter from an address, else Everything', () => {
    expect(libraryFilter('needs-alt')).toBe('needs-alt');
    expect(libraryFilter('nonsense')).toBe('all');
    expect(libraryFilter(null)).toBe('all');
  });

  it('says which albums a picture leaves before deleting it', () => {
    const none = deleteVerdict([entry('a')]);
    expect(none).toMatchObject({ ok: true, title: 'Delete this from your library?', albums: [] });
    expect(none.ok && none.words).toMatch(/isn't in any album/);
    const one = deleteVerdict([entry('a', { albums: ['Summer'] })]);
    expect(one.ok && one.words).toBe("It's in \u201cSummer\u201d. Delete it from your library and the album \u201cSummer\u201d?");
    const two = deleteVerdict([entry('a', { albums: ['Summer', 'Rain'] })]);
    expect(two.ok && two.words).toBe("It's in 2 albums (\u201cSummer\u201d and \u201cRain\u201d). Delete it from your library and both albums?");
    const many = deleteVerdict([entry('a', { albums: ['A', 'B'] }), entry('b', { albums: ['B', 'C'] })]);
    expect(many).toMatchObject({ ok: true, title: 'Delete 2 items from your library?', albums: ['A', 'B', 'C'] });
    expect(many.ok && many.words).toMatch(/^They're in 3 albums .* and all 3 albums\?$/);
  });

  it('refuses while a page uses it, naming the pages', () => {
    const v = deleteVerdict([entry('a', { albums: ['Summer'], articles: ['Field notes'] })]);
    expect(v).toEqual({ ok: false, why: "It can't be deleted while a page uses it: \u201cField notes\u201d. Take it out of that page first." });
    const several = deleteVerdict([entry('a', { articles: ['One'] }), entry('b', { articles: ['Two'] }), entry('c')]);
    expect(several.ok).toBe(false);
    expect(!several.ok && several.why).toMatch(/^Some of them can't be deleted while pages use them: \u201cOne\u201d and \u201cTwo\u201d/);
  });
});
