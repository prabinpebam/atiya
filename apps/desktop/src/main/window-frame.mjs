// @ts-check
/**
 * The main window's frame (documentation/desktop/spec.md §7.2, plan stage 7A). On Windows and Linux the app
 * draws the window itself: transparent and frameless, with 20 px corners, a shadow margin that lets clicks
 * through, and the app's own moving, resizing, snapping and window controls (`CustomWindow`). On macOS it's
 * the system's window with its traffic lights inset into the app's one title bar row. Ported from focus-notes.
 */
import { BrowserWindow, ipcMain, screen } from 'electron';
import { CustomWindow, POINTER_EDGE_PX } from '../core/window/custom-window.mjs';
import { EDGES, SNAP_ZONES, WINDOW_METRICS } from '../core/window/geometry.mjs';
import { initialPlacement, readWindowMemory, writeWindowMemory } from '../core/window/placement.mjs';

/**
 * @typedef {import('../core/window/geometry.mjs').DisplayInfo} DisplayInfo
 * @typedef {import('../core/window/geometry.mjs').Rect} Rect
 * @typedef {import('../core/window/geometry.mjs').SnapZone} SnapZone
 * @typedef {import('../core/window/geometry.mjs').ResizeEdge} ResizeEdge
 * @typedef {import('../core/window/custom-window.mjs').WindowReport} WindowReport
 * @typedef {import('../core/window/custom-window.mjs').FrameKind} FrameKind
 */

/** @returns {DisplayInfo[]} */
const displays = () => screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea, scaleFactor: d.scaleFactor }));
/** @returns {DisplayInfo} */
const primary = () => {
  const d = screen.getPrimaryDisplay();
  return { id: d.id, bounds: d.bounds, workArea: d.workArea, scaleFactor: d.scaleFactor };
};

export { frameKindFor } from '../core/window/custom-window.mjs';

/** The snap preview: a translucent accent rectangle in a window of its own that never takes the pointer or focus. */
function snapPreview() {
  /** @type {BrowserWindow | undefined} */
  let w;
  return {
    /** @param {Rect} r @param {string} color */
    show(r, color) {
      if (!w || w.isDestroyed()) {
        // nothing loads in it: its background is the rectangle
        w = new BrowserWindow({
          show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true, resizable: false, movable: false,
          minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false, backgroundColor: color,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, devTools: false },
        });
        w.setIgnoreMouseEvents(true);
      }
      w.setBackgroundColor(color);
      w.setBounds(r);
      if (!w.isVisible()) w.showInactive();
    },
    hide() {
      if (w && !w.isDestroyed()) w.hide();
    },
    destroy() {
      if (w && !w.isDestroyed()) w.destroy();
      w = undefined;
    },
  };
}

export class AppWindowFrame {
  /** @type {FrameKind} */ kind;
  /** @type {string} */ #file;
  /** @type {import('../core/window/placement.mjs').Placement} */ #placement;
  /** @type {CustomWindow | undefined} */ #custom;
  /** The accent the snap preview takes: the site's `--color-accent`, as the frame's page resolves it (light or dark). */
  #accent = '#3a3c9e';

  /** @param {FrameKind} kind @param {string} memoryFile */
  constructor(kind, memoryFile) {
    this.kind = kind;
    this.#file = memoryFile;
    this.#placement = initialPlacement(readWindowMemory(memoryFile), displays(), primary());
  }

