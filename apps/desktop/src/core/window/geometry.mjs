// @ts-check
/**
 * The geometry of the app's own window on Windows and Linux (documentation/desktop/spec.md §7.2, plan stage
 * 7A): resize zones, snapping, restoring under the pointer, displays with different scaling, and remembered
 * bounds. Pure functions on device-independent pixels (DIP), as Electron reports screens and windows; the
 * main process applies them. Ported from the owner's focus-notes (its window-geometry), with the app's metrics.
 */

/**
 * The window's metrics, in DIP. The radius and the margin are drawn by the frame's page from the site's
 * tokens (`--radius-lg`, `--space-4`); these are the same numbers, for the main process.
 */
export const WINDOW_METRICS = Object.freeze({
  /** The shadow margin around a window at rest; clicks in it pass through to what's behind. */
  margin: 16,
  /** The resize band just outside the visible window, and the corner squares. */
  resizeEdge: 6,
  resizeCorner: 14,
  minWidth: 720,
  minHeight: 480,
  /** The title bar's height (`--size-chrome-block-compact`): enough of it must stay on a display to grab. */
  titleBarHeight: 56,
  /** How long the pointer rests on Maximize before Snap Layouts opens. */
  snapLayoutsDelay: 400,
  snapPreviewOpacity: 0.3,
});

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ width: number, height: number }} Size
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ id: number, bounds: Rect, workArea: Rect, scaleFactor: number, nativeOrigin?: Point }} DisplayInfo
 * @typedef {'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'} ResizeEdge
 * @typedef {ResizeEdge | 'inside' | 'outside'} HitZone
 * @typedef {'maximize' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'leftThird' | 'centerThird' | 'rightThird'} SnapZone
 * @typedef {'halves' | 'thirds' | 'quarters' | 'maximize'} SnapLayout
 * @typedef {{ margin: number, edge: number, corner: number }} FrameMetrics
 * @typedef {'Left' | 'Right' | 'Up' | 'Down'} ArrowKey
 */

/** @type {readonly SnapZone[]} */
export const SNAP_ZONES = ['maximize', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'leftThird', 'centerThird', 'rightThird'];
/** @type {readonly ResizeEdge[]} */
export const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
/** The Snap Layouts picker's layouts and the zones in each, in reading order. @type {Record<SnapLayout, readonly SnapZone[]>} */
export const SNAP_LAYOUTS = {
  halves: ['left', 'right'],
  thirds: ['leftThird', 'centerThird', 'rightThird'],
  quarters: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
  maximize: ['maximize'],
};

/** How close to a screen edge the pointer must be to snap, and how far along it a corner reaches. */
export const SNAP_EDGE = 8;
export const SNAP_CORNER = 64;
/** Work areas at least this wide offer thirds in Snap Layouts, as Windows 11 does. */
export const WIDE_WORK_AREA = 1920;
/** How far a press must move before it becomes a drag (restoring a maximized window). */
export const DRAG_THRESHOLD = 4;
/** One arrow press of keyboard Move or Size; one pixel with Ctrl. */
export const KEY_STEP = 10;

const right = (/** @type {Rect} */ r) => r.x + r.width;
const bottom = (/** @type {Rect} */ r) => r.y + r.height;
const contains = (/** @type {Rect} */ r, /** @type {Point} */ p) => p.x >= r.x && p.x < right(r) && p.y >= r.y && p.y < bottom(r);
/** @returns {Rect} */
const inset = (/** @type {Rect} */ r, /** @type {number} */ d) => ({ x: r.x + d, y: r.y + d, width: r.width - 2 * d, height: r.height - 2 * d });
const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v));
const overlap = (/** @type {Rect} */ a, /** @type {Rect} */ b) => Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x)) * Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y));

/** The window's outer bounds (the visible window and its margin). @param {Rect} content @param {number} margin */
export const outerBounds = (content, margin) => inset(content, -margin);
/** The visible window inside outer bounds. @param {Rect} outer @param {number} margin */
export const contentBounds = (outer, margin) => inset(outer, margin);

