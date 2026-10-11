/** The select's rules beyond its keys (src/site/scripts/listbox.ts): the first choice, typeahead, and placing the list. */
import { describe, expect, it } from 'vitest';
import { describedBy, initialIndex, LIST_MARGIN, listLeft, listRoom, listTop, opensUp, typeahead, TYPEAHEAD_MS } from '../../src/site/scripts/listbox';

describe('select: the option chosen when it is drawn', () => {
  const values = ['light', 'dark', 'system'];
  it('the one with the value', () => {
    expect(initialIndex(values, 'dark')).toBe(1);
    expect(initialIndex(values, 'system', 'Pick one')).toBe(2);
  });

  it('else none with a placeholder, the first without', () => {
    expect(initialIndex(values, undefined, 'Pick one')).toBe(-1);
    expect(initialIndex(values, 'nope', 'Pick one')).toBe(-1);
    expect(initialIndex(values)).toBe(0);
    expect(initialIndex(values, 'nope')).toBe(0);
    expect(initialIndex(values, undefined, '')).toBe(0);
  });

  it('none from no options', () => {
    expect(initialIndex([])).toBe(-1);
    expect(initialIndex([], 'x', 'Pick')).toBe(-1);
  });
});

describe('select: described by its hint and error', () => {
  it('both, either or nothing', () => {
    expect(describedBy('s', 'Hint', 'Oops')).toBe('s-hint s-error');
    expect(describedBy('s', 'Hint')).toBe('s-hint');
    expect(describedBy('s', undefined, 'Oops')).toBe('s-error');
    expect(describedBy('s')).toBeUndefined();
    expect(describedBy('s', '', '')).toBeUndefined();
  });
});

describe('select: typeahead', () => {
  it('keys close together add up; a pause starts again', () => {
    let t = typeahead({ text: '', at: 0 }, 's', 1000);
    expect(t).toEqual({ text: 's', at: 1000 });
    t = typeahead(t, 'y', 1000 + TYPEAHEAD_MS);
    expect(t).toEqual({ text: 'sy', at: 1000 + TYPEAHEAD_MS });
    t = typeahead(t, 'd', 1001 + 2 * TYPEAHEAD_MS);
    expect(t).toEqual({ text: 'd', at: 1001 + 2 * TYPEAHEAD_MS });
  });
});

describe('select: placing the open list', () => {
  it('opens up only when it does not fit below and there is more room above', () => {
    expect(opensUp(400, 100, 300)).toBe(false);
    expect(opensUp(300, 500, 300)).toBe(true);
    expect(opensUp(300 + LIST_MARGIN, 500, 300)).toBe(false);
    expect(opensUp(100, 90, 300)).toBe(false);
  });

  it('takes the room on its side less a margin each end, never negative', () => {
    expect(listRoom(false, 500, 300)).toBe(300 - 2 * LIST_MARGIN);
    expect(listRoom(true, 500, 300)).toBe(500 - 2 * LIST_MARGIN);
    expect(listRoom(false, 500, 10)).toBe(0);
  });

  it("lines up with its button's start or end, kept inside the window", () => {
    const button = { left: 100, right: 300 };
    expect(listLeft(button, 250, false, 1000)).toBe(100);
    expect(listLeft(button, 250, true, 1000)).toBe(50);
    expect(listLeft({ left: 5, right: 50 }, 250, true, 1000)).toBe(LIST_MARGIN / 2);
    expect(listLeft({ left: 900, right: 990 }, 250, false, 1000)).toBe(1000 - 250 - LIST_MARGIN / 2);
  });

  it('sits under its button, or its own height over it', () => {
    expect(listTop(false, { top: 100, bottom: 148 }, 300)).toBe(148);
    expect(listTop(true, { top: 600, bottom: 648 }, 300)).toBe(300);
  });
});
