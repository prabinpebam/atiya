// @ts-check
/**
 * The app's own window on Windows and Linux (documentation/desktop/spec.md §7.2, plan stage 7A). Electron's
 * transparent windows lose native resizing, snapping, maximize and the shadow, so this does them: it moves
 * and resizes the window as the frame's page reports the pointer, previews and applies snap zones,
 * maximizes and restores itself, runs keyboard Move and Size, and lets clicks in the shadow margin through
 * to what's behind as the page reports the pointer near the edges. Pure of Electron: it's given the
 * window, the screen and the preview, so it's unit-tested with stand-ins. Ported from focus-notes.
 */
import {
  clampToDisplays, contentBounds, displayFor, DRAG_THRESHOLD, fitToDisplay, hitZone, keyboardStep, layoutsFor, needsRemeasure, outerBounds,
  resizeBounds, restoreUnderPointer, snapZoneAt, verticalRect, verticalSnapAt, WINDOW_METRICS, zoneRect,
} from './geometry.mjs';
import { MIN_SIZE } from './placement.mjs';

/**
 * @typedef {import('./geometry.mjs').Rect} Rect
 * @typedef {import('./geometry.mjs').Point} Point
 * @typedef {import('./geometry.mjs').DisplayInfo} DisplayInfo
 * @typedef {import('./geometry.mjs').ResizeEdge} ResizeEdge
 * @typedef {import('./geometry.mjs').SnapZone} SnapZone
 * @typedef {import('./geometry.mjs').SnapLayout} SnapLayout
 * @typedef {import('./placement.mjs').Placement} Placement
 * @typedef {import('./placement.mjs').WindowMemory} WindowMemory
 * @typedef {import('./placement.mjs').WindowMode} WindowMode
 * @typedef {{ getBounds(): Rect, setBounds(r: Rect): void, setPosition(x: number, y: number): void, minimize(): void, isMinimized(): boolean, isVisible(): boolean, isFocused(): boolean, isDestroyed(): boolean, setIgnoreMouseEvents(ignore: boolean, options?: { forward?: boolean }): void, moveTop(): void }} WinLike
 * @typedef {{ getAllDisplays(): DisplayInfo[], getCursorScreenPoint(): Point }} ScreenLike
 * @typedef {{ show(r: Rect, color: string): void, hide(): void }} PreviewLike
 * @typedef {{ type: string, key: string, control: boolean, alt: boolean, shift: boolean, meta: boolean }} KeyInput
 * @typedef {{ maximized: boolean, snapped: boolean, fullScreen: boolean, active: boolean, margin: number, layouts: SnapLayout[], keyboard?: 'move' | 'size' }} WindowReport
 * @typedef {{ screen: ScreenLike, preview: () => PreviewLike, previewColor: () => string, notify: (r: WindowReport) => void, save: (m: WindowMemory) => void, forwardsMoves: boolean }} Options
 */

/** @typedef {'custom' | 'native'} FrameKind */

/**
 * The app draws its own window everywhere but macOS, unless asked not to (`--native-window`, or a desktop
 * without a compositor, where transparency isn't possible).
 * @param {string} platform @param {readonly string[]} argv @param {NodeJS.ProcessEnv} env @returns {FrameKind}
 */
export const frameKindFor = (platform, argv, env) => (platform === 'darwin' || argv.includes('--native-window') || env.ATIYA_WINDOW === 'native' ? 'native' : 'custom');

/** @type {Record<string, import('./geometry.mjs').ArrowKey>} */
const ARROWS = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down' };
const metrics = { edge: WINDOW_METRICS.resizeEdge, corner: WINDOW_METRICS.resizeCorner };
/** The page reports pointer moves this close to the window's edges (CSS px): the margin, a corner handle, and room for a fast move. */
export const POINTER_EDGE_PX = WINDOW_METRICS.margin + WINDOW_METRICS.resizeCorner + 16;
/** How often Linux checks a pointer in the margin of an ignoring window, which the page can't see. */
export const POINTER_WATCH_MS = 50;

