/**
 * An album's Items view (documentation/gallery/spec.md §9.2): choosing cards (Shift for a range, Ctrl or Cmd for
 * one more), moving them (drag, Alt with an arrow key, Move to start or end), Sort by date taken, an item's fields,
 * Up front, Remove, and adding from the library, from files (a batch, each with its alt text) or from a YouTube or
 * Vimeo address (its poster taken by the server). Every change is shown at once, saved at once through one queue,
 * and undone with Undo (the article editor's own history, so the Page view's Undo carries on from here). The
 * album's rules are the pure model/album.ts; this only wires them to the page.
 */
import type { Album, Article } from '../../content/schema';
import { ITEM_DESCRIPTION_MAX } from '../../content/schema';
import { SaveQueue } from '../model/queue';
import { addItems, dropBefore, embedItem, mediaItems, moveBy, moveToEnd, moveToStart, parseLength, pickRange, pickToggle, removeItems, setEmbedShape, setItemField, setUpFront, sortByTaken, type Edit, type EmbedFacts, type ItemField } from '../model/album';
import { isVideoFile, needsConversion, pictureSizeIssue, posterTime, refusedFormat, svgChoices, typeOf, videoSizeIssue } from '../model/upload';
import { takenOf } from '../model/exif';
import { TAB, announce, api, describeIssue, onContentChange, saveStatus, startTask, swapRegions } from './client';
import { fillPicker } from './picker';
import { initRichFields } from './richtext';

interface AlbumState {
  id: string;
  key: string;
  version: string | null;
  structureVersion: string | null;
  article: Article;
  owner: string;
}
type Refresh = { details?: boolean; quiet?: boolean };
const STRUCTURE = '/content/structures/site.json';
const FIELDS = new Set<ItemField>(['caption', 'description', 'place', 'download', 'autoplay', 'loop', 'title', 'duration']);

