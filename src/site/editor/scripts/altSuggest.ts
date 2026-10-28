/**
 * Suggested alt text in the media screens (documentation/gallery/spec.md §9.6): asks the dev server for a draft
 * (`/_edit/api/ai/alt`) for a picture about to be uploaded or already in the library, and shows it in the empty
 * alt text field as its placeholder, marked Suggested (kit/AltSuggestion.astro), with Accept and Edit. The field's
 * value is untouched until one is pressed, so an unaccepted suggestion is never saved and never counts. A wait
 * goes through the task tracker; a failure is quiet but said in the status line. The same parts suggest a caption (§9.8.1,
 * `ai/caption`, `data-alt-kind="caption"`), on asking only, a miss said with what to do about it.
 */
import { announce, api, startTask } from './client';
import { missedLine, wantsSuggestion } from '../model/altText';
import { captionMissLine, type CaptionWhy } from '../model/captionText';

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
  const caption = root?.dataset.altKind === 'caption';
  const noun = caption ? 'caption' : 'alt text';
  const field = scope.querySelector<HTMLTextAreaElement | HTMLInputElement>(`textarea[name="${name}"], input[name="${name}"]`);
  if (!root || !field) return null;
  const offer = root.querySelector<HTMLElement>('[data-alt-offer]')!;
  const said = root.querySelector<HTMLElement>('[data-alt-said]')!;
  const askWrap = root.querySelector<HTMLElement>('[data-alt-ask-wrap]');
  const ask = root.querySelector<HTMLElement>('[data-alt-ask]');
  const decorative = () => scope.querySelector<HTMLInputElement>('input[name="decorative"]')?.checked ?? false;
  // alt text isn't wanted for a decorative picture; a caption only while its field is empty
  const wanted = () => (caption ? !field.value.trim() : wantsSuggestion({ alt: field.value, decorative: decorative() }));
  const placeholder = field.placeholder;
  let suggestion: string | null = null;
  // a newer request (or a new picture) makes an older answer stale
  let token = 0;

  const show = (text: string | null) => {
    suggestion = text;
    field.placeholder = text ?? placeholder;
    offer.hidden = !text;
    offer.dataset.altText = text ?? '';
    said.textContent = text ? `Suggested ${noun}: ${text}` : '';
    if (askWrap) askWrap.hidden = !!text || !askWrap.dataset.altOn || !wanted();
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
      // Suggest asks first even beside alt text, so it can show once the field is emptied
      if (!q || (!ask && !wanted())) return false;
      if (opts.known) {
        if (!wanted()) return false;
        show(opts.known);
        return true;
      }
      const on = await api<{ on: boolean }>('GET', `ai/${caption ? 'caption' : 'alt'}?${q}`);
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
      const task = startTask(caption ? 'Suggesting a caption' : 'Suggesting alt text', { el: [root, opts.asked ? ask : null], busyLabel: 'Suggesting' });
      const r = await api<{ alt?: string | null; caption?: string | null; why?: string }>('POST', caption ? 'ai/caption' : 'ai/alt', body).catch(() => null);
      const words = r?.ok ? (caption ? r.data.caption : r.data.alt) : null;
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
      if (!words) {
        task.failed();
        show(null);
        // quiet, but never silent: the status line says it wasn't suggested (§9.6); a caption, asked for, says why and what to do (§9.8.1)
        announce(caption ? captionMissLine(((r?.ok && r.data.why) || 'failed') as CaptionWhy) : missedLine(1));
        return false;
      }
      void task.done();
      show(words);
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
    if (t === field || t.name === 'decorative') show(wanted() ? suggestion : null);
  };
  scope.addEventListener('input', settle, { signal });
  scope.addEventListener('change', settle, { signal });
  if (ask) void suggester.suggest();
  return suggester;
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
