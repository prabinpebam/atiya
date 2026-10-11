/** The article minimap's landmarks, taps and placing (src/site/scripts/minimap.ts), and reading tokens (units.ts). */
import { describe, expect, it } from 'vitest';
import { boxPlacement, fitsBeside, groupLabel, headingLandmark, imageLandmark, MIN_IMAGE, movedTooFar, TAP_SLOP, tipY } from '../../src/site/scripts/minimap';
import { cssNumber } from '../../src/site/scripts/units';

describe('minimap: landmarks', () => {
  it("a gallery's label: its name, else its caption, else Gallery", () => {
    expect(groupLabel('  Studio   shots ', 'A caption')).toBe('Studio shots');
    expect(groupLabel(null, ' A caption ')).toBe('A caption');
    expect(groupLabel('', undefined)).toBe('Gallery');
  });

  it('a heading with words, unless an h1 repeats the title', () => {
    expect(headingLandmark(2, '  Pictures,\n given room ', 'Story')).toEqual({ kind: 'heading', level: 2, label: 'Pictures, given room' });
    expect(headingLandmark(2, '   ', 'Story')).toBeNull();
    expect(headingLandmark(2, null, 'Story')).toBeNull();
    expect(headingLandmark(1, 'Making things', 'Making things | Prabin')).toBeNull();
    expect(headingLandmark(2, 'Making things', 'Making things | Prabin')).toEqual({ kind: 'heading', level: 2, label: 'Making things' });
    expect(headingLandmark(1, 'Another title', 'Making things | Prabin')).toEqual({ kind: 'heading', level: 1, label: 'Another title' });
  });

  it('a picture big enough, with something to say, named by its alt text or caption', () => {
    const big = { width: 400, height: 300, role: null };
    expect(imageLandmark({ ...big, alt: 'A bridge', caption: 'Caption' })).toEqual({ kind: 'image', label: 'A bridge' });
    expect(imageLandmark({ ...big, alt: null, caption: ' The bridge ' })).toEqual({ kind: 'image', label: 'The bridge' });
  });

  it('none if decorative (empty alt, a presentation role), silent or small', () => {
    const big = { width: 400, height: 300 };
    expect(imageLandmark({ ...big, alt: '', caption: 'Caption', role: null })).toBeNull();
    expect(imageLandmark({ ...big, alt: 'A', caption: null, role: 'presentation' })).toBeNull();
    expect(imageLandmark({ ...big, alt: 'A', caption: null, role: 'none' })).toBeNull();
    expect(imageLandmark({ ...big, alt: null, caption: null, role: null })).toBeNull();
    expect(imageLandmark({ width: MIN_IMAGE - 1, height: 300, alt: 'A', caption: null, role: null })).toBeNull();
    expect(imageLandmark({ width: MIN_IMAGE, height: MIN_IMAGE / 2, alt: 'A', caption: null, role: 'img' })).toEqual({ kind: 'image', label: 'A' });
  });
});

describe('minimap: taps and placing', () => {
  it('a finger that moves more than the slop is scrolling, not tapping', () => {
    expect(movedTooFar(0, 0)).toBe(false);
    expect(movedTooFar(TAP_SLOP, 0)).toBe(false);
    expect(movedTooFar(6, 6)).toBe(true);
    expect(movedTooFar(0, -9)).toBe(true);
  });

  it('shown only where its left edge clears the text by the gap', () => {
    expect(fitsBeside(1400, 16, 40, 1000, 8)).toBe(true);
    expect(fitsBeside(1400, 16, 40, 1336, 8)).toBe(true);
    expect(fitsBeside(1400, 16, 40, 1337, 8)).toBe(false);
    expect(fitsBeside(1400, 16, 40, -Infinity, 8)).toBe(true);
  });

  it('in a box: along its right edge, inset top and bottom, never a negative height', () => {
    const box = { offsetTop: 60, offsetLeft: 200, clientWidth: 800, clientHeight: 600 };
    expect(boxPlacement(box, 16, 40)).toEqual({ top: 76, height: 568, left: 944 });
    expect(boxPlacement({ ...box, clientHeight: 20 }, 16, 40).height).toBe(0);
  });

  it("the tooltip level with its row's middle as the strip scrolls", () => {
    expect(tipY(100, 20, 0)).toBe(110);
    expect(tipY(100, 20, 60)).toBe(50);
  });
});

describe("reading a token's value (cssNumber)", () => {
  it('lengths in px: rem times the root font size', () => {
    expect(cssNumber('2.5rem', 16)).toBe(40);
    expect(cssNumber(' 1rem ', 20)).toBe(20);
    expect(cssNumber('12px')).toBe(12);
    expect(cssNumber('0')).toBe(0);
  });

  it('durations in ms, whichever way the minifier wrote them', () => {
    expect(cssNumber('3600ms')).toBe(3600);
    expect(cssNumber('3.6s')).toBe(3600);
  });

  it('anything else as it reads', () => {
    expect(cssNumber('1.5')).toBe(1.5);
    expect(cssNumber('')).toBeNaN();
  });
});
