/**
 * The Sections and Planet boards (documentation/sections/spec.md §7.2, §7.4): moving a page between
 * columns, and within one, by dragging its handle, by Alt with the arrow keys, or with Move (the dialog its
 * handle opens: the single-pointer way, WCAG 2.5.7); and Find, which narrows every column at once. A move
 * is reported as a \`board:move\` event on the board ({ page, from, to, index, fromIndex }, \`index\` being
 * where it lands once it has left its place); the screen decides what that writes. The screen reports a
 * refusal back with \`board:issue\`.
 */
import { announce } from './client';

export interface BoardMove {
  page: string;
  /** The column it leaves, and its place there. */
  from: string;
  fromIndex: number;
  /** The column it goes to, and its place there once it has left its old one. */
  to: string;
  index: number;
}

const SCROLL = (path: string) => `editor.board.scroll.${path}`;
const EDGE = 48;
const STEP = 16;

/** What scrolls the board: the nearest ancestor that scrolls, or the page. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

export function initBoard(root: HTMLElement, signal: AbortSignal) {
  const columns = () => [...root.querySelectorAll<HTMLElement>('[data-board-column]')];
  const cardsOf = (col: Element) => [...col.querySelectorAll<HTMLElement>('[data-board-card]')];
  const nameOf = (col: Element) => col.querySelector('h2')?.textContent?.trim() ?? '';
  const issue = root.querySelector<HTMLElement>('[data-board-issue]');
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => el.addEventListener(type, fn, { signal });

  const emit = (m: BoardMove) => {
    if (m.from === m.to && m.index === m.fromIndex) return;
    sessionStorage.setItem(SCROLL(location.pathname), String(scrollerOf(root).scrollTop));
    if (issue) issue.hidden = true;
    root.dispatchEvent(new CustomEvent<BoardMove>('board:move', { detail: m }));
  };
  on(root, 'board:issue' as keyof HTMLElementEventMap, (e) => {
    if (!issue) return;
    issue.textContent = (e as unknown as CustomEvent<string>).detail;
    issue.hidden = false;
  });

  // back where the last change left the board
  const scrolled = Number(sessionStorage.getItem(SCROLL(location.pathname)) ?? 0);
  if (scrolled) scrollerOf(root).scrollTop = scrolled;
  addEventListener('pagehide', () => sessionStorage.setItem(SCROLL(location.pathname), String(scrollerOf(root).scrollTop)), { signal });

  // ---------- Find: every column at once ----------
  const find = root.querySelector<HTMLInputElement>('[data-board-filter] input');
  if (find) {
    on(find, 'input', () => {
      const q = find.value.trim().toLowerCase();
      for (const card of root.querySelectorAll<HTMLElement>('[data-board-card]')) card.hidden = !!q && !(card.dataset.title ?? '').includes(q);
      const shown = root.querySelectorAll('[data-board-card]:not([hidden])').length;
      announce(q ? `${shown} ${shown === 1 ? 'page' : 'pages'} match` : 'Every page shows');
    });
  }

  // ---------- where a drop lands ----------
  const clearMarks = () => {
    for (const el of root.querySelectorAll<HTMLElement>('[data-drop], [data-drop-target]')) {
      delete el.dataset.drop;
      delete el.dataset.dropTarget;
    }
  };
  /** The column under the pointer, and the place in it (among the pages that show, the dragged one aside). */
  const landing = (x: number, y: number, dragged: HTMLElement) => {
    const col = columns().find((c) => {
      const b = c.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    });
    if (!col) return null;
    const all = cardsOf(col).filter((c) => c !== dragged);
    const shown = all.filter((c) => !c.hidden);
    const at = shown.findIndex((c) => {
      const b = c.getBoundingClientRect();
      return y < b.top + b.height / 2;
    });
    const index = at < 0 ? (shown.length ? all.indexOf(shown[shown.length - 1]) + 1 : all.length) : all.indexOf(shown[at]);
    return { col, index, before: at < 0 ? null : shown[at], after: at < 0 ? (shown[shown.length - 1] ?? null) : null };
  };

  // ---------- dragging a handle ----------
  let dragged = false;
  on(root, 'pointerdown', (e) => {
    const grip = (e.target as Element).closest<HTMLButtonElement>('[data-board-grip]');
    if (!grip || grip.disabled || e.button !== 0) return;
    const card = grip.closest<HTMLElement>('[data-board-card]')!;
    const from = card.closest<HTMLElement>('[data-board-column]')!;
    const fromIndex = cardsOf(from).indexOf(card);
    const start = { x: e.clientX, y: e.clientY };
    let ghost: HTMLElement | null = null;
    let target: ReturnType<typeof landing> = null;
    let at = start;
    let frame = 0;
    const scroller = scrollerOf(root);
    dragged = false;
    grip.setPointerCapture(e.pointerId);

    const mark = () => {
      clearMarks();
      target = landing(at.x, at.y, card);
      if (!target) return;
      target.col.dataset.dropTarget = '';
      if (target.before) target.before.dataset.drop = 'before';
      else if (target.after) target.after.dataset.drop = 'after';
    };
    /** Near an edge, the screen and the column's list scroll along, for as long as the pointer stays there. */
    const edges = () => {
      frame = 0;
      const page = scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : scroller.getBoundingClientRect();
      const top = scroller.scrollTop;
      if (at.y < page.top + EDGE) scroller.scrollTop -= STEP;
      else if (at.y > page.bottom - EDGE) scroller.scrollTop += STEP;
      const list = target?.col.querySelector<HTMLElement>('[data-board-list]');
      const listTop = list?.scrollTop ?? 0;
      if (list) {
        const b = list.getBoundingClientRect();
        if (at.y < b.top + EDGE / 2) list.scrollTop -= STEP;
        else if (at.y > b.bottom - EDGE / 2) list.scrollTop += STEP;
      }
      if (scroller.scrollTop === top && (list?.scrollTop ?? 0) === listTop) return;
      mark();
      frame = requestAnimationFrame(edges);
    };

    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        dragged = true;
        card.dataset.dragging = '';
        ghost = card.cloneNode(true) as HTMLElement;
        ghost.dataset.ghost = '';
        ghost.removeAttribute('data-board-card');
        ghost.setAttribute('aria-hidden', 'true');
        root.append(ghost);
      }
      ghost.style.setProperty('--x', `${ev.clientX}px`);
      ghost.style.setProperty('--y', `${ev.clientY}px`);
      at = { x: ev.clientX, y: ev.clientY };
      mark();
      if (!frame) frame = requestAnimationFrame(edges);
    };
    const up = () => {
      cancelAnimationFrame(frame);
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      clearMarks();
      delete card.dataset.dragging;
      ghost?.remove();
      if (ghost && target) emit({ page: card.dataset.boardCard!, from: from.dataset.boardColumn!, fromIndex, to: target.col.dataset.boardColumn!, index: target.index });
    };
    grip.addEventListener('pointermove', move, { signal });
    grip.addEventListener('pointerup', up, { signal });
    grip.addEventListener('pointercancel', up, { signal });
  });

  // ---------- the keys, on a handle ----------
  on(root, 'keydown', (e) => {
    const grip = (e.target as Element).closest<HTMLButtonElement>('[data-board-grip]');
    if (!grip || !e.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const card = grip.closest<HTMLElement>('[data-board-card]')!;
    const from = card.closest<HTMLElement>('[data-board-column]')!;
    const fromIndex = cardsOf(from).indexOf(card);
    const page = card.dataset.boardCard!;
    const cols = columns();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const index = fromIndex + (e.key === 'ArrowUp' ? -1 : 1);
      if (index < 0 || index >= cardsOf(from).length) return;
      return emit({ page, from: from.dataset.boardColumn!, fromIndex, to: from.dataset.boardColumn!, index });
    }
    const to = cols[cols.indexOf(from) + (e.key === 'ArrowLeft' ? -1 : 1)];
    if (!to) return;
    emit({ page, from: from.dataset.boardColumn!, fromIndex, to: to.dataset.boardColumn!, index: cardsOf(to).length });
  });

  // ---------- Move: the handle's click, without dragging ----------
  const dialog = root.querySelector<HTMLDialogElement>('#board-move');
  let moving: { page: string; from: string; fromIndex: number; count: number } | null = null;
  on(root, 'click', (e) => {
    const grip = (e.target as Element).closest<HTMLButtonElement>('[data-board-grip]');
    if (grip) {
      // (a drag ends in a click too: only a press that didn't move opens Move)
      if (dragged) return void (dragged = false);
      const card = grip.closest<HTMLElement>('[data-board-card]')!;
      const from = card.closest<HTMLElement>('[data-board-column]')!;
      const count = cardsOf(from).length;
      moving = { page: card.dataset.boardCard!, from: from.dataset.boardColumn!, fromIndex: cardsOf(from).indexOf(card), count };
      const title = card.querySelector('.title')?.textContent?.trim() ?? '';
      const name = dialog?.querySelector('[data-board-move-name]');
      if (name) name.textContent = `${title}, in ${nameOf(from)}`;
      dialog?.querySelectorAll<HTMLButtonElement>('[data-board-move-to]').forEach((b) => (b.disabled = b.dataset.boardMoveTo === moving!.from));
      dialog?.querySelectorAll<HTMLButtonElement>('[data-board-move-by]').forEach((b) => {
        const i = moving!.fromIndex + Number(b.dataset.boardMoveBy);
        b.disabled = i < 0 || i >= count;
      });
      dialog?.showModal();
      return;
    }
    const by = (e.target as Element).closest<HTMLElement>('[data-board-move-by]');
    const to = (e.target as Element).closest<HTMLElement>('[data-board-move-to]');
    if (!moving || (!by && !to)) return;
    const m = moving;
    dialog?.close();
    if (by) emit({ page: m.page, from: m.from, fromIndex: m.fromIndex, to: m.from, index: m.fromIndex + Number(by.dataset.boardMoveBy) });
    else {
      const col = columns().find((c) => c.dataset.boardColumn === to!.dataset.boardMoveTo);
      if (col) emit({ page: m.page, from: m.from, fromIndex: m.fromIndex, to: col.dataset.boardColumn!, index: cardsOf(col).length });
    }
  });
}
