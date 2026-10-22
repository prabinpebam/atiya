/**
 * The lightbox's zoom rules (tier 0; docs: documentation/gallery/spec.md §8.8, §8.5): where zoom is
 * offered, how far it goes, its steps, the limits of a pan, zooming round a point, and what each key and
 * gesture does when zoomed and when not. Pure and unit-tested (`tests/unit/zoomRules.test.ts`).
 *
 * A zoom is a `scale` against the item fitted to the stage (1: the whole item, `FIT`) and a `pan`: the
 * item's centre's offset from the stage's centre, in CSS px.
 */
import type { ItemKind } from './lightboxRules';

/** The whole item: no zoom. */
export const FIT = 1;
/** Each step (a button, + or −) zooms by half again. */
export const ZOOM_STEP = 1.5;
/** A picture is worth zooming when its largest size is at least this many times what's shown. */
export const OFFER_AT = 1.5;
/** A drawing (sharp at any size) zooms up to this. */
export const DRAWING_MAX = 4;
/** An arrow key pans by this share of the stage. */
export const PAN_SHARE = 0.1;

const EPS = 1e-6;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The most an item zooms, as a scale of what's shown (`shownWidth`, CSS px): a picture to its full
 * size (its largest published width), a drawing 4 times; never below the whole item.
 */
export function maxScale(kind: ItemKind, largestWidth: number, shownWidth: number): number {
  if (kind === 'drawing') return DRAWING_MAX;
  if (kind !== 'picture' || !(shownWidth > 0) || !(largestWidth > 0)) return FIT;
  return Math.max(FIT, largestWidth / shownWidth);
}

/** Whether zoom is offered: a drawing always; a picture whose largest size is at least 1.5 times what's shown; never an animated picture, a video or an embed. */
export function zoomOffered(kind: ItemKind, largestWidth: number, shownWidth: number): boolean {
  if (kind === 'drawing') return true;
  if (kind !== 'picture' || !(shownWidth > 0)) return false;
  return largestWidth >= OFFER_AT * shownWidth - EPS;
}

/** A scale kept between the whole item and the most. */
export const clampScale = (scale: number, max: number): number => Math.min(Math.max(scale, FIT), Math.max(max, FIT));

/** Whether a scale is (as good as) the whole item. */
export const isFit = (scale: number): boolean => scale <= FIT + EPS;

/** One step in (half again), up to the most; landing on it rather than just short. */
export function stepIn(scale: number, max: number): number {
  const next = scale * ZOOM_STEP;
  return next >= max - EPS ? clampScale(max, max) : clampScale(next, max);
}

/** One step out, down to the whole item. */
export function stepOut(scale: number, max: number): number {
  const next = scale / ZOOM_STEP;
  return next <= FIT + EPS ? FIT : clampScale(next, max);
}

/** Whether Zoom in and Zoom out can act (each button is disabled at its end). */
export function canZoom(scale: number, max: number): { in: boolean; out: boolean } {
  return { in: scale < max - EPS, out: scale > FIT + EPS };
}

/** A double-tap or double-click: to full size from the whole item, else back to the whole item. */
export const toggleScale = (scale: number, max: number): number => (isFit(scale) ? clampScale(max, max) : FIT);

/**
 * A pan kept so the item can't leave the stage: centred on an axis where the zoomed item fits the stage,
 * else never far enough to leave an empty edge. `fitted` is the item's size at the whole-item scale.
 */
export function clampPan(pan: Point, scale: number, fitted: Size, stage: Size): Point {
  const limit = (item: number, room: number) => Math.max(0, (item * scale - room) / 2);
  const lx = limit(fitted.width, stage.width);
  const ly = limit(fitted.height, stage.height);
  const c = (v: number, l: number) => (l === 0 ? 0 : Math.min(l, Math.max(-l, v)));
  return { x: c(pan.x, lx), y: c(pan.y, ly) };
}

/**
 * Zooming round a point (under the fingers or the pointer, from the stage's centre): the pan that keeps
 * what's under it in place at the new scale, then kept on the stage. Back to the whole item, it's centred.
 */
export function zoomAbout(from: { scale: number; pan: Point }, to: number, at: Point, fitted: Size, stage: Size): { scale: number; pan: Point } {
  if (isFit(to)) return { scale: FIT, pan: { x: 0, y: 0 } };
  const k = to / from.scale;
  const pan = { x: at.x - (at.x - from.pan.x) * k, y: at.y - (at.y - from.pan.y) * k };
  return { scale: to, pan: clampPan(pan, to, fitted, stage) };
}