export function initAlbum(root: HTMLElement, signal: AbortSignal) {
  const readState = (): AlbumState => JSON.parse(document.querySelector('[data-editor-state]')?.textContent ?? '{}');
  const state = readState();
  if (!state.article) return;
  let doc: Article = state.article;
  let saved: Article = structuredClone(doc);
  const album = (): Album => doc.album ?? { items: [] };
  let chosen = root.dataset.chosen || album().items[0]?.id || '';
  let picked: string[] = chosen ? [chosen] : [];
  let anchor = chosen;
  const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement | null;
  const on = <E extends Event>(t: EventTarget, type: string, fn: (e: E) => void) => t.addEventListener(type, fn as EventListener, { signal });
  const order = () => album().items.map((i) => i.id);
  const url = () => `${location.pathname}?view=items${chosen ? `&item=${encodeURIComponent(chosen)}` : ''}`;
  const card = (id: string) => root.querySelector<HTMLElement>(`[data-album-card="${CSS.escape(id)}"]`);
  initRichFields(root, signal, (href, apply) => openLink(href, apply));

  // ---------- history: the article editor's own, so Undo carries on across the views ----------
  const HKEY = `editor.history.${state.id}`;
  const hist: { past: string[]; future: string[] } = JSON.parse(sessionStorage.getItem(HKEY) ?? '{"past":[],"future":[]}');
  const persist = () => sessionStorage.setItem(HKEY, JSON.stringify({ past: hist.past.slice(-50), future: hist.future.slice(-50) }));
  const updateUndo = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-editor-undo]').forEach((b) => (b.disabled = !hist.past.length));
    document.querySelectorAll<HTMLButtonElement>('[data-editor-redo]').forEach((b) => (b.disabled = !hist.future.length));
  };
  updateUndo();

  // ---------- saving: one queue, never two at once; the regions drawn again once it's in ----------
  const queue = new SaveQueue<Refresh>(
    (w, r) => ({ details: !!w?.details || !!r.details, quiet: (w?.quiet ?? true) && !!r.quiet }),
    async (job, more) => {
      saveStatus.saving();
      const r = await api<{ article: Article }>('PUT', `articles/${state.id}`, {
        article: doc,
        ifMatch: { [state.key]: state.version, ...(state.structureVersion ? { [STRUCTURE]: state.structureVersion } : {}) },
      });
      if (r.ok) {
        state.version = r.data.versions?.[state.key] ?? state.version;
        if (r.data.versions?.[STRUCTURE]) state.structureVersion = r.data.versions[STRUCTURE];
        doc = more() ? { ...doc, updatedAt: r.data.article.updatedAt } : r.data.article;
        saved = structuredClone(r.data.article);
        if (more()) return 'ok';
        saveStatus.saved();
        await redraw(job);
        return 'ok';
      }
      if (r.status === 409) {
        saveStatus.failed('Not saved: this album changed in another tab or on disk');
        dialog('editor-conflict')?.showModal();
        return 'stop';
      }
      doc = structuredClone(saved);
      saveStatus.failed(`Not saved: ${(r.data.issues ?? []).map(describeIssue).join('; ') || 'the change was refused'}. The change was put back`);
      await redraw({ details: true });
      return 'failed';
    },
  );
  const typing = () => !!document.activeElement?.closest('[data-album-fields] input, [data-album-fields] [data-rich-input]');
  /** The list, its head and (when asked) the details drawn again from what was saved; the chosen cards stay chosen. */
  const redraw = async (r: Refresh) => {
    const names = ['album-head', 'album', ...(r.details ? ['album-details'] : [])];
    // a card that had the focus keeps it (the keyboard moves one after another)
    let focused: string | undefined;
    const landing = () => (focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-album-pick]')?.dataset.albumPick);
    await swapRegions(names, url(), r.details ? undefined : () => false, { quiet: r.quiet, label: 'Updating the album…', landing }).catch(() => null);
    paintPicked();
    if (focused) card(focused)?.querySelector<HTMLElement>('[data-album-pick]')?.focus();
  };

  /** A change to the album: kept in the history, shown, and saved. A refusal says why and changes nothing. */
  const change = (next: Album | Edit, opts: Refresh & { say?: string; moved?: boolean } = {}) => {
    if ('ok' in next && !next.ok) return saveStatus.failed(`Not saved: ${next.reason}`);
    const a = 'ok' in next ? (next as { album: Album }).album : (next as Album);
    if (a === doc.album) return;
    hist.past.push(JSON.stringify(doc));
    hist.future = [];
    persist();
    updateUndo();
    doc = { ...doc, album: a };
    if (opts.moved) showOrder();
    if (opts.say) announce(opts.say);
    saveStatus.dirty();
    void queue.push({ details: !!opts.details, quiet: opts.quiet ?? !!opts.moved });
  };
  /** A move shown at once (§3.6): the cards put in the album's new order and numbered again. */
  const showOrder = () => {
    const list = root.querySelector('[data-album-items]');
    if (!list) return;
    for (const id of order()) {
      const li = card(id);
      if (li) list.append(li);
    }
    list.querySelectorAll('.album-card-n').forEach((n, k) => (n.textContent = String(k + 1)));
  };
  const restore = (from: string[], to: string[]) => {
    const prev = from.pop();
    if (!prev) return;
    to.push(JSON.stringify(doc));
    persist();
    updateUndo();
    doc = JSON.parse(prev);
    if (!order().includes(chosen)) chosen = order()[0] ?? '';
    picked = chosen ? [chosen] : [];
    saveStatus.dirty();
    void queue.push({ details: true });
  };
  const undo = () => restore(hist.past, hist.future);
  const redo = () => restore(hist.future, hist.past);

  // ---------- choosing cards ----------
  const paintPicked = () => {
    root.querySelectorAll<HTMLElement>('[data-album-pick]').forEach((b) => b.setAttribute('aria-pressed', String(picked.includes(b.dataset.albumPick ?? ''))));
    const several = picked.length > 1;
    const box = root.querySelector<HTMLElement>('[data-album-several]');
    const one = root.querySelector<HTMLElement>('[data-album-one]');
    if (box) box.hidden = !several;
    if (one) one.hidden = several;
    const count = root.querySelector('[data-album-several-count]');
    if (count) count.textContent = `${picked.length} items chosen`;
  };
  const choose = (id: string, how: 'one' | 'range' | 'toggle' = 'one') => {
    picked = how === 'range' && anchor ? pickRange(order(), anchor, id) : how === 'toggle' ? pickToggle(picked, id) : [id];
    if (how !== 'range') anchor = id;
    if (!picked.length) picked = [id];
    paintPicked();
    if (picked.length > 1 || id === chosen) return;
    chosen = id;
    history.replaceState(history.state, '', url());
    void swapRegions(['album-details'], url(), undefined, { label: 'Showing the item…' }).then(paintPicked);
  };
  paintPicked();

  // ---------- an item's fields: saved as they change ----------
  on(root, 'change', (e) => {
    const t = e.target as HTMLInputElement;
    const box = t.closest<HTMLElement>('[data-album-fields]');
    if (!box || !t.name) return;
    const id = box.dataset.albumFields ?? '';
    if (t.name === 'upFront') return change(setUpFront(album(), id, t.checked), { say: t.checked ? 'Up front' : 'Not up front' });
    if (t.name === 'shape') return change(setEmbedShape(album(), id, t.value));
    const field = t.name as ItemField;
    if (!FIELDS.has(field)) return;
    if (field === 'description') {
      const count = root.querySelector('[data-album-count]');
      if (count) count.textContent = `${t.value.length} of ${ITEM_DESCRIPTION_MAX} characters`;
    }
    const value = field === 'autoplay' || field === 'loop' ? t.checked : field === 'download' ? (t.value === '' ? undefined : t.value === 'true') : field === 'duration' ? (t.value.trim() ? parseLength(t.value) : undefined) : t.value;
    change(setItemField(album(), id, field, value), { quiet: true });
  });

  // ---------- clicks ----------
  on<MouseEvent>(root, 'click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-album-pick], [data-album-add], [data-album-sort], [data-album-move], [data-album-remove], [data-album-poster], [data-album-standard]');
    if (!el) return;
    const d = el.dataset;
    if (d.albumPick) return choose(d.albumPick, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'one');
    if (d.albumAdd === 'library') return openPicker('multiple');
    if (d.albumAdd === 'upload') return dialog('album-upload')?.showModal();
    if (d.albumAdd === 'link') return dialog('album-link')?.showModal();
    if (d.albumSort !== undefined) {
      const day = (id: string) => card(id)?.dataset.taken || undefined;
      return change(sortByTaken(album(), (i) => day(i.id)), { moved: true, say: 'Sorted by date taken' });
    }
    if (d.albumMove) return move(d.albumMove);
    if (d.albumRemove !== undefined) return remove();
    if (d.albumPoster !== undefined) return openPicker('single');
    if (d.albumStandard) return standard(d.albumStandard, el);
  });
  const move = (where: string) => {
    const a = album();
    const next = where === 'start' ? moveToStart(a, picked) : where === 'end' ? moveToEnd(a, picked) : moveBy(a, picked, where === 'up' ? -1 : 1);
    change(next, { moved: true, say: `Moved to place ${next.items.findIndex((i) => picked.includes(i.id)) + 1}` });
    card(picked[0])?.querySelector<HTMLElement>('[data-album-pick]')?.focus();
  };
  const remove = () => {
    const ids = order();
    const at = ids.findIndex((id) => picked.includes(id));
    const left = ids.filter((id) => !picked.includes(id));
    const n = picked.length;
    chosen = left[Math.min(at, left.length - 1)] ?? '';
    picked = chosen ? [chosen] : [];
    history.replaceState(history.state, '', url());
    change(removeItems(album(), ids.filter((id) => !left.includes(id))), { details: true, say: n === 1 ? 'Removed from the album: its file stays in the library' : `${n} items removed from the album: their files stay in the library` });
  };
  const standard = async (media: string, el: HTMLElement) => {
    const task = startTask('Making it standard…', { el, busyLabel: 'Making it standard…' });
    const r = await api('POST', `media/${media}/standard`, {});
    if (!r.ok) {
      task.failed();
      return saveStatus.failed(`Not changed: ${(r.data.issues ?? []).map(describeIssue).join('; ') || 'it was refused'}`);
    }
    void task.done();
    saveStatus.saved('Made standard');
    await redraw({ details: true });
  };
  /** Items added after the chosen card (or at the end), chosen, and shown. */
  const add = (items: ReturnType<typeof mediaItems>, say: string) => {
    const r = addItems(album(), items, picked.length === 1 ? chosen : null);
    if (r.ok && items.length) {
      chosen = items[items.length - 1].id;
      picked = [chosen];
      history.replaceState(history.state, '', url());
    }
    change(r, { details: true, say });
  };

  // ---------- the keyboard: Alt and an arrow moves, Delete removes, Ctrl+Z undoes ----------
  on<KeyboardEvent>(document, 'keydown', (e) => {
    const inField = !!(e.target as Element).closest('input, textarea, [contenteditable="true"], dialog');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !inField && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && !inField && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      return redo();
    }
    if (!(e.target as Element).closest('[data-album-pick]')) return;
    const arrows: Record<string, string> = { ArrowUp: 'up', ArrowLeft: 'up', ArrowDown: 'down', ArrowRight: 'down', Home: 'start', End: 'end' };
    if (e.altKey && arrows[e.key]) {
      e.preventDefault();
      return move(arrows[e.key]);
    }
    if (e.key === 'Delete' && !e.altKey && !mod) {
      e.preventDefault();
      return remove();
    }
  });
  on(document, 'click', (e) => {
    const t = (e.target as Element).closest('[data-editor-undo], [data-editor-redo]');
    if (t) return t.hasAttribute('data-editor-undo') ? undo() : redo();
  });

  // ---------- dragging cards, and dropping files ----------
  let dragging: string[] = [];
  const clearMarks = () => root.querySelectorAll('[data-drop-before], [data-dragging]').forEach((x) => (x.removeAttribute('data-drop-before'), x.removeAttribute('data-dragging')));
  const veil = (show: boolean) => {
    const v = root.querySelector<HTMLElement>('[data-album-veil]');
    if (v) v.hidden = !show;
  };
  on<DragEvent>(root, 'dragstart', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('[data-album-card]');
    if (!li) return;
    const id = li.dataset.albumCard ?? '';
    if (!picked.includes(id)) choose(id);
    dragging = [...picked];
    dragging.forEach((x) => card(x)?.setAttribute('data-dragging', ''));
    e.dataTransfer?.setData('text/plain', dragging.join(' '));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  on<DragEvent>(root, 'dragover', (e) => {
    const files = [...(e.dataTransfer?.types ?? [])].includes('Files');
    if (!files && !dragging.length) return;
    e.preventDefault();
    if (files) return veil(true);
    root.querySelectorAll('[data-drop-before]').forEach((x) => x.removeAttribute('data-drop-before'));
    (e.target as Element).closest('[data-album-card]')?.setAttribute('data-drop-before', '');
  });
  on<DragEvent>(root, 'dragleave', (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) veil(false);
  });
  on<DragEvent>(root, 'dragend', () => {
    dragging = [];
    clearMarks();
  });
  on<DragEvent>(root, 'drop', (e) => {
    e.preventDefault();
    veil(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) return startBatch(files);
    if (!dragging.length) return;
    const before = (e.target as Element).closest<HTMLElement>('[data-album-card]')?.dataset.albumCard ?? null;
    const ids = dragging;
    dragging = [];
    clearMarks();
    change(dropBefore(album(), ids, before), { moved: true, say: 'Moved' });
  });

  // ---------- the library picker: several to add, or one poster ----------
  let pickMode: 'multiple' | 'single' | null = null;
  const inPick = new Set<string>();
  const syncPicker = () => {
    const d = dialog('editor-picker');
    const use = d?.querySelector<HTMLButtonElement>('[data-editor-media-use]');
    const count = d?.querySelector<HTMLElement>('[data-editor-media-count]')?.firstElementChild;
    if (count) count.textContent = pickMode === 'multiple' ? `${inPick.size} chosen` : 'Choose a picture for the poster';
    if (use) {
      use.disabled = !inPick.size;
      use.hidden = pickMode !== 'multiple';
      const label = use.querySelector('.label') ?? use;
      label.textContent = inPick.size ? `Add ${inPick.size}` : 'Add them';
    }
  };
  const openPicker = (mode: 'multiple' | 'single') => {
    const d = dialog('editor-picker');
    if (!d) return;
    pickMode = mode;
    inPick.clear();
    const title = d.querySelector('#editor-picker-title');
    if (title) title.textContent = mode === 'multiple' ? 'Add pictures and videos' : 'Choose the poster';
    const kind = () => {
      const grid = d.querySelector<HTMLElement>('[data-editor-media-grid]');
      if (grid) grid.dataset.pickKind = mode === 'multiple' ? 'any' : 'image';
      d.querySelectorAll('[data-editor-media]').forEach((b) => b.setAttribute('aria-pressed', String(inPick.has(b.getAttribute('data-editor-media') ?? ''))));
    };
    kind();
    syncPicker();
    d.showModal();
    void fillPicker(d, () => (kind(), syncPicker()));
  };
  const picked_ = (ids: string[]) => {
    const mode = pickMode;
    pickMode = null;
    dialog('editor-picker')?.close();
    if (!ids.length) return;
    if (mode === 'single') return change(setItemField(album(), chosen, 'poster', ids[0]), { details: true, say: 'Poster changed' });
    add(mediaItems(album(), ids), ids.length === 1 ? 'Added 1 item' : `Added ${ids.length} items`);
  };
  on(document, 'click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('#editor-picker [data-editor-media], #editor-picker [data-editor-media-use]');
    if (!t || !pickMode) return;
    const id = t.dataset.editorMedia;
    if (!id) return picked_([...inPick]);
    if (pickMode === 'single') return picked_([id]);
    if (inPick.has(id)) inPick.delete(id);
    else inPick.add(id);
    t.setAttribute('aria-pressed', String(inPick.has(id)));
    syncPicker();
  });
  on(document, 'media:uploaded', async (e) => {
    if (!pickMode) return;
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    if (pickMode === 'single') return picked_([id]);
    inPick.add(id);
    await swapRegions(['media-grid'], url(), undefined, { quiet: true }).catch(() => null);
    const d = dialog('editor-picker');
    if (d) void fillPicker(d, () => d.querySelector(`[data-editor-media="${CSS.escape(id)}"]`)?.setAttribute('aria-pressed', 'true'));
    syncPicker();
  });

  // ---------- the link dialog, for the description's links ----------
  let linkTo: ((href: string) => void) | null = null;
  const openLink = (href: string, apply: (href: string) => void) => {
    linkTo = apply;
    const d = dialog('editor-insert-link');
    const input = d?.querySelector<HTMLInputElement>('input[name="href"]');
    if (input) input.value = href.startsWith('ref:') ? '' : href;
    d?.showModal();
  };

  // ---------- forms: a link, a video's address, a batch of files ----------
  const issue = (form: HTMLElement, msg: string) => {
    const p = form.querySelector<HTMLElement>('[data-editor-form-issue], [data-album-form-issue]');
    if (p) (p.textContent = msg), (p.hidden = !msg);
  };
  on<SubmitEvent>(document, 'submit', async (e) => {
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const val = (k: string) => String(data.get(k) ?? '').trim();
    if (form.matches('#editor-insert-link [data-editor-insert-form="link"]') && linkTo) {
      e.preventDefault();
      const target = val('ref') || val('href');
      if (target && !/^(https?:\/\/|mailto:|ref:)/i.test(target)) return issue(form, 'Use an address that starts with https://, http:// or mailto:, or choose an article.');
      issue(form, '');
      form.closest('dialog')?.close();
      linkTo(target);
      linkTo = null;
      return;
    }
    if (form.matches('[data-album-link-form]')) {
      e.preventDefault();
      const task = startTask('Asking the provider…', { el: form.querySelector('[type="submit"]'), busyLabel: 'Adding…' });
      const r = await api<Omit<EmbedFacts, 'embed'> & { embed: EmbedFacts['embed'] }>('POST', `articles/${state.id}/embed`, { url: val('url') });
      if (!r.ok) {
        task.failed();
        return issue(form, (r.data.issues ?? []).map((i) => i.message).join(' ') || "Couldn't add that video.");
      }
      void task.done();
      issue(form, '');
      form.reset();
      form.closest('dialog')?.close();
      return add([embedItem(album(), r.data)], `Added ${r.data.title}`);
    }
    if (form.matches('[data-album-upload-form]')) {
      e.preventDefault();
      return uploadBatch(form);
    }
  });
  on(document, 'click', (e) => {
    if (!(e.target as Element).closest('#editor-insert-link [data-editor-unlink]') || !linkTo) return;
    dialog('editor-insert-link')?.close();
    linkTo('');
    linkTo = null;
  });

  // ---------- uploading a batch: each file added to the album as soon as it's in ----------
  let batch: { file: File; row: HTMLElement; note: string }[] = [];
  const uploadForm = () => document.querySelector<HTMLFormElement>('[data-album-upload-form]');
  const startBatch = (files: File[]) => {
    const form = uploadForm();
    const list = form?.querySelector('[data-album-batch]');
    const tpl = form?.querySelector<HTMLTemplateElement>('template[data-album-batch-row]');
    if (!form || !list || !tpl) return;
    list.replaceChildren();
    batch = files.map((file, n) => {
      const row = (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      // each copy's own IDs, so every label still names its own field
      row.querySelectorAll<HTMLElement>('[id]').forEach((x) => (x.id = `${x.id}-${n}`));
      row.querySelectorAll<HTMLElement>('[for], [aria-describedby], [aria-labelledby]').forEach((x) => {
        for (const a of ['for', 'aria-describedby', 'aria-labelledby']) {
          const v = x.getAttribute(a);
          if (v) x.setAttribute(a, v.split(' ').map((w) => `${w}-${n}`).join(' '));
        }
      });
      const type = typeOf(file);
      const video = isVideoFile(file);
      const note = refusedFormat(file) ?? (video ? videoSizeIssue(file.size) : needsConversion(type) ? `${file.name} needs converting first: upload it in Media.` : pictureSizeIssue(type, file.size)) ?? '';
      row.querySelector('[data-album-batch-name]')!.textContent = file.name;
      row.querySelector('[data-album-batch-note]')!.textContent = note ? ` ${note}` : video ? ' A video: its alt text is its title.' : '';
      if (note) row.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.disabled = true));
      list.append(row);
      return { file, row, note };
    });
    const go = form.querySelector<HTMLButtonElement>('[data-album-upload-go]');
    if (go) go.disabled = !batch.some((b) => !b.note);
    issue(form, '');
    dialog('album-upload')?.showModal();
  };
  on(document, 'change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.closest('[data-album-files]') && t.files) startBatch([...t.files]);
  });
  const uploadBatch = async (form: HTMLFormElement) => {
    const todo = batch.filter((b) => !b.note);
    const alt = (b: (typeof batch)[number]) => b.row.querySelector<HTMLInputElement>('[data-album-batch-alt] input, input[name="alt"]')?.value.trim() ?? '';
    const caption = (b: (typeof batch)[number]) => b.row.querySelector<HTMLInputElement>('input[name="caption"]')?.value.trim() ?? '';
    if (todo.some((b) => !alt(b))) return issue(form, 'Give every file its alt text: what it shows, for someone who can’t see it.');
    issue(form, '');
    const status = form.querySelector('[data-album-batch-status]');
    let n = 0;
    for (const b of todo) {
      n++;
      if (status) status.textContent = `Uploading ${n} of ${todo.length}: ${b.file.name}…`;
      const data = new FormData();
      data.set('file', b.file, b.file.name);
      data.set('owner', state.owner);
      data.set('caption', caption(b));
      if (isVideoFile(b.file)) {
        const v = await videoFacts(b.file);
        if (!v) {
          issue(form, `This browser can't play ${b.file.name}. Save it as an MP4 (H.264) or a WebM, then try again.`);
          continue;
        }
        data.set('title', alt(b));
        data.set('width', String(v.width));
        data.set('height', String(v.height));
        data.set('duration', String(v.duration));
        if (v.poster) data.set('poster', v.poster, 'poster.webp');
      } else {
        data.set('alt', alt(b));
        const bytes = new Uint8Array(await b.file.arrayBuffer());
        const day = takenOf(bytes);
        if (day) data.set('taken', day);
        if (typeOf(b.file) === 'image/svg+xml') data.set('svgAs', svgChoices(b.file.size).default);
      }
      const r = await api<{ id: string }>('POST', 'media', data);
      if (!r.ok) {
        issue(form, `${b.file.name}: ${(r.data.issues ?? []).map((i) => i.message).join(' ') || 'not uploaded'}`);
        continue;
      }
      b.row.remove();
      add(mediaItems(album(), [r.data.id]), `Added ${b.file.name}`);
    }
    batch = batch.filter((b) => b.row.isConnected && !b.note);
    if (status) status.textContent = '';
    if (!batch.length) {
      form.reset();
      form.closest('dialog')?.close();
    }
  };

  // ---------- changes made elsewhere: drawn again, unless something here waits to be saved ----------
  onContentChange((c) => {
    if (c.origin === TAB || !c.files.includes(state.key) || queue.pending || typing()) return;
    void swapRegions(['album-head', 'album', 'album-details', 'state'], url(), undefined, { quiet: true }).then(() => {
      const fresh = readState();
      if (!fresh.article) return;
      doc = fresh.article;
      saved = structuredClone(doc);
      state.version = fresh.version;
      state.structureVersion = fresh.structureVersion;
      paintPicked();
    });
  }, signal);
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
