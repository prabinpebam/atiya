/**
 * The album editor's viewer (documentation/gallery/spec.md §9.5): the dialog over the album that shows one item
 * large with its words beside it (components/AlbumViewer.astro, MediaInfo.astro). The host opens it on an item
 * (the grid's `album:open-item`, or Review from the facts line), draws its region from the server for each item
 * (the address carries `?item=`, so a reload opens the same one), steps with Previous and Next and the arrow keys,
 * and goes back to the grid at the item when it closes. In a review of alt text (§9.8) it keeps the suggestions
 * asked for, asks for the strip's others in turn, and offers Accept all once every one has one.
 */
import { announce, api, describeIssue, swapRegions } from './client';

const REGION = 'album-viewer';
const typing = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"]');

export function initViewerHost(root: HTMLElement, signal: AbortSignal) {
  const dialog = document.getElementById('album-viewer') as HTMLDialogElement | null;
  if (!dialog || !root.contains(dialog)) return;
  const stage = () => dialog.querySelector<HTMLElement>('[data-album-viewer-stage]');
  let current = '';
  let reviewing = false;
  let busy = false;
  // review: a suggestion for each library item, asked once (null: none came)
  const known = new Map<string, string | null>();
  let asking = false;

  const address = (id: string, review: boolean) => {
    const u = new URL(location.href);
    u.searchParams.delete('item');
    u.searchParams.delete('review');
    if (id || review) u.searchParams.set('item', id);
    if (review) u.searchParams.set('review', '1');
    return u;
  };
  /** What the info panel still has to save is saved before it's drawn again. */
  const flush = async () => {
    const waits: Promise<unknown>[] = [];
    dialog.querySelector('[data-media-info]')?.dispatchEvent(new CustomEvent('viewer:flush', { detail: { waits } }));
    await Promise.all(waits);
  };

  const open = async (id: string, review: boolean, focus: 'go-prev' | 'go-next' | 'start' = 'start') => {
    if (busy) return;
    busy = true;
    try {
      await flush();
      const url = address(id, review);
      history.replaceState(history.state, '', url);
      if (review !== reviewing) known.clear();
      reviewing = review;
      try {
        await swapRegions([REGION], url.href, undefined, { quiet: true });
      } catch {
        return announce('Couldn’t open it: is the dev server running?', 'negative');
      }
      const s = stage();
      current = s?.dataset.albumViewerStage ?? '';
      if (!current) {
        if (dialog.open) dialog.close();
        else history.replaceState(history.state, '', address('', false));
        return announce(review ? 'Every picture has alt text.' : 'That item isn’t in the album any more.');
      }
      history.replaceState(history.state, '', address(current, review));
      if (!dialog.open) {
        dialog.showModal();
        // after the Dialog's own start in its first field (a mutation observer's), so the arrows work from the start
        await new Promise((r) => requestAnimationFrame(r));
      }
      settle(focus);
      if (review) void askAhead();
    } finally {
      busy = false;
    }
  };
  /** The focus where the owner was: the alt text in a review, the same arrow when stepping, else the stage. */
  const settle = (focus: 'go-prev' | 'go-next' | 'start') => {
    const alt = dialog.querySelector<HTMLElement>('[data-media-info] [name="alt"]');
    if (reviewing && alt) return alt.focus();
    const want = focus === 'go-prev' ? 'prev' : 'next';
    const btn = dialog.querySelector<HTMLButtonElement>(`[data-viewer-go="${want}"]:not(:disabled)`) ?? dialog.querySelector<HTMLButtonElement>('[data-viewer-go]:not(:disabled)');
    (btn ?? dialog.querySelector<HTMLElement>('[data-dialog-close]'))?.focus();
  };
  const go = (dir: 'prev' | 'next') => {
    const to = stage()?.dataset[dir];
    if (to) void open(to, reviewing, dir === 'prev' ? 'go-prev' : 'go-next');
  };

  // ---------- the review's suggestions: the strip's pictures, one at a time ----------
  const strip = (): { id: string; media: string }[] => {
    try {
      return JSON.parse(dialog.querySelector<HTMLElement>('[data-viewer-review]')?.dataset.viewerReview ?? '[]');
    } catch {
      return [];
    }
  };
  const paintAll = () => {
    const list = strip();
    const wrap = dialog.querySelector<HTMLElement>('[data-viewer-all-wrap]');
    const ready = list.length > 1 && list.every((s) => !!known.get(s.media));
    if (!wrap) return;
    wrap.hidden = !ready;
    const b = wrap.querySelector('[data-viewer-all]');
    const label = b?.querySelector('.label') ?? b;
    if (ready && label) label.textContent = `Accept all ${list.length} suggestions`;
  };
  const askAhead = async () => {
    if (asking) return paintAll();
    asking = true;
    try {
      const on = await api<{ on: boolean }>('GET', `ai/alt?media=${encodeURIComponent(strip()[0]?.media ?? '')}`);
      if (!on.ok || !on.data.on) return;
      for (const s of strip()) {
        if (!reviewing || !dialog.open) return;
        if (known.has(s.media) || s.id === current) continue;
        const r = await api<{ alt: string | null }>('POST', 'ai/alt', { media: s.media }).catch(() => null);
        known.set(s.media, r?.ok ? (r.data.alt ?? null) : null);
        paintAll();
      }
    } finally {
      asking = false;
      paintAll();
    }
  };
  const acceptAll = async (button: HTMLElement) => {
    const list = strip().filter((s) => known.get(s.media));
    if (!list.length) return;
    await flush();
    button.setAttribute('aria-busy', 'true');
    const r = await api('PUT', 'media-words', { changes: list.map((s) => ({ id: s.media, words: { alt: known.get(s.media) } })) });
    button.removeAttribute('aria-busy');
    if (!r.ok) return announce(`The suggestions weren’t saved: ${(r.data.issues ?? []).map(describeIssue).join(' ') || 'try again'}`, 'negative');
    root.dispatchEvent(new CustomEvent('album:redraw'));
    dialog.close();
    announce(`Saved ${list.length} alt texts: every picture in the review has its words.`);
  };

  // ---------- what opens it, steps and closes it ----------
  root.addEventListener('album:open-item', (e) => void open((e as CustomEvent<{ id: string }>).detail.id, false), { signal });
  root.addEventListener('viewer:go', (e) => void open((e as CustomEvent<{ id: string }>).detail.id, reviewing), { signal });
  root.addEventListener(
    'viewer:done',
    () => {
      if (dialog.open) dialog.close();
      announce('Every picture has alt text.');
    },
    { signal },
  );
  root.addEventListener(
    'viewer:known',
    (e) => {
      const d = (e as CustomEvent<{ media: string; alt?: string | null }>).detail;
      if (known.has(d.media)) d.alt = known.get(d.media);
    },
    { signal },
  );
  root.addEventListener(
    'viewer:suggested',
    (e) => {
      const d = (e as CustomEvent<{ media: string; alt: string | null }>).detail;
      known.set(d.media, d.alt);
      paintAll();
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      if (t.closest('[data-album-review]')) return void open('', true);
      const all = t.closest<HTMLElement>('[data-viewer-all]');
      if (all && dialog.contains(all)) return void acceptAll(all);
      const thumb = t.closest<HTMLElement>('[data-strip-item]');
      if (thumb && dialog.contains(thumb) && thumb.dataset.stripItem !== current) void open(thumb.dataset.stripItem!, true);
    },
    { signal },
  );
  dialog.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(e.key === 'ArrowLeft' ? 'prev' : 'next');
      }
    },
    { signal },
  );
  dialog.addEventListener(
    'close',
    () => {
      void flush();
      const at = current;
      reviewing = false;
      known.clear();
      history.replaceState(history.state, '', address('', false));
      const cell = at ? root.querySelector<HTMLElement>(`li[data-item="${CSS.escape(at)}"]`) : null;
      if (cell) {
        cell.tabIndex = 0;
        cell.focus();
      }
    },
    { signal },
  );

  // a page loaded with ?item= opens at it (a reload keeps the viewer where it was)
  const first = stage()?.dataset.albumViewerStage;
  if (first) {
    current = first;
    reviewing = stage()?.dataset.review !== undefined;
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => settle('start'));
    if (reviewing) void askAhead();
  }
}