export class CustomWindow {
  /** @type {WinLike} */ #win;
  /** @type {Options} */ #o;
  /** @type {WindowMode} */ #mode;
  /** @type {SnapZone | undefined} */ #zone;
  /** @type {Rect} */ #restore;
  /** @type {{ kind: 'move' | ResizeEdge, start: Point, from: Rect, moved: boolean, snap?: { zone: SnapZone, display: DisplayInfo }, vertical?: DisplayInfo } | undefined} */ #drag;
  /** Snapped to the work area's full height at its own width (a top or bottom edge dragged to the screen's edge). */
  #vertical = false;
  /** @type {{ mode: 'move' | 'size', edge?: ResizeEdge, original: Rect, current: Rect } | undefined} */ #keys;
  #ignoring = false;
  /** Full screen is the app's own too: Electron doesn't track it for transparent windows. */
  #full = false;
  /** @type {Rect | undefined} */ #beforeFull;
  #previewing = false;
  #tracking = false;
  /** @type {ReturnType<typeof setInterval> | undefined} */ #watch;

  /** @param {WinLike} win @param {Options} o @param {Placement} placement */
  constructor(win, o, placement) {
    this.#win = win;
    this.#o = o;
    this.#mode = placement.mode;
    this.#zone = placement.zone;
    this.#restore = placement.restore;
  }

  /** The window's outer bounds for a placement: the visible window and its shadow margin. @param {Placement} p */
  static outer(p) {
    return outerBounds(p.content, p.mode === 'normal' && !p.fullScreen ? WINDOW_METRICS.margin : 0);
  }

  /** The shadow margin now: only a rounded window at rest has one. */
  margin() {
    return this.#mode === 'normal' && !this.#full ? WINDOW_METRICS.margin : 0;
  }
  resizable() {
    return this.#mode !== 'maximized' && !this.#full;
  }
  /** The visible window's bounds. */
  content() {
    return contentBounds(this.#win.getBounds(), this.margin());
  }
  #displays() {
    return this.#o.screen.getAllDisplays();
  }
  #display() {
    return displayFor(this.content(), this.#displays());
  }