/**
 * What a point (in window coordinates) is over. The handles lie in a band `edge` wide just outside the
 * visible window, inside the shadow margin; with no margin (snapped) they lie just inside the edges.
 * Corners are `corner` squares at the band's corners. The rest of the margin is "outside".
 * @param {Point} p @param {Size} size @param {FrameMetrics} m @param {boolean} [resizable]
 * @returns {HitZone}
 */
export function hitZone(p, size, m, resizable = true) {
  const frame = inset({ x: 0, y: 0, width: size.width, height: size.height }, m.margin);
  if (!resizable) return contains(frame, p) ? 'inside' : 'outside';
  const outer = inset(frame, -Math.min(m.edge, m.margin));
  const inner = m.margin >= m.edge ? frame : inset(frame, m.edge - m.margin);
  if (!contains(outer, p)) return 'outside';
  const w = p.x < outer.x + m.corner;
  const e = p.x >= right(outer) - m.corner;
  const n = p.y < outer.y + m.corner;
  const s = p.y >= bottom(outer) - m.corner;
  if ((w || e) && (n || s)) return /** @type {ResizeEdge} */ (`${n ? 'n' : 's'}${w ? 'w' : 'e'}`);
  if (contains(inner, p)) return 'inside';
  if (p.x < inner.x) return 'w';
  if (p.x >= right(inner)) return 'e';
  return p.y < inner.y ? 'n' : 's';
}

/**
 * The bounds after dragging an edge or corner by `d`, never below `min`. With `keepRatio` (Shift) the proportions stay.
 * @param {Rect} start @param {ResizeEdge} edge @param {Point} d @param {Size} min @param {boolean} [keepRatio]
 * @returns {Rect}
 */
export function resizeBounds(start, edge, d, min, keepRatio = false) {
  const west = edge.includes('w');
  const north = edge.includes('n');
  const dx = west ? -d.x : edge.includes('e') ? d.x : 0;
  const dy = north ? -d.y : edge.includes('s') ? d.y : 0;
  let width = start.width + dx;
  let height = start.height + dy;
  if (keepRatio) {
    const ratio = start.width / start.height;
    const byWidth = dy === 0 || (dx !== 0 && Math.abs(dx) / start.width >= Math.abs(dy) / start.height);
    if (byWidth) height = Math.round(width / ratio);
    else width = Math.round(height * ratio);
  }
  width = Math.max(min.width, Math.round(width));
  height = Math.max(min.height, Math.round(height));
  return { x: west ? right(start) - width : start.x, y: north ? bottom(start) - height : start.y, width, height };
}

/**
 * Dragging a maximized or snapped window restores it under the pointer, at the same relative place across
 * its width and the same distance below its top, as Windows does.
 * @param {Size} restore @param {Rect} from @param {Point} p @param {Rect} workArea
 * @returns {Rect}
 */
export function restoreUnderPointer(restore, from, p, workArea) {
  const fx = from.width > 0 ? (p.x - from.x) / from.width : 0.5;
  const x = clamp(Math.round(p.x - fx * restore.width), Math.max(workArea.x, p.x - restore.width + 1), Math.min(right(workArea) - restore.width, p.x));
  const y = p.y - Math.min(p.y - from.y, restore.height - 1);
  return { x, y, width: restore.width, height: restore.height };
}

/** A snap zone's rectangle in a work area; neighbouring zones share edges, with no gaps. @param {SnapZone} zone @param {Rect} wa @returns {Rect} */
export function zoneRect(zone, wa) {
  const xAt = (/** @type {number} */ f) => wa.x + Math.round(wa.width * f);
  const yAt = (/** @type {number} */ f) => wa.y + Math.round(wa.height * f);
  const box = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => ({ x: xAt(x0), y: yAt(y0), width: xAt(x1) - xAt(x0), height: yAt(y1) - yAt(y0) });
  switch (zone) {
    case 'maximize':
      return { ...wa };
    case 'left':
      return box(0, 0.5, 0, 1);
    case 'right':
      return box(0.5, 1, 0, 1);
    case 'topLeft':
      return box(0, 0.5, 0, 0.5);
    case 'topRight':
      return box(0.5, 1, 0, 0.5);
    case 'bottomLeft':
      return box(0, 0.5, 0.5, 1);
    case 'bottomRight':
      return box(0.5, 1, 0.5, 1);
    case 'leftThird':
      return box(0, 1 / 3, 0, 1);
    case 'centerThird':
      return box(1 / 3, 2 / 3, 0, 1);
    case 'rightThird':
      return box(2 / 3, 1, 0, 1);
  }
}

