/**
 * The album editor (documentation/gallery/spec.md §9.2 to §9.4, §9.7): the words typed in place, the grid's
 * selection (a click, Shift for a range, Ctrl or Cmd for one more, Ctrl+A, Escape), moving (a drag, Alt with an
 * arrow key, Move to start or end), the selection bar, Sort, Settings, Publish, and adding: files dropped anywhere
 * on the grid or chosen with Upload (each its own tile with its progress, two at a time, never blocking the grid),
 * items from the library (the picker), a text card or a YouTube or Vimeo link. Every change is kept at once, saved
 * through one queue (never two saves at once) and can be undone. The rules are the pure model/album.ts; this only
 * wires them to the page.
 */
import type { Album } from '../../content/schema';
import type { AlbumMedia, MediaLookup } from '../../content/album';
import { SaveQueue } from '../model/queue';
import { addItems, addText, editText, moveBy, moveItems, moveToEnd, moveToStart, pickRange, pickToggle, removeItems, setCoverLead, setItemDownload, setItemPlay, setSettings, setWords, sortAlbum, type AlbumSettings } from '../model/album';
import { isVideoFile, needsConversion, pictureSizeIssue, posterTime, refusedFormat, svgChoices, typeOf, videoSizeIssue } from '../model/upload';
import { takenOf } from '../model/exif';
import { TAB, announce, api, describeIssue, editorUrl, onContentChange, saveStatus, startTask, swapRegions } from './client';
import { fillPicker } from './picker';
import { initAlbumCover } from './albumCover';
import { rowStep } from './photoSelection';

interface AlbumState {
  id: string;
  key: string;
  version: string | null;
  album: Album;
  facts: Record<string, AlbumMedia>;
  owner: string;
}
type Job = { what: string };
const REGIONS = ['album-grid', 'album-cover', 'album-facts', 'album-state'];
const WORDS = ['title', 'summary', 'description'] as const;
type Word = (typeof WORDS)[number];
const UPLOADS_AT_ONCE = 2;

