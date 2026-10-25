import { describe, expect, it } from 'vitest';
import { clampWidth, followMove, followRemove, itemKey, widest, widthForKey, type WidthBounds } from '../../src/site/editor/model/inspector';
import { duration, fieldId, onPlanet, pickTopic, statusChoices, topicsDetail, videoUrl, WIDTHS } from '../../src/site/editor/model/inspectorFields';

const B: WidthBounds = { min: 24, max: 60, room: 100, canvasMin: 24 };

describe("the inspector's width", () => {
  it('stays between its narrowest and its widest, and never leaves the canvas less than its least', () => {
    expect(clampWidth(10, B)).toBe(24);
    expect(clampWidth(40, B)).toBe(40);
    expect(clampWidth(90, B)).toBe(60);
    // a narrower window: the canvas keeps its 24 rem
    expect(widest({ ...B, room: 70 })).toBe(46);
    expect(clampWidth(60, { ...B, room: 70 })).toBe(46);
    // a window too narrow for both: the inspector keeps its narrowest
    expect(widest({ ...B, room: 30 })).toBe(24);
    expect(clampWidth(Number.NaN, B)).toBe(24);
    expect(clampWidth(33.3333, B)).toBe(33.3125);
  });

  it('answers the separator’s keys: Left widens, Right narrows, Shift by four, Home and End to the ends', () => {
    expect(widthForKey('ArrowLeft', false, 30, B)).toBe(31);
    expect(widthForKey('ArrowRight', false, 30, B)).toBe(29);
    expect(widthForKey('ArrowLeft', true, 30, B)).toBe(34);
    expect(widthForKey('ArrowRight', true, 25, B)).toBe(24);
    expect(widthForKey('Home', false, 50, B)).toBe(24);
    expect(widthForKey('End', false, 30, B)).toBe(60);
    expect(widthForKey('Enter', false, 30, B)).toBeNull();
  });
});

describe("the inspector's sections", () => {
  it('keeps showing an item wherever it moves, and the items it passes keep their own', () => {
    expect(followMove(itemKey(2), 2, 0)).toBe('item-0');
    expect(followMove(itemKey(0), 2, 0)).toBe('item-1');
    expect(followMove(itemKey(1), 0, 3)).toBe('item-0');
    expect(followMove(itemKey(4), 0, 3)).toBe('item-4');
    expect(followMove('layout', 0, 3)).toBe('layout');
    expect(followMove(undefined, 0, 3)).toBeUndefined();
  });

  it('after a removal, shows the item before the one removed, and the others keep theirs', () => {
    expect(followRemove(itemKey(2), 2)).toBe('item-1');
    expect(followRemove(itemKey(0), 0)).toBe('item-0');
    expect(followRemove(itemKey(3), 1)).toBe('item-2');
    expect(followRemove(itemKey(1), 3)).toBe('item-1');
    expect(followRemove('pictures', 0)).toBe('pictures');
  });
});

describe("the inspector's fields (model/inspectorFields.ts, shared by its parts)", () => {
  it('names a field by its block and its name, so two forms never share an ID', () => {
    expect(fieldId(3, 'caption')).toBe('f-3-caption');
    expect(fieldId(0, 'item-2-autoplay')).toBe('f-0-item-2-autoplay');
    expect(fieldId(1, 's.item 4')).toBe('f-1-s-item-4');
    expect(fieldId(2, 'width')).not.toBe(fieldId(3, 'width'));
  });

  it("writes a video's length and address as the person would", () => {
    expect(duration(140)).toBe('2:20');
    expect(duration(59)).toBe('0:59');
    expect(duration(undefined)).toBe('');
    expect(videoUrl({ type: 'video', embed: { provider: 'youtube', id: 'abc' } } as never)).toBe('https://youtu.be/abc');
    expect(videoUrl({ type: 'video', embed: { provider: 'vimeo', id: '42' } } as never)).toBe('https://vimeo.com/42');
    expect(videoUrl({ type: 'video', media: 'x' } as never)).toBe('');
  });

  it("offers every status, and keeps one a page has that isn't otherwise offered", () => {
    expect(statusChoices('draft').map((s) => s.value)).toEqual(['draft', 'factReview', 'editorialReview', 'approved', 'published']);
    expect(statusChoices('stale').map((s) => s.value)).toContain('stale');
    expect(statusChoices('archived').map((s) => s.value)).toContain('archived');
    expect(WIDTHS.map((w) => w.value)).toEqual(['content', 'popout', 'wide', 'full']);
  });

  it('says where a page is on the planet: never when private, else in the building that shows its section', () => {
    expect(onPlanet(true, 'Library', true)).toMatch(/^Not on the planet: private pages never are/);
    expect(onPlanet(false, 'Library', true)).toBe('In the Library, which shows its section.');
    expect(onPlanet(false, 'Library', false)).toBe('In the Library, which shows its section, once it’s published.');
    expect(onPlanet(false, '', true)).toMatch(/no building shows its section/);
  });
});

describe("a page's topics in its settings", () => {
  it('keeps the order it had, puts a new one last, and leaves the field out when none is left', () => {
    expect(pickTopic(undefined, 'craft', true)).toEqual(['craft']);
    expect(pickTopic(['leadership', 'craft'], 'ai', true)).toEqual(['leadership', 'craft', 'ai']);
    expect(pickTopic(['leadership', 'craft', 'ai'], 'craft', false)).toEqual(['leadership', 'ai']);
    // ticked twice (a stale form) is still once, at the end
    expect(pickTopic(['craft', 'ai'], 'craft', true)).toEqual(['ai', 'craft']);
    expect(pickTopic(['craft'], 'craft', false)).toBeUndefined();
  });

  it('sums them up by name in the side navigation', () => {
    const choices = [{ value: 'ai', label: 'AI' }, { value: 'craft', label: 'Craft' }, { value: 'leadership', label: 'Leadership' }];
    expect(topicsDetail(undefined, choices)).toBe('None');
    expect(topicsDetail(['craft', 'ai'], choices)).toBe('Craft, AI');
    expect(topicsDetail(['craft', 'ai', 'leadership', 'gone'], choices)).toBe('Craft, AI and 2 more');
  });
});