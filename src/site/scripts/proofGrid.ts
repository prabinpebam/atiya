/**
 * The proof grid's DOM wiring (tier 0; docs: documentation/home-views/proof-grid.md §5): one tab stop for the
 * table, arrows between its row and cell buttons (a roving tabindex), a cell opening its kind's evidence and a
 * row's name all of it, one at a time, under its row; the open one, Close or Esc shut it and put the keyboard back
 * where it was. The address follows (`#cap-<id>-<kind>`, `#cap-<id>`), and a link to one opens it. Too narrow for
 * the table (an accordion), the first row starts open. ProofGrid.astro's script runs it on each grid through
 * `each`; the address rule is pure (`gridTarget`, scripts/homeAddress.ts) and unit-tested.
 */
import { gridTarget, type GridTarget } from './homeAddress';
import { narrowerThan } from './media';
import { track } from './telemetry';

export function setupProofGrid(root: HTMLElement, signal: AbortSignal): void {
  const view = root.dataset.view ?? 'proof-grid';
  const rowOf = (id: string) => root.querySelector<HTMLElement>(`tr[data-row="${CSS.escape(id)}"]`);
  const evidenceOf = (id: string) => root.querySelector<HTMLElement>(`[data-grid-evidence="${CSS.escape(id)}"]`);
  const opener = (id: string, kind: string) => root.querySelector<HTMLButtonElement>(`[data-grid-open="${CSS.escape(id)}"][data-kind="${CSS.escape(kind)}"]`);
  const ids = [...root.querySelectorAll<HTMLElement>('tr[data-row]')].map((r) => r.dataset.row!);
  const kinds = [...new Set([...root.querySelectorAll<HTMLElement>('[data-grid-open]')].map((b) => b.dataset.kind!))].filter((k) => k !== 'all');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const address = (hash: string) => history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
  let open: GridTarget | null = null;

  // the roving tabindex: the buttons a visitor can see, row by row (the row's name first)
  const grid = () =>
    [...root.querySelectorAll<HTMLElement>('tr[data-row]')].map((tr) => [...tr.querySelectorAll<HTMLButtonElement>('[data-grid-open]')].filter((b) => b.checkVisibility()));
  const rove = (to: HTMLButtonElement, focus = true) => {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-grid-open]')) b.tabIndex = b === to ? 0 : -1;
    if (focus) to.focus();
  };

  const close = (focus: boolean) => {
    if (!open) return;
    const { id, kind } = open;
    const region = evidenceOf(id);
    if (region) region.hidden = true;
    rowOf(id)?.removeAttribute('data-open');
    for (const b of root.querySelectorAll<HTMLButtonElement>(`[data-grid-open="${CSS.escape(id)}"]`)) b.setAttribute('aria-expanded', 'false');
    if (location.hash.startsWith(`#cap-${id}`)) address('');
    open = null;
    const back = opener(id, kind);
    if (back) rove(back, focus);
  };

  /** Opens a row's evidence, all of it or a kind's. `from`: a press or a link (the address follows either way). */
  const show = (target: GridTarget, from: 'press' | 'address') => {
    const region = evidenceOf(target.id);
    const button = opener(target.id, target.kind);
    if (!region || !button) return;
    close(false);
    // the phone's first row, open with no evidence (below), closes like any other
    for (const tr of root.querySelectorAll('tr[data-open]')) tr.removeAttribute('data-open');
    open = target;
    region.hidden = false;
    region.dataset.kind = target.kind;
    rowOf(target.id)?.setAttribute('data-open', '');
    button.setAttribute('aria-expanded', 'true');
    rove(button, false);
    for (const g of region.querySelectorAll<HTMLElement>('[data-group]')) g.hidden = target.kind !== 'all' && g.dataset.group !== target.kind;
    region.setAttribute('aria-label', button.dataset.region ?? '');
    address(target.kind === 'all' ? `#cap-${target.id}` : `#cap-${target.id}-${target.kind}`);
    track('capability_l3_open', { id: target.id, view, kind: target.kind });
    const behavior: ScrollBehavior = still.matches ? 'auto' : 'smooth';
    if (from === 'address') rowOf(target.id)?.scrollIntoView({ block: 'start', behavior });
    // only if it would be out of view: evidence that fits stays where it opened
    else if (region.getBoundingClientRect().bottom > innerHeight) region.scrollIntoView({ block: 'nearest', behavior });
  };

  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    const button = target.closest<HTMLButtonElement>('[data-grid-open]');
    if (button) {
      const t = { id: button.dataset.gridOpen!, kind: button.dataset.kind! };
      if (open && open.id === t.id && open.kind === t.kind) close(false);
      else show(t, 'press');
      return;
    }
    if (target.closest('[data-grid-close]')) close(true);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && (e.target as Element).closest('tr[data-row], [data-grid-evidence]')) {
      e.preventDefault();
      close(true);
      return;
    }
    const from = (e.target as Element).closest<HTMLButtonElement>('[data-grid-open]');
    if (!from) return;
    const rows = grid().filter((r) => r.length > 0);
    const r = rows.findIndex((row) => row.includes(from));
    if (r < 0) return;
    const c = rows[r].indexOf(from);
    const at = (row: number, col: number) => rows[row][Math.min(col, rows[row].length - 1)];
    const next: Record<string, () => HTMLButtonElement | undefined> = {
      ArrowRight: () => rows[r][c + 1],
      ArrowLeft: () => rows[r][c - 1],
      ArrowDown: () => (rows[r + 1] ? at(r + 1, c) : undefined),
      ArrowUp: () => (rows[r - 1] ? at(r - 1, c) : undefined),
      Home: () => (e.ctrlKey ? rows[0][0] : rows[r][0]),
      End: () => (e.ctrlKey ? rows.at(-1)!.at(-1) : rows[r].at(-1)),
    };
    const to = next[e.key]?.();
    if (!next[e.key]) return;
    e.preventDefault();
    if (to) rove(to);
  });

  // an address with #cap-<id>-<kind> or #cap-<id> opens it (a link a colleague forwarded, a return visit)
  const fromAddress = () => {
    const t = gridTarget(location.hash, ids, kinds);
    if (t && opener(t.id, t.kind)) show(t, 'address');
  };
  window.addEventListener('hashchange', fromAddress, { signal });
  if (gridTarget(location.hash, ids, kinds)) fromAddress();
  // too narrow for the table: the rows are an accordion, the first one open on its kinds, its evidence a press away,
  // so every row is still on the first screen (proof-grid.md §4.3); no address, no telemetry
  else {
    const stack = getComputedStyle(root).getPropertyValue(root.dataset.stack ?? '');
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (ids[0] && narrowerThan(root.clientWidth, stack, remPx)) rowOf(ids[0])?.setAttribute('data-open', '');
  }
}
