import { describe, expect, it } from 'vitest';
import {
  canZoom,
  clampPan,
  clampScale,
  dragPan,
  isFit,
  keyAction,
  maxScale,
  needsLarger,
  panBy,
  pinchScale,
  stepIn,
  stepOut,
  swipeAllowed,
  toggleScale,
  touchAction,
  wheelFactor,
  zoomAbout,
  zoomAnnouncement,
  zoomOffered,
  DRAWING_MAX,
  FIT,
  ZOOM_STEP,
} from '../../src/site/scripts/zoomRules';

const stage = { width: 1000, height: 600 };
const fitted = { width: 900, height: 600 };

describe('zoom rules: where it is offered, and how far', () => {
  it('offers a picture whose largest size is at least 1.5 times what is shown', () => {
    expect(zoomOffered('picture', 2560, 900)).toBe(true);
    expect(zoomOffered('picture', 1350, 900)).toBe(true);
    expect(zoomOffered('picture', 1349, 900)).toBe(false);
    expect(zoomOffered('picture', 960, 960)).toBe(false);
    expect(zoomOffered('picture', 2560, 0)).toBe(false);
  });

  it('offers a drawing always, and never an animated picture, a video or an embed', () => {
    expect(zoomOffered('drawing', 0, 900)).toBe(true);
    expect(zoomOffered('animated', 3840, 400)).toBe(false);
    expect(zoomOffered('video', 3840, 400)).toBe(false);
    expect(zoomOffered('embed', 3840, 400)).toBe(false);
  });

  it("goes to a picture's full size (its largest published width) and 4 times for a drawing", () => {
    expect(maxScale('picture', 2560, 1280)).toBe(2);
    expect(maxScale('picture', 3840, 960)).toBe(4);
    expect(maxScale('picture', 600, 900)).toBe(FIT);
    expect(maxScale('drawing', 0, 900)).toBe(DRAWING_MAX);
    expect(maxScale('video', 3840, 960)).toBe(FIT);
    expect(maxScale('picture', 2560, 0)).toBe(FIT);
  });
});

describe('zoom rules: steps and limits', () => {
  it('steps by half again, landing on the ends', () => {
    expect(stepIn(FIT, 4)).toBe(ZOOM_STEP);
    expect(stepIn(1.5, 4)).toBeCloseTo(2.25);
    expect(stepIn(3, 4)).toBe(4);
    expect(stepIn(4, 4)).toBe(4);
    expect(stepOut(2.25, 4)).toBeCloseTo(1.5);
    expect(stepOut(1.2, 4)).toBe(FIT);
    expect(stepOut(FIT, 4)).toBe(FIT);
  });

  it('a step in and a step out come back to the whole item', () => {
    expect(stepOut(stepIn(FIT, 4), 4)).toBe(FIT);
  });

  it('clamps a scale between the whole item and the most', () => {
    expect(clampScale(0.5, 4)).toBe(FIT);
    expect(clampScale(9, 4)).toBe(4);
    expect(clampScale(2, 0.5)).toBe(FIT);
    expect(isFit(1.0000001)).toBe(true);
    expect(isFit(1.01)).toBe(false);
  });

  it('disables each button at its end', () => {
    expect(canZoom(FIT, 4)).toEqual({ in: true, out: false });
    expect(canZoom(2, 4)).toEqual({ in: true, out: true });
    expect(canZoom(4, 4)).toEqual({ in: false, out: true });
    expect(canZoom(FIT, FIT)).toEqual({ in: false, out: false });
  });

  it('a double-tap goes to full size, and back to the whole item', () => {
    expect(toggleScale(FIT, 2.5)).toBe(2.5);
    expect(toggleScale(1.5, 2.5)).toBe(FIT);
    expect(toggleScale(2.5, 2.5)).toBe(FIT);
  });

  it('pinching follows the fingers, within the limits', () => {
    expect(pinchScale(1, 100, 200, 4)).toBe(2);
    expect(pinchScale(2, 100, 50, 4)).toBe(FIT);
    expect(pinchScale(2, 100, 400, 4)).toBe(4);
    expect(pinchScale(2, 0, 400, 4)).toBe(2);
  });

  it('the wheel zooms only with Ctrl (and a trackpad pinch), in, out, and gently', () => {
    expect(wheelFactor(-100, false)).toBeNull();
    expect(wheelFactor(0, true)).toBeNull();
    expect(wheelFactor(-10, true)!).toBeGreaterThan(1);
    expect(wheelFactor(10, true)!).toBeLessThan(1);
    expect(wheelFactor(-10_000, true)).toBeCloseTo(Math.E);
  });
});