  /** Where the window opens, and how it's drawn. @returns {Electron.BaseWindowConstructorOptions} */
  options() {
    const p = this.#placement;
    if (this.kind === 'native') {
      return { ...p.restore, minWidth: WINDOW_METRICS.minWidth, minHeight: WINDOW_METRICS.minHeight, ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 20 } } : {}) };
    }
    return { ...CustomWindow.outer(p), frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false, maximizable: false, fullscreenable: false };
  }

  /** The window's state now, for the frame's page. @returns {WindowReport & { frame: FrameKind, pointerEdge: number }} */
  state() {
    const base = this.#custom?.report() ?? { maximized: false, snapped: false, fullScreen: false, active: true, margin: 0, layouts: [] };
    return { ...base, frame: this.kind, pointerEdge: POINTER_EDGE_PX };
  }

  /** The visible window's bounds inside the window (its margin), for laying out the views. */
  margin() {
    return this.#custom?.margin() ?? 0;
  }

  /**
   * @param {Electron.BaseWindow} win
   * @param {{ notify: (s: ReturnType<AppWindowFrame['state']>) => void, views: () => Electron.WebContents[] }} o
   */
  attach(win, o) {
    const p = this.#placement;
    if (this.kind === 'native') {
      if (p.mode === 'maximized') win.maximize();
      win.on('close', () => writeWindowMemory(this.#file, { version: 1, bounds: win.getNormalBounds(), ...(win.isMaximized() ? { maximized: true } : {}) }));
      return;
    }
    const preview = snapPreview();
    const alpha = Math.round(WINDOW_METRICS.snapPreviewOpacity * 255).toString(16).padStart(2, '0');
    const custom = new CustomWindow(
      win,
      {
        screen: { getAllDisplays: displays, getCursorScreenPoint: () => screen.getCursorScreenPoint() },
        preview: () => preview,
        previewColor: () => `#${alpha}${this.#accent.slice(1)}`,
        notify: () => o.notify(this.state()),
        save: (m) => writeWindowMemory(this.#file, m),
        // Electron forwards pointer moves to an ignoring window on Windows, not on Linux
        forwardsMoves: process.platform === 'win32',
      },
      p,
    );
    this.#custom = custom;
    custom.trackPointer();
    // keyboard Move and Size take every key in either view until they end
    const keys = (/** @type {Electron.Event} */ e, /** @type {Electron.Input} */ input) => {
      if (custom.key(input)) e.preventDefault();
    };
    for (const wc of o.views()) wc.on('before-input-event', keys);
    const notify = () => custom.notify();
    const check = () => custom.pointerCheck();
    win.on('hide', check);
    win.on('minimize', check);
    win.on('restore', notify);
    win.on('focus', notify);
    win.on('blur', () => {
      custom.endKeyboard(true);
      notify();
    });
    // a system maximize (Win+Up) becomes the app's own, which knows the work area
    win.on('maximize', () => {
      if (custom.report().maximized) return;
      win.unmaximize();
      custom.maximize();
    });
    const changed = () => custom.displaysChanged();
    screen.on('display-added', changed);
    screen.on('display-removed', changed);
    screen.on('display-metrics-changed', changed);
    win.on('close', () => custom.save());
    win.on('closed', () => {
      custom.stop();
      preview.destroy();
      screen.off('display-added', changed);
      screen.off('display-removed', changed);
      screen.off('display-metrics-changed', changed);
    });
  }

  /** Full screen (F11) in the app's own window; false where the system does it. */
  toggleFullScreen() {
    this.#custom?.toggleFullScreen();
    return Boolean(this.#custom);
  }
  toggleMaximize() {
    this.#custom?.toggleMaximize();
  }
  /** @param {'move' | 'size'} mode */
  keyboard(mode) {
    this.#custom?.keyboard(mode);
  }

  /**
   * The window channels, each checked to come from the frame's own page.
   * @param {(e: Electron.IpcMainEvent) => boolean} fromFrame
   * @param {() => Electron.BaseWindow | null} win
   */
  registerIpc(fromFrame, win) {
    /** @param {string} channel @param {(...args: any[]) => void} fn */
    const on = (channel, fn) =>
      ipcMain.on(channel, (e, ...args) => {
        if (fromFrame(e)) fn(...args);
      });
    // the pointer moved near the margin, or left the page: where it is, the system says
    on('window:pointer', () => this.#custom?.pointerCheck());
    on('window:minimize', () => (this.#custom ? this.#custom.minimize() : win()?.minimize()));
    on('window:maximize', () => (this.#custom ? this.#custom.maximize() : win()?.maximize()));
    on('window:restore', () => (this.#custom ? this.#custom.restore() : win()?.unmaximize()));
    on('window:close', () => win()?.close());
    on('window:snap', (/** @type {unknown} */ zone) => {
      if (SNAP_ZONES.includes(/** @type {SnapZone} */ (zone))) this.#custom?.snap(/** @type {SnapZone} */ (zone));
    });
    on('window:drag', (/** @type {unknown} */ phase, /** @type {unknown} */ kind, /** @type {unknown} */ x, /** @type {unknown} */ y, /** @type {unknown} */ shift) => {
      if ((phase !== 'start' && phase !== 'move' && phase !== 'end') || (kind !== 'move' && !EDGES.includes(/** @type {ResizeEdge} */ (kind)))) return;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      this.#custom?.drag(phase, /** @type {'move' | ResizeEdge} */ (kind), Math.round(x), Math.round(y), shift === true);
    });
    on('window:toggle-maximize', () => this.#custom?.toggleMaximize());
    // a double-click on the top or bottom edge fills the height (Windows' vertical maximize), and again puts it back
    on('window:vertical', () => this.#custom?.verticalize());
    on('window:accent', (/** @type {unknown} */ color) => {
      const m = typeof color === 'string' ? /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color) : null;
      if (m) this.#accent = `#${m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
    });
  }
}
