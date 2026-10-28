/**
 * The album editor's docked inspector (components/AlbumInspector.astro; documentation/gallery/spec.md §9.6): its
 * Selection tab follows the grid's selection (`album:picked`, from scripts/albumEditor.ts), kept in the address
 * (`?selected=`, so a reload shows the same), and is drawn by the server for what's selected. What it holds that
 * waits to be saved is saved before it's drawn again, and it's never drawn again under someone typing in it. For
 * several selected, it saves what they share: the date taken and the place (each picture's own words, in one
 * save) and this album's downloads (sent to the album editor, so Undo takes it back).
 */
import { announce, api, refused, saveStatus, startTask, swapRegions } from './client';
import { applySections, initSections } from './inspector';
import { batchProblem, type WordsChange } from '../model/albumViewer';
import { SELECTED_PARAM, selectedParam } from '../model/albumInspector';
import type { Album } from '../../content/schema';

const REGION = 'album-selection';
const DEBOUNCE_MS = 120;

export function initAlbumInspector(root: HTMLElement, signal: AbortSignal) {
  const inspector = root.querySelector<HTMLElement>('[data-album-inspector]');
  if (!inspector) return;
  const region = () => inspector.querySelector<HTMLElement>(`[data-region="${REGION}"]`);
  let ids: string[] = new URLSearchParams(location.search).get(SELECTED_PARAM)?.split(',').filter(Boolean) ?? [];
  let shown = ids.join(',');
  let timer = 0;
  let asked = 0;

  const album = (): Album | null => {
    try {
      return (JSON.parse(root.querySelector('[data-album-state]')?.textContent ?? '') as { album: Album }).album;
    } catch {
      return null;
    }
  };
  /** The library items behind the selected album items (a text card has none). */
  const mediaOf = (chosen: string[]) => {
    const items = album()?.items ?? [];
    return chosen.flatMap((id) => {
      const it = items.find((i) => i.id === id);
      return it && 'media' in it ? [it.media] : [];
    });
  };
  /** Someone is typing or choosing in the inspector: it isn't drawn again under them. */
  const busy = () => {
    const a = document.activeElement;
    return !!a && inspector.contains(a) && !!a.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"]');
  };
  /** What the inspector holds that waits to be saved: the picture's words, a text card's words. */
  const flush = async () => {
    const waits: Promise<unknown>[] = [];
    inspector.querySelector('[data-media-info]')?.dispatchEvent(new CustomEvent('viewer:flush', { detail: { waits } }));
    root.dispatchEvent(new CustomEvent('album:flush'));
    await Promise.all(waits);
  };
  const address = () => {
    const u = new URL(location.href);
    const v = selectedParam(ids);
    if (v) u.searchParams.set(SELECTED_PARAM, v);
    else u.searchParams.delete(SELECTED_PARAM);
    return u;
  };

  /** Draws the Selection tab for what's selected now; the latest ask wins. */
  const draw = async (force: boolean) => {
    const key = ids.join(',');
    if (!force && key === shown) return;
    const mine = ++asked;
    await flush();
    if (mine !== asked) return;
    const url = address();
    history.replaceState(history.state, '', url);
    try {
      await swapRegions([REGION], url.href, () => mine !== asked || busy(), { quiet: true });
    } catch {
      return announce('Couldn’t show its details: is the dev server running?', 'negative');
    }
    if (mine !== asked) return;
    shown = key;
    applySections(inspector);
  };
  const tab = (name: 'selection' | 'album') => inspector.querySelector('[data-tabs]')?.dispatchEvent(new CustomEvent('tabs:select', { detail: { tab: name } }));

  root.addEventListener(
    'album:picked',
    (e) => {
      const next = (e as CustomEvent<{ ids: string[] }>).detail.ids;
      const before = ids.join(',');
      ids = next;
      if (ids.join(',') === before) return;
      if (ids.length) tab('selection');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void draw(false), DEBOUNCE_MS);
    },
    { signal },
  );
  // the album drawn again (a save, Undo, a change elsewhere), or the item's words changed in the viewer
  root.addEventListener('album:drawn', () => !busy() && ids.length && void draw(true), { signal });
  root.addEventListener('album:selection-redraw', () => void draw(true), { signal });
  document.getElementById('album-viewer')?.addEventListener('close', () => ids.length === 1 && void draw(true), { signal });

  inspector.addEventListener(
    'click',
    (e) => {
      const view = (e.target as Element).closest<HTMLElement>('[data-album-view]');
      if (view) root.dispatchEvent(new CustomEvent('album:open-item', { detail: { id: view.dataset.albumView } }));
      // the batch of suggested words (§9.8.2): the selected items that are pictures or videos, by their grid cells
      if ((e.target as Element).closest('[data-suggest-words-open]')) {
        const all = album()?.items ?? [];
        const items = ids.flatMap((id) => {
          const it = all.find((i) => i.id === id);
          return it && 'media' in it ? [{ media: it.media, cell: id }] : [];
        });
        if (items.length) root.dispatchEvent(new CustomEvent('words:suggest', { detail: { items } }));
      }
    },
    { signal },
  );

  // ---------- several selected: what they share ----------
  const say = (text: string) => {
    const note = region()?.querySelector<HTMLElement>('[data-selection-problem]');
    if (!note) return;
    note.textContent = text;
    note.hidden = !text;
  };
  inspector.addEventListener(
    'change',
    async (e) => {
      const el = e.target as HTMLInputElement;
      if (!el.closest('[data-selection-words]') || (el.name !== 'taken' && el.name !== 'place')) return;
      const media = mediaOf(ids);
      const words = el.name === 'taken' ? { taken: el.value } : { place: el.value.trim() };
      const changes: WordsChange[] = media.map((id) => ({ id, words }));
      const problem = batchProblem(changes);
      if (problem) return say(problem);
      say('');
      const n = media.length;
      const task = startTask(el.name === 'taken' ? 'Setting the date…' : 'Setting the place…', { el, busyLabel: 'Saving…' });
      saveStatus.saving();
      const r = await api('PUT', 'media-words', { changes });
      if (!r.ok) {
        task.failed();
        const why = refused(r, 'Nothing was changed.');
        saveStatus.failed(`Not saved: ${why}`);
        return say(why);
      }
      void task.done();
      saveStatus.saved(`${el.name === 'taken' ? 'Set the date of' : 'Set the place of'} ${n} ${n === 1 ? 'item' : 'items'}`);
      root.dispatchEvent(new CustomEvent('album:redraw'));
    },
    { signal },
  );
  inspector.addEventListener(
    'select-change',
    (e) => {
      if (!(e.target as Element).closest('[data-selection-download]')) return;
      const v = (e as CustomEvent<{ value: string }>).detail.value;
      root.dispatchEvent(new CustomEvent('album:act', { detail: { what: `download-${v}`, ids: [...ids] } }));
    },
    { signal },
  );

  initSections(inspector, signal);
  applySections(inspector);
}
