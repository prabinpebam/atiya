/**
 * An album's Up front view (documentation/gallery/spec.md §9.3): the band arranger. A tile is chosen with a click
 * or Enter; it's dragged to a cell or by its handles to a size (both snapping to the grid), or moved with the arrow
 * keys (Shift to resize); the tray's items are put up front with a click or dropped on a cell, and a tile dragged to
 * the tray leaves the band. Every change is shown at once, saved at once through one queue, said in the live line
 * (or why it was refused), and undone with Undo (the article editor's own history). The rules are the pure
 * model/arranger.ts; this only wires them to the page.
 */
import type { Album, Article } from '../../content/schema';
import { phoneOf, rowsOf, showcaseOf } from '../../content/album';
import { SaveQueue } from '../model/queue';
import type { Edit } from '../model/album';
import {
  arrangeForPhones,
  arrangeKey,
  backToAutomatic,
  closeGapsIn,
  focusAt,
  gridOf,
  moveTo,
  nudgeFocus,
  phoneJoined,
  placeWords,
  putUpFront,
  resizeTo,
  setDisplay,
  setOnPhones,
  setPlay,
  setTileFocus,
  takeOut,
  useDefault,
  usePreset,
  type Dir,
  type PresetId,
  type Show,
} from '../model/arranger';
import { TAB, api, describeIssue, onContentChange, saveStatus, swapRegions } from './client';

interface ArrangerState {
  id: string;
  key: string;
  version: string | null;
  structureVersion: string | null;
  article: Article;
}
type Kind = Parameters<typeof setDisplay>[3];
const STRUCTURE = '/content/structures/site.json';
const ARROWS: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
/** How far (px) a pointer moves before a press becomes a drag. */
const DRAG_START = 4;