export function initAlbumEditor(root: HTMLElement, signal: AbortSignal) {
  const read = (): AlbumState | null => {
    try {
      return JSON.parse(root.querySelector('[data-album-state]')?.textContent ?? '') as AlbumState;
    } catch {
      return null;
    }
  };
  const first = read();
  if (!first) return;
  const state: AlbumState = first;
  let doc: Album = state.album;
  let saved: Album = structuredClone(doc);
  const lookup: MediaLookup = (id) => state.facts[id];
  const undos: Album[] = [];
  const redos: Album[] = [];
  let picked: string[] = [];
  let anchor: string | null = null;
  const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement | null;
  const grid = () => root.querySelector<HTMLElement>('[data-photo-grid]');
  const cells = () => [...root.querySelectorAll<HTMLElement>('[data-photo-grid] li[data-item]')];
  const order = () => cells().map((c) => c.dataset.item!);
  const cellOf = (id: string) => root.querySelector<HTMLElement>(`li[data-item="${CSS.escape(id)}"]`);

  // ---------- saving: one at a time, the latest album each time ----------
  const queue = new SaveQueue<Job>(
    (waiting, r) => ({ what: r.what || waiting?.what || '' }),
    async (job, more) => {
      saveStatus.saving();
      const sending = doc;
      const r = await api('PUT', `albums/${state.id}`, { album: sending, ifMatch: { [state.key]: state.version } });
      if (r.ok) {
        state.version = r.data.versions?.[state.key] ?? state.version;
        saved = structuredClone(sending);
        saveStatus.saved(job.what);
        if (!more()) void redraw();
        return 'ok';
      }
      if (r.status === 409) {
        saveStatus.failed('This album was changed elsewhere: reload it to carry on.');
        dialog('album-conflict')?.showModal();
        return 'stop';
      }
      const why = (r.data.issues ?? []).map(describeIssue).join(' ') || 'The album wasn’t saved.';
      doc = structuredClone(saved);
      undos.pop();
      saveStatus.failed(why);
      announce(why, 'negative');
      void redraw();
      return 'failed';
    },
  );
  /** Keeps a change: shown at once where it can be, saved, and undoable. */
  const change = (next: Album, what: string, opts: { typing?: boolean } = {}) => {
    if (next === doc) return;
    // typing in one field is one step of Undo
    if (!opts.typing || !typingStep) undos.push(doc);
    typingStep = !!opts.typing;
    redos.length = 0;
    doc = next;
    paintOrder();
    paintTools();
    saveStatus.dirty();
    void queue.push({ what });
  };
  let typingStep = false;

  /** The regions drawn again from what's saved; the selection kept. */
  const redraw = async () => {
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('li[data-item]')?.dataset.item;
    // uploads still going (or refused, saying why) carry over to the grid drawn again; finished ones go
    let carried: HTMLElement[] = [];
    try {
      await swapRegions(REGIONS, location.href, () => queue.pending, { quiet: true, landing: () => (carried = [...root.querySelectorAll<HTMLElement>('li[data-upload]:not([data-done])')]) });
    } catch {
      return announce('Couldn’t show the album again: is the dev server running?', 'negative');
    }
    if (carried.length) {
      const lists = root.querySelectorAll('[data-photo-grid] ul[data-photo-cells]');
      lists[lists.length - 1]?.append(...carried);
      root.querySelector('[data-photo-empty]')?.setAttribute('hidden', '');
    }
    const fresh = read();
    if (fresh) state.facts = fresh.facts;
    picked = picked.filter((id) => cellOf(id));
    paintPicked();
    if (focused) focusCell(cellOf(focused));
  };

  // ---------- painting what's kept before the server draws it ----------
  /** The cells in the album's order at once (a move, a removal), until the grid is drawn again. */
  const paintOrder = () => {
    const ids = new Set(doc.items.map((i) => i.id));
    for (const c of cells()) if (!ids.has(c.dataset.item!)) c.remove();
    const g = grid();
    // a custom order is one list: its cells follow the album's items
    if ((doc.order ?? 'oldest') === 'custom' && g?.querySelectorAll('ul[data-photo-cells]').length === 1) {
      const list = g.querySelector('ul[data-photo-cells]')!;
      const uploads = [...list.querySelectorAll('li[data-upload]')];
      for (const i of doc.items) {
        const c = cellOf(i.id);
        if (c) list.append(c);
      }
      list.append(...uploads);
    }
    picked = picked.filter((id) => ids.has(id));
    paintPicked();
  };
  const paintPicked = () => {
    const on = new Set(picked);
    for (const c of cells()) c.setAttribute('aria-selected', String(on.has(c.dataset.item!)));
    const g = grid();
    if (g) g.toggleAttribute('data-selecting', picked.length > 0);
    const bar = root.querySelector<HTMLElement>('[data-album-selbar]');
    if (bar) bar.hidden = !picked.length;
    const count = root.querySelector('[data-album-selcount]');
    if (count) count.textContent = `${picked.length} selected`;
    const one = picked.length === 1 ? doc.items.find((i) => i.id === picked[0]) : undefined;
    setHidden('[data-album-only="cover"]', !one || 'text' in one);
    setHidden('[data-album-only="text"]', !one || !('text' in one));
  };
  const setHidden = (sel: string, hidden: boolean) => root.querySelectorAll<HTMLElement>(sel).forEach((b) => (b.hidden = hidden));
  /** The header's tools follow the album: Undo, Redo, Sort, Publish. */
  const paintTools = () => {
    const undo = document.querySelector<HTMLButtonElement>('[data-album-undo]');
    const redo = document.querySelector<HTMLButtonElement>('[data-album-redo]');
    if (undo) undo.disabled = !undos.length;
    if (redo) redo.disabled = !redos.length;
    document.querySelector('[data-album-sort]')?.dispatchEvent(new CustomEvent('select-set', { detail: { value: doc.order ?? 'oldest' } }));
    const publish = document.querySelector<HTMLElement>('[data-album-publish]');
    const label = publish?.querySelector('.label') ?? publish;
    if (label) label.textContent = doc.status === 'published' ? 'Unpublish' : 'Publish';
  };
  const focusCell = (c: HTMLElement | null | undefined) => {
    if (!c) return;
    for (const o of cells()) o.tabIndex = o === c ? 0 : -1;
    c.focus();
  };

  // ---------- the selection ----------
  const pick = (id: string, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }, fromCheck = false) => {
    // as in a photo app: once anything is selected, a click adds or takes away
    if (e.shiftKey) picked = pickRange(order(), anchor, id);
    else if (e.ctrlKey || e.metaKey || fromCheck || picked.length) picked = pickToggle(order(), picked, id);
    else picked = [id];
    if (!e.shiftKey) anchor = id;
    paintPicked();
  };
  const chosen = (): string[] => {
    if (picked.length) return picked;
    const f = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('li[data-item]')?.dataset.item;
    return f ? [f] : [];
  };
  const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const switched = (before: Album) => ((before.order ?? 'oldest') !== 'custom' && doc.order === 'custom' ? ' The album is in your own order now.' : '');
  const move = (next: (a: Album) => Album, what: string) => {
    const before = doc;
    change(next(doc), what);
    const note = switched(before);
    if (note) announce(`${what}.${note}`);
  };
  /** Opening an item: the viewer (scripts/albumViewer.ts) hears it and opens at it. */
  const open = (id: string) => root.dispatchEvent(new CustomEvent('album:open-item', { bubbles: true, detail: { id } }));

  const act = (what: string, given?: string[]) => {
    const ids = given ?? chosen();
    if (what === 'clear') {
      picked = [];
      return paintPicked();
    }
    if (!ids.length) return;
    // the selection's dialogs (scripts/albumActions.ts): Add to album, Set the date, Set the place, Downloads
    const bulk = ({ 'add-to': 'album', date: 'date', place: 'place', downloads: 'download' } as Record<string, string>)[what];
    if (bulk) return void root.dispatchEvent(new CustomEvent('album:selection', { detail: { what: bulk, ids } }));
    if (what.startsWith('download-')) {
      const v = what.slice('download-'.length);
      return change(setItemDownload(doc, ids, v === 'allow' ? true : v === 'deny' ? false : undefined, lookup), 'Downloads set');
    }
    if (what === 'start') return move((a) => moveToStart(a, ids, lookup), `Moved ${count(ids.length, 'item')} to the start`);
    if (what === 'end') return move((a) => moveToEnd(a, ids, lookup), `Moved ${count(ids.length, 'item')} to the end`);
    if (what === 'remove') {
      change(removeItems(doc, ids), `Removed ${ids.length}`);
      picked = [];
      paintPicked();
      return announce(`Removed ${ids.length}. They’re still in your library. Undo puts them back.`);
    }
    if (what === 'cover') {
      const r = setCoverLead(doc, ids[0]);
      if (!r.ok) return announce(r.why, 'negative');
      return change(r.album, 'Cover picture set');
    }
    if (what === 'text') {
      const item = doc.items.find((i) => i.id === ids[0]);
      if (item && 'text' in item) return openText(item.id, item.text);
    }
  };

  // ---------- clicks: the grid, the selection bar, the dialogs ----------
  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      // a refused upload's tile goes when it's clicked
      const failed = t.closest<HTMLElement>('li[data-upload][data-failed]');
      if (failed) return failed.remove();
      const cell = t.closest<HTMLElement>('li[data-item]');
      if (cell && root.contains(cell)) {
        focusCell(cell);
        return pick(cell.dataset.item!, e, !!t.closest('.check'));
      }
      const b = t.closest<HTMLElement>('[data-album-act], [data-editor-media], [data-album-picker-use], [data-album-text-save], [data-album-link-add], [data-album-delete-open], [data-album-delete-confirm], [data-album-reload]');
      if (!b) return;
      const d = b.dataset;
      if (d.albumAct) return act(d.albumAct);
      if (d.editorMedia) {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        return syncPicker();
      }
      if (d.albumPickerUse !== undefined) return usePicked();
      if (d.albumTextSave !== undefined) return saveText();
      if (d.albumLinkAdd !== undefined) return void addLink();
      if (d.albumDeleteOpen !== undefined) {
        dialog('album-settings')?.close();
        return dialog('album-delete')?.showModal();
      }
      if (d.albumDeleteConfirm !== undefined) return void deleteAlbum();
      if (d.albumReload !== undefined) location.reload();
    },
    { signal },
  );
  root.addEventListener(
    'dblclick',
    (e) => {
      const cell = (e.target as Element).closest<HTMLElement>('li[data-item]');
      if (cell) open(cell.dataset.item!);
    },
    { signal },
  );

  // ---------- keys on the grid ----------
  root.addEventListener(
    'keydown',
    (e) => {
      const cell = (e.target as Element).closest<HTMLElement>('li[data-item]');
      if (!cell) return;
      const id = cell.dataset.item!;
      const all = cells();
      const at = all.indexOf(cell);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: rowStep(all, at, -1), ArrowDown: rowStep(all, at, 1), Home: -at, End: all.length - 1 - at }[e.key];
      if (step !== undefined && e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const ids = picked.includes(id) ? picked : [id];
        move((a) => moveBy(a, ids, step < 0 ? -1 : 1, lookup), `Moved ${count(ids.length, 'item')}`);
        return focusCell(cellOf(id));
      }
      if (step !== undefined) {
        e.preventDefault();
        const to = all[Math.min(all.length - 1, Math.max(0, at + step))];
        focusCell(to);
        if (e.shiftKey && to) {
          picked = pickRange(order(), anchor ?? id, to.dataset.item!);
          paintPicked();
        }
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        picked = pickToggle(order(), picked, id);
        anchor = id;
        return paintPicked();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        return open(id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        picked = order();
        return paintPicked();
      }
      if (e.key === 'Escape' && picked.length) {
        e.preventDefault();
        picked = [];
        return paintPicked();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (!picked.length) picked = [id];
        return act('remove');
      }
    },
    { signal },
  );

  // ---------- dragging: items to move, files to add ----------
  let dragging: string[] = [];
  let dropBefore: string | null = null;
  const MOVE = 'application/x-album-items';
  const clearDrop = () => root.querySelectorAll('[data-drop]').forEach((c) => c.removeAttribute('data-drop'));
  root.addEventListener(
    'dragstart',
    (e) => {
      const cell = (e.target as Element).closest<HTMLElement>('li[data-item]');
      if (!cell || !e.dataTransfer) return;
      const id = cell.dataset.item!;
      dragging = picked.includes(id) ? order().filter((i) => picked.includes(i)) : [id];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(MOVE, dragging.join(' '));
      dragging.forEach((i) => cellOf(i)?.setAttribute('data-dragging', ''));
    },
    { signal },
  );
  root.addEventListener(
    'dragend',
    () => {
      root.querySelectorAll('[data-dragging]').forEach((c) => c.removeAttribute('data-dragging'));
      clearDrop();
      dragging = [];
    },
    { signal },
  );
  const files = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
  root.addEventListener(
    'dragover',
    (e) => {
      const g = grid();
      if (!g || !g.contains(e.target as Node)) return;
      if (files(e)) {
        e.preventDefault();
        g.setAttribute('data-dropping', '');
        return;
      }
      if (!dragging.length) return;
      e.preventDefault();
      const cell = (e.target as Element).closest<HTMLElement>('li[data-item]');
      clearDrop();
      if (!cell) return void (dropBefore = null);
      const box = cell.getBoundingClientRect();
      const after = e.clientX > box.left + box.width / 2;
      const all = cells();
      const target = after ? all[all.indexOf(cell) + 1] : cell;
      dropBefore = target?.dataset.item ?? null;
      target?.setAttribute('data-drop', 'before');
    },
    { signal },
  );
  root.addEventListener(
    'dragleave',
    (e) => {
      const g = grid();
      if (g && !g.contains(e.relatedTarget as Node | null)) g.removeAttribute('data-dropping');
    },
    { signal },
  );
  root.addEventListener(
    'drop',
    (e) => {
      const g = grid();
      if (!g || !g.contains(e.target as Node)) return;
      e.preventDefault();
      g.removeAttribute('data-dropping');
      clearDrop();
      if (files(e)) return upload([...(e.dataTransfer?.files ?? [])]);
      if (!dragging.length) return;
      const ids = dragging;
      if (dropBefore && ids.includes(dropBefore)) return;
      move((a) => moveItems(a, ids, dropBefore, lookup), `Moved ${count(ids.length, 'item')}`);
    },
    { signal },
  );

  // ---------- uploads: a tile each, two at a time, in the background ----------
  const waiting: { file: File; tile: HTMLElement }[] = [];
  let running = 0;
  let tiles = 0;
  const upload = (list: File[]) => {
    const g = grid();
    const template = g?.querySelector<HTMLTemplateElement>('template[data-photo-upload]');
    if (!g || !template || !list.length) return;
    g.querySelector<HTMLElement>('[data-photo-empty]')?.setAttribute('hidden', '');
    const lists = g.querySelectorAll('ul[data-photo-cells]');
    const into = lists[lists.length - 1];
    for (const file of list) {
      const tile = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const n = `u${++tiles}`;
      tile.querySelectorAll('[id]').forEach((el) => (el.id = `${el.id}-${n}`));
      tile.querySelectorAll('[aria-labelledby]').forEach((el) => el.setAttribute('aria-labelledby', `${el.getAttribute('aria-labelledby')}-${n}`));
      tile.querySelector('[data-upload-name]')!.textContent = file.name;
      tile.setAttribute('aria-label', `Uploading ${file.name}`);
      into?.append(tile);
      const why = refusedFormat(file) ?? (isVideoFile(file) ? videoSizeIssue(file.size) : needsConversion(typeOf(file)) ? `${file.name} needs converting first: add it in Media, then add it from your library.` : pictureSizeIssue(typeOf(file), file.size));
      if (why) failTile(tile, why);
      else waiting.push({ file, tile });
    }
    announce(`Uploading ${count(waiting.length, 'file')}…`);
    pump();
  };
  const pump = () => {
    while (running < UPLOADS_AT_ONCE && waiting.length) {
      const next = waiting.shift()!;
      running++;
      void send(next.file, next.tile).finally(() => {
        running--;
        pump();
      });
    }
  };
  const progress = (tile: HTMLElement, fraction: number | null) => {
    const wrap = tile.querySelector<HTMLElement>('[data-upload-progress]');
    const bar = wrap?.querySelector<HTMLElement>('[role="progressbar"]');
    if (!wrap || !bar) return;
    if (fraction === null) {
      wrap.style.removeProperty('--progress');
      bar.removeAttribute('aria-valuenow');
      bar.setAttribute('data-indeterminate', '');
    } else {
      const pct = Math.round(fraction * 100);
      bar.removeAttribute('data-indeterminate');
      wrap.style.setProperty('--progress', `${pct}%`);
      bar.setAttribute('aria-valuenow', String(pct));
    }
  };
  const failTile = (tile: HTMLElement, why: string) => {
    tile.setAttribute('data-failed', '');
    tile.setAttribute('aria-label', why);
    tile.querySelector('[data-upload-progress]')?.setAttribute('hidden', '');
    const w = tile.querySelector<HTMLElement>('[data-upload-why]');
    if (w) {
      w.hidden = false;
      w.textContent = why;
    }
  };
  const send = async (file: File, tile: HTMLElement) => {
    const data = new FormData();
    data.set('file', file, file.name);
    data.set('owner', state.owner);
    if (isVideoFile(file)) {
      const v = await videoFacts(file);
      if (!v) return failTile(tile, `This browser can’t play ${file.name}. Save it as an MP4 (H.264) or a WebM, then try again.`);
      data.set('title', file.name.replace(/\.[^.]+$/, ''));
      data.set('width', String(v.width));
      data.set('height', String(v.height));
      data.set('duration', String(v.duration));
      if (v.poster) data.set('poster', v.poster, 'poster.webp');
    } else {
      const day = takenOf(new Uint8Array(await file.arrayBuffer()));
      if (day) data.set('taken', day);
      if (typeOf(file) === 'image/svg+xml') data.set('svgAs', svgChoices(file.size).default);
      if (doc.large) data.set('large', 'true');
    }
    const r = await post(data, (f) => progress(tile, f < 1 ? f * 0.9 : null));
    if (!r.ok || !r.id) return failTile(tile, `${file.name}: ${(r.issues ?? []).map((i) => i.message).join(' ') || 'not uploaded'}`);
    added([r.id], tile, r.existing ? `${file.name} was already in your library: added it.` : '');
  };
  /** Library items added to the album; `tile` (an upload's) goes once the grid shows them. */
  const added = (ids: string[], tile?: HTMLElement, note = '') => {
    const r = addItems(doc, ids, {});
    if (!r.added.length) {
      tile?.remove();
      return announce(note || `${count(r.skipped.length, 'item')} ${r.skipped.length === 1 ? 'was' : 'were'} already in the album.`);
    }
    // the tile stays until the grid is drawn with its item
    if (tile) {
      tile.setAttribute('data-done', '');
      progress(tile, 1);
    }
    change(r.album, `Added ${count(r.added.length, 'item')}`);
    if (note) announce(note);
  };

  // ---------- the picker: from the library ----------
  const syncPicker = () => {
    const d = dialog('album-picker');
    const n = d?.querySelectorAll('[data-editor-media][aria-pressed="true"]').length ?? 0;
    const use = d?.querySelector<HTMLButtonElement>('[data-album-picker-use]');
    if (use) use.disabled = !n;
    const words = d?.querySelector('[data-album-picker-count]');
    if (words) words.textContent = n ? `${n} chosen` : 'Choose what to add';
  };
  const openPicker = () => {
    const d = dialog('album-picker');
    if (!d) return;
    d.querySelectorAll('[data-editor-media]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    syncPicker();
    d.showModal();
    void fillPicker(d, (g) => {
      g.dataset.pickKind = 'any';
      syncPicker();
    });
  };
  const usePicked = () => {
    const d = dialog('album-picker');
    const ids = [...(d?.querySelectorAll<HTMLElement>('[data-editor-media][aria-pressed="true"]') ?? [])].map((b) => b.dataset.editorMedia!);
    d?.close();
    if (ids.length) added(ids);
  };
  root.addEventListener(
    'media:uploaded',
    (e) => {
      // uploaded from the picker's own form: straight into the album
      dialog('album-picker')?.close();
      added([(e as CustomEvent<{ id: string }>).detail.id]);
    },
    { signal },
  );

  // ---------- a text card, and a linked video ----------
  let editing: string | null = null;
  const textField = () => dialog('album-text')?.querySelector<HTMLTextAreaElement>('[data-album-add-field] textarea');
  const openText = (id: string | null = null, words = '') => {
    editing = id;
    const f = textField();
    if (f) f.value = words;
    dialog('album-text')?.showModal();
    f?.focus();
  };
  const saveText = () => {
    const words = textField()?.value.trim() ?? '';
    if (!words) return announce('Type the card’s words first.', 'negative');
    dialog('album-text')?.close();
    if (editing) return change(editText(doc, editing, words), 'Text card changed');
    const at = picked.length ? order().find((i) => picked.includes(i)) : null;
    const before = doc;
    const r = addText(doc, words, lookup, { before: at ?? null });
    change(r.album, 'Text card added');
    const note = switched(before);
    if (note) announce(`Text card added.${note}`);
  };
  const openLink = () => {
    const d = dialog('album-link');
    d?.showModal();
    d?.querySelector<HTMLInputElement>('[data-album-add-field] input')?.focus();
  };
  const addLink = async () => {
    const d = dialog('album-link');
    const input = d?.querySelector<HTMLInputElement>('[data-album-add-field] input');
    const url = input?.value.trim() ?? '';
    if (!url) return announce('Paste a YouTube or Vimeo address first.', 'negative');
    const task = startTask('Adding the video…', { el: d?.querySelector('[data-album-link-add]') });
    const r = await api<{ id: string; existing?: boolean; title?: string }>('POST', 'linked-video', { url, album: state.id });
    if (!r.ok) {
      task.failed();
      return announce((r.data.issues ?? []).map((i) => i.message).join(' ') || 'That video couldn’t be added.', 'negative');
    }
    void task.done();
    if (input) input.value = '';
    d?.close();
    added([r.data.id], undefined, r.data.existing ? `${r.data.title ?? 'That video'} was already in your library: added it.` : '');
  };

  // ---------- the album itself: deleting it ----------
  const deleteAlbum = async () => {
    const task = startTask('Deleting the album…', { el: root.querySelector('[data-album-delete-confirm]') });
    const r = await api('DELETE', `albums/${state.id}`, { ifMatch: { [state.key]: state.version } });
    if (!r.ok) {
      task.failed();
      return announce((r.data.issues ?? []).map((i) => i.message).join(' ') || 'The album wasn’t deleted.', 'negative');
    }
    saveStatus.carry('Album deleted');
    location.href = editorUrl('albums/');
  };

  // ---------- the words, as they're typed ----------
  let typingTimer = 0;
  const typed = (field: Word, value: string) => {
    window.clearTimeout(typingTimer);
    saveStatus.dirty();
    typingTimer = window.setTimeout(() => {
      if (field === 'title' && !value.trim()) return saveStatus.failed('Give the album a title.');
      change(setWords(doc, { [field]: value }), '', { typing: true });
      if (field === 'title')
        document.querySelectorAll<HTMLElement>('[data-album-heading]').forEach((h) => {
          (h.querySelector('strong') ?? h).textContent = value.trim();
          h.title = value.trim();
        });
    }, 500);
  };
  root.addEventListener(
    'input',
    (e) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement;
      const field = el.closest<HTMLElement>('[data-album-field]')?.dataset.albumField as Word | undefined;
      if (field && WORDS.includes(field)) typed(field, el.value);
    },
    { signal },
  );
  root.addEventListener('focusout', () => (typingStep = false), { signal });

  // ---------- settings ----------
  const ACCESS_ASK: Record<'open' | 'private', string> = {
    open: 'Make this album public? It and its own pictures move back to content/, and once you save to remote, they’re on the site for everyone and in the public repository’s history.',
    private: 'Make this album private? It and its own pictures move to private-pages/, and it’s listed in its section only for readers you share it with, from Access. If it was published openly before, that earlier version stays in the public repository’s history.',
  };
  const MOVE_IN_ASK = 'Move these private pictures into this album’s folder? They become public with the album, and nothing else uses them.';
  const access = async (to: 'open' | 'private') => {
    const select = root.querySelector<HTMLElement>('[data-album-setting="access"]');
    const now = state.key.startsWith('/private/') ? 'private' : 'open';
    const back = () => select?.dispatchEvent(new CustomEvent('select-set', { detail: { value: now } }));
    if (to === now) return;
    if (queue.pending || JSON.stringify(doc) !== JSON.stringify(saved)) {
      back();
      return announce('Your last change is still saving: try again in a moment.', 'negative');
    }
    if (!confirm(ACCESS_ASK[to])) return back();
    const task = startTask(to === 'open' ? 'Making the album public…' : 'Making the album private…', { el: select });
    let r = await api('PUT', `albums/${state.id}/access`, { access: to });
    // an open album never shows a private picture (V52): ones nothing else uses can move into its folder
    if (!r.ok && (r.data.issues ?? []).some((i) => i.path === 'move')) {
      const why = (r.data.issues ?? []).map((i) => i.message).join(' ');
      if (confirm(`${why}.\n\n${MOVE_IN_ASK}`)) r = await api('PUT', `albums/${state.id}/access`, { access: to, moveIn: true });
    }
    if (!r.ok) {
      task.failed();
      back();
      const why = (r.data.issues ?? []).map((i) => i.message).join(' ') || 'Who can see it wasn’t changed.';
      saveStatus.failed(`Not changed: ${why}`);
      return announce(why, 'negative');
    }
    void task.done();
    // its file moved folders: the editor is drawn again from its new place
    saveStatus.carry(to === 'open' ? 'Made public' : 'Made private');
    location.reload();
  };
  const setting = async (name: string, value: string | boolean) => {
    if (name === 'access') return access(value === 'private' ? 'private' : 'open');
    if (name === 'section') {
      if (!value) return;
      const task = startTask('Moving the album…', { el: root.querySelector('[data-album-setting="section"]') });
      const r = await api('PUT', `albums/${state.id}/section`, { section: value });
      if (!r.ok) {
        task.failed();
        return announce((r.data.issues ?? []).map((i) => i.message).join(' ') || 'The album wasn’t moved.', 'negative');
      }
      void task.done();
      return saveStatus.saved('Moved to its section');
    }
    if (name === 'layout' || name === 'captions' || name === 'dates' || name === 'download' || name === 'large') {
      const next = setSettings(doc, { [name]: value } as Partial<Omit<AlbumSettings, 'order'>>);
      change(next, 'Settings saved');
      const captions = root.querySelector<HTMLInputElement>('[data-album-setting="captions"] input');
      if (captions && name === 'layout') captions.disabled = value === 'story';
    }
  };
  root.addEventListener(
    'select-change',
    (e) => {
      const name = (e.target as Element).closest<HTMLElement>('[data-album-setting]')?.dataset.albumSetting;
      if (name) void setting(name, (e as CustomEvent<{ value: string }>).detail.value);
    },
    { signal },
  );
  root.addEventListener(
    'change',
    (e) => {
      const el = e.target as HTMLInputElement;
      const name = el.closest<HTMLElement>('[data-album-setting]')?.dataset.albumSetting;
      if (name && el.type === 'checkbox') void setting(name, el.checked);
    },
    { signal },
  );

  // ---------- the header's tools (outside the editor: heard on the document) ----------
  const sort = (value: string) => {
    if (value === (doc.order ?? 'oldest')) return;
    const r = sortAlbum(doc, value as NonNullable<Album['order']>, lookup);
    if (!r.ok) {
      paintTools();
      return announce(r.why, 'negative');
    }
    change(r.album, value === 'custom' ? 'In your own order' : value === 'newest' ? 'Newest first' : 'Oldest first');
  };
  document.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-album-undo], [data-album-redo], [data-album-library], [data-album-text], [data-album-link], [data-album-publish]');
      if (!b) return;
      const d = b.dataset;
      // the Add dialog's other ways open their own dialog in its place
      if (d.albumLibrary !== undefined || d.albumText !== undefined || d.albumLink !== undefined) dialog('album-add')?.close();
      if (d.albumUndo !== undefined || d.albumRedo !== undefined) {
        const from = d.albumUndo !== undefined ? undos : redos;
        const to = d.albumUndo !== undefined ? redos : undos;
        const back = from.pop();
        if (!back) return;
        to.push(doc);
        doc = back;
        typingStep = false;
        paintOrder();
        paintTools();
        saveStatus.dirty();
        // the save draws the grid again (an undone removal brings its cells back)
        return void queue.push({ what: d.albumUndo !== undefined ? 'Undone' : 'Redone' });
      }
      if (d.albumLibrary !== undefined) return openPicker();
      if (d.albumText !== undefined) return openText();
      if (d.albumLink !== undefined) return openLink();
      if (d.albumPublish !== undefined) {
        const publishing = doc.status !== 'published';
        if (publishing && !doc.items.length) return announce('Add something to the album before publishing it.', 'negative');
        change({ ...doc, status: publishing ? 'published' : 'draft' }, publishing ? 'Published' : 'Unpublished');
        announce(publishing ? 'Published: it’s on the site once you save to remote.' : 'Unpublished: it’s a draft again.');
      }
    },
    { signal },
  );
  document.addEventListener(
    'change',
    (e) => {
      const input = e.target as HTMLInputElement;
      if (input.type !== 'file' || !input.closest('[data-album-upload]')) return;
      dialog('album-add')?.close();
      upload([...(input.files ?? [])]);
      input.value = '';
    },
    { signal },
  );
  document.addEventListener(
    'select-change',
    (e) => {
      if ((e.target as Element).closest('[data-album-sort]')) sort((e as CustomEvent<{ value: string }>).detail.value);
    },
    { signal },
  );
  window.addEventListener(
    'beforeunload',
    (e) => {
      if (queue.pending || running || waiting.length) e.preventDefault();
    },
    { signal },
  );

  // ---------- the viewer and the selection's dialogs ask through events (scripts/albumViewer.ts, mediaInfo.ts, albumActions.ts) ----------
  root.addEventListener('album:act', (e) => act((e as CustomEvent<{ what: string; ids: string[] }>).detail.what, (e as CustomEvent<{ ids: string[] }>).detail.ids), { signal });
  root.addEventListener(
    'album:item',
    (e) => {
      const d = (e as CustomEvent<{ id: string; play?: { autoplay?: boolean; loop?: boolean }; download?: boolean | null }>).detail;
      if (d.play) return change(setItemPlay(doc, d.id, d.play, lookup), 'Playing set');
      if (d.download !== undefined) change(setItemDownload(doc, [d.id], d.download ?? undefined, lookup), 'Downloads set');
    },
    { signal },
  );
  root.addEventListener('album:redraw', () => void (queue.pending ? undefined : redraw()), { signal });

  // ---------- a change made elsewhere: drawn again, unless something here waits to be saved ----------
  onContentChange((c) => {
    if (c.origin === TAB || queue.pending || !c.files.some((f) => f === state.key || f.includes('/media/'))) return;
    void redraw().then(() => {
      const fresh = read();
      if (!fresh || fresh.version === state.version) return;
      doc = fresh.album;
      saved = structuredClone(doc);
      state.version = fresh.version;
      paintTools();
    });
  }, signal);

  paintTools();
  paintPicked();
  initAlbumCover(root, signal, { album: () => doc, change: (next, what) => change(next, what), lookup });
  // a new album opens with its title ready to type over (§9.1)
  if (new URLSearchParams(location.search).has('new')) {
    const title = root.querySelector<HTMLInputElement>('[data-album-field="title"] input');
    title?.focus();
    title?.select();
    history.replaceState(history.state, '', location.pathname);
  }
}

