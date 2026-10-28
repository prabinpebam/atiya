/**
 * Suggested alt text in the media screens (documentation/gallery/spec.md §9.6): asks the dev server for a draft
 * (`/_edit/api/ai/alt`) for a picture about to be uploaded or already in the library, and shows it in the empty
 * alt text field as its placeholder, marked Suggested (kit/AltSuggestion.astro), with Accept and Edit. The field's
 * value is untouched until one is pressed, so an unaccepted suggestion is never saved and never counts. A wait
 * goes through the task tracker; a failure is quiet but said in the status line. The same parts suggest a caption (§9.8.1,
 * `ai/caption`, `data-alt-kind="caption"`), and a description or a place (§9.8.2, `ai/words`), on asking only, a miss said
 * with what to do about it. A description's field is rich text, which has no placeholder: its draft shows as a preview.
 */
import { announce, api, startTask } from './client';
import { missedLine, wantsSuggestion } from '../model/altText';
import { WORD_NOUNS, wordMissLine, type WordKind } from '../model/pictureWords';

/** What the picture is: one in the library, or a file about to be uploaded to a folder. */
export type AltSource = { media: () => string | null } | { file: () => File | null; owner: () => string };

export interface AltSuggester {
  /**
   * Asks for a suggestion when the field is empty and not decorative; true when one is showing. `asked`: the owner pressed
   * Suggest; `known`: one already asked for (the album viewer's review keeps them), shown without asking again.
   */
  suggest(opts?: { asked?: boolean; known?: string | null }): Promise<boolean>;
  /** Takes the suggestion away (a new file, a picture closed). */
  clear(): void;
  /** Accepts a showing suggestion into the field (Use all suggestions); true when there was one. */
  accept(): boolean;
}

const OFFERS = new WeakMap<HTMLElement, AltSuggester>();

/**
 * Wires the suggestion beside a form's alt text field (or, with `field: 'caption'`, its caption field). `scope` holds the
 * field and its `[data-alt-suggestion]`. The availability (whether the writer sees pictures, the switch, a private page's
 * rule) is asked once per picture.
 */
export function initAltSuggest(scope: HTMLElement, signal: AbortSignal, source: AltSource, o: { field?: string } = {}): AltSuggester | null {
  const name = o.field ?? 'alt';
  const root = scope.querySelector<HTMLElement>(`[data-alt-suggestion="${name}"]`);
  const kind = (root?.dataset.altKind ?? 'alt') as WordKind;
  const alt = kind === 'alt';
  const noun = WORD_NOUNS[kind].label.toLowerCase();
  const field = scope.querySelector<HTMLTextAreaElement | HTMLInputElement>(`textarea[name="${name}"], input[name="${name}"]`);
  if (!root || !field) return null;
  // a description is rich text: its words are typed in the field's editable area and carried in the hidden input
  const rich = field.closest('[data-rich-field]')?.querySelector<HTMLElement>('[data-rich-input]') ?? null;
  const preview = root.querySelector<HTMLElement>('[data-alt-preview]');
  const offer = root.querySelector<HTMLElement>('[data-alt-offer]')!;
  const said = root.querySelector<HTMLElement>('[data-alt-said]')!;
  const askWrap = root.querySelector<HTMLElement>('[data-alt-ask-wrap]');
  const ask = root.querySelector<HTMLElement>('[data-alt-ask]');
  const decorative = () => scope.querySelector<HTMLInputElement>('input[name="decorative"]')?.checked ?? false;
  // alt text isn't wanted for a decorative picture; the other words only while their field is empty
  const wanted = () => (alt ? wantsSuggestion({ alt: field.value, decorative: decorative() }) : !(rich ? rich.textContent ?? '' : field.value).trim());
  const placeholder = field.placeholder;
  let suggestion: string | null = null;
  // a newer request (or a new picture) makes an older answer stale
  let token = 0;

  const show = (text: string | null) => {
    suggestion = text;
    if (!rich) field.placeholder = text ?? placeholder;
    if (preview) preview.textContent = text ?? '';
    offer.hidden = !text;
    offer.dataset.altText = text ?? '';
    said.textContent = text ? `Suggested ${noun}: ${text}` : '';
    if (askWrap) askWrap.hidden = !!text || !askWrap.dataset.altOn || !wanted();
  };
  const take = (focus: boolean) => {
    if (!suggestion) return false;
    field.value = suggestion;
    if (rich) {
      const p = document.createElement('p');
      p.textContent = suggestion;
      rich.replaceChildren(p);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } else field.dispatchEvent(new Event('input', { bubbles: true }));
    show(null);
    if (focus) (rich ?? field).focus();
    return true;
  };
  const query = () => {
    if ('media' in source) {
      const id = source.media();
      return id ? `media=${encodeURIComponent(id)}` : null;
    }
    return source.file() ? `owner=${encodeURIComponent(source.owner())}` : null;
  };

  const suggester: AltSuggester = {
    async suggest(opts = {}) {
      const mine = ++token;
      show(null);
      const q = query();
      // Suggest asks first even beside alt text, so it can show once the field is emptied
      if (!q || (!ask && !wanted())) return false;
      if (opts.known) {
        if (!wanted()) return false;
        show(opts.known);
        return true;
      }
      // a description or a place is asked of `ai/words`, and only about a picture already in the library
      const words = kind === 'description' || kind === 'place';
      if (words && !('media' in source)) return false;
      const on = await api<{ on: boolean }>('GET', `ai/${words ? 'words' : kind}?${q}`);
      if (mine !== token || !on.ok) return false;
      if (askWrap) askWrap.dataset.altOn = on.data.on ? '1' : '';
      if (!on.data.on) {
        show(null);
        return false;
      }
      if ((!opts.asked && ask) || !wanted()) {
        // in the details, a picture already uploaded is suggested only on asking
        show(null);
        return false;
      }
      let body: unknown;
      if ('media' in source) body = words ? { media: source.media(), want: [kind] } : { media: source.media() };
      else {
        const file = source.file();
        if (!file) return false;
        // only the bytes go: a fresh name, so the file's own never leaves the page
        const form = new FormData();
        form.append('file', new Blob([file], { type: file.type }), 'picture');
        form.append('owner', source.owner());
        body = form;
      }
      const task = startTask(`Suggesting ${WORD_NOUNS[kind].a}`, { el: [root, opts.asked ? ask : null], busyLabel: 'Suggesting' });
      type Reply = { alt?: string | null; caption?: string | null; why?: string; words?: Partial<Record<WordKind, string>>; missed?: Partial<Record<WordKind, string>> };
      const r = await api<Reply>('POST', words ? 'ai/words' : `ai/${kind}`, body).catch(() => null);
      const text = r?.ok ? (words ? r.data.words?.[kind] : kind === 'caption' ? r.data.caption : r.data.alt) : null;
      if (mine !== token) {
        task.failed();
        return false;
      }
      // typed into, or marked decorative, while it was asked: the owner's words win
      if (!wanted()) {
        void task.done();
        show(null);
        return false;
      }
      if (!text) {
        task.failed();
        show(null);
        // quiet, but never silent: the status line says it wasn't suggested (§9.6); words asked for say why and what to do (§9.8.1, §9.8.2)
        announce(alt ? missedLine(1) : wordMissLine(kind, (r?.ok && (r.data.missed?.[kind] || r.data.why)) || 'failed'));
        return false;
      }
      void task.done();
      show(text);
      return true;
    },
    clear() {
      token++;
      show(null);
    },
    accept: () => take(false),
  };
  OFFERS.set(root, suggester);

  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      if (t.closest('[data-alt-accept]')) take(false);
      else if (t.closest('[data-alt-edit]')) take(true);
      else if (t.closest('[data-alt-ask]')) void suggester.suggest({ asked: true });
    },
    { signal },
  );
  // a word typed, or decorative ticked, puts the suggestion away: it never sits beside the owner's own words
  const settle = (e: Event) => {
    const t = e.target as HTMLInputElement;
    if (t === field || t.name === 'decorative' || (rich && rich.contains(t))) show(wanted() ? suggestion : null);
  };
  scope.addEventListener('input', settle, { signal });
  scope.addEventListener('change', settle, { signal });
  if (ask) void suggester.suggest();
  return suggester;
}