export function initArranger(root: HTMLElement, signal: AbortSignal) {
  const readState = (): ArrangerState => JSON.parse(document.querySelector('[data-editor-state]')?.textContent ?? '{}');
  const state = readState();
  if (!state.article) return;
  let doc: Article = state.article;
  let saved: Article = structuredClone(doc);
  let show = (root.dataset.show === 'phone' ? 'phone' : 'wide') as Show;
  let chosen = root.dataset.chosen ?? '';
  let dragging = false;
  const album = (): Album => doc.album ?? { items: [] };
  const on = <E extends Event>(t: EventTarget, type: string, fn: (e: E) => void) => t.addEventListener(type, fn as EventListener, { signal });
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const attr = (name: string, value: string) => `[${name}="${CSS.escape(value)}"]`;
  const place = (item: string) => $(attr('data-arranger-place', item));
  const kindOf = (item: string) => (place(item)?.dataset.kind ?? 'missing') as Kind;
  const bytesOf = (item: string) => (place(item)?.dataset.bytes ? Number(place(item)!.dataset.bytes) : undefined);
  const labelOf = (item: string) => place(item)?.querySelector('[data-arranger-tile]')?.getAttribute('aria-label')?.split(', ')[0] ?? item;
  const url = () => `${location.pathname}?view=front${show === 'phone' ? '&show=phone' : ''}${chosen ? `&tile=${encodeURIComponent(chosen)}` : ''}`;
  const band = (a: Album) => (show === 'phone' ? phoneOf(a) : showcaseOf(a));

  // ---------- the live line: each move in words, and each refusal's reason ----------
  const say = (text: string) => {
    const live = $('[data-arranger-live]');
    if (!live) return;
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = text));
  };

  // ---------- history: the article editor's own, so Undo carries on across the views ----------
  const HKEY = `editor.history.${state.id}`;
  const hist: { past: string[]; future: string[] } = JSON.parse(sessionStorage.getItem(HKEY) ?? '{"past":[],"future":[]}');
  const persist = () => sessionStorage.setItem(HKEY, JSON.stringify({ past: hist.past.slice(-50), future: hist.future.slice(-50) }));
  const updateUndo = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-editor-undo]').forEach((b) => (b.disabled = !hist.past.length));
    document.querySelectorAll<HTMLButtonElement>('[data-editor-redo]').forEach((b) => (b.disabled = !hist.future.length));
  };
  updateUndo();

  // ---------- saving: one queue, never two at once; the region drawn again once it's in ----------
  const queue = new SaveQueue<true>(
    () => true,
    async (_, more) => {
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
        await redraw();
        return 'ok';
      }
      if (r.status === 409) {
        saveStatus.failed('Not saved: this album changed in another tab or on disk');
        (document.getElementById('editor-conflict') as HTMLDialogElement | null)?.showModal();
        return 'stop';
      }
      doc = structuredClone(saved);
      saveStatus.failed(`Not saved: ${(r.data.issues ?? []).map(describeIssue).join('; ') || 'the change was refused'}. The change was put back`);
      await redraw();
      return 'failed';
    },
  );

  /** The control that had the focus, as a selector, so it has it again once the region is drawn again. */
  const focusedSelector = () => {
    for (let el = document.activeElement as HTMLElement | null; el && root.contains(el); el = el.parentElement) {
      const a = [...el.attributes].find((x) => /^data-(arranger|editor)-/.test(x.name) && x.name !== 'data-arranger-live');
      if (a) return attr(a.name, a.value);
    }
    return null;
  };
  const redraw = async (quiet = true) => {
    let sel: string | null = null;
    await swapRegions(['album-arranger'], url(), () => dragging, { quiet, label: 'Showing the band…', landing: () => (sel = focusedSelector()) }).catch(() => null);
    updateUndo();
    const el = sel ? $(sel) : null;
    (el?.matches('button, input') ? el : el?.querySelector<HTMLElement>('button, input'))?.focus();
  };

  /** The band shown as the album now has it, at once (§3.6): each tile moved to its new cells. */
  const paint = (a: Album) => {
    const tiles = band(a);
    for (const t of tiles) {
      const el = place(t.item);
      if (!el) continue;
      el.style.setProperty('--x', String(t.x + 1));
      el.style.setProperty('--y', String(t.y + 1));
      el.style.setProperty('--w', String(t.w));
      el.style.setProperty('--h', String(t.h));
    }
    const canvas = $('[data-arranger-canvas]');
    const g = gridOf(show);
    if (canvas && Number.isFinite(g.rows)) canvas.style.setProperty('--rows', String(Math.min(g.rows, rowsOf(tiles) + 2)));
  };

  /** A change to the album: kept in the history, shown, said and saved. A refusal says why and changes nothing. */
  const change = (edit: Edit, words?: (a: Album) => string) => {
    if (!edit.ok) {
      say(edit.reason);
      saveStatus.failed(`Not saved: ${edit.reason}`);
      return false;
    }
    const before = album();
    if (edit.album === before) return true;
    hist.past.push(JSON.stringify(doc));
    hist.future = [];
    persist();
    updateUndo();
    doc = { ...doc, album: edit.album };
    paint(edit.album);
    const joined = show === 'wide' ? phoneJoined(before, edit.album) : [];
    say([words?.(edit.album), joined.length ? `${joined.map(labelOf).join(', ')} joined the phone's arrangement at the end.` : ''].filter(Boolean).join(' '));
    saveStatus.dirty();
    void queue.push(true);
    return true;
  };
  const placeOf = (item: string) => (a: Album) => {
    const t = band(a).find((x) => x.item === item);
    return t ? `${labelOf(item)}: ${placeWords(t)}.` : '';
  };
  const restore = (from: string[], to: string[]) => {
    const prev = from.pop();
    if (!prev) return;
    to.push(JSON.stringify(doc));
    persist();
    updateUndo();
    doc = JSON.parse(prev);
    paint(album());
    saveStatus.dirty();
    void queue.push(true);
  };

  // ---------- choosing, and the band shown ----------
  const choose = (item: string) => {
    chosen = item;
    root.querySelectorAll<HTMLElement>('[data-arranger-tile]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.arrangerTile === item)));
    history.replaceState(history.state, '', url());
    void redraw(false);
  };

  // ---------- clicks ----------
  let justDragged = false;
  on<MouseEvent>(root, 'click', (e) => {
    if (justDragged) return void (justDragged = false);
    const el = (e.target as Element).closest<HTMLElement>(
      '[data-arranger-tile], [data-arranger-show], [data-arranger-close], [data-arranger-default], [data-arranger-phone-arrange], [data-arranger-phone-back], [data-arranger-move], [data-arranger-size], [data-arranger-focus], [data-arranger-focus-reset], [data-arranger-remove], [data-arranger-tray-item], [data-editor-undo], [data-editor-redo]',
    );
    if (!el || (el as HTMLButtonElement).disabled) return;
    const d = el.dataset;
    if (d.arrangerTile) return choose(d.arrangerTile);
    if (d.arrangerShow) {
      show = d.arrangerShow === 'phone' ? 'phone' : 'wide';
      history.replaceState(history.state, '', url());
      return void redraw(false);
    }
    if (d.arrangerClose !== undefined) return void change(closeGapsIn(album(), show), () => 'Gaps closed: the tiles moved up.');
    if (d.arrangerDefault !== undefined) return void change(useDefault(album()), () => 'The band is worked out from the album again.');
    if (d.arrangerPhoneArrange !== undefined) return void change(arrangeForPhones(album()), () => "The phone's band is your own arrangement now.");
    if (d.arrangerPhoneBack !== undefined) return void change(backToAutomatic(album()), () => "The phone's band is worked out from the wide one again.");
    if (d.arrangerMove) return void change(arrangeKey(album(), show, chosen, d.arrangerMove as Dir, false), placeOf(chosen));
    if (d.arrangerSize) return void change(arrangeKey(album(), show, chosen, d.arrangerSize as Dir, true), placeOf(chosen));
    if (d.arrangerFocus !== undefined) {
      const img = el.querySelector('img')?.getBoundingClientRect() ?? el.getBoundingClientRect();
      return setFocus(focusAt((e.clientX - img.left) / img.width, (e.clientY - img.top) / img.height));
    }
    if (d.arrangerFocusReset !== undefined) return void change(setTileFocus(album(), chosen, undefined, kindOf(chosen)), () => "It uses the picture's focus point.");
    if (d.arrangerRemove !== undefined) {
      const was = labelOf(chosen);
      if (change(takeOut(album(), chosen), () => `${was} is no longer up front.`)) chosen = '';
      return;
    }
    if (d.arrangerTrayItem) {
      const item = d.arrangerTrayItem;
      if (change(putUpFront(album(), item), placeOf(item))) chosen = item;
      return;
    }
    if (d.editorUndo !== undefined) return restore(hist.past, hist.future);
    if (d.editorRedo !== undefined) return restore(hist.future, hist.past);
  });

  const setFocus = (focus: string) => {
    const box = $('[data-arranger-focus-box]');
    if (!change(setTileFocus(album(), chosen, focus, kindOf(chosen)), () => `Focus point: ${focus}.`) || !box) return;
    const [x, y] = focus.split(' ');
    box.style.setProperty('--fx', x);
    box.style.setProperty('--fy', y);
    box.querySelector<HTMLElement>('[data-arranger-focus]')?.setAttribute('data-arranger-focus', focus);
  };

  // ---------- fields: the preset, the display, Play in the band and Show on phones ----------
  on(root, 'change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.closest('[data-arranger-preset]') && t.value) {
      const aspect = (item: string) => Number(place(item)?.dataset.aspect) || undefined;
      return void change(usePreset(album(), t.value as PresetId, aspect), () => 'The preset is laid out.');
    }
    if (t.closest('[data-arranger-display]')) return void change(setDisplay(album(), chosen, t.value as 'kind' | 'fill' | 'fit', kindOf(chosen)), () => `It shows its item: ${t.value === 'kind' ? 'by kind' : t.value}.`);
    if (t.closest('[data-arranger-play]')) {
      if (!change(setPlay(album(), chosen, t.checked, { kind: kindOf(chosen), bytes: bytesOf(chosen) }), () => (t.checked ? 'It plays in the band.' : "It doesn't play in the band."))) t.checked = !t.checked;
      return;
    }
    if (t.closest('[data-arranger-phones]')) {
      if (!change(setOnPhones(album(), chosen, t.checked), () => (t.checked ? 'It shows on phones.' : "It doesn't show on phones."))) t.checked = !t.checked;
    }
  });

  // ---------- keys: a tile's arrows move it (Shift: resize), Delete takes it out; the focus point's arrows move it ----------
  on<KeyboardEvent>(root, 'keydown', (e) => {
    const tile = (e.target as Element).closest<HTMLElement>('[data-arranger-tile]');
    const focus = (e.target as Element).closest<HTMLElement>('[data-arranger-focus]');
    const dir = ARROWS[e.key];
    if (tile && dir && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const item = tile.dataset.arrangerTile ?? '';
      chosen = item;
      return void change(arrangeKey(album(), show, item, dir, e.shiftKey), placeOf(item));
    }
    if (tile && (e.key === 'Delete' || e.key === 'Backspace') && show === 'wide') {
      e.preventDefault();
      const item = tile.dataset.arrangerTile ?? '';
      if (change(takeOut(album(), item), () => `${labelOf(item)} is no longer up front.`) && chosen === item) chosen = '';
      return;
    }
    if (focus && dir) {
      e.preventDefault();
      setFocus(nudgeFocus(focus.dataset.arrangerFocus, dir));
    }
  });
  on<KeyboardEvent>(document, 'keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' || k === 'y') {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) restore(hist.future, hist.past);
      else restore(hist.past, hist.future);
    }
  });

  // ---------- the pointer: drag a tile to a cell, its handles to a size, the tray's items in and out ----------
  const outline = () => $('[data-arranger-outline]');
  const showOutline = (r: { x: number; y: number; w: number; h: number } | null, refused = false) => {
    const o = outline();
    if (!o) return;
    o.hidden = !r;
    if (!r) return;
    o.style.setProperty('--x', String(r.x + 1));
    o.style.setProperty('--y', String(r.y + 1));
    o.style.setProperty('--w', String(r.w));
    o.style.setProperty('--h', String(r.h));
    o.toggleAttribute('data-refused', refused);
  };
  const grid = () => {
    const canvas = $('[data-arranger-canvas]')!;
    const r = canvas.getBoundingClientRect();
    const cols = Number(canvas.dataset.columns) || gridOf(show).columns;
    const gap = parseFloat(getComputedStyle(canvas).columnGap) || 0;
    return { r, cols, pitch: (r.width + gap) / cols };
  };
  const over = (sel: string, x: number, y: number) => {
    const r = $(sel)?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  on<PointerEvent>(root, 'pointerdown', (e) => {
    if (e.button !== 0) return;
    const t = e.target as Element;
    const handle = t.closest<HTMLElement>('[data-arranger-handle]');
    const tile = t.closest<HTMLElement>('[data-arranger-place]');
    const tray = t.closest<HTMLElement>('[data-arranger-tray-place]');
    const host = tile ?? tray;
    if (!host || (tray && tray.querySelector<HTMLButtonElement>('button')?.disabled)) return;
    const item = tile?.dataset.arrangerPlace ?? tray?.dataset.arrangerTrayPlace ?? '';
    const from = band(album()).find((x) => x.item === item);
    if (tile && !from) return;
    // a selection left by an earlier drag would turn this one into the browser's own drag (a pointercancel)
    getSelection()?.removeAllRanges();
    const g = grid();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    let trial: { edit: Edit; words: (a: Album) => string } | null = null;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = Math.round((ev.clientX - sx) / g.pitch);
      const dy = Math.round((ev.clientY - sy) / g.pitch);
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_START) return;
      moved = dragging = true;
      host.toggleAttribute(handle ? 'data-resizing' : 'data-dragging', true);
      const inCanvas = over('[data-arranger-canvas]', ev.clientX, ev.clientY);
      if (tray) {
        if (!inCanvas) return void ((trial = null), showOutline(null));
        const at = { x: Math.floor((ev.clientX - g.r.left) / g.pitch), y: Math.floor((ev.clientY - g.r.top) / g.pitch) };
        trial = { edit: putUpFront(album(), item, at), words: placeOf(item) };
        const added = trial.edit.ok ? showcaseOf(trial.edit.album).find((x) => x.item === item) : null;
        return showOutline(added ?? { ...at, w: 3, h: 2 }, !trial.edit.ok);
      }
      if (!handle && !inCanvas && show === 'wide' && over('[data-arranger-tray]', ev.clientX, ev.clientY)) {
        trial = { edit: takeOut(album(), item), words: () => `${labelOf(item)} is no longer up front.` };
        return showOutline(null);
      }
      if (!from) return;
      const h = handle?.dataset.arrangerHandle;
      const rect = handle
        ? { x: from.x, y: from.y, w: h === 'bottom' ? from.w : from.w + dx, h: h === 'right' ? from.h : from.h + dy }
        : { x: Math.max(0, Math.min(g.cols - from.w, from.x + dx)), y: Math.max(0, from.y + dy), w: from.w, h: from.h };
      trial = handle ? { edit: resizeTo(album(), show, item, { w: rect.w, h: rect.h }), words: placeOf(item) } : { edit: moveTo(album(), show, item, { x: rect.x, y: rect.y }), words: placeOf(item) };
      showOutline(rect, !trial.edit.ok);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      drag.abort();
      host.removeAttribute('data-dragging');
      host.removeAttribute('data-resizing');
      showOutline(null);
      dragging = false;
      if (!moved) return;
      justDragged = true;
      setTimeout(() => (justDragged = false), 0);
      if (trial && ev.type === 'pointerup') {
        const ok = change(trial.edit, trial.words);
        if (ok && tile && trial.edit.ok && !band(trial.edit.album).some((x) => x.item === item) && chosen === item) chosen = '';
        if (ok && tray) chosen = item;
      }
    };
    // the drag's own listeners, on the window (the pointer leaves the tile at once), gone when it ends or the page does
    const drag = new AbortController();
    signal.addEventListener('abort', () => drag.abort(), { once: true });
    window.addEventListener('pointermove', move, { signal: drag.signal });
    window.addEventListener('pointerup', end, { signal: drag.signal });
    window.addEventListener('pointercancel', end, { signal: drag.signal });
  });
  // the tiles and the tray's items are dragged by the arranger, never by the browser
  on<DragEvent>(root, 'dragstart', (e) => {
    const el = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
    if (el?.closest('[data-arranger-canvas], [data-arranger-tray]')) e.preventDefault();
  });

  // ---------- changes made elsewhere: drawn again, unless something here waits to be saved ----------
  onContentChange((c) => {
    if (c.origin === TAB || !c.files.includes(state.key) || queue.pending || dragging) return;
    void swapRegions(['album-arranger', 'state'], url(), undefined, { quiet: true }).then(() => {
      const fresh = readState();
      if (!fresh.article) return;
      doc = fresh.article;
      saved = structuredClone(doc);
      state.version = fresh.version;
      state.structureVersion = fresh.structureVersion;
      updateUndo();
    });
  }, signal);
}