/** The stage's own buttons: Previous and Next, and the actions on the item (sent to the album editor). */
export function initViewerStage(stage: HTMLElement, signal: AbortSignal) {
  const id = stage.dataset.albumViewerStage;
  if (!id) return;
  const root = stage.closest<HTMLElement>('[data-album-editor]');
  if (!root) return;
  stage.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const go = t.closest<HTMLElement>('[data-viewer-go]');
      if (go) {
        const to = go.dataset.viewerGo === 'prev' ? stage.dataset.prev : stage.dataset.next;
        if (to) root.dispatchEvent(new CustomEvent('viewer:go', { detail: { id: to } }));
        return;
      }
      const act = t.closest<HTMLButtonElement>('[data-viewer-act]');
      if (!act) return;
      const what = act.dataset.viewerAct!;
      if (what === 'add-to') return root.dispatchEvent(new CustomEvent('album:selection', { detail: { what: 'album', ids: [id] } }));
      root.dispatchEvent(new CustomEvent('album:act', { detail: { what, ids: [id] } }));
      if (what === 'cover') {
        act.disabled = true;
        const label = act.querySelector('.label') ?? act;
        label.textContent = 'The cover picture';
      }
      // removed: back to the grid, which says so (with Undo)
      if (what === 'remove') (stage.closest('dialog') as HTMLDialogElement | null)?.close();
    },
    { signal },
  );
  stage.querySelector('[data-viewer-dark]')?.addEventListener(
    'change',
    (e) => {
      const on = (e.target as HTMLInputElement).checked;
      stage.querySelector('[data-viewer-art]')?.toggleAttribute('data-dark', on);
    },
    { signal },
  );
}
