import { describe, expect, it } from 'vitest';
import { clampWidth, followMove, followRemove, itemKey, widest, widthForKey, type WidthBounds } from '../../src/site/editor/model/inspector';

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
