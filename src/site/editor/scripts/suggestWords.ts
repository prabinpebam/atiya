/**
 * Suggested words for several pictures (components/SuggestWords.astro; documentation/gallery/spec.md §9.8.2). The
 * album inspector and the library's selection bar send `words:suggest` with the items chosen (each by its library
 * item and its grid cell); this asks what they lack, lets the owner choose what to suggest, asks the AI writer one
 * picture at a time (Stop keeps what came), and shows every draft to change or empty before Save these words saves
 * them all in one change. Closing the dialog keeps the drafts: opening it again for the same items shows them.
 */
import { announce, api, refused, saveStatus, startTask } from './client';
import { batchProblem, type WordsChange } from '../model/albumViewer';
import {
  BATCH_KINDS,
  batchAsked,
  batchChanges,
  batchDoneLine,
  batchNeeds,
  batchOffLine,
  batchProgress,
  batchRunLabel,
  needsLine,
  wordMissLine,
  type BatchDraft,
  type BatchKind,
  type WordKind,
  type WordMiss,
} from '../model/pictureWords';

type Item = { media: string; cell: string };
type Needs = { on: boolean; why?: string; lacks: Record<string, BatchKind[]> };
type Words = { words: Partial<Record<WordKind, string>>; missed: Partial<Record<WordKind, WordMiss>>; why?: string; taken?: string };

let rowIds = 0;

