/**
 * The albums list (documentation/gallery/spec.md §9.2): New album, and the gallery's albums moved by their
 * handles (a drag, or Alt with Up or Down on a handle or an album), saved at once as the owner's own order.
 */
import { announce, api, describeIssue, saveStatus, startTask, swapRegions } from './client';
import { newAlbum } from './albums';

const rowsOf = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(':scope > [data-album-row]')];
const orderOf = (list: HTMLElement) => rowsOf(list).map((r) => r.dataset.albumRow!);
const titleOf = (row: HTMLElement) => row.querySelector('[data-link-name]')?.textContent ?? 'The album';

/** Wires one albums list (`root`, the AlbumList part). */
export function initAlbumList(root: HTMLElement, signal: AbortSignal) {
  root.querySelector('[data-album-list-new]')?.addEventListener('click', () => void newAlbum(), { signal });
  const list = root.querySelector<HTMLElement>('[data-album-list-rows]');
  const gallery = root.dataset.gallery;
  if (!list || !gallery) return;

  const save = async (before: string[], row: HTMLElement) => {
    const after = orderOf(list);
    if (after.join() === before.join()) return;
    const at = after.indexOf(row.dataset.albumRow!) + 1;
    announce(`${titleOf(row)} moved to place ${at} of ${after.length}`);
    saveStatus.saving();
    const task = startTask('Saving the order…', { el: row });
    const r = await api('PUT', `gallery/${gallery}/order`, { albums: after });
    if (!r.ok) {
      task.failed();
      saveStatus.failed(r.data.issues?.map(describeIssue).join(' ') || "Couldn't save the order");
      for (const id of before) {
        const el = list.querySelector(`:scope > [data-album-row="${CSS.escape(id)}"]`);
        if (el) list.append(el);
      }
      return;
    }
    void task.done();
    saveStatus.saved('Order saved: your own order');
    // the gallery's entry now says "Your own order"; the focus stays on the moved album's handle
    const focus = document.activeElement?.closest('[data-album-row]') ? row.dataset.albumRow : undefined;
    await swapRegions(['album-list']);
    if (focus) document.querySelector<HTMLElement>(`[data-album-list-move="${CSS.escape(focus)}"]`)?.focus();
  };

  // Alt with Up or Down: one place up or down
  list.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const row = (e.target as Element).closest<HTMLElement>('[data-album-row]');
      if (!row) return;
      e.preventDefault();
      const before = orderOf(list);
      const next = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (!next) return;
      if (e.key === 'ArrowUp') next.before(row);
      else next.after(row);
      (e.target as HTMLElement).focus();
      void save(before, row);
    },
    { signal },
  );

  // a drag by the handle: the row follows the pointer among the others, and lands where it's let go
  list.addEventListener(
    'pointerdown',
    (e) => {
      const handle = (e.target as Element).closest<HTMLElement>('[data-album-list-move]');
      if (!handle || e.button !== 0) return;
      const row = handle.closest<HTMLElement>('[data-album-row]')!;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const before = orderOf(list);
      row.dataset.moving = '';
      const move = (m: PointerEvent) => {
        const over = rowsOf(list).find((r) => {
          if (r === row) return false;
          const b = r.getBoundingClientRect();
          return m.clientY >= b.top && m.clientY <= b.bottom;
        });
        if (!over) return;
        const b = over.getBoundingClientRect();
        if (m.clientY < b.top + b.height / 2) over.before(row);
        else over.after(row);
      };
      const end = () => {
        handle.removeEventListener('pointermove', move);
        delete row.dataset.moving;
        void save(before, row);
      };
      handle.addEventListener('pointermove', move, { signal });
      handle.addEventListener('pointerup', end, { once: true, signal });
      handle.addEventListener('pointercancel', end, { once: true, signal });
    },
    { signal },
  );
}
