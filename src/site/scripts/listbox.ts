/**
 * The custom select's keyboard model (docs: documentation/site-ui/design-system.md §2, §7): the WAI-ARIA
 * APG "select-only combobox" (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).
 * Pure: the component's script (`select.ts`) turns keys into actions with it, places the list with it, then
 * moves the DOM.
 */

export type ListAction =
  | { type: 'none' }
  | { type: 'open'; active: number }
  | { type: 'move'; active: number }
  | { type: 'commit'; active: number; close: true; keepFocus: boolean }
  | { type: 'close' }
  | { type: 'type'; char: string };

export interface ListState {
  open: boolean;
  /** The option with visual focus (open) or the selected one (closed); -1 if none. */
  active: number;
  count: number;
}

export interface KeyInput {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** How far PageUp / PageDown jump. */
export const PAGE = 10;

const clamp = (i: number, n: number) => Math.max(0, Math.min(n - 1, i));

/** What a key does to a select-only combobox. */
export function keyAction(e: KeyInput, s: ListState): ListAction {
  const { key } = e;
  const n = s.count;
  if (n === 0) return { type: 'none' };
  const cur = s.active < 0 ? 0 : s.active;
  if (!s.open) {
    switch (key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        return { type: 'open', active: cur };
      case 'ArrowUp':
        return { type: 'open', active: e.altKey ? cur : 0 };
      case 'Home':
        return { type: 'open', active: 0 };
      case 'End':
        return { type: 'open', active: n - 1 };
    }
    return printable(e) ? { type: 'type', char: key } : { type: 'none' };
  }
  switch (key) {
    case 'ArrowDown':
      return { type: 'move', active: clamp(cur + 1, n) };
    case 'ArrowUp':
      return e.altKey ? { type: 'commit', active: cur, close: true, keepFocus: true } : { type: 'move', active: clamp(cur - 1, n) };
    case 'Home':
      return { type: 'move', active: 0 };
    case 'End':
      return { type: 'move', active: n - 1 };
    case 'PageDown':
      return { type: 'move', active: clamp(cur + PAGE, n) };
    case 'PageUp':
      return { type: 'move', active: clamp(cur - PAGE, n) };
    case 'Enter':
    case ' ':
      return { type: 'commit', active: cur, close: true, keepFocus: true };
    case 'Tab':
      return { type: 'commit', active: cur, close: true, keepFocus: false };
    case 'Escape':
      return { type: 'close' };
  }
  return printable(e) ? { type: 'type', char: key } : { type: 'none' };
}

export function printable(e: KeyInput): boolean {
  return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/**
 * Typeahead, as the APG example does it: the first option after `from` (wrapping) whose label starts
 * with what's been typed; failing that, if every typed letter is the same ("sss"), the next option
 * starting with that letter, so repeating a letter cycles through them. Returns -1 when nothing matches.
 */
export function matchIndex(labels: string[], typed: string, from: number): number {
  const q = typed.toLowerCase();
  const n = labels.length;
  if (!q || n === 0) return -1;
  const order = Array.from({ length: n }, (_, k) => (((from + 1 + k) % n) + n) % n);
  const hit = order.find((i) => labels[i].toLowerCase().startsWith(q));
  if (hit !== undefined) return hit;
  if ([...q].every((c) => c === q[0])) {
    const again = order.find((i) => labels[i].toLowerCase().startsWith(q[0]));
    if (again !== undefined) return again;
  }
  return -1;
}

/** How long the typed string is kept between keys (ms). */
export const TYPEAHEAD_MS = 600;

/** What's been typed so far, and when the last key came (ms). */
export interface Typed {
  text: string;
  at: number;
}

/** The typeahead's string after a key at `now`: started again after a pause longer than TYPEAHEAD_MS. */
export function typeahead(prev: Typed, char: string, now: number): Typed {
  return { text: now - prev.at > TYPEAHEAD_MS ? char : prev.text + char, at: now };
}

/**
 * The option chosen when the select is drawn: the one whose value is `value`; failing that, none if
 * there's a placeholder to show, else the first. -1 when none.
 */
export function initialIndex(values: readonly string[], value?: string, placeholder?: string): number {
  const i = values.indexOf(value as string);
  if (value !== undefined && i >= 0) return i;
  return placeholder || values.length === 0 ? -1 : 0;
}

/** The combobox's aria-describedby: its hint's and its error's ids, or nothing. */
export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

/** How far the open list keeps from the window's edges (px); half of it at the sides. */
export const LIST_MARGIN = 16;

/** Whether the list opens above its button: there isn't room for it below, and there's more above. */
export function opensUp(below: number, above: number, listHeight: number, margin = LIST_MARGIN): boolean {
  return below < listHeight + margin && above > below;
}

/** The height the open list may take: the room on its side, less a margin at each end. */
export function listRoom(up: boolean, above: number, below: number, margin = LIST_MARGIN): number {
  return Math.max(0, (up ? above : below) - margin * 2);
}

/** The open list's left edge: lined up with its button's start or end, kept inside the window. */
export function listLeft(button: { left: number; right: number }, width: number, alignEnd: boolean, viewport: number, margin = LIST_MARGIN): number {
  const left = alignEnd ? button.right - width : button.left;
  return Math.max(margin / 2, Math.min(left, viewport - width - margin / 2));
}

/** The open list's top edge (before the CSS gap): under its button, or its own height over it. */
export function listTop(up: boolean, button: { top: number; bottom: number }, height: number): number {
  return up ? button.top - height : button.bottom;
}
