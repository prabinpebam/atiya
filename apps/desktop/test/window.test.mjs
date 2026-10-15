// @ts-check
/** Plan stage 7A: the app's own window (geometry, placement, the window controller), with stand-ins for Electron. */
import { describe, expect, it } from 'vitest';
import { CustomWindow, frameKindFor, POINTER_EDGE_PX } from '../src/core/window/custom-window.mjs';
import {
  clampToDisplays, hitZone, keyboardStep, layoutsFor, resizeBounds, restoreUnderPointer, snapZoneAt, WINDOW_METRICS, zoneRect,
} from '../src/core/window/geometry.mjs';
import { initialPlacement, MIN_SIZE, parseWindowMemory } from '../src/core/window/placement.mjs';

const wa = { x: 0, y: 0, width: 1920, height: 1040 };
const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: wa, scaleFactor: 1 };
const second = { id: 2, bounds: { x: 1920, y: 0, width: 1280, height: 1024 }, workArea: { x: 1920, y: 0, width: 1280, height: 984 }, scaleFactor: 1.5 };
const m = { margin: 16, edge: 6, corner: 14 };

describe('the geometry', () => {
  it('the handles lie in a band just outside the visible window; the rest of the margin lets clicks through', () => {
    const size = { width: 1000, height: 800 };
    expect(hitZone({ x: 500, y: 400 }, size, m)).toBe('inside');
    expect(hitZone({ x: 2, y: 400 }, size, m)).toBe('outside');
    expect(hitZone({ x: 12, y: 400 }, size, m)).toBe('w');
    expect(hitZone({ x: 987, y: 400 }, size, m)).toBe('e');
    expect(hitZone({ x: 990, y: 400 }, size, m)).toBe('outside');
    expect(hitZone({ x: 500, y: 11 }, size, m)).toBe('n');
    expect(hitZone({ x: 12, y: 12 }, size, m)).toBe('nw');
    expect(hitZone({ x: 988, y: 788 }, size, m)).toBe('se');
    // not resizable (maximized): the margin passes clicks through, and there are no handles
    expect(hitZone({ x: 12, y: 400 }, size, m, false)).toBe('outside');
    // no margin (snapped): the handles lie just inside the edges
    expect(hitZone({ x: 2, y: 400 }, size, { ...m, margin: 0 })).toBe('w');
  });

  it('resizes from an edge or a corner, never below the minimum, keeping the ratio with Shift', () => {
    const r = { x: 100, y: 100, width: 1000, height: 800 };
    expect(resizeBounds(r, 'e', { x: 50, y: 0 }, MIN_SIZE)).toEqual({ x: 100, y: 100, width: 1050, height: 800 });
    expect(resizeBounds(r, 'nw', { x: 20, y: 30 }, MIN_SIZE)).toEqual({ x: 120, y: 130, width: 980, height: 770 });
    expect(resizeBounds(r, 'w', { x: 900, y: 0 }, MIN_SIZE)).toEqual({ x: 1100 - MIN_SIZE.width, y: 100, width: MIN_SIZE.width, height: 800 });
    expect(resizeBounds(r, 'se', { x: 100, y: 0 }, MIN_SIZE, true)).toEqual({ x: 100, y: 100, width: 1100, height: 880 });
  });

  it('snap zones tile the work area with no gaps, and thirds are offered only on wide ones', () => {
    expect(zoneRect('left', wa)).toEqual({ x: 0, y: 0, width: 960, height: 1040 });
    expect(zoneRect('bottomRight', wa)).toEqual({ x: 960, y: 520, width: 960, height: 520 });
    const thirds = ['leftThird', 'centerThird', 'rightThird'].map((z) => zoneRect(/** @type {any} */ (z), wa));
    expect(thirds[0].width + thirds[1].width + thirds[2].width).toBe(1920);
    expect(thirds[1].x).toBe(thirds[0].x + thirds[0].width);
    expect(layoutsFor(wa)).toContain('thirds');
    expect(layoutsFor({ ...wa, width: 1600 })).not.toContain('thirds');
  });

  it('the pointer at a screen edge snaps there; between two displays it does not', () => {
    expect(snapZoneAt({ x: 960, y: 2 }, [display])?.zone).toBe('maximize');
    expect(snapZoneAt({ x: 2, y: 500 }, [display])?.zone).toBe('left');
    expect(snapZoneAt({ x: 2, y: 10 }, [display])?.zone).toBe('topLeft');
    expect(snapZoneAt({ x: 1918, y: 500 }, [display, second])).toBeUndefined();
    expect(snapZoneAt({ x: 960, y: 500 }, [display])).toBeUndefined();
  });

  it('dragging a maximized window restores it under the pointer, at the same place across it', () => {
    const r = restoreUnderPointer({ width: 1000, height: 700 }, { x: 0, y: 0, width: 1920, height: 1040 }, { x: 960, y: 20 }, wa);
    expect(r).toEqual({ x: 460, y: 0, width: 1000, height: 700 });
  });

  it('a remembered place off every display comes back onto one, and keeps the title bar grabbable', () => {
    expect(clampToDisplays({ x: 5000, y: 300, width: 1200, height: 800 }, [display], MIN_SIZE).x).toBeLessThanOrEqual(1920 - 1200);
    expect(clampToDisplays({ x: 100, y: -500, width: 1200, height: 800 }, [display], MIN_SIZE).y).toBeGreaterThanOrEqual(0);
    expect(clampToDisplays({ x: 100, y: 100, width: 300, height: 200 }, [display], MIN_SIZE)).toMatchObject({ width: MIN_SIZE.width, height: MIN_SIZE.height });
  });

  it('keyboard Size chooses an edge first, then moves it; Move moves', () => {
    const r = { x: 100, y: 100, width: 1000, height: 800 };
    const first = keyboardStep(r, 'size', 'Right', undefined, MIN_SIZE);
    expect(first).toEqual({ rect: r, edge: 'e' });
    expect(keyboardStep(r, 'size', 'Right', first.edge, MIN_SIZE).rect.width).toBe(1010);
    expect(keyboardStep(r, 'move', 'Down', undefined, MIN_SIZE, true).rect.y).toBe(101);
  });
});

