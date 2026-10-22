/**
 * Choosing pictures in a PhotoGrid (kit/PhotoGrid.astro), as in a photo app: a click picks one, Shift a range,
 * Ctrl or ⌘ adds or takes away (and once anything is picked, a click adds or takes away); the arrows move along
 * the grid as it's drawn, Space picks, Enter opens, Ctrl+A picks all, Escape clears, Delete asks. The album
 * editor has its own (it also moves items); the library (spec §9.9) uses this.
 */
import { pickRange, pickToggle } from '../model/album';

/** Up or down a row of the grid as it's drawn (days flow side by side): the offset to the nearest cell in the next row, 0 at an edge. */
export function rowStep(all: HTMLElement[], at: number, dir: 1 | -1): number {
  const box = (el: HTMLElement) => el.getBoundingClientRect();
  const here = box(all[at]!);
  const x = here.left + here.width / 2;
  const beyond = all.map((el, i) => ({ i, r: box(el) })).filter(({ r }) => (dir > 0 ? r.top > here.bottom - 1 : r.bottom < here.top + 1));
  if (!beyond.length) return 0;
  const rowTop = dir > 0 ? Math.min(...beyond.map(({ r }) => r.top)) : Math.max(...beyond.map(({ r }) => r.top));
  const row = beyond.filter(({ r }) => Math.abs(r.top - rowTop) < 1);
  const best = row.reduce((a, b) => (Math.abs(b.r.left + b.r.width / 2 - x) < Math.abs(a.r.left + a.r.width / 2 - x) ? b : a));
  return best.i - at;
}

export interface PhotoSelection {
  /** What's picked, in the grid's order. */
  picked(): string[];
  /** Picks exactly these (none clears). */
  set(ids: string[]): void;
}

/** Wires the grid's cells (`li[data-item]`, the visible ones) under root; reports every change of what's picked. */
export function initPhotoSelection(
  root: HTMLElement,
  signal: AbortSignal,
  on: { change(picked: string[]): void; open(id: string): void; remove?(ids: string[]): void },
): PhotoSelection {
  let picked: string[] = [];
  let anchor: string | undefined;
  const cells = () => [...root.querySelectorAll<HTMLElement>('li[data-item]')].filter((c) => !c.hidden && !c.closest('[hidden]'));
  const order = () => cells().map((c) => c.dataset.item!);
  const paint = () => {
    const shown = new Set(order());
    picked = picked.filter((id) => shown.has(id));
    const set = new Set(picked);
    for (const c of root.querySelectorAll<HTMLElement>('li[data-item]')) c.setAttribute('aria-selected', String(set.has(c.dataset.item!)));
    root.querySelector('[data-photo-grid]')?.toggleAttribute('data-selecting', picked.length > 0);
    on.change(picked);
  };
  const focusCell = (c: HTMLElement | undefined) => {
    if (!c) return;
    for (const o of root.querySelectorAll<HTMLElement>('li[data-item]')) o.tabIndex = o === c ? 0 : -1;
    c.focus();
  };
  const pick = (id: string, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }, fromCheck: boolean) => {
    if (e.shiftKey) picked = pickRange(order(), anchor ?? null, id);
    else if (e.ctrlKey || e.metaKey || fromCheck || picked.length) picked = pickToggle(order(), picked, id);
    else picked = [id];
    if (!e.shiftKey) anchor = id;
    paint();
  };
  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const cell = t.closest<HTMLElement>('li[data-item]');
      if (!cell || !root.contains(cell)) return;
      focusCell(cell);
      pick(cell.dataset.item!, e, !!t.closest('.check'));
    },
    { signal },
  );
  root.addEventListener(
    'dblclick',
    (e) => {
      const cell = (e.target as Element).closest<HTMLElement>('li[data-item]');
      if (cell) on.open(cell.dataset.item!);
    },
    { signal },
  );
  root.addEventListener(
    'keydown',
    (e) => {
      const cell = (e.target as Element).closest<HTMLElement>('li[data-item]');
      if (!cell) return;
      const id = cell.dataset.item!;
      const all = cells();
      const at = all.indexOf(cell);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: rowStep(all, at, -1), ArrowDown: rowStep(all, at, 1), Home: -at, End: all.length - 1 - at }[e.key];
      if (step !== undefined) {
        e.preventDefault();
        const to = all[Math.min(all.length - 1, Math.max(0, at + step))];
        focusCell(to);
        if (e.shiftKey && to) {
          picked = pickRange(order(), anchor ?? id, to.dataset.item!);
          paint();
        }
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        picked = pickToggle(order(), picked, id);
        anchor = id;
        return paint();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        return on.open(id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        picked = order();
        return paint();
      }
      if (e.key === 'Escape' && picked.length) {
        e.preventDefault();
        picked = [];
        return paint();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && on.remove) {
        e.preventDefault();
        on.remove(picked.length ? picked : [id]);
      }
    },
    { signal },
  );
  return {
    picked: () => picked,
    set: (ids) => {
      picked = ids;
      paint();
    },
  };
}
