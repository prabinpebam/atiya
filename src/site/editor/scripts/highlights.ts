/** Home highlights' one-save form: optimistic ordering, versioned saves and live updates without losing input. */
import { announce, api, describeIssue, onContentChange, saveStatus, swapRegions, track } from './client';
import { addHighlight, excerptHighlight, highlightSource, HighlightEdits, HIGHLIGHT_MAX, moveHighlight, removeHighlight, type Highlights, type HighlightChoice, type HighlightDetail } from '../model/highlights';

interface State {
  highlights: Highlights;
  version: string | null;
  choices: HighlightChoice[];
  details: Record<string, HighlightDetail>;
}

const KEY = '/content/highlights.json';
const REGION = 'highlights';

/** Wires a single screen instance; every listener ends when its region is replaced. */
export function initHighlights(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-highlights-state]')?.textContent ?? '{}') as State;
  const form = root.querySelector<HTMLFormElement>('[data-highlights-form]')!;
  const list = root.querySelector<HTMLOListElement>('[data-highlight-list]')!;
  const issue = root.querySelector<HTMLElement>('[data-editor-form-issue]')!;
  const add = root.querySelector<HTMLButtonElement>('[data-highlight-add]')!;
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  let items = state.highlights.items;
  const edits = new HighlightEdits();
  const say = (message: string) => {
    issue.textContent = message;
    issue.hidden = !message;
  };
  const changed = () => {
    edits.change();
    form.dataset.unsaved = '';
    say('');
    saveStatus.dirty('Home highlights');
  };
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const read = (): Highlights => ({
    ...state.highlights,
    label: field('label').value,
    enabled: field('enabled').checked,
    peek: field('peek').checked,
    arrows: field('arrows').checked,
    pager: field('pager').value as Highlights['pager'],
    display: field('display').value as Highlights['display'],
    background: field('background').checked,
    rounded: field('rounded').checked,
    shadow: field('shadow').checked,
    items,
  });
  const rows = () => [...list.querySelectorAll<HTMLElement>('[data-highlight-row]')];
  const refresh = () => {
    const elements = rows();
    elements.forEach((row, i) => {
      row.querySelector<HTMLButtonElement>('[data-highlight-move="up"]')!.disabled = i === 0;
      row.querySelector<HTMLButtonElement>('[data-highlight-move="down"]')!.disabled = i === elements.length - 1;
    });
    const source = field('source').value;
    const chosen = state.choices.find((c) => c.key === source);
    add.disabled = items.length >= HIGHLIGHT_MAX || !chosen || items.some((i) => highlightSource(i) === chosen.key);
    root.querySelector('[data-highlight-count]')!.textContent = `${items.length} of ${HIGHLIGHT_MAX} slides`;
    root.querySelector<HTMLElement>('[data-highlight-empty]')!.hidden = items.length > 0;
    for (const option of root.querySelectorAll<HTMLElement>('[data-select] [data-option]')) {
      if (!option.closest('[data-select]')?.querySelector('input[name="source"]')) continue;
      option.setAttribute('aria-disabled', items.some((i) => highlightSource(i) === option.dataset.value) ? 'true' : 'false');
    }
  };

  const append = (choice: HighlightChoice, id: string) => {
    const template = root.querySelector<HTMLTemplateElement>('[data-highlight-template]')!;
    const row = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.dataset.highlightRow = id;
    row.querySelector('[data-highlight-title]')!.textContent = choice.title;
    row.querySelector('[data-highlight-reason]')!.textContent = choice.reason ? `Waiting: ${choice.reason}` : 'Ready to show';
    const wrap = row.querySelector('[data-highlight-excerpt-wrap]')!;
    if (choice.item.type !== 'article') wrap.remove();
    else {
      const oldId = row.querySelector<HTMLTextAreaElement>('textarea')!.id;
      for (const element of wrap.querySelectorAll<HTMLElement>('[id], [for], [aria-describedby]')) {
        for (const attr of ['id', 'for', 'aria-describedby']) {
          const value = element.getAttribute(attr);
          if (value) element.setAttribute(attr, value.replaceAll(oldId, `highlight-${id}-excerpt`));
        }
      }
      row.querySelector<HTMLTextAreaElement>('textarea')!.name = `excerpt-${id}`;
    }
    list.append(row);
  };

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    const row = target.closest<HTMLElement>('[data-highlight-row]');
    if (row && target.closest('[data-highlight-excerpt]')) items = excerptHighlight(items, row.dataset.highlightRow!, target.value);
    changed();
  }, { signal });
  form.addEventListener('change', (event) => {
    if ((event.target as HTMLInputElement).name !== 'source') changed();
    refresh();
  }, { signal });
  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-highlight-add], [data-highlight-move], [data-highlight-remove]');
    if (!button || button.disabled) return;
    if (button === add) {
      const choice = state.choices.find((c) => c.key === field('source').value);
      if (!choice) return;
      const id = `slide-${crypto.randomUUID()}`;
      const next = addHighlight(items, choice.item, id);
      if (next === items) return;
      items = next;
      append(choice, id);
      refresh();
      const row = rows().at(-1)!;
      (row.querySelector<HTMLElement>('textarea') ?? row.querySelector<HTMLElement>('[data-highlight-remove]'))?.focus();
      announce('Added slide');
    } else {
      const row = button.closest<HTMLElement>('[data-highlight-row]')!;
      const id = row.dataset.highlightRow!;
      const before = items.findIndex((i) => i.id === id);
      if (button.hasAttribute('data-highlight-remove')) {
        items = removeHighlight(items, id);
        row.remove();
        refresh();
        const next = rows()[Math.min(before, items.length - 1)];
        (next?.querySelector<HTMLElement>('[data-highlight-remove]') ?? root.querySelector<HTMLElement>('[role="combobox"]'))?.focus();
        announce('Removed slide');
      } else {
        const direction = button.dataset.highlightMove === 'up' ? -1 : 1;
        const next = moveHighlight(items, id, direction);
        if (next === items) return;
        items = next;
        const elements = rows();
        if (direction === -1) list.insertBefore(row, elements[before - 1]);
        else list.insertBefore(elements[before + 1], row);
        refresh();
        const focus = button.disabled ? row.querySelector<HTMLButtonElement>(`[data-highlight-move="${direction === -1 ? 'down' : 'up'}"]`) : button;
        focus?.focus();
        announce(`Moved slide to position ${before + direction + 1}`);
      }
    }
    changed();
    refresh();
  }, { signal });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (edits.saving) return;
    const value = read();
    const before = edits.begin();
    submit.disabled = true;
    say('');
    saveStatus.saving();
    try {
      const reply = await track('Saving home highlights', { el: root }, () => api('PUT', 'highlights', { highlights: value, ifMatch: { [KEY]: state.version } }));
      if (!reply.ok) {
        edits.failed();
        form.dataset.unsaved = '';
        const why = (reply.data.issues ?? []).map(describeIssue).join(' ') || 'The highlights could not be saved. Try again.';
        say(reply.status === 409 ? `${why} Your unsaved input is kept. Reopen this screen to review the saved version before trying again.` : why);
        saveStatus.failed(`Not saved: ${issue.textContent}`);
        return;
      }
      state.version = reply.data.versions?.[KEY] ?? state.version;
      edits.saved(before);
      if (edits.dirty) {
        saveStatus.dirty('Saved earlier changes; newer home highlights changes are not saved yet');
        return;
      }
      delete form.dataset.unsaved;
      saveStatus.saved('Saved home highlights');
      await swapRegions([REGION], location.href, () => edits.dirty, { label: 'Updating home highlights' });
    } catch {
      edits.failed();
      form.dataset.unsaved = '';
      say('The highlights could not be saved or refreshed. Your input is kept. Check your connection and try again.');
      saveStatus.failed(issue.textContent!);
    } finally {
      edits.end();
      submit.disabled = false;
    }
  }, { signal });

  onContentChange(() => {
    if (edits.keep) {
      say('Content changed elsewhere. Your unsaved input is kept; saving may need a review of the newer version.');
      return;
    }
    void swapRegions([REGION], location.href, () => edits.keep, { quiet: true }).catch(() => announce('The highlights could not be refreshed. Reload this screen to try again.', 'negative'));
  }, signal);
  refresh();
}
