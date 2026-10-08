/**
 * The inspector's separator (documentation/editor/spec.md §3.5): dragging it, or its keys, sets the
 * inspector's width (the studio's --inspector-width), held by the pure rules in model/inspector.ts and
 * kept for the next visit; a double click puts it back to its narrowest.
 */
import { clampWidth, widest, widthForKey, type WidthBounds } from '../model/inspector';

const KEY = 'editor.inspector.width';

export function initResize(studio: HTMLElement, signal: AbortSignal): void {
  const handle = studio.querySelector<HTMLElement>('[data-editor-resize]');
  if (!handle) return;
  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const token = (name: string, fallback: number) => parseFloat(getComputedStyle(studio).getPropertyValue(name)) || fallback;
  const bounds = (): WidthBounds => {
    const outline = studio.querySelector<HTMLElement>('.outline');
    const shown = outline && getComputedStyle(outline).display !== 'none' ? outline.getBoundingClientRect().width : 0;
    return {
      min: token('--c-editor-inspector', 24),
      max: token('--c-editor-inspector-max', 60),
      room: (studio.clientWidth - shown) / remPx(),
      canvasMin: token('--c-editor-canvas-min', 24),
    };
  };
  let width = bounds().min;
  const apply = (w: number, keep: boolean) => {
    const b = bounds();
    width = clampWidth(w, b);
    studio.style.setProperty('--inspector-width', `${width}rem`);
    handle.setAttribute('aria-valuemin', String(b.min));
    handle.setAttribute('aria-valuemax', String(Math.round(widest(b))));
    handle.setAttribute('aria-valuenow', String(Math.round(width)));
    handle.setAttribute('aria-valuetext', `${Math.round(width)} rem wide`);
    if (keep) localStorage.setItem(KEY, String(width));
  };
  // the width kept from last time, held to this window
  const kept = Number(localStorage.getItem(KEY));
  apply(kept || width, false);

  handle.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = width;
      const rtl = getComputedStyle(studio).direction === 'rtl';
      handle.dataset.dragging = '';
      studio.dataset.resizing = '';
      const move = (ev: PointerEvent) => {
        // the separator is the inspector's start edge: towards the canvas widens it
        const by = (rtl ? ev.clientX - startX : startX - ev.clientX) / remPx();
        apply(startW + by, false);
      };
      const end = () => {
        handle.removeEventListener('pointermove', move);
        delete handle.dataset.dragging;
        delete studio.dataset.resizing;
        apply(width, true);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end, { once: true });
      handle.addEventListener('pointercancel', end, { once: true });
    },
    { signal },
  );
  handle.addEventListener(
    'keydown',
    (e) => {
      const next = widthForKey(e.key, e.shiftKey, width, bounds());
      if (next === null) return;
      e.preventDefault();
      apply(next, true);
    },
    { signal },
  );
  handle.addEventListener('dblclick', () => apply(bounds().min, true), { signal });
  // a narrower window can't keep a width it has no room for (the kept width comes back when it can)
  window.addEventListener('resize', () => apply(Number(localStorage.getItem(KEY)) || width, false), { signal });
}
