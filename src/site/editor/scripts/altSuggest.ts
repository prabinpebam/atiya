/**
 * Suggested alt text in the media screens (documentation/gallery/spec.md §9.6): asks the dev server for a draft
 * (`/_edit/api/ai/alt`) for a picture about to be uploaded or already in the library, and shows it in the empty
 * alt text field as its placeholder, marked Suggested (kit/AltSuggestion.astro), with Accept and Edit. The field's
 * value is untouched until one is pressed, so an unaccepted suggestion is never saved and never counts. A wait
 * goes through the task tracker; a failure is quiet but said in the status line.
 */
import { announce, api, startTask } from './client';
import { missedLine, wantsSuggestion } from '../model/altText';

/** What the picture is: one in the library, or a file about to be uploaded to a folder. */
export type AltSource = { media: () => string | null } | { file: () => File | null; owner: () => string };

export interface AltSuggester {
  /** Asks for a suggestion when the field is empty and not decorative; true when one is showing. `asked`: the owner pressed Suggest. */
  suggest(opts?: { asked?: boolean }): Promise<boolean>;
  /** Takes the suggestion away (a new file, a picture closed). */
  clear(): void;
  /** Accepts a showing suggestion into the field (Use all suggestions); true when there was one. */
  accept(): boolean;
}

const OFFERS = new WeakMap<HTMLElement, AltSuggester>();

/**
 * Wires the suggestion beside a form's alt text field. `scope` holds the field and its `[data-alt-suggestion]`.
 * The availability (whether the writer sees pictures, the switch, a private page's rule) is asked once per picture.
 */
export function initAltSuggest(scope: HTMLElement, signal: AbortSignal, source: AltSource): AltSuggester | null {
  const root = scope.querySelector<HTMLElement>('[data-alt-suggestion]');
  const name = root?.dataset.altSuggestion || 'alt';
  const field = scope.querySelector<HTMLTextAreaElement | HTMLInputElement>(`textarea[name="${name}"], input[name="${name}"]`);
  if (!root || !field) return null;
  const offer = root.querySelector<HTMLElement>('[data-alt-offer]')!;
  const said = root.querySelector<HTMLElement>('[data-alt-said]')!;
  const askWrap = root.querySelector<HTMLElement>('[data-alt-ask-wrap]');
  const ask = root.querySelector<HTMLElement>('[data-alt-ask]');
  const decorative = () => scope.querySelector<HTMLInputElement>('input[name="decorative"]')?.checked ?? false;
  const placeholder = field.placeholder;
  let suggestion: string | null = null;
  // a newer request (or a new picture) makes an older answer stale
  let token = 0;

  const show = (text: string | null) => {
    suggestion = text;
    field.placeholder = text ?? placeholder;
    offer.hidden = !text;
    offer.dataset.altText = text ?? '';
    said.textContent = text ? `Suggested alt text: ${text}` : '';
    if (askWrap) askWrap.hidden = !!text || !askWrap.dataset.altOn || !wantsSuggestion({ alt: field.value, decorative: decorative() });
  };
  const take = (focus: boolean) => {
    if (!suggestion) return false;
    field.value = suggestion;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    show(null);
    if (focus) field.focus();
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
      const wanted = () => wantsSuggestion({ alt: field.value, decorative: decorative() });
      // Suggest asks first even beside alt text, so it can show once the field is emptied
      if (!q || (!ask && !wanted())) return false;
      const on = await api<{ on: boolean }>('GET', `ai/alt?${q}`);
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
      if ('media' in source) body = { media: source.media() };
      else {
        const file = source.file();
        if (!file) return false;
        // only the bytes go: a fresh name, so the file's own never leaves the page
        const form = new FormData();
        form.append('file', new Blob([file], { type: file.type }), 'picture');
        form.append('owner', source.owner());
        body = form;
      }
      const task = startTask('Suggesting alt text', { el: [root, opts.asked ? ask : null], busyLabel: 'Suggesting' });
      const r = await api<{ alt: string | null; why?: string }>('POST', 'ai/alt', body).catch(() => null);
      if (mine !== token) {
        task.failed();
        return false;
      }
      // typed into, or marked decorative, while it was asked: the owner's words win
      if (!wantsSuggestion({ alt: field.value, decorative: decorative() })) {
        void task.done();
        show(null);
        return false;
      }
      if (!r?.ok || !r.data.alt) {
        task.failed();
        show(null);
        // quiet, but never silent: the status line says it wasn't suggested (§9.6)
        announce(missedLine(1));
        return false;
      }
      void task.done();
      show(r.data.alt);
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
    if (t === field || t.name === 'decorative') show(wantsSuggestion({ alt: field.value, decorative: decorative() }) ? suggestion : null);
  };
  scope.addEventListener('input', settle, { signal });
  scope.addEventListener('change', settle, { signal });
  if (ask) void suggester.suggest();
  return suggester;
}

/** Use all suggestions (§9.6): accepts every suggestion still showing in `scope`; how many it took. */
export function acceptAll(scope: ParentNode): number {
  let n = 0;
  for (const el of scope.querySelectorAll<HTMLElement>('[data-alt-suggestion]')) if (OFFERS.get(el)?.accept()) n++;
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
