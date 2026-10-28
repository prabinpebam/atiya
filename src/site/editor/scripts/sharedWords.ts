/**
 * What several selected library items share of their words (kit/SharedWords.astro; documentation/gallery/spec.md
 * §9.8.2 U5, U6, U8), wherever they're shown: the album inspector (scripts/albumInspector.ts) and the Media screen's
 * side panel (scripts/mediaLibrary.ts). A value typed is set on each of them when its field is left, in one save;
 * one that would replace their different values, or give several pictures one alt text, asks first (Set on all, or
 * Keep their own, which puts the field back). Each field's own Suggest, and Suggest words with AI…, open the batch
 * (scripts/suggestWords.ts) for them with that kind ticked.
 */
import { api, refused, saveStatus, startTask } from './client';
import { batchProblem, type WordsChange } from '../model/albumViewer';
import { sharedChange, type Shared } from '../model/albumInspector';

/** What a shared field's task says while it saves, and once it's saved, by its name. */
const COPY: Record<string, [string, string]> = {
  caption: ['Setting the caption…', 'Set the caption of'],
  description: ['Setting the description…', 'Set the description of'],
  alt: ['Setting the alt text…', 'Set the alt text of'],
  taken: ['Setting the date…', 'Set the date of'],
  place: ['Setting the place…', 'Set the place of'],
};

export interface SharedWordsHost {
  /** The selected items with library items, and the grid cell each is shown in. */
  items(): { media: string; cell: string }[];
  /** Where the batch is asked for (`words:suggest`) and the redraw after a save (`album:redraw`) is sent. */
  target: HTMLElement;
}

export function initSharedWords(host: HTMLElement, signal: AbortSignal, opts: SharedWordsHost) {
  const box = () => host.querySelector<HTMLElement>('[data-selection-words]');
  const say = (text: string) => {
    const note = host.querySelector<HTMLElement>('[data-selection-problem]');
    if (!note) return;
    note.textContent = text;
    note.hidden = !text;
  };
  let pending: { el: HTMLInputElement | HTMLTextAreaElement; before: string } | null = null;
  const confirmRow = () => box()?.querySelector<HTMLElement>('[data-shared-confirm]') ?? null;
  const hideConfirm = () => {
    const row = confirmRow();
    if (row) row.hidden = true;
    pending = null;
  };

  const save = async (el: HTMLInputElement | HTMLTextAreaElement) => {
    const copy = COPY[el.name]!;
    const media = opts.items().map((i) => i.media);
    const words = { [el.name]: el.name === 'taken' ? el.value : el.value.trim() };
    const changes: WordsChange[] = media.map((id) => ({ id, words }));
    const problem = batchProblem(changes);
    if (problem) return say(problem);
    say('');
    const n = media.length;
    const task = startTask(copy[0], { el, busyLabel: 'Saving…' });
    saveStatus.saving();
    const r = await api('PUT', 'media-words', { changes });
    if (!r.ok) {
      task.failed();
      const why = refused(r, 'Nothing was changed.');
      saveStatus.failed(`Not saved: ${why}`);
      return say(why);
    }
    void task.done();
    saveStatus.saved(`${copy[1]} ${n} ${n === 1 ? 'item' : 'items'}`);
    opts.target.dispatchEvent(new CustomEvent('album:redraw'));
  };

  host.addEventListener(
    'change',
    (e) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!el.closest('[data-selection-words]') || !COPY[el.name]) return;
      const field = el.closest<HTMLElement>('[data-shared-state]');
      const state = (field?.dataset.sharedState ?? 'none') as Shared['state'];
      const value = el.name === 'taken' ? el.value : el.value.trim();
      const next = sharedChange(el.name, value, state, opts.items().length);
      if (next.act === 'skip') return hideConfirm();
      if (next.act === 'set') {
        hideConfirm();
        return void save(el);
      }
      // the value would replace theirs: ask first, below the fields
      const row = confirmRow();
      if (!row) return;
      pending = { el, before: el.defaultValue };
      const q = row.querySelector('p');
      if (q) q.textContent = next.question;
      row.hidden = false;
      row.querySelector<HTMLElement>('[data-shared-apply]')?.focus();
    },
    { signal },
  );

  host.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      if (!t.closest('[data-selection-words]')) return;
      if (t.closest('[data-shared-apply]') && pending) {
        const { el } = pending;
        hideConfirm();
        return void save(el);
      }
      if (t.closest('[data-shared-keep]') && pending) {
        const { el, before } = pending;
        hideConfirm();
        el.value = before;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return el.focus();
      }
      // the batch of suggested words (§9.8.2 U3): only for these, with the field's kind ticked
      const open = t.closest<HTMLElement>('[data-suggest-words-open]');
      if (!open) return;
      const items = opts.items();
      const kind = open.dataset.suggestWordsOpen;
      if (items.length) opts.target.dispatchEvent(new CustomEvent('words:suggest', { detail: { items, kinds: kind ? [kind] : undefined } }));
    },
    { signal },
  );
}