/** The layouts Snap Layouts offers on a work area: thirds only on wide ones. @param {Rect} wa @returns {SnapLayout[]} */
export const layoutsFor = (wa) => (wa.width >= WIDE_WORK_AREA ? ['halves', 'thirds', 'quarters', 'maximize'] : ['halves', 'quarters', 'maximize']);

/** The display under a point, or the nearest one. @param {Point} p @param {readonly DisplayInfo[]} displays */
export function displayAt(p, displays) {
  const hit = displays.find((d) => contains(d.bounds, p));
  if (hit) return hit;
  const dist = (/** @type {DisplayInfo} */ d) => Math.hypot(p.x - clamp(p.x, d.bounds.x, right(d.bounds) - 1), p.y - clamp(p.y, d.bounds.y, bottom(d.bounds) - 1));
  return /** @type {DisplayInfo} */ ([...displays].sort((a, b) => dist(a) - dist(b))[0]);
}

/** The display a window belongs to: the one it overlaps most. @param {Rect} r @param {readonly DisplayInfo[]} displays */
export function displayFor(r, displays) {
  const best = /** @type {DisplayInfo} */ ([...displays].sort((a, b) => overlap(r, b.bounds) - overlap(r, a.bounds))[0]);
  return overlap(r, best.bounds) > 0 ? best : displayAt({ x: r.x + r.width / 2, y: r.y + r.height / 2 }, displays);
}

/**
 * The snap zone the pointer is at while moving the window: an outer edge of a display (one no other display
 * continues past), the corners along it, or the top for maximize.
 * @param {Point} p @param {readonly DisplayInfo[]} displays
 * @returns {{ zone: SnapZone, display: DisplayInfo } | undefined}
 */
export function snapZoneAt(p, displays) {
  const display = displays.find((d) => contains(d.bounds, p));
  if (!display) return undefined;
  const b = display.bounds;
  const wa = display.workArea;
  const open = (/** @type {Point} */ q) => !displays.some((d) => contains(d.bounds, q));
  const west = p.x - b.x < SNAP_EDGE && open({ x: b.x - 1, y: p.y });
  const east = right(b) - 1 - p.x < SNAP_EDGE && open({ x: right(b), y: p.y });
  const north = p.y - b.y < SNAP_EDGE && open({ x: p.x, y: b.y - 1 });
  const nearTop = p.y - wa.y < SNAP_CORNER;
  const nearBottom = bottom(wa) - p.y < SNAP_CORNER;
  /** @type {SnapZone | undefined} */
  let zone;
  if (west) zone = nearTop ? 'topLeft' : nearBottom ? 'bottomLeft' : 'left';
  else if (east) zone = nearTop ? 'topRight' : nearBottom ? 'bottomRight' : 'right';
  else if (north) zone = p.x - b.x < SNAP_CORNER ? 'topLeft' : right(b) - p.x < SNAP_CORNER ? 'topRight' : 'maximize';
  return zone ? { zone, display } : undefined;
}

/**
 * Resizing by the top or bottom edge until the pointer reaches that edge of the screen fills the work area's
 * height and keeps the width and place across, as Windows does (the bottom counts at the taskbar too). Not where
 * another display continues past that edge.
 * @param {ResizeEdge} edge @param {Point} p @param {readonly DisplayInfo[]} displays
 * @returns {DisplayInfo | undefined}
 */
