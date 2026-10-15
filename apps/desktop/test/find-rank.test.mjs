// @ts-check
/** Plan stage 7E: the action center's finding and ordering (documentation/desktop/action-center.md §7). */
import { describe, expect, it } from 'vitest';
import { fold, group, prepare, remember, RECENT_MAX, search } from '../src/ui/find-rank.mjs';

/** @param {string} key @param {string} group @param {string} title @param {Partial<import('../src/ui/find-rank.mjs').FindItem>} [more] */
const item = (key, group, title, more = {}) => ({ key, group, title, ...more });

const ITEMS = prepare([
  item('setting:theme', 'settings', 'Colour theme', { words: ['dark', 'light', 'mode'] }),
  item('page:theme', 'pages', 'Theme', { detail: 'Work · Published' }),
  item('page:designup', 'pages', 'My journey with DesignUp', { detail: 'Writing · Published', text: 'We ship weekly and learn from every release. Design is a team sport.' }),
  item('page:resume', 'pages', 'Résumé', { detail: 'About · Published' }),
  item('setting:way:little-planet', 'settings', 'Little planet', { words: ['game', 'mode', 'way to explore'] }),
  item('go:media', 'go', 'Media', { words: ['pictures', 'images', 'photos', 'videos', 'uploads'] }),
  item('go:publish', 'go', 'Save to remote', { words: ['publish', 'push', 'deploy', 'git'] }),
  item('action:restart', 'actions', 'Restart edit mode', { words: ['server', 'stuck'] }),
]);
const keys = (/** @type {string} */ q, /** @type {{ recent?: string[] }} */ o = {}) => search(ITEMS, q, o).map((f) => f.item.key);

describe('finding', () => {
  it('folds case, accents and punctuation, keeping the length', () => {
    expect(fold('Résumé, v2!')).toBe('resume  v2 ');
    expect(fold('Résumé, v2!')).toHaveLength('Résumé, v2!'.length);
    expect(keys('resume')).toEqual(['page:resume']);
  });

  it('needs every word typed to match somewhere', () => {
    expect(keys('journey design')).toEqual(['page:designup']);
    expect(keys('journey planet')).toEqual([]);
    expect(keys('   ')).toEqual([]);
  });

  it("finds by other words, the quieter line and a page's body, and says where in the body", () => {
    expect(keys('publish')).toContain('go:publish');
    expect(keys('pictures')).toEqual(['go:media']);
    expect(keys('writing')).toEqual(['page:designup']);
    const [hit] = search(ITEMS, 'ship weekly');
    expect(hit.item.key).toBe('page:designup');
    expect(hit.score).toBe(15);
    expect(hit.snippet).toContain('ship weekly');
  });

  it("finds by a title's initials", () => {
    const [hit] = search(ITEMS, 'lp');
    expect(hit.item.key).toBe('setting:way:little-planet');
    expect(hit.marks).toEqual([
      [0, 1],
      [7, 8],
    ]);
  });

  it('matches a word of one or two letters only where a word starts, and the body only at word starts', () => {
    const list = prepare([item('a', 'pages', 'My notes'), item('b', 'pages', 'Family album'), item('c', 'pages', 'Notes', { text: 'Rethinking design.' })]);
    expect(search(list, 'my').map((f) => f.item.key)).toEqual(['a']);
    expect(search(list, 'thinking')).toEqual([]);
    expect(search(list, 'rethink').map((f) => f.item.key)).toEqual(['c']);
  });
});

describe('ordering', () => {
  it("puts a title's start before a word's start before inside a word, and marks what matched", () => {
    const list = prepare([item('a', 'pages', 'Planets I like'), item('b', 'pages', 'The planet'), item('c', 'pages', 'Exoplanet')]);
    const found = search(list, 'planet');
    expect(found.map((f) => f.item.key)).toEqual(['a', 'b', 'c']);
    expect(found[1].marks).toEqual([[4, 10]]);
  });

  it('prefers an action or a setting by a little, and a whole title by more', () => {
    // "theme": a page titled exactly Theme beats the setting whose title only has it as a word
    expect(keys('theme')).toEqual(['page:theme', 'setting:theme']);
    // "dark" is only the setting's other word
    expect(keys('dark')).toEqual(['setting:theme']);
  });

  it('lifts what was used lately, the latest most', () => {
    const list = prepare([item('a', 'pages', 'Notes on design'), item('b', 'pages', 'Notes on people')]);
    expect(search(list, 'notes').map((f) => f.item.key)).toEqual(['a', 'b']);
    expect(search(list, 'notes', { recent: ['b'] }).map((f) => f.item.key)).toEqual(['b', 'a']);
  });

  it('groups the rest under the top hit, in order, with how many more', () => {
    const many = prepare([
      item('action:x', 'actions', 'Page break'),
      ...Array.from({ length: 9 }, (_, i) => item(`page:${i}`, 'pages', `Page ${i}`)),
      item('go:pages', 'go', 'Pages'),
    ]);
    const { top, groups } = group(search(many, 'page'));
    expect(top?.item.key).toBe('action:x');
    expect(groups.map((g) => g.id)).toEqual(['pages', 'go']);
    expect(groups[0].items).toHaveLength(5);
    expect(groups[0].more).toBe(4);
    expect(groups.flatMap((g) => g.items).some((f) => f === top)).toBe(false);
  });

  it('is fast: 2,000 results with bodies, prepared once and each search well within a frame', () => {
    const body = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(60);
    let t = performance.now();
    const big = prepare(Array.from({ length: 2000 }, (_, i) => item(`page:${i}`, 'pages', `Page about topic ${i}`, { detail: 'Writing · Draft', text: body })));
    expect(performance.now() - t).toBeLessThan(250);
    search(big, 'warm up');
    t = performance.now();
    for (const q of ['top', 'topic 19', 'adipiscing', 'nothing here']) search(big, q);
    expect((performance.now() - t) / 4).toBeLessThan(16);
  });
});

describe('recent', () => {
  it('puts what was chosen first, without repeats, at most eight', () => {
    let r = /** @type {string[]} */ ([]);
    for (const k of ['a', 'b', 'c', 'a']) r = remember(r, k);
    expect(r).toEqual(['a', 'c', 'b']);
    for (let i = 0; i < 20; i++) r = remember(r, `k${i}`);
    expect(r).toHaveLength(RECENT_MAX);
  });
});
