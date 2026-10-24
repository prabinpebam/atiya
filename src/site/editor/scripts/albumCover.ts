/**
 * Edit cover (documentation/gallery/spec.md §9.6): the album editor's cover band as its arranger. Drawn from the
 * album being edited (the album editor's own, so every change goes through its one save queue and its Undo), with the
 * items' facts the cover region carries. A tile is dragged to a cell or by its handles to a size, snapping to whole
 * cells; an item of the strip dragged onto the band joins it, a tile dragged onto the strip leaves it; the arrow keys
 * (Shift: resize), Delete and the tile bar's buttons do the same without a drag. The rules are the pure model/cover.ts.
 */
import type { Album, AlbumTile } from '../../content/schema';
import { coverOf, displayFor, holes, readingOrder, type MediaLookup } from '../../content/album';
import type { Outcome } from '../model/album';
import {
  arrangeForPhones,
  arrangeKey,
  canvasRows,
  cellAt,
  closeGapsIn,
  coverState,
  coverWarnings,
  gridOf,
  leadOf,
  moveTo,
  phoneJoined,
  phoneToAutomatic,
  placeWords,
  playRefusal,
  putInCover,
  resizeTo,
  setBackground,
  setDisplay,
  setOnPhones,
  setPlay,
  shownTiles,
  takeOut,
  useAutomatic,
  usePictureFocus,
  usePreset,
  type CoverItem,
  type Dir,
  type PresetId,
  type Rect,
  type Show,
} from '../model/cover';
import { initCoverBackground } from './coverBackground';

/** What the album editor lends Edit cover: the album as it stands, its way to keep a change, and its media. */
export interface CoverHost {
  album(): Album;
  change(next: Album, what: string): void;
  lookup: MediaLookup;
}

const ARROWS: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const DRAG_START = 4;
const SAVED = 'Cover changed';

