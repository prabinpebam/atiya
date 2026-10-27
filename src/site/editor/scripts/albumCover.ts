/**
 * Edit cover (documentation/gallery/spec.md §9.6): the album editor's cover band as its arranger. Drawn from the
 * album being edited (the album editor's own, so every change goes through its one save queue and its Undo), with the
 * items' facts the cover region carries. A tile is dragged to a cell or by any edge or corner to a size, snapping to
 * whole cells. The album's own grid below is where items come from: those dragged from it onto the band join it, a
 * tile dragged onto it leaves it, and while Edit cover is open its items in the cover are marked and its selection
 * bar has Add to cover and Remove from cover. The arrow keys (Shift: resize), Delete and the tile bar's buttons do
 * the same without a drag. The rules are the pure model/cover.ts.
 */
import type { Album, AlbumTile } from '../../content/schema';
import { coverOf, displayFor, holes, readingOrder, type MediaLookup } from '../../content/album';
import type { Outcome } from '../model/album';
import {
  NEW_TILE,
  addToCover,
  arrangeForPhones,
  arrangeKey,
  canvasRows,
  cellAt,
  closeGapsIn,
  coverState,
  coverWarnings,
  edgeRect,
  gridOf,
  leadOf,
  moveTo,
  phoneJoined,
  phoneToAutomatic,
  placeWords,
  playRefusal,
  reshapeTo,
  setBackground,
  setDisplay,
  setOnPhones,
  setPlay,
  shownTiles,
  takeAllOut,
  takeOut,
  useAutomatic,
  usePictureFocus,
  usePreset,
  type CoverItem,
  type Dir,
  type Edge,
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
  // an alt text's own full stop would double up in "…: columns 1 to 3" and "…in the cover."
  const labelOf = (id: string) => (factsOf(id)?.label ?? id).replace(/\.+$/, '');
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
  const addedWords = (ids: string[]) => (a: Album) =>
    ids.length === 1
      ? placeOf(ids[0])(a)
      : `Added to the cover: ${ids
          .filter((id) => wideOf(a, id))
          .map(labelOf)
          .join(', ')}.`;

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
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-cover-tile]');
    const refocus = focused ? `[data-cover-tile="${CSS.escape(focused.dataset.coverTile ?? '')}"]` : '';

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
    paintGrid();
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

  // ---------- the album's grid, the cover's source while editing: its items in the cover marked, its bar's actions ----------
  const photoGrid = () => root.querySelector<HTMLElement>('[data-photo-grid]');
  let picked: string[] = [];
  const paintGrid = () => {
    const g = photoGrid();
    const inCover = new Set(open ? coverOf(host.album(), host.lookup).map((t) => t.item) : []);
    g?.toggleAttribute('data-cover-editing', open);
    g?.querySelectorAll<HTMLElement>('li[data-item]').forEach((c) => {
      const on = inCover.has(c.dataset.item!);
      c.toggleAttribute('data-in-cover', on);
      if (on) c.setAttribute('aria-description', 'In the cover');
      else c.removeAttribute('aria-description');
    });
    const acts = root.querySelector<HTMLElement>('[data-cover-acts]');
    if (!acts) return;
    const media = picked.filter((id) => items.some((i) => i.id === id));
    acts.hidden = !open || preview || show !== 'wide' || !media.length;
    root.querySelector<HTMLElement>('[data-cover-add]')!.hidden = !media.some((id) => !inCover.has(id));
    root.querySelector<HTMLElement>('[data-cover-take]')!.hidden = !media.some((id) => inCover.has(id));
  };
  root.addEventListener(
    'album:picked',
    (e) => {
      picked = (e as CustomEvent<{ ids: string[] }>).detail.ids;
      paintGrid();
    },
    { signal },
  );
  root.addEventListener('album:drawn', () => paintGrid(), { signal });

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
    paintGrid();
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
        '[data-cover-show], [data-cover-preview], [data-cover-close-gaps], [data-cover-phone-arrange], [data-cover-phone-back], [data-cover-automatic], [data-cover-cancel], [data-cover-done], [data-cover-tile], [data-cover-add], [data-cover-take], [data-cover-move], [data-cover-size], [data-cover-display], [data-cover-focus-reset], [data-cover-remove]',
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
      if (d.coverAdd !== undefined) {
        const ids = picked.filter((id) => !coverOf(album, host.lookup).some((t) => t.item === id));
        if (apply(addToCover(album, ids, host.lookup), addedWords(ids))) chosen = ids.find((id) => wideOf(host.album(), id)) ?? chosen;
        return paint();
      }
      if (d.coverTake !== undefined) {
        const ids = picked.filter((id) => coverOf(album, host.lookup).some((t) => t.item === id));
        if (apply(takeAllOut(album, ids, host.lookup), () => `Taken out of the cover: ${ids.map(labelOf).join(', ')}.`) && ids.includes(chosen)) chosen = '';
        return paint();
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

  // ---------- the pointer: a tile to a cell, any edge or corner to a size, a tile out onto the album's grid ----------
  const showOutline = (r: Rect | null, refused = false) => {
    const o = $('[data-cover-outline]');
    if (!o) return;
    o.hidden = !r;
    if (!r) return;
    setRect(o, r);
    o.toggleAttribute('data-refused', refused);
  };
  const inside = (el: Element | null | undefined, x: number, y: number) => {
    const r = el?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  /** The canvas's measures: where a point falls, cell by cell. */
  const measure = (canvas: HTMLElement) => {
    const box = canvas.getBoundingClientRect();
    const cols = gridOf(show).columns;
    const gap = parseFloat(getComputedStyle(canvas).columnGap) || 0;
    return { box, cols, pitch: (box.width + gap) / cols };
  };
  const taking = (on: boolean) => photoGrid()?.toggleAttribute('data-cover-taking', on);
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || !open) return;
      const t = e.target as Element;
      const canvas = $('[data-cover-canvas]');
      if (!canvas) return;
      const handle = t.closest<HTMLElement>('[data-cover-handle]');
      const el = t.closest<HTMLElement>('[data-cover-place]');
      if (!el || !canvas.hasAttribute('data-editable')) return;
      const id = el.dataset.coverPlace ?? '';
      const from = shownTiles(host.album(), show, host.lookup).find((x) => x.item === id);
      if (!from) return;
      // a selection left by an earlier drag would turn this one into the browser's own drag (a pointercancel)
      getSelection()?.removeAllRanges();
      const { cols, pitch } = measure(canvas);
      const edge = handle?.dataset.coverHandle as Edge | undefined;
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      let trial: { r: Outcome; words: (a: Album) => string; after?: 'out' } | null = null;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_START) return;
        moved = dragging = true;
        el.toggleAttribute(edge ? 'data-resizing' : 'data-dragging', true);
        const album = host.album();
        // a tile dragged down onto the album's grid leaves the cover
        const out = !edge && show === 'wide' && !inside(canvas, ev.clientX, ev.clientY) && inside(photoGrid(), ev.clientX, ev.clientY);
        taking(out);
        if (out) {
          trial = { r: takeOut(album, id, host.lookup), words: () => `${labelOf(id)} is no longer in the cover.`, after: 'out' };
          return showOutline(null);
        }
        const dx = Math.round((ev.clientX - sx) / pitch);
        const dy = Math.round((ev.clientY - sy) / pitch);
        const rect = edge ? edgeRect(from, edge, dx, dy, gridOf(show)) : { x: Math.max(0, Math.min(cols - from.w, from.x + dx)), y: Math.max(0, from.y + dy), w: from.w, h: from.h };
        const r = edge ? reshapeTo(album, show, id, rect, host.lookup) : moveTo(album, show, id, { x: rect.x, y: rect.y }, host.lookup);
        trial = { r, words: placeOf(id) };
        showOutline(rect, !r.ok);
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        drag.abort();
        el.removeAttribute('data-dragging');
        el.removeAttribute('data-resizing');
        showOutline(null);
        taking(false);
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
  // the tiles are dragged here, never by the browser
  root.addEventListener(
    'dragstart',
    (e) => {
      const el = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (el?.closest('[data-cover-canvas]')) e.preventDefault();
    },
    { signal },
  );

  // ---------- the album's grid: its items dragged up into the cover (the grid's own drag, scripts/albumEditor.ts) ----------
  const ITEMS = 'application/x-album-items';
  /** What the grid is dragging (its data can't be read until the drop): the cells it marked. */
  const draggedIds = () => [...root.querySelectorAll<HTMLElement>('[data-photo-grid] li[data-dragging]')].map((c) => c.dataset.item ?? '').filter(Boolean);
  /** Where the dragged items would go in the cover, tried on the album as it is. */
  const dropTrial = (e: DragEvent) => {
    const canvas = $('[data-cover-canvas]');
    if (!open || preview || show !== 'wide' || !canvas?.hasAttribute('data-editable')) return null;
    if (!e.dataTransfer?.types.includes(ITEMS) || !inside(canvas, e.clientX, e.clientY)) return null;
    const { box, cols, pitch } = measure(canvas);
    const at = cellAt({ x: e.clientX - box.left, y: e.clientY - box.top }, pitch, cols);
    const ids = draggedIds();
    return { ids, at, r: addToCover(host.album(), ids, host.lookup, at) };
  };
  root.addEventListener(
    'dragover',
    (e) => {
      const d = dropTrial(e);
      if (!d) return showOutline(null);
      e.preventDefault();
      // the grid allows a move only
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const first = d.r.ok ? coverOf(d.r.album, host.lookup).find((x) => d.ids.includes(x.item) && x.x === d.at.x && x.y === d.at.y) : null;
      showOutline(first ?? { ...d.at, ...NEW_TILE }, !d.r.ok);
    },
    { signal },
  );
  root.addEventListener(
    'drop',
    (e) => {
      const d = dropTrial(e);
      showOutline(null);
      if (!d) return;
      e.preventDefault();
      if (apply(d.r, addedWords(d.ids))) chosen = d.ids.find((id) => wideOf(host.album(), id)) ?? chosen;
      paint();
    },
    { signal },
  );
  for (const type of ['dragleave', 'dragend'] as const)
    root.addEventListener(
      type,
      (e) => {
        if (type === 'dragend' || !inside($('[data-cover-canvas]'), (e as DragEvent).clientX, (e as DragEvent).clientY)) showOutline(null);
      },
      { signal },
    );

  readItems();
}