describe('the placement', () => {
  it('reads only what is valid from window.json, and forgets the rest', () => {
    expect(parseWindowMemory('{"version":1,"bounds":{"x":10,"y":20,"width":900,"height":700},"maximized":true,"zone":"nowhere"}')).toEqual({ version: 1, bounds: { x: 10, y: 20, width: 900, height: 700 }, maximized: true });
    expect(parseWindowMemory('not json')).toEqual({ version: 1 });
    expect(parseWindowMemory('{"version":2}')).toEqual({ version: 1 });
  });

  it('opens centred at its default size the first time, and maximized where it was maximized', () => {
    const first = initialPlacement({ version: 1 }, [display], display);
    expect(first).toMatchObject({ mode: 'normal', content: { x: 240, y: 60, width: 1440, height: 920 } });
    const max = initialPlacement({ version: 1, bounds: { x: 100, y: 100, width: 1000, height: 700 }, maximized: true }, [display], display);
    expect(max).toMatchObject({ mode: 'maximized', content: wa, restore: { x: 100, y: 100, width: 1000, height: 700 } });
  });
});

/** A stand-in BaseWindow. @param {import('../src/core/window/geometry.mjs').Rect} bounds */
function fakeWin(bounds) {
  /** @type {any[]} */
  const calls = [];
  const w = {
    bounds: { ...bounds },
    ignoring: false,
    getBounds: () => ({ ...w.bounds }),
    setBounds: (/** @type {any} */ r) => ((w.bounds = { ...r }), calls.push(['setBounds', r])),
    setPosition: (/** @type {number} */ x, /** @type {number} */ y) => ((w.bounds = { ...w.bounds, x, y }), calls.push(['setPosition', x, y])),
    minimize: () => calls.push(['minimize']),
    isMinimized: () => false,
    isVisible: () => true,
    isFocused: () => true,
    isDestroyed: () => false,
    setIgnoreMouseEvents: (/** @type {boolean} */ i) => ((w.ignoring = i), calls.push(['ignore', i])),
    moveTop: () => calls.push(['moveTop']),
  };
  return { w, calls };
}

function controller(cursor = { x: 0, y: 0 }) {
  const placement = initialPlacement({ version: 1 }, [display], display);
  const { w, calls } = fakeWin(CustomWindow.outer(placement));
  /** @type {any[]} */
  const saved = [];
  /** @type {any[]} */
  const previews = [];
  /** @type {any[]} */
  const reports = [];
  const c = new CustomWindow(
    /** @type {any} */ (w),
    {
      screen: { getAllDisplays: () => [display], getCursorScreenPoint: () => cursor },
      preview: () => ({ show: (r) => previews.push(r), hide: () => previews.push(null) }),
      previewColor: () => '#4d3a3c9e',
      notify: (r) => reports.push(r),
      save: (mem) => saved.push(mem),
      forwardsMoves: true,
    },
    placement,
  );
  return { c, w, calls, saved, previews, reports, cursor };
}