/**
 * Use the file's date (§9.8.2): the date the camera wrote, kept from the upload in the local record, offered beside an
 * empty Date taken (`[data-file-date-wrap]` around a `[data-file-date]` button). Pressing it fills the field and sends
 * `input`, so the screen saves it as it saves anything typed. `refresh` after the field is changed without an event.
 */
export function initFileDate(scope: HTMLElement, signal: AbortSignal, media: () => string): { refresh(): void } {
  const wrap = scope.querySelector<HTMLElement>('[data-file-date-wrap]');
  const field = scope.querySelector<HTMLInputElement>('input[name="taken"]');
  let fileTaken = '';
  let asked: Promise<void> | null = null;
  const refresh = () => {
    if (!wrap || !field) return;
    asked ??= api<{ taken?: string }>('GET', `ai/words?media=${encodeURIComponent(media())}`)
      .then((r) => void (fileTaken = (r.ok && r.data.taken) || ''))
      .catch(() => {});
    void asked.then(() => (wrap.hidden = !fileTaken || !!field.value));
  };
  scope.addEventListener(
    'click',
    (e) => {
      if (!field || !fileTaken || !(e.target as Element).closest('[data-file-date]')) return;
      field.value = fileTaken;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      announce(`Used the file's date: ${fileTaken}.`);
    },
    { signal },
  );
  scope.addEventListener('input', (e) => (e.target === field ? refresh() : undefined), { signal });
  refresh();
  return { refresh };
}

/** Use all suggestions (§9.6): accepts every alt text suggestion still showing in `scope` (never a caption); how many it took. */
export function acceptAll(scope: ParentNode): number {
  let n = 0;
  for (const el of scope.querySelectorAll<HTMLElement>('[data-alt-kind="alt"]')) if (OFFERS.get(el)?.accept()) n++;
  return n;
}

/** Wires every `[data-alt-use-all]` button in `scope` to {@link acceptAll}, saying how many it took. */
export function initUseAll(scope: HTMLElement, signal: AbortSignal) {
  scope.addEventListener(
    'click',
    (e) => {
      if (!(e.target as Element).closest('[data-alt-use-all]')) return;
      const n = acceptAll(scope);
      announce(n ? `Used ${n === 1 ? '1 suggestion' : `${n} suggestions`}.` : 'No suggestions to use.');
    },
    { signal },
  );
}
