/**
 * The Albums screen (documentation/gallery/spec.md §9.1): finding and filtering the cards as typed, Add album
 * (an untitled draft made at once, then opened with its title selected), copying an album's address and deleting
 * one after asking, saying what it keeps.
 */
import { announce, api, editorUrl, refused, saveStatus, startTask } from './client';

/** Wires the Albums screen's cards (`root`, the AlbumCards part); Add album and the delete dialog are the page's. */
export function initAlbums(root: HTMLElement, signal: AbortSignal) {
  const search = root.querySelector<HTMLInputElement>('[data-albums-search] input');
  const found = root.querySelector<HTMLElement>('[data-albums-found]');
  let filter = 'all';

  const apply = () => {
    const words = (search?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const card of root.querySelectorAll<HTMLElement>('[data-album-card]')) {
      const d = card.dataset;
      const fits =
        (!words || (d.title ?? '').includes(words)) &&
        (filter === 'all' || (filter === 'drafts' && d.draft !== undefined) || (filter === 'private' && d.private !== undefined) || (filter.startsWith('section:') && d.section === filter.slice(8)));
      card.hidden = !fits;
      if (fits) shown++;
    }
    if (found) found.textContent = shown === 1 ? '1 album' : `${shown} albums`;
  };
  search?.addEventListener('input', apply, { signal });
  root.querySelector('[data-albums-filter]')?.addEventListener(
    'select-change',
    (e) => {
      filter = (e as CustomEvent<{ value: string }>).detail.value;
      apply();
    },
    { signal },
  );

  const dialog = document.querySelector<HTMLDialogElement>('#album-delete');
  let deleting: { id: string; title: string } | null = null;
  root.addEventListener(
    'click',
    async (e) => {
      const t = e.target as Element;
      const copy = t.closest<HTMLElement>('[data-albums-copy]');
      if (copy) {
        await navigator.clipboard.writeText(new URL(copy.dataset.albumsCopy!, location.origin).href).catch(() => {});
        announce('Address copied');
        return;
      }
      const del = t.closest<HTMLElement>('[data-albums-delete]');
      if (del && dialog) {
        deleting = { id: del.dataset.albumsDelete!, title: del.dataset.albumsTitle ?? '' };
        const words = dialog.querySelector('[data-album-delete-words]');
        const count = del.dataset.albumsCount;
        if (words) words.textContent = `Delete ${deleting.title}? ${count ? `Its ${count} stay in your library.` : 'It has nothing in it yet.'}`;
        dialog.showModal();
      }
    },
    { signal },
  );
  dialog?.querySelector('[data-album-delete-confirm]')?.addEventListener(
    'click',
    async () => {
      if (!deleting) return;
      const { id, title } = deleting;
      dialog.close();
      const card = root.querySelector<HTMLElement>(`[data-album-card="${CSS.escape(id)}"]`);
      saveStatus.saving();
      const task = startTask(`Deleting ${title}…`, { el: card });
      const r = await api('DELETE', `albums/${id}`, { ifMatch: {} });
      if (r.ok) {
        void task.done();
        card?.remove();
        apply();
        saveStatus.saved(`Deleted ${title}`);
      } else {
        task.failed();
        saveStatus.failed(refused(r, `${title} wasn’t deleted.`));
      }
    },
    { signal },
  );

  document.querySelector('[data-albums-new]')?.addEventListener('click', () => newAlbum(), { signal });

  // Add album from the action center (gallery spec §9.10): the address asks for one; made once, never on a reload
  const url = new URL(location.href);
  if (url.searchParams.get('new') === '1') {
    url.searchParams.delete('new');
    history.replaceState(history.state, '', url);
    void newAlbum();
  }
}

/** Add album: an untitled draft in the gallery, made at once and opened with its title selected (§9.1). */
export async function newAlbum(body: { title?: string; section?: string } = {}) {
  const task = startTask('Making the album…', { el: document.querySelector('[data-albums-new]') });
  saveStatus.saving();
  const r = await api<{ id?: string; note?: string }>('POST', 'albums', body);
  if (!r.ok || !r.data.id) {
    task.failed();
    saveStatus.failed(refused(r, 'The album wasn’t made.'));
    return;
  }
  void task.done();
  saveStatus.carry(r.data.note ? `Album added. ${r.data.note}` : 'Album added');
  location.href = editorUrl(`albums/${r.data.id}/?new=1`);
}