describe('zoom rules: panning stays on the stage', () => {
  it('centres an axis where the zoomed item fits the stage', () => {
    expect(clampPan({ x: 50, y: 50 }, FIT, fitted, stage)).toEqual({ x: 0, y: 0 });
    // 900 × 1.05 = 945 < 1000 wide: centred; 600 × 1.05 = 630 > 600 tall: 15 either way
    expect(clampPan({ x: 50, y: 50 }, 1.05, fitted, stage)).toEqual({ x: 0, y: 15 });
  });

  it('never leaves an empty edge', () => {
    // at 2×: 1800 × 1200 on 1000 × 600, so 400 and 300 either way
    expect(clampPan({ x: 999, y: -999 }, 2, fitted, stage)).toEqual({ x: 400, y: -300 });
    expect(clampPan({ x: -120, y: 40 }, 2, fitted, stage)).toEqual({ x: -120, y: 40 });
  });

  it('the arrow keys pan a tenth of the stage, the item moving so the reader sees further that way', () => {
    expect(panBy({ x: 0, y: 0 }, { x: -1, y: 0 }, 2, fitted, stage)).toEqual({ x: 100, y: 0 });
    expect(panBy({ x: 0, y: 0 }, { x: 0, y: 1 }, 2, fitted, stage)).toEqual({ x: 0, y: -60 });
    expect(panBy({ x: 400, y: 0 }, { x: -1, y: 0 }, 2, fitted, stage)).toEqual({ x: 400, y: 0 });
  });

  it('a drag pans from where it started, within the limits', () => {
    expect(dragPan({ x: 10, y: 10 }, 30, -20, 2, fitted, stage)).toEqual({ x: 40, y: -10 });
    expect(dragPan({ x: 0, y: 0 }, 5000, 5000, 2, fitted, stage)).toEqual({ x: 400, y: 300 });
  });
});

describe('zoom rules: zooming round a point', () => {
  it('keeps what is under the point in place', () => {
    const at = { x: 200, y: -100 };
    const from = { scale: FIT, pan: { x: 0, y: 0 } };
    const to = zoomAbout(from, 2, at, fitted, stage);
    // the content point under `at` before and after: (at - pan) / scale
    expect((at.x - to.pan.x) / to.scale).toBeCloseTo((at.x - from.pan.x) / from.scale);
    expect((at.y - to.pan.y) / to.scale).toBeCloseTo((at.y - from.pan.y) / from.scale);
    expect(to).toEqual({ scale: 2, pan: { x: -200, y: 100 } });
  });

  it('round the centre, it stays centred; back to the whole item, it is centred', () => {
    expect(zoomAbout({ scale: FIT, pan: { x: 0, y: 0 } }, 3, { x: 0, y: 0 }, fitted, stage).pan).toEqual({ x: 0, y: 0 });
    expect(zoomAbout({ scale: 3, pan: { x: 120, y: -40 } }, FIT, { x: 300, y: 200 }, fitted, stage)).toEqual({ scale: FIT, pan: { x: 0, y: 0 } });
  });

  it('a zoom round a point near an edge is kept on the stage', () => {
    const to = zoomAbout({ scale: 2, pan: { x: 400, y: 0 } }, 4, { x: -500, y: 0 }, fitted, stage);
    // at 4×: 3600 wide, so 1300 either way at most
    expect(Math.abs(to.pan.x)).toBeLessThanOrEqual(1300);
    expect(to.pan.x).toBe(1300);
  });
});