export function verticalSnapAt(edge, p, displays) {
  if (edge !== 'n' && edge !== 's') return undefined;
  const display = displays.find((d) => contains(d.bounds, p));
  if (!display) return undefined;
  const b = display.bounds;
  const wa = display.workArea;
  const open = (/** @type {Point} */ q) => !displays.some((d) => contains(d.bounds, q));
  if (edge === 'n') return p.y < wa.y + SNAP_EDGE && (wa.y > b.y || open({ x: p.x, y: b.y - 1 })) ? display : undefined;
  return p.y >= bottom(wa) - SNAP_EDGE && (bottom(wa) < bottom(b) || open({ x: p.x, y: bottom(b) })) ? display : undefined;
}

/** A window filling its work area's height, at its own place and width across. @param {Rect} r @param {Rect} wa @returns {Rect} */
export const verticalRect = (r, wa) => ({ x: r.x, y: wa.y, width: r.width, height: wa.height });

/**
 * Keeps a window's size in DIP on the display it's moving to, shrinking it to the work area if it doesn't
 * fit, and keeping it inside.
 * @param {Rect} r @param {DisplayInfo} d @returns {Rect}
 */
export function fitToDisplay(r, d) {
  const wa = d.workArea;
  const width = Math.min(r.width, wa.width);
  const height = Math.min(r.height, wa.height);
  return { x: clamp(r.x, wa.x, right(wa) - width), y: clamp(r.y, wa.y, bottom(wa) - height), width, height };
}

/** Whether the system changed a window's size (crossing to another scale) by more than rounding. @param {Size} expected @param {Size} actual */
export const needsRemeasure = (expected, actual) => Math.abs(expected.width - actual.width) > 1 || Math.abs(expected.height - actual.height) > 1;

/**
 * Remembered bounds, checked against the displays there are now: at least the minimum size, no larger than
 * its display's work area, and with enough of the title bar on a display to grab it. A window that would
 * open off-screen is moved onto the nearest display.
 * @param {Rect} saved @param {readonly DisplayInfo[]} displays @param {Size} min @param {number} [band]
 * @returns {Rect}
 */
export function clampToDisplays(saved, displays, min, band = WINDOW_METRICS.titleBarHeight) {
  const r = { ...saved, width: Math.max(min.width, saved.width), height: Math.max(min.height, saved.height) };
  const grab = { x: r.x, y: r.y, width: r.width, height: band };
  const on = displays.find((d) => {
    const wa = d.workArea;
    const w = Math.min(right(grab), right(wa)) - Math.max(grab.x, wa.x);
    return r.y >= wa.y && w >= Math.min(64, r.width) && grab.y < bottom(wa) - band / 2;
  });
  if (on) return r.width <= on.workArea.width && r.height <= on.workArea.height ? r : fitToDisplay(r, on);
  return fitToDisplay(r, displayFor(r, displays));
}

/**
 * One arrow press of keyboard Move or Size. Size first chooses an edge, then moves it; an arrow across it
 * adds the other edge, making a corner, as on Windows.
 * @param {Rect} r @param {'move' | 'size'} mode @param {ArrowKey} key @param {ResizeEdge | undefined} edge @param {Size} min @param {boolean} [fine]
 * @returns {{ rect: Rect, edge?: ResizeEdge }}
 */
export function keyboardStep(r, mode, key, edge, min, fine = false) {
  const step = fine ? 1 : KEY_STEP;
  const dx = key === 'Left' ? -step : key === 'Right' ? step : 0;
  const dy = key === 'Up' ? -step : key === 'Down' ? step : 0;
  if (mode === 'move') return { rect: { ...r, x: r.x + dx, y: r.y + dy } };
  const v = edge?.match(/[ns]/)?.[0] ?? '';
  const h = edge?.match(/[ew]/)?.[0] ?? '';
  const horizontal = dx !== 0;
  if (horizontal ? !h : !v) {
    const chosen = horizontal ? (dx < 0 ? 'w' : 'e') : dy < 0 ? 'n' : 's';
    return { rect: r, edge: /** @type {ResizeEdge} */ (horizontal ? v + chosen : chosen + h) };
  }
  return { rect: resizeBounds(r, /** @type {ResizeEdge} */ (horizontal ? h : v), { x: dx, y: dy }, min), edge: /** @type {ResizeEdge} */ (edge) };
}
