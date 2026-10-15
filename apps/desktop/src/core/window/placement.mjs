// @ts-check
/**
 * Where the window opens (documentation/desktop/spec.md §7.2): `window.json` in the app's data folder keeps
 * its size, position, and whether it was maximized, snapped or full screen, checked against the displays
 * there are now. Ported from focus-notes.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { clampToDisplays, displayAt, displayFor, SNAP_ZONES, WINDOW_METRICS, zoneRect } from './geometry.mjs';

/**
 * @typedef {import('./geometry.mjs').Rect} Rect
 * @typedef {import('./geometry.mjs').SnapZone} SnapZone
 * @typedef {import('./geometry.mjs').DisplayInfo} DisplayInfo
 * @typedef {{ version: 1, bounds?: Rect, maximized?: boolean, zone?: SnapZone, fullScreen?: boolean }} WindowMemory
 * @typedef {'normal' | 'maximized' | 'snapped'} WindowMode
 * @typedef {{ content: Rect, mode: WindowMode, zone?: SnapZone, restore: Rect, fullScreen: boolean }} Placement
 */

export const MIN_SIZE = { width: WINDOW_METRICS.minWidth, height: WINDOW_METRICS.minHeight };
export const DEFAULT_SIZE = { width: 1440, height: 920 };

/** @param {unknown} r @returns {r is Rect} */
const isRect = (r) =>
  typeof r === 'object' && r !== null && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(/** @type {any} */ (r)[k])) && /** @type {Rect} */ (r).width > 0 && /** @type {Rect} */ (r).height > 0;

/** Reads `window.json`, keeping only what's valid; anything else is forgotten, never an error. @param {string | undefined} text @returns {WindowMemory} */
export function parseWindowMemory(text) {
  try {
    const m = JSON.parse(text ?? '');
    if (m?.version !== 1) return { version: 1 };
    const round = (/** @type {Rect} */ r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
    return {
      version: 1,
      ...(isRect(m.bounds) ? { bounds: round(m.bounds) } : {}),
      ...(m.maximized === true ? { maximized: true } : {}),
      ...(SNAP_ZONES.includes(m.zone) && m.zone !== 'maximize' ? { zone: m.zone } : {}),
      ...(m.fullScreen === true ? { fullScreen: true } : {}),
    };
  } catch {
    return { version: 1 };
  }
}

/** @param {string} file @returns {WindowMemory} */
export function readWindowMemory(file) {
  try {
    return parseWindowMemory(readFileSync(file, 'utf8'));
  } catch {
    return { version: 1 };
  }
}

/** Written whole, through a temporary file, so a crash never leaves half of it. @param {string} file @param {WindowMemory} m */
export function writeWindowMemory(file, m) {
  try {
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
    renameSync(tmp, file);
  } catch {
    // not remembering where the window was never stops the app
  }
}

/**
 * The remembered place on today's displays, or the default size centred on the primary display.
 * @param {WindowMemory} m @param {readonly DisplayInfo[]} displays @param {DisplayInfo} primary
 * @returns {Placement}
 */
export function initialPlacement(m, displays, primary) {
  const wa = primary.workArea;
  const width = Math.min(DEFAULT_SIZE.width, wa.width);
  const height = Math.min(DEFAULT_SIZE.height, wa.height);
  const centred = { x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2), width, height };
  const restore = m.bounds ? clampToDisplays(m.bounds, displays, MIN_SIZE) : centred;
  /** @type {SnapZone | undefined} */
  const zone = m.maximized ? 'maximize' : m.zone;
  if (!zone) return { content: restore, mode: 'normal', restore, fullScreen: m.fullScreen === true };
  const display = m.bounds ? displayFor(restore, displays) : displayAt({ x: wa.x, y: wa.y }, displays);
  return {
    content: zoneRect(zone, display.workArea),
    mode: zone === 'maximize' ? 'maximized' : 'snapped',
    ...(zone === 'maximize' ? {} : { zone }),
    restore,
    fullScreen: m.fullScreen === true,
  };
}