describe('zoom rules: loading, gestures and words', () => {
  it('asks for the larger size only when the one on the stage is too small for the scale', () => {
    expect(needsLarger(FIT, 900, 1600)).toBe(false);
    expect(needsLarger(2, 900, 1600)).toBe(true);
    expect(needsLarger(1.5, 900, 1600)).toBe(false);
  });

  it('swipes between items only when not zoomed', () => {
    expect(swipeAllowed(FIT)).toBe(true);
    expect(swipeAllowed(1.5)).toBe(false);
  });

  it("keeps the browser's pinch zoom where zoom isn't offered", () => {
    expect(touchAction(true)).toBe('none');
    expect(touchAction(false)).toBe('pan-y pinch-zoom');
  });

  it('announces the level', () => {
    expect(zoomAnnouncement(2)).toBe('Zoomed to 200%');
    expect(zoomAnnouncement(FIT)).toBe('Zoomed to 100%');
    expect(zoomAnnouncement(2.25)).toBe('Zoomed to 225%');
    expect(zoomAnnouncement(1.333)).toBe('Zoomed to 133%');
  });
});

describe('zoom rules: keys', () => {
  const still = { zoomed: false, zoomable: true };
  const zoomed = { zoomed: true, zoomable: true };

  it('Left and Right move between items when not zoomed, and pan when zoomed', () => {
    expect(keyAction('ArrowLeft', still)).toEqual({ type: 'move', by: -1 });
    expect(keyAction('ArrowRight', still)).toEqual({ type: 'move', by: 1 });
    expect(keyAction('ArrowLeft', zoomed)).toEqual({ type: 'pan', x: -1, y: 0 });
    expect(keyAction('ArrowRight', zoomed)).toEqual({ type: 'pan', x: 1, y: 0 });
  });

  it('Up and Down pan when zoomed, and do nothing otherwise', () => {
    expect(keyAction('ArrowUp', zoomed)).toEqual({ type: 'pan', x: 0, y: -1 });
    expect(keyAction('ArrowDown', zoomed)).toEqual({ type: 'pan', x: 0, y: 1 });
    expect(keyAction('ArrowUp', still)).toBeNull();
    expect(keyAction('ArrowDown', still)).toBeNull();
  });

  it('Home and End go to the ends, zoomed or not', () => {
    expect(keyAction('Home', still)).toEqual({ type: 'first' });
    expect(keyAction('End', zoomed)).toEqual({ type: 'last' });
  });

  it('+ (or =) and − zoom only where it is offered; 0 goes back to the whole item when zoomed', () => {
    expect(keyAction('+', still)).toEqual({ type: 'zoom', by: 1 });
    expect(keyAction('=', still)).toEqual({ type: 'zoom', by: 1 });
    expect(keyAction('-', zoomed)).toEqual({ type: 'zoom', by: -1 });
    expect(keyAction('−', zoomed)).toEqual({ type: 'zoom', by: -1 });
    expect(keyAction('+', { zoomed: false, zoomable: false })).toBeNull();
    expect(keyAction('-', { zoomed: false, zoomable: false })).toBeNull();
    expect(keyAction('0', zoomed)).toEqual({ type: 'fit' });
    expect(keyAction('0', still)).toBeNull();
  });

  it('Escape goes back to the whole item first, then closes', () => {
    expect(keyAction('Escape', zoomed)).toEqual({ type: 'fit' });
    expect(keyAction('Escape', still)).toEqual({ type: 'close' });
  });

  it('I opens or closes the info panel', () => {
    expect(keyAction('i', still)).toEqual({ type: 'info' });
    expect(keyAction('I', zoomed)).toEqual({ type: 'info' });
  });

  it("leaves the browser's keys alone (Ctrl and + is its own zoom; Alt and Left is Back)", () => {
    expect(keyAction('+', { ...still, modified: true })).toBeNull();
    expect(keyAction('ArrowLeft', { ...still, modified: true })).toBeNull();
    expect(keyAction('Escape', { ...zoomed, modified: true })).toBeNull();
  });

  it("leaves a player's arrows, Home and End to it", () => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) expect(keyAction(k, { ...still, inPlayer: true })).toBeNull();
    expect(keyAction('Escape', { ...still, inPlayer: true })).toEqual({ type: 'close' });
  });

  it("leaves a text field's typing to it, but Escape still works", () => {
    for (const k of ['i', '0', '+', '-', 'ArrowLeft', 'Home']) expect(keyAction(k, { ...still, inField: true })).toBeNull();
    expect(keyAction('Escape', { ...still, inField: true })).toEqual({ type: 'close' });
  });

  it('ignores any other key', () => {
    expect(keyAction('a', still)).toBeNull();
    expect(keyAction('Tab', zoomed)).toBeNull();
    expect(keyAction(' ', still)).toBeNull();
  });
});