/** A multipart POST to the media API with its upload's progress (fetch can't report it). */
function post(data: FormData, onProgress: (fraction: number) => void): Promise<{ ok: boolean; id?: string; existing?: boolean; issues?: { message: string }[] }> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('POST', editorUrl('api/media'));
    x.setRequestHeader('X-Editor', '1');
    x.setRequestHeader('X-Editor-Tab', TAB);
    x.upload.addEventListener('progress', (e) => e.lengthComputable && onProgress(e.loaded / e.total));
    x.addEventListener('load', () => {
      try {
        const r = JSON.parse(x.responseText);
        resolve({ ...r, ok: x.status < 400 && r.ok !== false });
      } catch {
        resolve({ ok: false, issues: [{ message: `the editor couldn’t read the answer (${x.status})` }] });
      }
    });
    x.addEventListener('error', () => resolve({ ok: false, issues: [{ message: 'the dev server didn’t answer' }] }));
    x.send(data);
  });
}

/** A video file's size, length and poster frame (a second in, where the first is often black), or null when it won't play here. */
function videoFacts(file: File): Promise<{ width: number; height: number; duration: number; poster: Blob | null } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const src = URL.createObjectURL(file);
    const end = (r: Parameters<typeof resolve>[0]) => (URL.revokeObjectURL(src), resolve(r));
    v.muted = true;
    v.preload = 'auto';
    v.addEventListener('error', () => end(null), { once: true });
    v.addEventListener(
      'loadedmetadata',
      () => {
        if (!v.videoWidth || !v.videoHeight) return end(null);
        const duration = Number.isFinite(v.duration) ? v.duration : 0;
        v.addEventListener(
          'seeked',
          () => {
            const c = document.createElement('canvas');
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            c.getContext('2d')?.drawImage(v, 0, 0);
            c.toBlob((poster) => end({ width: v.videoWidth, height: v.videoHeight, duration, poster }), 'image/webp', 0.9);
          },
          { once: true },
        );
        v.currentTime = posterTime(duration);
      },
      { once: true },
    );
    v.src = src;
  });
}
