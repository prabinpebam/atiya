/**
 * What the album editor's selection (and the viewer's Add to album) does to several items at once
 * (components/AlbumBulk.astro; documentation/gallery/spec.md §9.3): Add to album (another, or a new one), Set the
 * date and Set the place (on each picture's own words, §4, in one save) and Downloads (this album's, handed to the
 * album editor's save). `album:selection` opens the dialog for the chosen items.
 */
import { announce, api, describeIssue, saveStatus, startTask } from './client';
import { batchProblem, type WordsChange } from '../model/albumViewer';
import type { Album } from '../../content/schema';

type Bulk = 'album' | 'date' | 'place' | 'download';
const DIALOG: Record<Bulk, string> = { album: 'album-add-to', date: 'album-date', place: 'album-place', download: 'album-downloads' };
const NEW = '+new';

export function initAlbumActions(root: HTMLElement, signal: AbortSignal) {
  let ids: string[] = [];
  const album = (): { id: string; album: Album } | null => {
    try {
      return JSON.parse(root.querySelector('[data-album-state]')?.textContent ?? '');
    } catch {
      return null;
    }
  };
  /** The library items behind the chosen album items (a text card has none). */
  const mediaOf = (chosen: string[]) => {
    const items = album()?.album.items ?? [];
    return chosen.flatMap((id) => {
      const it = items.find((i) => i.id === id);
      return it && 'media' in it ? [it.media] : [];
    });
  };
  const dialog = (what: Bulk) => document.getElementById(DIALOG[what]) as HTMLDialogElement | null;
  const part = (what: Bulk) => dialog(what)?.querySelector<HTMLElement>(`[data-album-bulk="${what}"]`) ?? null;
  const say = (what: Bulk, text: string) => {
    const note = part(what)?.querySelector<HTMLElement>('[data-bulk-problem]');
    if (!note) return;
    note.textContent = text;
    note.hidden = !text;
  };
  const many = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

  root.addEventListener(
    'album:selection',
    (e) => {
      const d = (e as CustomEvent<{ what: Bulk; ids: string[] }>).detail;
      const media = mediaOf(d.ids);
      if (d.what !== 'download' && !media.length) return announce('A text card has no picture to change: choose pictures or videos.');
      ids = d.ids;
      const el = part(d.what);
      const count = el?.querySelector('[data-bulk-count]');
      if (count) count.textContent = d.what === 'download' ? `For ${many(d.ids.length, 'item')} in this album` : `For ${many(media.length, 'selected item')}`;
      say(d.what, '');
      dialog(d.what)?.showModal();
    },
    { signal },
  );
  root.addEventListener(
    'select-change',
    (e) => {
      const sel = (e.target as Element).closest('[data-bulk-album]');
      if (!sel) return;
      const wrap = part('album')?.querySelector<HTMLElement>('[data-bulk-new]');
      if (wrap) wrap.hidden = (e as CustomEvent<{ value: string }>).detail.value !== NEW;
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (e) => {
      const save = (e.target as Element).closest<HTMLElement>('[data-bulk-save]');
      const bulk = save?.closest<HTMLElement>('[data-album-bulk]');
      if (!save || !bulk || save.getAttribute('aria-busy') === 'true') return;
      void run(bulk.dataset.albumBulk as Bulk, bulk, save);
    },
    { signal },
  );

  const run = async (what: Bulk, el: HTMLElement, button: HTMLElement) => {
    const value = (n: string) => el.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value.trim() ?? '';
    if (what === 'download') {
      const v = value('download');
      root.dispatchEvent(new CustomEvent('album:act', { detail: { what: `download-${v || 'follow'}`, ids } }));
      return dialog(what)?.close();
    }
    const media = mediaOf(ids);
    if (what === 'album') {
      let target = value('album');
      const task = startTask(`Adding ${many(media.length, 'item')}…`, { el: button, busyLabel: 'Adding…' });
      if (target === NEW) {
        const title = value('title');
        if (!title) {
          task.failed();
          return say(what, 'Give the new album a title.');
        }
        const made = await api<{ id: string }>('POST', 'albums', { title });
        if (!made.ok) {
          task.failed();
          return say(what, (made.data.issues ?? []).map(describeIssue).join(' ') || 'The album wasn’t made.');
        }
        target = made.data.id;
      }
      const r = await api<{ added: number; skipped: number }>('POST', `albums/${encodeURIComponent(target)}/items`, { media });
      if (!r.ok) {
        task.failed();
        return say(what, (r.data.issues ?? []).map(describeIssue).join(' ') || 'They weren’t added.');
      }
      void task.done();
      dialog(what)?.close();
      const skipped = r.data.skipped ? ` ${r.data.skipped} ${r.data.skipped === 1 ? 'was' : 'were'} already there.` : '';
      return saveStatus.saved(`Added ${many(r.data.added, 'item')} to the album; they stay in this one too.${skipped}`);
    }
    const changes: WordsChange[] = media.map((id) => ({ id, words: what === 'date' ? { taken: value('taken') } : { place: value('place') } }));
    const problem = batchProblem(changes);
    if (problem) return say(what, problem);
    const task = startTask(what === 'date' ? 'Setting the date…' : 'Setting the place…', { el: button, busyLabel: 'Saving…' });
    saveStatus.saving();
    const r = await api('PUT', 'media-words', { changes });
    if (!r.ok) {
      task.failed();
      const why = (r.data.issues ?? []).map(describeIssue).join(' ') || 'Nothing was changed.';
      saveStatus.failed(`Not saved: ${why}`);
      return say(what, why);
    }
    void task.done();
    dialog(what)?.close();
    saveStatus.saved(`${what === 'date' ? 'Set the date of' : 'Set the place of'} ${many(media.length, 'item')}`);
    root.dispatchEvent(new CustomEvent('album:redraw'));
  };
}