export function initSuggestWords(el: HTMLElement, signal: AbortSignal) {
  const root = el.closest<HTMLElement>('[data-album-editor], [data-media-library]');
  const dialog = el.closest('dialog');
  if (!root || !dialog) return;
  const q = <T extends Element = HTMLElement>(s: string) => el.querySelector<T>(s);
  const stage = (name: 'choose' | 'review') => {
    el.dataset.stage = name;
    for (const s of el.querySelectorAll<HTMLElement>('[data-suggest-stage]')) s.hidden = s.dataset.suggestStage !== name;
  };
  const show = (wrap: string, on: boolean) => {
    const w = q(wrap);
    if (w) w.hidden = !on;
  };
  const line = (sel: string, text: string) => {
    const n = q(sel);
    if (!n) return;
    n.textContent = text;
    n.hidden = !text;
  };
  const boxes = () => [...el.querySelectorAll<HTMLInputElement>('input[name="kind"]')];
  const chosen = () => boxes().filter((b) => b.checked && !b.disabled).map((b) => b.value as BatchKind);
  const rows = q<HTMLOListElement>('[data-suggest-rows]')!;
  const runButton = q<HTMLButtonElement>('[data-suggest-run]');

  let items: Item[] = [];
  let needs: Needs = { on: false, lacks: {} };
  let drafted = '';
  let running = false;
  let stopped = false;

  const asked = () => batchAsked(needs.lacks, items.map((i) => i.media), chosen());
  const refreshRun = () => {
    const n = asked().length;
    if (runButton) {
      const label = runButton.querySelector('[data-button-label]') ?? runButton;
      label.textContent = batchRunLabel(n);
      runButton.disabled = !n;
    }
  };
  const paintChoices = () => {
    const counts = batchNeeds(items.map((i) => needs.lacks[i.media] ?? []));
    for (const b of boxes()) {
      const k = b.value as BatchKind;
      const writer = k !== 'taken';
      b.disabled = writer && !needs.on;
      if (b.disabled) b.checked = false;
      b.closest('[data-checkbox]')?.toggleAttribute('data-disabled', b.disabled);
      const hint = b.closest('[data-checkbox]')?.querySelector('[data-field-part="hint"]');
      if (hint) hint.textContent = b.disabled ? 'Off: see below' : needsLine(counts[k], items.length);
    }
    line('[data-suggest-off]', needs.on ? '' : batchOffLine(needs.why));
    refreshRun();
  };

  const open = async (next: Item[]) => {
    const key = next.map((i) => i.media).join(',');
    dialog.showModal();
    // the drafts of the same items wait where they were left
    if (key === drafted && (running || rows.children.length)) return;
    items = next;
    drafted = '';
    rows.replaceChildren();
    stage('choose');
    const n = items.length;
    line('[data-suggest-count]', `For ${n} selected ${n === 1 ? 'item' : 'items'}`);
    for (const h of el.querySelectorAll('[data-suggest-kind] [data-field-part="hint"]')) h.textContent = 'Checking…';
    if (runButton) {
      (runButton.querySelector('[data-button-label]') ?? runButton).textContent = 'Suggest';
      runButton.disabled = true;
    }
    const r = await api<Needs>('POST', 'ai/words/needs', { media: items.map((i) => i.media) }).catch(() => null);
    if (key !== items.map((i) => i.media).join(',')) return;
    needs = r?.ok ? { on: r.data.on, why: r.data.why, lacks: r.data.lacks ?? {} } : { on: false, why: 'failed', lacks: {} };
    paintChoices();
  };

  /** One picture's row: its thumbnail and name, a field for each word that came, and what didn't. */
  const row = (item: Item, reply: Words | null, want: BatchKind[]): boolean => {
    const tpl = q<HTMLTemplateElement>('template[data-suggest-row]');
    const li = tpl?.content.firstElementChild?.cloneNode(true) as HTMLLIElement | undefined;
    if (!li) return false;
    li.dataset.suggestMedia = item.media;
    const cell = root.querySelector<HTMLElement>(`[data-item="${CSS.escape(item.cell)}"]`);
    const src = cell?.querySelector('img')?.currentSrc;
    const thumb = li.querySelector<HTMLElement>('[data-suggest-thumb]');
    if (thumb && src) thumb.style.setProperty('--thumb', `url("${src.replace(/"/g, '%22')}")`);
    const name = cell?.getAttribute('aria-label') || 'Picture';
    li.querySelector('[data-suggest-name]')!.textContent = name;
    let got = 0;
    const uid = ++rowIds;
    for (const k of BATCH_KINDS) {
      const value = k === 'taken' ? reply?.taken : reply?.words[k];
      const box = li.querySelector<HTMLElement>(`[data-suggest-field="${k}"]`);
      if (!box) continue;
      if (!value || !want.includes(k)) {
        box.remove();
        continue;
      }
      got++;
      box.hidden = false;
      const field = box.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
      const id = `suggest-${uid}-${k}`;
      box.querySelector('label')?.setAttribute('for', id);
      const hint = box.querySelector('[data-field-part="hint"]');
      if (hint) hint.id = `${id}-hint`;
      field.id = id;
      field.value = value;
      if (hint) field.setAttribute('aria-describedby', hint.id);
      else field.removeAttribute('aria-describedby');
      field.setAttribute('aria-label', `${box.querySelector('label')?.textContent?.trim() ?? k}: ${name}`);
    }
    const writer = want.filter((k): k is WordKind => k !== 'taken');
    const missing = writer.filter((k) => !reply?.words[k]);
    const miss = !reply ? "The AI writer didn't answer. Check it on the AI screen, then try again." : reply.why && missing.length ? wordMissLine(missing[0]!, reply.why) : missing.map((k) => wordMissLine(k, reply.missed[k] ?? 'empty')).join(' ');
    const note = li.querySelector<HTMLElement>('[data-suggest-miss]');
    if (note) {
      note.textContent = miss;
      note.hidden = !miss;
    }
    rows.append(li);
    return got > 0;
  };

  const progress = (done: number, of: number) => {
    const wrap = q('[data-suggest-progress]');
    const pct = of ? Math.round((done / of) * 100) : 0;
    wrap?.style.setProperty('--progress', `${pct}%`);
    wrap?.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(pct));
    const value = wrap?.querySelector('[data-field-part="note"]');
    if (value) value.textContent = `${pct}%`;
    line('[data-suggest-status]', batchProgress(done, of));
  };

  const run = async () => {
    const want = chosen();
    const list = asked();
    if (!list.length || running) return;
    running = true;
    stopped = false;
    drafted = items.map((i) => i.media).join(',');
    rows.replaceChildren();
    stage('review');
    show('[data-suggest-stop-wrap]', true);
    show('[data-suggest-discard-wrap]', false);
    show('[data-suggest-save-wrap]', false);
    const task = startTask(`Suggesting words for ${list.length === 1 ? '1 picture' : `${list.length} pictures`}…`, { el: q('[data-suggest-progress]'), quiet: true });
    let got = 0;
    let none = 0;
    progress(0, list.length);
    for (const [i, media] of list.entries()) {
      if (stopped) break;
      const lacks = (needs.lacks[media] ?? []).filter((k) => want.includes(k));
      const writer = lacks.filter((k) => k !== 'taken');
      const r = await api<Words>('POST', 'ai/words', { media, want: writer, onlyEmpty: true }).catch(() => null);
      const item = items.find((x) => x.media === media)!;
      if (row(item, r?.ok ? r.data : null, lacks)) got++;
      else none++;
      progress(i + 1, list.length);
    }
    running = false;
    void task.done();
    show('[data-suggest-stop-wrap]', false);
    show('[data-suggest-discard-wrap]', true);
    show('[data-suggest-save-wrap]', got > 0);
    line('[data-suggest-status]', (stopped ? 'Stopped. ' : '') + batchDoneLine(got, none));
  };

  const reset = () => {
    rows.replaceChildren();
    drafted = '';
    stage('choose');
  };

  const save = async (button: HTMLElement) => {
    if (button.getAttribute('aria-busy') === 'true') return;
    const drafts: BatchDraft[] = [...rows.querySelectorAll<HTMLElement>('[data-suggest-media]')].map((li) => ({
      media: li.dataset.suggestMedia!,
      words: Object.fromEntries([...li.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-suggest-field] input, [data-suggest-field] textarea')].map((f) => [f.name, f.value])),
    }));
    const changes = batchChanges(drafts) as WordsChange[];
    if (!changes.length) return line('[data-suggest-status]', 'Every draft is empty: nothing to save. Discard them, or write some words.');
    const problem = batchProblem(changes);
    if (problem) return line('[data-suggest-status]', problem);
    const task = startTask('Saving the words…', { el: button, busyLabel: 'Saving…' });
    saveStatus.saving();
    const r = await api('PUT', 'media-words', { changes });
    if (!r.ok) {
      task.failed();
      const why = refused(r, 'Nothing was saved.');
      saveStatus.failed(`Not saved: ${why}`);
      return line('[data-suggest-status]', why);
    }
    void task.done();
    const n = changes.length;
    saveStatus.saved(`Saved words for ${n === 1 ? '1 picture' : `${n} pictures`}`);
    reset();
    dialog.close();
    root.dispatchEvent(new CustomEvent('album:redraw'));
  };

  root.addEventListener('words:suggest', (e) => void open((e as CustomEvent<{ items: Item[] }>).detail.items), { signal });
  el.addEventListener('change', (e) => ((e.target as HTMLInputElement).name === 'kind' ? refreshRun() : undefined), { signal });
  el.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      if (t.closest('[data-suggest-run]')) return void run();
      if (t.closest('[data-suggest-stop]')) {
        stopped = true;
        return line('[data-suggest-status]', 'Stopping after this picture…');
      }
      if (t.closest('[data-suggest-discard]')) {
        reset();
        dialog.close();
        return announce('Discarded the suggestions.');
      }
      const s = t.closest<HTMLElement>('[data-suggest-save]');
      if (s) void save(s);
    },
    { signal },
  );
  // closing keeps the drafts (they're there when it's opened again for the same items); a run under way stops
  dialog.addEventListener('close', () => void (running && (stopped = true)), { signal });
}
