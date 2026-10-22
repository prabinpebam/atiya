/**
 * The library's timeline (components/MediaLibrary.astro; documentation/gallery/spec.md §9.9): picking in the grid
 * (photoSelection), opening one item in the details beside it, the filter, the selection bar (Add to album, Set the
 * date and Set the place go to albumActions; Delete asks first, saying which albums it leaves, and is refused while
 * a page uses it) and Add link (a linked video).
 */
import { api, announce, describeIssue, saveStatus, startTask, swapRegions } from './client';
import { initPhotoSelection } from './photoSelection';
import { deleteVerdict } from '../model/library';

type Uses = Record<string, { albums: string[]; articles: string[] }>;
const DETAILS = ['media-details', 'media-info'];
const many = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

export function initLibraryScreen(root: HTMLElement, signal: AbortSignal) {
  const bar = root.querySelector<HTMLElement>('[data-library-selbar]');
  const count = root.querySelector<HTMLElement>('[data-library-count]');
  const uses = (): Uses => {
    try {
      return JSON.parse(root.querySelector('[data-library-uses]')?.textContent ?? '{}');
    } catch {
      return {};
    }
  };
  let opened = new URL(location.href).searchParams.get('id');
  const address = (change: (p: URLSearchParams) => void) => {
    const url = new URL(location.href);
    change(url.searchParams);
    return url;
  };
  const open = async (id: string) => {
    if (id === opened) return;
    opened = id;
    const url = address((p) => p.set('id', id));
    history.pushState(null, '', url);
    await swapRegions(DETAILS, url.href, () => opened !== id, { label: 'Showing its details…' });
  };
  const sel = initPhotoSelection(root, signal, {
    change(picked) {
      if (bar) bar.hidden = picked.length === 0;
      if (count) count.textContent = `${picked.length} selected`;
      if (picked.length === 1) void open(picked[0]!);
    },
    open: (id) => void open(id),
    remove: (ids) => ask(ids),
  });
  // a redraw of the grid (here or by the details' tools) draws it unpicked: pick again what was picked
  const repaint = () => sel.set(sel.picked().length ? sel.picked() : opened ? [opened] : []);
  repaint();
  document.addEventListener('astro:page-load', repaint, { signal });
  const redraw = async (names: string[], url = location.href, quiet = false) => {
    await swapRegions(names, url, undefined, quiet ? { quiet: true } : { label: 'Updating the library…' });
  };

  // ---------- the filter ----------
  root.addEventListener(
    'select-change',
    (e) => {
      if (!(e.target as Element).closest('[data-library-filter]')) return;
      const v = (e as CustomEvent<{ value: string }>).detail.value;
      const url = address((p) => (v === 'all' ? p.delete('show') : p.set('show', v)));
      history.replaceState(null, '', url);
      void redraw(['media-grid'], url.href);
    },
    { signal },
  );

  // ---------- the selection bar ----------
  root.addEventListener(
    'click',
    (e) => {
      const act = (e.target as Element).closest<HTMLElement>('[data-library-act]')?.dataset.libraryAct;
      if (!act) return;
      const ids = sel.picked();
      if (act === 'clear') return sel.set([]);
      if (act === 'delete') return ask(ids);
      root.dispatchEvent(new CustomEvent('album:selection', { detail: { what: act, ids } }));
    },
    { signal },
  );
  root.addEventListener('album:redraw', () => void redraw(['media-grid', 'media-info'], location.href, true), { signal });

  // ---------- deleting ----------
  const dialog = document.getElementById(root.dataset.libraryDelete ?? '') as HTMLDialogElement | null;
  let doomed: string[] = [];
  const ask = (ids: string[]) => {
    if (!ids.length || !dialog) return;
    const known = uses();
    const v = deleteVerdict(ids.map((id) => known[id] ?? { albums: [], articles: [] }));
    doomed = v.ok ? ids : [];
    const title = document.getElementById(`${dialog.id}-title`);
    if (title) title.textContent = v.ok ? v.title : "Can't delete";
    const words = dialog.querySelector('[data-library-delete-words]');
    if (words) words.textContent = v.ok ? v.words : v.why;
    const ok = dialog.querySelector<HTMLElement>('[data-library-delete-ok]');
    if (ok) ok.hidden = !v.ok;
    dialog.showModal();
  };
  dialog?.addEventListener(
    'click',
    async (e) => {
      const button = (e.target as Element).closest<HTMLElement>('[data-library-delete-confirm]');
      if (!button || !doomed.length || button.getAttribute('aria-busy') === 'true') return;
      const ids = doomed;
      const task = startTask(`Deleting ${many(ids.length)}…`, { el: button, busyLabel: 'Deleting…' });
      saveStatus.saving();
      const r = await api<{ albums: number }>('POST', 'media-delete', { ids });
      if (!r.ok) {
        task.failed();
        const why = (r.data.issues ?? []).map(describeIssue).join(' ') || 'Nothing was deleted.';
        saveStatus.failed(`Not deleted: ${why}`);
        const words = dialog.querySelector('[data-library-delete-words]');
        if (words) words.textContent = why;
        return;
      }
      void task.done();
      dialog.close();
      doomed = [];
      const albums = r.data.albums ? ` and from ${r.data.albums === 1 ? 'its album' : `${r.data.albums} albums`}` : '';
      saveStatus.saved(`Deleted ${many(ids.length)} from your library${albums}`);
      const gone = new Set(ids);
      sel.set(sel.picked().filter((id) => !gone.has(id)));
      if (opened && gone.has(opened)) {
        opened = null;
        history.replaceState(null, '', address((p) => p.delete('id')));
      }
      await redraw(['media-grid', ...DETAILS], location.href, true);
    },
    { signal },
  );

  // ---------- Add link ----------
  const link = document.getElementById(root.dataset.libraryLink ?? '') as HTMLDialogElement | null;
  link?.addEventListener(
    'click',
    async (e) => {
      const button = (e.target as Element).closest<HTMLElement>('[data-library-link-add]');
      if (!button || button.getAttribute('aria-busy') === 'true') return;
      const field = link.querySelector<HTMLInputElement>('[name="url"]');
      const problem = link.querySelector<HTMLElement>('[data-library-link-problem]');
      const say = (text: string) => {
        if (!problem) return;
        problem.textContent = text;
        problem.hidden = !text;
      };
      const url = field?.value.trim() ?? '';
      if (!url) return say('Paste a YouTube or Vimeo address.');
      say('');
      const task = startTask('Adding the video…', { el: button, busyLabel: 'Adding…' });
      const r = await api<{ id: string; existing?: boolean; title?: string }>('POST', 'linked-video', { url });
      if (!r.ok) {
        task.failed();
        return say((r.data.issues ?? []).map(describeIssue).join(' ') || 'It wasn’t added.');
      }
      void task.done();
      link.close();
      if (field) field.value = '';
      saveStatus.saved(r.data.existing ? 'That video is already in your library' : `Added ${r.data.title ? `“${r.data.title}”` : 'the video'} to your library`);
      opened = r.data.id;
      const next = address((p) => p.set('id', r.data.id));
      history.pushState(null, '', next);
      await redraw(['media-grid', ...DETAILS], next.href);
      if (!root.querySelector(`li[data-item="${CSS.escape(r.data.id)}"]`)) announce('It’s in your library; the filter chosen doesn’t show it.');
    },
    { signal },
  );
}
