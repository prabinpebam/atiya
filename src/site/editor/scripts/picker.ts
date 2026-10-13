/**
 * The picker on demand (documentation/engineering/performance-report.md R5): a screen's picture picker is
 * drawn without its cards, and fills as it first opens, a page at a time, saying how far it's got
 * ("Preparing pictures: 40 of 105", spec §2.2). Each page's cards join the grid's folders, so the grid
 * itself (its upload form, a file already in it, a search typed meanwhile) stays as it is. The article
 * editor and Settings use it.
 */
import { announce, startTask } from './client';
import { REGIONS_HEADER, regionsHeader } from '../model/regions';

const filling = new WeakSet<HTMLElement>();

/** A page of the grid, drawn by the server (the screen's address, or the next page's). */
async function page(url: string): Promise<HTMLElement | null> {
  const res: Response = await fetch(url, { headers: { 'X-Editor': '1', [REGIONS_HEADER]: regionsHeader(['media-grid']) } });
  return new DOMParser().parseFromString(await res.text(), 'text/html').querySelector<HTMLElement>('[data-editor-media-grid]');
}

/** A page's cards added to the grid's folders, and what it says about how far it's got. */
function merge(grid: HTMLElement, next: HTMLElement) {
  for (const group of next.querySelectorAll<HTMLElement>('[data-media-group]')) {
    const label = group.getAttribute('aria-label') ?? '';
    const same = [...grid.querySelectorAll<HTMLElement>('[data-media-group]')].find((g) => g.getAttribute('aria-label') === label);
    const list = same?.querySelector('ul');
    if (list) list.append(...[...group.querySelectorAll('ul > li')].map((li) => document.importNode(li, true)));
    else {
      const groups = grid.querySelectorAll('[data-media-group]');
      const after = groups[groups.length - 1] ?? grid.querySelector('[data-media-preparing], .placeholder, [data-editor-media-found]');
      const added = document.importNode(group, true);
      if (after) after.after(added);
      else grid.append(added);
    }
  }
  // the shimmer goes with the first cards; the line saying how far it's got is the latest page's (none on the last)
  grid.querySelector(':scope > .placeholder')?.remove();
  const line = grid.querySelector('[data-media-preparing]');
  const fresh = next.querySelector('[data-media-preparing]');
  if (line && fresh) line.replaceWith(document.importNode(fresh, true));
  else line?.remove();
  const found = grid.querySelector<HTMLElement>('[data-editor-media-found]');
  const total = next.querySelector<HTMLElement>('[data-editor-media-found]')?.dataset.total;
  if (found && total) {
    found.dataset.total = total;
    if (!grid.querySelector<HTMLInputElement>('[data-editor-media-search] input')?.value) found.textContent = total;
  }
  delete grid.dataset.pickerPending;
  if (next.dataset.mediaNext) grid.dataset.mediaNext = next.dataset.mediaNext;
  else delete grid.dataset.mediaNext;
      // a search typed meanwhile covers the cards just added
      const search = grid.querySelector<HTMLInputElement>('[data-editor-media-search] input');
      if (search?.value) search.dispatchEvent(new Event('input'));
}

/**
 * The picker's grid in `dialog`, filled: the first page (when none is drawn yet), then the rest, one page
 * after another; `after` runs with each (to mark what the pick has chosen). Resolves once the first page is in.
 */
export async function fillPicker(dialog: HTMLElement, after: (grid: HTMLElement) => void = () => {}): Promise<void> {
  const grid = dialog.querySelector<HTMLElement>('[data-editor-media-grid]');
  if (!grid || filling.has(grid)) return;
  if (grid.dataset.pickerPending === undefined && !grid.dataset.mediaNext) return;
  filling.add(grid);
  const task = startTask('Preparing pictures…', { el: grid, line: grid.dataset.pickerPending !== undefined });
  try {
    if (grid.dataset.pickerPending !== undefined) {
      const first = await page(location.href);
      if (!first || !grid.isConnected) throw new Error('no grid');
      merge(grid, first);
      after(grid);
    }
    void rest(grid, after, task);
  } catch {
    task.failed();
    filling.delete(grid);
    announce("Couldn't load the pictures: is the dev server running? Open the picker again to try again.", 'negative');
  }
}

async function rest(grid: HTMLElement, after: (grid: HTMLElement) => void, task: ReturnType<typeof startTask>) {
  try {
    while (grid.isConnected && grid.dataset.mediaNext) {
      const next = await page(grid.dataset.mediaNext);
      if (!next || !grid.isConnected) break;
      merge(grid, next);
      after(grid);
    }
    void task.done();
  } catch {
    task.failed();
    announce("Couldn't load every picture: open the picker again to try again.", 'negative');
  } finally {
    filling.delete(grid);
  }
}