export function initAlbumCover(root: HTMLElement, signal: AbortSignal, host: CoverHost) {
  const panel = () => root.querySelector<HTMLElement>('[data-album-cover-editor]');
  const region = () => root.querySelector<HTMLElement>('[data-album-cover]');
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => panel()?.querySelector<T>(sel) ?? null;
  if (!panel()) return;

  let open = false;
  let show: Show = 'wide';
  let chosen = '';
  let preview = false;
  let dragging = false;
  let justDragged = false;
  let before: Album | null = null;
  let lead: string | undefined;
  let items: CoverItem[] = [];
  const readItems = () => {
    try {
      items = JSON.parse(region()?.querySelector('[data-cover-items]')?.textContent || '[]') as CoverItem[];
    } catch {
      items = [];
    }
  };
  const factsOf = (id: string) => items.find((i) => i.id === id);
  const labelOf = (id: string) => factsOf(id)?.label ?? id;
  const wideOf = (album: Album, id: string): AlbumTile | undefined => coverOf(album, host.lookup).find((t) => t.item === id);

  const say = (text: string, negative = false) => {
    const s = $('[data-cover-status]');
    if (!s) return;
    s.textContent = text;
    s.toggleAttribute('data-negative', negative);
  };
  const placeOf = (id: string) => (a: Album) => {
    const t = shownTiles(a, show, host.lookup).find((x) => x.item === id);
    return t ? `${labelOf(id)}: ${placeWords(t)}.` : '';
  };

  /** A change kept through the album editor (shown, saved, undoable), or its refusal said. */
  const apply = (r: Outcome, words?: (a: Album) => string) => {
    if (!r.ok) {
      say(r.why, true);
      return false;
    }
    const was = host.album();
    if (r.album !== was) host.change(r.album, SAVED);
    const joined = show === 'wide' ? phoneJoined(was, r.album) : [];
    say([r.note, words?.(r.album), joined.length ? `${joined.map(labelOf).join(', ')} joined the phone's arrangement at the end.` : ''].filter(Boolean).join(' '));
    paint();
    return true;
  };
  const paintBackground = initCoverBackground(root, panel, signal, {
    chosen: () => chosen,
    thumb: (id) => factsOf(id)?.thumb || undefined,
    auto: (id) => factsOf(id)?.bg,
    colour: (id) => wideOf(host.album(), id)?.bg,
    set: (id, hex) => void apply(setBackground(host.album(), id, hex, host.lookup), () => (hex ? `Its background is ${hex}.` : "Its background is the picture's own edge colour.")),
  });

  // ---------- drawing ----------
  const setRect = (el: HTMLElement, r: Rect) => {
    el.style.setProperty('--x', String(r.x + 1));
    el.style.setProperty('--y', String(r.y + 1));
    el.style.setProperty('--w', String(r.w));
    el.style.setProperty('--h', String(r.h));
  };
  const picture = (img: HTMLImageElement | null, it: CoverItem | undefined, mode: 'fill' | 'fit', focus?: string, own?: string) => {
    if (!img) return;
    if (it?.thumb) img.src = it.thumb;
    else img.removeAttribute('src');
    img.loading = 'eager';
    img.dataset.fit = mode === 'fit' ? 'contain' : 'cover';
    img.style.setProperty('--focus', focus ?? '50% 50%');
    const bg = own ?? it?.bg;
    if (bg) {
      img.dataset.bg = '';
      img.style.setProperty('--picture-bg', bg);
      img.style.setProperty('--picture-bg-dark', bg);
    }
  };
  const when = (p: HTMLElement, name: string, on: boolean) => p.querySelectorAll<HTMLElement>(`[data-cover-when="${name}"]`).forEach((el) => (el.hidden = !on));

  const paint = () => {
    const p = panel();
    if (!p || !open || dragging) return;
    const album = host.album();
    const st = coverState(album);
    const editable = show === 'wide' || st.phoneArranged;
    const grid = gridOf(show);
    const tiles = readingOrder(shownTiles(album, show, host.lookup));
    if (chosen && !tiles.some((t) => t.item === chosen)) chosen = '';
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-cover-tile], [data-cover-strip-item]');
    const refocus = focused ? (focused.dataset.coverTile ? `[data-cover-tile="${CSS.escape(focused.dataset.coverTile)}"]` : `[data-cover-strip-item="${CSS.escape(focused.dataset.coverStripItem ?? '')}"]`) : '';

    p.dataset.show = show;
    p.toggleAttribute('data-preview', preview);
    $('[data-cover-preview]')?.setAttribute('aria-pressed', String(preview));
    $('[data-cover-state]')!.textContent = show === 'wide' ? (st.arranged ? 'Arranged' : 'Automatic') : st.phoneArranged ? 'Arranged for phones' : 'Worked out for phones';
    p.querySelectorAll<HTMLElement>('[data-cover-show]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.coverShow === show)));
    when(p, 'wide', show === 'wide');
    when(p, 'editable', editable);
    when(p, 'phone-auto', show === 'phone' && !st.phoneArranged);
    when(p, 'phone-own', show === 'phone' && st.phoneArranged);
    $('[data-cover-hint]')!.textContent = preview
      ? `As the gallery will show it${show === 'phone' ? ' on a phone' : ''}. Preview again to go back to arranging.`
      : show === 'wide'
        ? st.arranged
          ? 'Your own arrangement. Drag a tile to a cell or by its edges to a size; or choose it and use the arrow keys (Shift to resize).'
          : 'Worked out from the album: change anything and it becomes your own arrangement.'
        : st.phoneArranged
          ? "The phone's own arrangement, 6 columns wide: the same moves, handles and keys. Items added to the cover join it at the end."
          : 'Worked out from the wide cover: 6 columns, in reading order. Arrange for phones to place the tiles yourself.';

    // the canvas: its cells, its holes hatched, its tiles in reading order
    const canvas = $('[data-cover-canvas]')!;
    canvas.style.setProperty('--columns', String(grid.columns));
    canvas.style.setProperty('--rows', String(canvasRows(tiles, show, editable && !preview)));
    canvas.toggleAttribute('data-editable', editable && !preview);
    canvas.inert = preview;
    canvas.querySelectorAll(':scope > :not([data-cover-outline])').forEach((el) => el.remove());
    const holeT = $<HTMLTemplateElement>('[data-cover-hole-template]')!;
    for (const h of holes(tiles, grid.columns)) {
      const el = (holeT.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      setRect(el, { ...h, w: 1, h: 1 });
      canvas.append(el);
    }
    const tileT = $<HTMLTemplateElement>('[data-cover-tile-template]')!;
    for (const t of tiles) {
      const el = (tileT.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      const it = factsOf(t.item);
      const wide = wideOf(album, t.item);
      el.dataset.coverPlace = t.item;
      setRect(el, t);
      const b = el.querySelector<HTMLElement>('[data-cover-tile]')!;
      b.dataset.coverTile = t.item;
      b.setAttribute('aria-pressed', String(!preview && t.item === chosen));
      const plays = !!wide?.play;
      const hidden = wide?.onPhones === false;
      b.setAttribute('aria-label', [labelOf(t.item), placeWords(t), plays ? 'plays in the cover' : '', hidden ? 'not on phones' : ''].filter(Boolean).join(', '));
      picture(el.querySelector('img'), it, displayFor(wide ?? {}, it?.kind), wide?.focus ?? it?.focus, wide?.bg);
      (el.querySelector('[data-cover-mark="play"]') as HTMLElement).hidden = !plays;
      (el.querySelector('[data-cover-mark="phones"]') as HTMLElement).hidden = !hidden;
      canvas.append(el);
    }

    // the warnings that apply
    const warn = $('[data-cover-warnings]')!;
    const ws = coverWarnings(album, show, host.lookup, factsOf);
    warn.replaceChildren(...ws.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
    warn.hidden = !ws.length;

    paintBar(album, editable);
    paintStrip(album);
    if (refocus) $(refocus)?.focus();
  };

  const paintBar = (album: Album, editable: boolean) => {
    const box = $('[data-cover-chosen]')!;
    $('[data-cover-none]')!.hidden = !!chosen;
    box.hidden = !chosen;
    if (!chosen) return;
    const t = shownTiles(album, show, host.lookup).find((x) => x.item === chosen)!;
    const wide = wideOf(album, chosen);
    const it = factsOf(chosen);
    $('[data-cover-chosen-label]')!.textContent = labelOf(chosen);
    $('[data-cover-chosen-place]')!.textContent = placeWords(t);
    box.querySelectorAll<HTMLButtonElement>('[data-cover-move], [data-cover-size]').forEach((b) => (b.disabled = !editable));
    const choice = wide?.display ?? 'kind';
    box.querySelectorAll<HTMLElement>('[data-cover-display]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.coverDisplay === choice)));
    $<HTMLButtonElement>('[data-cover-focus-reset]')!.disabled = !wide?.focus;
    const why = wide ? playRefusal(album, chosen, { kind: it?.kind, bytes: it?.bytes }, host.lookup) : null;
    const play = $<HTMLInputElement>('[data-cover-play] input')!;
    play.checked = !!wide?.play;
    play.disabled = !wide?.play && !!why;
    $('[data-cover-play-why]')!.textContent = !wide?.play && why ? why : '';
    $<HTMLInputElement>('[data-cover-phones] input')!.checked = wide?.onPhones === false;
    paintBackground();
  };

  const paintStrip = (album: Album) => {
    const strip = $('[data-cover-strip]')!;
    const inCover = new Set(coverOf(album, host.lookup).map((t) => t.item));
    const t = $<HTMLTemplateElement>('[data-cover-strip-template]')!;
    strip.replaceChildren(
      ...items.map((it) => {
        const el = (t.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        const on = inCover.has(it.id);
        el.dataset.coverStripPlace = it.id;
        const b = el.querySelector<HTMLElement>('[data-cover-strip-item]')!;
        b.dataset.coverStripItem = it.id;
        b.setAttribute('aria-label', on ? `${it.label}, in the cover: choose its tile` : `Add ${it.label} to the cover`);
        picture(el.querySelector('img'), it, it.kind === 'drawing' ? 'fit' : 'fill', it.focus);
        (el.querySelector('[data-cover-mark="in"]') as HTMLElement).hidden = !on;
        return el;
      }),
    );
  };

  // ---------- opening and closing ----------
  const openEditor = () => {
    const p = panel();
    if (!p) return;
    readItems();
    before = structuredClone(host.album());
    lead = leadOf(before);
    open = true;
    show = 'wide';
    chosen = '';
    preview = false;
    p.hidden = false;
    region()!.hidden = true;
    say('');
    paint();
    ($('[data-cover-tile]') ?? $('[data-cover-done]'))?.focus();
  };
  const close = () => {
    const p = panel();
    open = false;
    before = null;
    if (p) p.hidden = true;
    const r = region();
    if (r) r.hidden = false;
    r?.querySelector<HTMLElement>('[data-album-cover-edit]')?.focus();
  };
  /** Cancel: the cover put back as it was when Edit cover opened (the rest of the album as it is now), then closed. */
  const cancel = () => {
    const was = before;
    const now = host.album();
    if (was && JSON.stringify(was.cover) !== JSON.stringify(now.cover)) {
      const { cover: _, ...rest } = now;
      host.change(was.cover ? { ...rest, cover: was.cover } : rest, 'Cover put back');
    }
    close();
  };
  const choose = (id: string) => {
    chosen = id;
    paint();
    const t = shownTiles(host.album(), show, host.lookup).find((x) => x.item === id);
    if (t) say(`${labelOf(id)}: ${placeWords(t)}.`);
  };

  // after a save the regions are drawn again: the cover region stays hidden while editing, and the items are fresh
  document.addEventListener(
    'astro:page-load',
    () => {
      readItems();
      if (!open) return;
      const r = region();
      if (r) r.hidden = true;
      paint();
    },
    { signal },
  );

  // ---------- clicks (Edit cover is in the cover and the header's tools, outside the editor's root) ----------
  document.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-album-cover-edit]');
      if (b && !b.disabled && !open) openEditor();
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (e) => {
      if (justDragged) return void (justDragged = false);
      const el = (e.target as Element).closest<HTMLElement>(
        '[data-cover-show], [data-cover-preview], [data-cover-close-gaps], [data-cover-phone-arrange], [data-cover-phone-back], [data-cover-automatic], [data-cover-cancel], [data-cover-done], [data-cover-tile], [data-cover-strip-item], [data-cover-move], [data-cover-size], [data-cover-display], [data-cover-focus-reset], [data-cover-remove]',
      );
      if (!el || (el as HTMLButtonElement).disabled) return;
      const d = el.dataset;
      const album = host.album();
      if (!open) return;
      if (d.coverShow) {
        show = d.coverShow === 'phone' ? 'phone' : 'wide';
        return paint();
      }
      if (d.coverPreview !== undefined) {
        preview = !preview;
        say(preview ? 'Previewing the cover as the gallery shows it.' : 'Arranging the cover.');
        return paint();
      }
      if (d.coverDone !== undefined) return close();
      if (d.coverCancel !== undefined) return cancel();
      if (d.coverCloseGaps !== undefined) return void apply(closeGapsIn(album, show, host.lookup), () => 'Gaps closed: the tiles moved up.');
      if (d.coverPhoneArrange !== undefined) return void apply(arrangeForPhones(album, host.lookup), () => "The phone's cover is your own arrangement now.");
      if (d.coverPhoneBack !== undefined) return void apply(phoneToAutomatic(album), () => "The phone's cover is worked out from the wide one again.");
      if (d.coverAutomatic !== undefined) return void apply(useAutomatic(album, lead), () => 'The cover is worked out from the album again.');
      if (d.coverTile) return choose(d.coverTile);
      if (d.coverStripItem) {
        const id = d.coverStripItem;
        if (coverOf(album, host.lookup).some((t) => t.item === id)) {
          show = 'wide';
          choose(id);
          return $(`[data-cover-tile="${CSS.escape(id)}"]`)?.focus();
        }
        if (apply(putInCover(album, id, host.lookup), placeOf(id))) choose(id);
        return;
      }
      if (!chosen) return;
      if (d.coverMove) return void apply(arrangeKey(album, show, chosen, d.coverMove as Dir, false, host.lookup), placeOf(chosen));
      if (d.coverSize) return void apply(arrangeKey(album, show, chosen, d.coverSize as Dir, true, host.lookup), placeOf(chosen));
      if (d.coverDisplay) {
        const choice = d.coverDisplay as 'kind' | 'fill' | 'fit';
        return void apply(setDisplay(album, chosen, choice, factsOf(chosen)?.kind, host.lookup), () => `It shows its item: ${choice === 'kind' ? 'by kind' : choice}.`);
      }
      if (d.coverFocusReset !== undefined) return void apply(usePictureFocus(album, chosen, host.lookup), () => "It uses the picture's focus point.");
      if (d.coverRemove !== undefined) {
        const was = labelOf(chosen);
        if (apply(takeOut(album, chosen, host.lookup), () => `${was} is no longer in the cover.`)) chosen = '';
        paint();
      }
    },
    { signal },
  );

  // ---------- fields: the preset, Play in the band and Hide on phones ----------
  root.addEventListener(
    'select-change',
    (e) => {
      const sel = (e.target as Element).closest<HTMLElement>('[data-cover-preset]');
      const value = (e as CustomEvent<{ value?: string }>).detail?.value;
      if (!sel || !value || !open) return;
      const aspect = (id: string) => factsOf(id)?.aspect;
      apply(usePreset(host.album(), value as PresetId, host.lookup, aspect), () => 'The preset is laid out.');
      // the same preset can be chosen again
      sel.querySelectorAll('[role="option"]').forEach((o) => o.setAttribute('aria-selected', 'false'));
    },
    { signal },
  );
  root.addEventListener(
    'change',
    (e) => {
      const t = e.target as HTMLInputElement;
      if (!open || !chosen) return;
      const it = factsOf(chosen);
      if (t.closest('[data-cover-play]')) {
        if (!apply(setPlay(host.album(), chosen, t.checked, { kind: it?.kind, bytes: it?.bytes }, host.lookup), () => (t.checked ? 'It plays in the cover.' : "It doesn't play in the cover."))) t.checked = !t.checked;
        return;
      }
      if (t.closest('[data-cover-phones]')) {
        if (!apply(setOnPhones(host.album(), chosen, !t.checked, host.lookup), () => (t.checked ? "It isn't shown on phones." : 'It shows on phones.'))) t.checked = !t.checked;
      }
    },
    { signal },
  );

  // ---------- keys: a tile's arrows move it (Shift: resize), Delete takes it out, Escape is Done ----------
  root.addEventListener(
    'keydown',
    (e) => {
      if (!open) return;
      const target = e.target as Element;
      if (!target.closest('[data-album-cover-editor]')) return;
      if (e.key === 'Escape' && !target.closest('[data-select]') && !e.defaultPrevented) {
        e.preventDefault();
        return close();
      }
      const tile = target.closest<HTMLElement>('[data-cover-tile]');
      if (!tile) return;
      const id = tile.dataset.coverTile ?? '';
      const dir = ARROWS[e.key];
      if (dir && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        chosen = id;
        return void apply(arrangeKey(host.album(), show, id, dir, e.shiftKey, host.lookup), placeOf(id));
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && show === 'wide') {
        e.preventDefault();
        if (apply(takeOut(host.album(), id, host.lookup), () => `${labelOf(id)} is no longer in the cover.`) && chosen === id) chosen = '';
        paint();
        $('[data-cover-tile]')?.focus();
      }
    },
    { signal },
  );

  // ---------- the pointer: a tile to a cell, its handles to a size, the strip's items in and out ----------
  const showOutline = (r: Rect | null, refused = false) => {
    const o = $('[data-cover-outline]');
    if (!o) return;
    o.hidden = !r;
    if (!r) return;
    setRect(o, r);
    o.toggleAttribute('data-refused', refused);
  };
  const over = (sel: string, x: number, y: number) => {
    const r = $(sel)?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || !open) return;
      const t = e.target as Element;
      const canvas = $('[data-cover-canvas]');
      if (!canvas) return;
      const handle = t.closest<HTMLElement>('[data-cover-handle]');
      const tile = t.closest<HTMLElement>('[data-cover-place]');
      const strip = t.closest<HTMLElement>('[data-cover-strip-place]');
      const el = tile ?? strip;
      if (!el || !canvas.hasAttribute('data-editable')) return;
      if (strip && show !== 'wide') return;
      const id = tile?.dataset.coverPlace ?? strip?.dataset.coverStripPlace ?? '';
      const from = shownTiles(host.album(), show, host.lookup).find((x) => x.item === id);
      if (tile && !from) return;
      // a selection left by an earlier drag would turn this one into the browser's own drag (a pointercancel)
      getSelection()?.removeAllRanges();
      const box = canvas.getBoundingClientRect();
      const cols = gridOf(show).columns;
      const gap = parseFloat(getComputedStyle(canvas).columnGap) || 0;
      const pitch = (box.width + gap) / cols;
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      let trial: { r: Outcome; words: (a: Album) => string; after?: 'out' | 'in' } | null = null;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_START) return;
        moved = dragging = true;
        el.toggleAttribute(handle ? 'data-resizing' : 'data-dragging', true);
        const inCanvas = over('[data-cover-canvas]', ev.clientX, ev.clientY);
        const album = host.album();
        if (strip) {
          if (!inCanvas) return void ((trial = null), showOutline(null));
          const at = cellAt({ x: ev.clientX - box.left, y: ev.clientY - box.top }, pitch, cols);
          const r = putInCover(album, id, host.lookup, at);
          trial = { r, words: placeOf(id), after: 'in' };
          const added = r.ok ? coverOf(r.album, host.lookup).find((x) => x.item === id) : null;
          return showOutline(added ?? { ...at, w: 3, h: 2 }, !r.ok);
        }
        if (!handle && !inCanvas && show === 'wide' && over('[data-cover-strip-region]', ev.clientX, ev.clientY)) {
          trial = { r: takeOut(album, id, host.lookup), words: () => `${labelOf(id)} is no longer in the cover.`, after: 'out' };
          return showOutline(null);
        }
        if (!from) return;
        const dx = Math.round((ev.clientX - sx) / pitch);
        const dy = Math.round((ev.clientY - sy) / pitch);
        const h = handle?.dataset.coverHandle;
        const rect = handle
          ? { x: from.x, y: from.y, w: h === 'bottom' ? from.w : from.w + dx, h: h === 'right' ? from.h : from.h + dy }
          : { x: Math.max(0, Math.min(cols - from.w, from.x + dx)), y: Math.max(0, from.y + dy), w: from.w, h: from.h };
        const r = handle ? resizeTo(album, show, id, { w: rect.w, h: rect.h }, host.lookup) : moveTo(album, show, id, { x: rect.x, y: rect.y }, host.lookup);
        trial = { r, words: placeOf(id) };
        showOutline(rect, !r.ok);
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        drag.abort();
        el.removeAttribute('data-dragging');
        el.removeAttribute('data-resizing');
        showOutline(null);
        dragging = false;
        if (!moved) return;
        justDragged = true;
        setTimeout(() => (justDragged = false), 0);
        if (!trial || ev.type !== 'pointerup') return paint();
        if (trial.r.ok) chosen = trial.after === 'out' ? (chosen === id ? '' : chosen) : id;
        if (!apply(trial.r, trial.words)) paint();
      };
      // the drag's own listeners, on the window (the pointer leaves the tile at once), gone when it ends or the page does
      const drag = new AbortController();
      signal.addEventListener('abort', () => drag.abort(), { once: true });
      window.addEventListener('pointermove', move, { signal: drag.signal });
      window.addEventListener('pointerup', end, { signal: drag.signal });
      window.addEventListener('pointercancel', end, { signal: drag.signal });
    },
    { signal },
  );
  // the tiles and the strip's items are dragged here, never by the browser
  root.addEventListener(
    'dragstart',
    (e) => {
      const el = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (el?.closest('[data-cover-canvas], [data-cover-strip]')) e.preventDefault();
    },
    { signal },
  );

  readItems();
}