  /** @returns {WindowReport} */
  report() {
    return {
      maximized: this.#mode === 'maximized',
      snapped: this.#mode === 'snapped',
      fullScreen: this.#full,
      active: this.#win.isFocused(),
      margin: this.margin(),
      layouts: layoutsFor(this.#display().workArea),
      ...(this.#keys ? { keyboard: this.#keys.mode } : {}),
    };
  }
  notify() {
    if (!this.#win.isDestroyed()) this.#o.notify(this.report());
  }
  /** @returns {WindowMemory} */
  memory() {
    // a window filling the height at its own width comes back as it is: it's a size, not a zone
    const bounds = (this.#mode === 'normal' || this.#vertical) && !this.#full ? this.content() : this.#restore;
    return {
      version: 1,
      bounds,
      ...(this.#mode === 'maximized' ? { maximized: true } : {}),
      ...(this.#mode === 'snapped' && this.#zone && !this.#vertical ? { zone: this.#zone } : {}),
      ...(this.#full ? { fullScreen: true } : {}),
    };
  }
  save() {
    this.#o.save(this.memory());
  }

  /** @param {WindowMode} mode @param {SnapZone} [zone] */
  #setMode(mode, zone) {
    this.#mode = mode;
    this.#zone = zone;
    this.#vertical = false;
    // the frame's page redraws the corners and the margin as the window changes shape
    this.notify();
  }
  /** @param {Rect} content */
  #apply(content) {
    this.#win.setBounds(outerBounds(content, this.margin()));
  }

  maximize() {
    this.snap('maximize');
  }
  /** Snaps to a zone of the window's display (or the given one), keeping where Restore goes. @param {SnapZone} zone @param {DisplayInfo} [display] */
  snap(zone, display = this.#display()) {
    if (this.#full) return;
    if (this.#mode === 'normal') this.#restore = this.content();
    this.#setMode(zone === 'maximize' ? 'maximized' : 'snapped', zone === 'maximize' ? undefined : zone);
    this.#apply(zoneRect(zone, display.workArea));
    this.save();
  }
  /**
   * Fills the work area's height at the window's own place and width (Windows' vertical maximize: a top or bottom
   * edge dragged to the screen's edge, or double-clicked); again, or a drag by the bar, puts the height back.
   * @param {DisplayInfo} [display] @param {Rect} [from] the window as it was before (a resize's start)
   */
  verticalize(display = this.#display(), from = this.content()) {
    if (this.#full || this.#mode === 'maximized') return;
    if (this.#vertical) return this.restore();
    if (this.#mode === 'normal') this.#restore = from;
    this.#setMode('snapped');
    this.#vertical = true;
    this.#apply(verticalRect(from, display.workArea));
    this.save();
  }
  get vertical() {
    return this.#vertical;
  }
  restore() {
    if (this.#mode === 'normal' || this.#full) return;
    this.#setMode('normal');
    this.#apply(clampToDisplays(this.#restore, this.#displays(), MIN_SIZE));
    this.save();
  }
  toggleMaximize() {
    if (this.#mode === 'maximized') this.restore();
    else this.maximize();
  }
  minimize() {
    this.#win.minimize();
  }
  /** Full screen (F11): the whole display, with no corners, margin or shadow; leaving puts it back as it was. */
  toggleFullScreen() {
    this.#keys = undefined;
    if (this.#full) {
      this.#full = false;
      this.notify();
      this.#apply(this.#beforeFull ?? this.#restore);
    } else {
      const display = this.#display();
      this.#beforeFull = this.content();
      if (this.#mode === 'normal') this.#restore = this.#beforeFull;
      this.#full = true;
      this.notify();
      this.#win.setBounds(display.bounds);
    }
    this.save();
  }

  /**
   * A move (by the bar) or a resize (by a handle), in screen DIP. Moving a maximized or snapped window
   * restores it under the pointer; moving to a screen edge previews a zone, and releasing there snaps.
   * @param {'start' | 'move' | 'end'} phase @param {'move' | ResizeEdge} kind @param {number} x @param {number} y @param {boolean} shift
   */
  drag(phase, kind, x, y, shift) {
    const p = { x, y };
    if (phase === 'start') {
      if (this.#full || this.#keys || (kind !== 'move' && !this.resizable())) return;
      this.#drag = { kind, start: p, from: this.content(), moved: false };
      this.#setIgnore(false);
      return;
    }
    const d = this.#drag;
    if (!d || (kind !== d.kind && phase !== 'end')) return;
    if (!d.moved && Math.hypot(x - d.start.x, y - d.start.y) < DRAG_THRESHOLD) {
      if (phase === 'end') this.#drag = undefined;
      return;
    }
    if (!d.moved) {
      d.moved = true;
      if (this.#mode !== 'normal') {
        if (d.kind === 'move') d.from = restoreUnderPointer(this.#restore, d.from, d.start, displayFor(d.from, this.#displays()).workArea);
        else this.#restore = d.from; // a snapped window resized by hand becomes a normal window where it is
        this.#setMode('normal');
        if (d.kind === 'move') this.#apply(d.from);
      }
    }
    const delta = { x: x - d.start.x, y: y - d.start.y };
    if (d.kind === 'move') {
      const outer = outerBounds({ ...d.from, x: d.from.x + delta.x, y: d.from.y + delta.y }, this.margin());
      // only the position: the system keeps the size right on a display with another scale
      this.#win.setPosition(outer.x, outer.y);
      const snap = snapZoneAt(p, this.#displays());
      if (snap) d.snap = snap;
      else delete d.snap;
      this.#showPreview(snap ? zoneRect(snap.zone, snap.display.workArea) : undefined);
    } else {
      this.#apply(resizeBounds(d.from, d.kind, delta, MIN_SIZE, shift));
      // the top or bottom edge at the screen's edge: a preview of the full height, taken on release
      const v = verticalSnapAt(d.kind, p, this.#displays());
      if (v) d.vertical = v;
      else delete d.vertical;
      this.#showPreview(v ? verticalRect(d.from, v.workArea) : undefined);
    }
    if (phase !== 'end') return;
    this.#drag = undefined;
    this.#showPreview(undefined);
    if (d.kind === 'move' && d.snap) return this.snap(d.snap.zone, d.snap.display);
    if (d.kind !== 'move' && d.vertical) return this.verticalize(d.vertical, d.from);
    if (d.kind === 'move') this.#remeasure({ width: d.from.width, height: d.from.height });
    this.#restore = this.content();
    this.notify();
    this.save();
  }

  /** On a display with another scale, the window keeps its size in DIP, which keeps its size on screen. @param {{ width: number, height: number }} expected */
  #remeasure(expected) {
    const now = this.content();
    if (!needsRemeasure(expected, now)) return;
    this.#apply(fitToDisplay({ ...now, ...expected }, displayFor(now, this.#displays())));
  }

  /** @param {Rect | undefined} r */
  #showPreview(r) {
    if (!r) {
      if (this.#previewing) this.#o.preview().hide();
      this.#previewing = false;
      return;
    }
    this.#o.preview().show(r, this.#o.previewColor());
    if (!this.#previewing) this.#win.moveTop();
    this.#previewing = true;
  }

  /** Keyboard Move and Size: the arrow keys until Enter keeps it or Esc puts it back. @param {'move' | 'size'} mode */
  keyboard(mode) {
    if (this.#full || this.#mode === 'maximized') return;
    if (this.#mode === 'snapped') {
      this.#restore = this.content();
      this.#setMode('normal');
      this.#apply(this.#restore);
    }
    const r = this.content();
    this.#keys = { mode, original: r, current: r };
    this.notify();
  }
  get keyboardActive() {
    return Boolean(this.#keys);
  }
  /** A key while Move or Size runs. True when it was used (every key is, until it ends). @param {KeyInput} input */
  key(input) {
    const k = this.#keys;
    if (!k) return false;
    if (input.type !== 'keyDown') return true;
    if (input.key === 'Enter') this.endKeyboard(true);
    else if (input.key === 'Escape') this.endKeyboard(false);
    else if (ARROWS[input.key]) {
      const step = keyboardStep(k.current, k.mode, ARROWS[input.key], k.edge, MIN_SIZE, input.control);
      k.current = step.rect;
      if (step.edge) k.edge = step.edge;
      this.#apply(step.rect);
    }
    return true;
  }
  /** @param {boolean} keep */
  endKeyboard(keep) {
    const k = this.#keys;
    if (!k) return;
    this.#keys = undefined;
    if (!keep) this.#apply(k.original);
    this.#restore = this.content();
    this.notify();
    this.save();
  }

  /** Displays came or went or changed: a maximized or snapped window refits; a normal one stays reachable. */
  displaysChanged() {
    if (this.#full) return;
    const displays = this.#displays();
    if (this.#mode === 'normal') {
      const now = this.content();
      const fit = clampToDisplays(now, displays, MIN_SIZE);
      if (fit.x !== now.x || fit.y !== now.y || fit.width !== now.width || fit.height !== now.height) this.#apply(fit);
    } else if (this.#vertical) this.#apply(verticalRect(this.content(), this.#display().workArea));
    else this.#apply(zoneRect(this.#mode === 'maximized' ? 'maximize' : (this.#zone ?? 'maximize'), this.#display().workArea));
    this.notify();
  }

  /**
   * Clicks in the shadow margin pass through to what's behind. Nothing polls: the page reports the pointer
   * moving near the window's edges, and this checks it against the margin and the handles. While the window
   * ignores the mouse, Windows still forwards the moves to the page; Linux can't, so there, and only while
   * the pointer is in the margin of an ignoring window, it's checked on a timer.
   */
  trackPointer() {
    this.#tracking = true;
  }
  stop() {
    this.#tracking = false;
    this.#stopWatch();
    if (this.#previewing) this.#o.preview().hide();
  }
  pointerCheck() {
    const w = this.#win;
    if (!this.#tracking || w.isDestroyed()) return this.#stopWatch();
    // a hidden or minimized window takes the pointer again when it's back, where the page can see it
    if (!w.isVisible() || w.isMinimized()) return this.#setIgnore(false);
    if (this.#drag || this.#keys) return;
    const b = w.getBounds();
    const c = this.#o.screen.getCursorScreenPoint();
    const p = { x: c.x - b.x, y: c.y - b.y };
    if (p.x < 0 || p.y < 0 || p.x >= b.width || p.y >= b.height) return this.#o.forwardsMoves ? undefined : this.#setIgnore(false);
    this.#setIgnore(hitZone(p, { width: b.width, height: b.height }, { margin: this.margin(), ...metrics }, this.resizable()) === 'outside');
  }
  get passingThrough() {
    return this.#ignoring;
  }
  /** @param {boolean} ignore */
  #setIgnore(ignore) {
    if (ignore !== this.#ignoring) {
      this.#ignoring = ignore;
      if (!this.#win.isDestroyed()) this.#win.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined);
    }
    if (ignore && !this.#o.forwardsMoves) {
      this.#watch ??= setInterval(() => this.pointerCheck(), POINTER_WATCH_MS);
      this.#watch.unref?.();
    } else this.#stopWatch();
  }
  #stopWatch() {
    if (this.#watch === undefined) return;
    clearInterval(this.#watch);
    this.#watch = undefined;
  }
}
