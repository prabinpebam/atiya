/**
 * The inspector's width and its sections (documentation/editor/spec.md §3.5): pure rules for the
 * separator that resizes it and for which section shows when it's wide enough for two columns (the
 * sections listed beside the chosen one's fields).
 */

/** The narrowest and widest the inspector gets, and the least the canvas keeps beside it (rem). */
export interface WidthBounds {
  min: number;
  max: number;
  /** The window's width less everything but the canvas and the inspector (rem). */
  room: number;
  canvasMin: number;
}

/** The widest the inspector can be now: its own most, and never so wide the canvas falls under its least. */
export const widest = (b: WidthBounds): number => Math.max(b.min, Math.min(b.max, b.room - b.canvasMin));

/** A width (rem) held between the narrowest and the widest, to a sixteenth of a rem. */
export const clampWidth = (w: number, b: WidthBounds): number => Math.round(Math.min(widest(b), Math.max(b.min, Number.isFinite(w) ? w : b.min)) * 16) / 16;

/**
 * A key on the separator, as the APG window splitter: it sits on the inspector's start edge, so Left
 * widens it and Right narrows it (a step, or four with Shift); Home makes it its narrowest, End its
 * widest. Null for any other key.
 */
export function widthForKey(key: string, shift: boolean, w: number, b: WidthBounds): number | null {
  const step = shift ? 4 : 1;
  if (key === 'ArrowLeft') return clampWidth(w + step, b);
  if (key === 'ArrowRight') return clampWidth(w - step, b);
  if (key === 'Home') return b.min;
  if (key === 'End') return widest(b);
  return null;
}

/** An item's section key in a collection's settings (one section an item). */
export const itemKey = (n: number): string => `item-${n}`;
const itemOf = (key: string | undefined): number | null => {
  const m = key ? /^item-(\d+)$/.exec(key) : null;
  return m ? Number(m[1]) : null;
};

/**
 * The section to show after the items moved (one item from a place to another): the item that was
 * shown keeps being shown wherever it went, and an item it passed over keeps its own.
 */
export function followMove(current: string | undefined, from: number, to: number): string | undefined {
  const n = itemOf(current);
  if (n === null || from === to) return current;
  if (n === from) return itemKey(to);
  if (from < n && n <= to) return itemKey(n - 1);
  if (to <= n && n < from) return itemKey(n + 1);
  return current;
}

/** The section to show after an item was removed: the item before it (or the new first), and the others keep theirs. */
export function followRemove(current: string | undefined, removed: number): string | undefined {
  const n = itemOf(current);
  if (n === null || n < removed) return current;
  return itemKey(Math.max(0, n - 1));
}