describe('the window controller', () => {
  it('at rest the window has its shadow margin; maximized it fills the work area with none, and Restore puts it back', () => {
    const { c, w, saved } = controller();
    expect(w.bounds).toEqual({ x: 240 - 16, y: 60 - 16, width: 1440 + 32, height: 920 + 32 });
    expect(c.margin()).toBe(WINDOW_METRICS.margin);
    c.maximize();
    expect(w.bounds).toEqual(wa);
    expect(c.report()).toMatchObject({ maximized: true, margin: 0 });
    expect(saved.at(-1)).toMatchObject({ maximized: true, bounds: { x: 240, y: 60, width: 1440, height: 920 } });
    c.restore();
    expect(c.content()).toEqual({ x: 240, y: 60, width: 1440, height: 920 });
    expect(c.report()).toMatchObject({ maximized: false, margin: 16 });
  });

  it('moving by the bar follows the pointer; at the top edge it previews and snaps to maximize', () => {
    const { c, w, previews } = controller();
    c.drag('start', 'move', 500, 80, false);
    c.drag('move', 'move', 600, 180, false);
    expect(c.content()).toMatchObject({ x: 340, y: 160 });
    c.drag('move', 'move', 900, 2, false);
    expect(previews.at(-1)).toEqual(wa);
    c.drag('end', 'move', 900, 2, false);
    expect(c.report().maximized).toBe(true);
    expect(w.bounds).toEqual(wa);
  });

  it('dragging a maximized window restores it under the pointer', () => {
    const { c } = controller();
    c.maximize();
    c.drag('start', 'move', 960, 20, false);
    c.drag('move', 'move', 980, 120, false);
    c.drag('end', 'move', 980, 120, false);
    expect(c.report().maximized).toBe(false);
    expect(c.content()).toMatchObject({ width: 1440, height: 920 });
    expect(c.content().x).toBeLessThan(980);
    expect(c.content().x + c.content().width).toBeGreaterThan(980);
  });

  it('resizes from a handle, but not while maximized; a tiny press is a click, not a drag', () => {
    const { c, calls } = controller();
    c.drag('start', 'se', 1680, 980, false);
    c.drag('end', 'se', 1700, 1000, false);
    expect(c.content()).toMatchObject({ width: 1460, height: 940 });
    c.maximize();
    const before = calls.length;
    c.drag('start', 'se', 100, 100, false);
    c.drag('end', 'se', 300, 300, false);
    expect(calls.length).toBe(before);
    c.restore();
    c.drag('start', 'move', 500, 80, false);
    c.drag('end', 'move', 501, 81, false);
    expect(c.content()).toMatchObject({ x: 240, y: 60 });
  });

  it('the shadow margin passes clicks through; the handles and the window take them', () => {
    const cursor = { x: 0, y: 0 };
    const { c, w } = controller(cursor);
    c.trackPointer();
    const b = w.getBounds();
    Object.assign(cursor, { x: b.x + 3, y: b.y + 400 });
    c.pointerCheck();
    expect(w.ignoring).toBe(true);
    Object.assign(cursor, { x: b.x + 12, y: b.y + 400 });
    c.pointerCheck();
    expect(w.ignoring).toBe(false);
    Object.assign(cursor, { x: b.x + 600, y: b.y + 400 });
    c.pointerCheck();
    expect(w.ignoring).toBe(false);
    expect(POINTER_EDGE_PX).toBeGreaterThan(WINDOW_METRICS.margin + WINDOW_METRICS.resizeCorner);
  });

  it('snaps to a zone from Snap Layouts, keeping where Restore goes; keyboard Move ends with Enter or puts it back with Esc', () => {
    const { c } = controller();
    c.snap('left');
    expect(c.content()).toEqual(zoneRect('left', wa));
    expect(c.report()).toMatchObject({ snapped: true, margin: 0 });
    c.restore();
    c.keyboard('move');
    const key = (/** @type {string} */ k) => c.key({ type: 'keyDown', key: k, control: false, alt: false, shift: false, meta: false });
    key('ArrowRight');
    key('Escape');
    expect(c.content()).toMatchObject({ x: 240, y: 60 });
    c.keyboard('move');
    key('ArrowRight');
    key('Enter');
    expect(c.content()).toMatchObject({ x: 250, y: 60 });
    expect(c.keyboardActive).toBe(false);
  });

  it('the app draws its own window everywhere but macOS, unless asked not to', () => {
    expect(frameKindFor('win32', [], {})).toBe('custom');
    expect(frameKindFor('linux', [], {})).toBe('custom');
    expect(frameKindFor('darwin', [], {})).toBe('native');
    expect(frameKindFor('win32', ['--native-window'], {})).toBe('native');
    expect(frameKindFor('win32', [], { ATIYA_WINDOW: 'native' })).toBe('native');
  });
});
