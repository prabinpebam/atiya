/**
 * Add slide's sources step (documentation/home-views/highlights.md §2.1): the kind toggles and the search narrow the
 * tiles in place (the server drew the same narrowing from the address, so a reload or Back shows what was left), the
 * address keeps both without adding history, and the tiles' pictures are fetched as their own region once the step
 * is on screen, so the screen never waits on drawing every picture.
 */
import { swapRegions } from './client';
import { kindLine, matchesSource, sourcesLine, chosenKind, type SourceKind } from '../model/highlights';

/** The kind and search the sources step shows, from the address. */
const asked = () => {
  const p = new URL(location.href).searchParams;
  return { kind: chosenKind(p.get('kind')), q: p.get('q') ?? '' };
};

/** Keeps the kind and the search in the address (no new history entry), dropping them when they're the default. */
function remember(kind: 'all' | SourceKind, q: string) {
  const url = new URL(location.href);
  if (kind === 'all') url.searchParams.delete('kind');
  else url.searchParams.set('kind', kind);
  if (q.trim()) url.searchParams.set('q', q);
  else url.searchParams.delete('q');
  history.replaceState(history.state, '', url);
}

/** Shows the tiles of `kind` matching `q`, and says how many. */
function narrow(root: HTMLElement, kind: 'all' | SourceKind, q: string) {
  let shown = 0;
  root.querySelectorAll<HTMLElement>('[data-source-tile]').forEach((li) => {
    const show = (kind === 'all' || li.dataset.kind === kind) && matchesSource(li.dataset.name ?? '', q);
    li.hidden = !show;
    if (show) shown++;
  });
  const count = root.querySelector<HTMLElement>('[data-source-count]');
  const line = sourcesLine(shown, kind, q);
  if (count && count.textContent !== line) count.textContent = line;
}

/** Sets up the kind toggles and the search of one sources step. */
export function initSlideSources(root: HTMLElement, signal: AbortSignal) {
  const search = root.querySelector<HTMLInputElement>('[data-source-search] input');
  const kindNote = root.querySelector<HTMLElement>('[data-source-kind-line]');
  let { kind } = asked();
  const apply = () => {
    const q = search?.value ?? '';
    narrow(root, kind, q);
    remember(kind, q);
  };
  root.addEventListener(
    'click',
    (e) => {
      const toggle = (e.target as HTMLElement).closest<HTMLElement>('[data-source-kind]');
      if (!toggle) return;
      kind = chosenKind(toggle.dataset.sourceKind ?? null);
      root.querySelectorAll<HTMLElement>('[data-source-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b === toggle)));
      if (kindNote) kindNote.textContent = kindLine(kind);
      apply();
    },
    { signal },
  );
  search?.addEventListener('input', apply, { signal });
}

/**
 * Once the tiles are on screen without their pictures, fetches them as their own region; the swapped region is set
 * up again (`each`), so it's narrowed to whatever was chosen or typed meanwhile.
 */
export function fillSources(region: HTMLElement, keep: () => boolean) {
  const root = region.closest<HTMLElement>('[data-slide-sources]');
  if (root) {
    const search = root.querySelector<HTMLInputElement>('[data-source-search] input');
    const pressed = root.querySelector<HTMLElement>('[data-source-kind][aria-pressed="true"]');
    narrow(root, chosenKind(pressed?.dataset.sourceKind ?? null), search?.value ?? '');
  }
  if (!region.hasAttribute('data-sources-pending')) return;
  // the swap replaces the tiles: a tile focused meanwhile (Back from a preview) keeps the focus
  let focused: string | undefined;
  const ctl = new AbortController();
  region.addEventListener('focusin', (e) => (focused = (e.target as HTMLElement).closest<HTMLElement>('[data-source-tile]')?.dataset.sourceTile), { signal: ctl.signal });
  const tileFocused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-source-tile]');
  if (tileFocused && region.contains(tileFocused)) focused = tileFocused.dataset.sourceTile;
  void swapRegions(['highlight-sources'], location.href, keep, { label: 'Preparing pictures…' }).then(() => {
    ctl.abort();
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!focused || !lost) return;
    document.querySelector<HTMLElement>(`[data-source-tile="${CSS.escape(focused)}"] :is(a, button)`)?.focus();
  });
}