/** An arrow key's pan: a tenth of the stage, the item moving so the reader sees further that way. */
export function panBy(pan: Point, dir: Point, scale: number, fitted: Size, stage: Size): Point {
  const next = { x: pan.x - dir.x * stage.width * PAN_SHARE, y: pan.y - dir.y * stage.height * PAN_SHARE };
  return clampPan(next, scale, fitted, stage);
}

/** A drag's pan, from where it started. */
export const dragPan = (start: Point, dx: number, dy: number, scale: number, fitted: Size, stage: Size): Point => clampPan({ x: start.x + dx, y: start.y + dy }, scale, fitted, stage);

/** A pinch's scale: the scale it started at, times how far the fingers have spread. */
export function pinchScale(startScale: number, startDistance: number, distance: number, max: number): number {
  if (!(startDistance > 0)) return clampScale(startScale, max);
  return clampScale((startScale * distance) / startDistance, max);
}

/** The wheel's zoom factor: only with Ctrl (a trackpad's pinch sends it too), so scrolling never zooms by accident; null otherwise. */
export function wheelFactor(deltaY: number, ctrlKey: boolean): number | null {
  if (!ctrlKey || deltaY === 0) return null;
  return Math.exp(Math.max(-1, Math.min(1, -deltaY * 0.01)));
}

/** Whether a swipe moves between items: only when not zoomed (a zoomed item's drag pans). */
export const swipeAllowed = (scale: number): boolean => isFit(scale);

/** The stage's `touch-action`: its own pinch and drag where zoom is offered, else the browser's pinch zoom kept (readers with low vision need it). */
export const touchAction = (offered: boolean): string => (offered ? 'none' : 'pan-y pinch-zoom');

/** Whether the size on the stage is too small for a scale, so the larger one is needed (fetched only when zooming starts). */
export const needsLarger = (scale: number, shownWidth: number, loadedWidth: number): boolean => shownWidth * scale > loadedWidth + EPS;

/** The level in words, for the live region: "Zoomed to 200%". */
export const zoomAnnouncement = (scale: number): string => `Zoomed to ${Math.round(scale * 100)}%`;

// ---------- keys (spec §8.5) ----------

/** What a key does in the lightbox. */
export type KeyAction =
  | { type: 'move'; by: -1 | 1 }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'pan'; x: -1 | 0 | 1; y: -1 | 0 | 1 }
  | { type: 'zoom'; by: -1 | 1 }
  | { type: 'fit' }
  | { type: 'info' }
  | { type: 'close' };

export interface KeyState {
  /** Zoomed past the whole item. */
  zoomed: boolean;
  /** Zoom is offered for the item shown. */
  zoomable: boolean;
  /** The focus is in a player (a video's controls): its arrows, Home and End are its own. */
  inPlayer?: boolean;
  /** Ctrl, Meta or Alt is held: the browser's (Ctrl and + is its own zoom), never the lightbox's. */
  modified?: boolean;
  /** The focus is in a text field (Copy link's fallback): its typing keys are its own. */
  inField?: boolean;
}

const PAN: Record<string, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/**
 * A key's action, or null to leave it alone. Left and Right move (wrapping) and pan while zoomed; Up and
 * Down only pan; Home and End go to the ends; + (or =) and − zoom where offered, 0 goes back to the
 * whole item; I opens or closes the info panel; Escape goes back to the whole item first, then closes.
 */
export function keyAction(key: string, s: KeyState): KeyAction | null {
  if (s.modified) return null;
  if (s.inField && key !== 'Escape') return null;
  if (key in PAN) {
    if (s.inPlayer) return null;
    if (s.zoomed) return { type: 'pan', ...PAN[key] };
    if (key === 'ArrowLeft') return { type: 'move', by: -1 };
    if (key === 'ArrowRight') return { type: 'move', by: 1 };
    return null;
  }
  switch (key) {
    case 'Home':
      return s.inPlayer ? null : { type: 'first' };
    case 'End':
      return s.inPlayer ? null : { type: 'last' };
    case '+':
    case '=':
      return s.zoomable ? { type: 'zoom', by: 1 } : null;
    case '-':
    case '−':
    case '_':
      return s.zoomable ? { type: 'zoom', by: -1 } : null;
    case '0':
      return s.zoomed ? { type: 'fit' } : null;
    case 'i':
    case 'I':
      return { type: 'info' };
    case 'Escape':
      return s.zoomed ? { type: 'fit' } : { type: 'close' };
    default:
      return null;
  }
}
