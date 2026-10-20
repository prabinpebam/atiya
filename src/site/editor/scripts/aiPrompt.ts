/**
 * The AI prompt in the canvas (documentation/editor/ai-editing.md §4): shows the state the article editor sends,
 * under the block it's about, and draws the block's proposal as a tracked change. It runs nothing itself: every
 * choice is posted to the editor, which holds the request (scripts/ai.ts).
 */
import { wordDiff } from '../model/aiText';
import { triesLine } from '../model/aiTries';
import { CHOICES, type AiChoice } from '../model/aiCopy';

/** What the editor sends to draw. */
export interface AiView {
  index: number;
  phase: 'ready' | 'working' | 'proposed' | 'note' | 'closed';
  /** The service line. */
  service?: string;
  /** The step, while working. */
  status?: string;
  /** The block's words so far, while writing. */
  words?: string;
  /** The block's words in the proposal. */
  after?: string;
  summary?: string;
  /** The try shown (from 0) and how many there are. */
  shown?: number;
  count?: number;
  note?: string;
  /** What the note offers, in the order the prompt draws them (`CHOICES`). */
  choices?: AiChoice[];
  /** The label of the choice that opens the AI screen, when it isn't "Set up AI". */
  setup?: string;
  /** Whether the note offers Show tries (a later try failed; the earlier ones are kept). */
  back?: boolean;
}

/** What the prompt posts to the editor. */
export type AiDo =
  | { do: 'send'; instruction: string; action?: string }
  | { do: 'more'; instruction: string }
  | { do: 'step'; by: number }
  | { do: 'keep' | 'discard' | 'stop' | 'close' | 'retry' | 'back' | 'setup' | 'copy' | 'anyway' | 'cancel' };

const blockAt = (index: number): HTMLElement | null => {
  const prose = document.querySelector('.prose');
  if (!prose) return null;
  let current = -1;
  for (const n of Array.from(prose.childNodes)) {
    if (n.nodeType === Node.COMMENT_NODE) {
      const m = /^editor-block:(\d+)$/.exec((n as Comment).data.trim());
      if (m) current = Number(m[1]);
    } else if (n.nodeType === Node.ELEMENT_NODE && current === index) return n as HTMLElement;
  }
  return null;
};

const wordsOf = (block: HTMLElement): HTMLElement => (block.matches('[data-editor-editable]') ? block : (block.querySelector<HTMLElement>('[data-editor-editable]') ?? block));

const hidden = (words: string) => Object.assign(document.createElement('span'), { className: 'sr-only', textContent: words });

/** The proposal's words in place of the block's, as a tracked change (§4.3). */
function drawChange(el: HTMLElement, before: string, after: string) {
  const parts = wordDiff(before, after);
  el.replaceChildren(
    ...parts.map((p) => {
      if (p.kind === 'same') return document.createTextNode(p.text);
      const mark = document.createElement(p.kind === 'add' ? 'ins' : 'del');
      mark.append(hidden(p.kind === 'add' ? 'added: ' : 'removed: '), p.text);
      return mark;
    }),
  );
}

export function initAiPrompt(root: HTMLElement, signal: AbortSignal) {
  if (window.parent === window) return;
  const post = (m: AiDo) => window.parent.postMessage({ source: 'editor-canvas', type: 'ai-do', ...m }, location.origin);
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const form = $<HTMLFormElement>('[data-ai-form]');
  const field = $<HTMLTextAreaElement>('[data-ai-field] textarea');
  const service = $('[data-ai-service]');
  const status = $('[data-ai-status]');
  const summary = $('[data-ai-summary]');
  const noteText = $('[data-ai-note-text]');
  const choices = Array.from(root.querySelectorAll<HTMLElement>('[data-ai-choice]'));
  const setupLabel = $('[data-ai-choice="setup"] .label');
  const tries = $('[data-ai-tries]');
  const triesText = $('[data-ai-tries-text]');
  const prev = $<HTMLButtonElement>('[data-ai-prev]');
  const next = $<HTMLButtonElement>('[data-ai-next]');
  const more = $<HTMLFormElement>('[data-ai-more]');
  const moreField = $<HTMLTextAreaElement>('[data-ai-more-field] textarea');

  // the block as it was, put back on discard and close
  let saved: { el: HTMLElement; html: string; editable: string | null } | null = null;
  let at = -1;
  const restore = () => {
    if (!saved) return;
    saved.el.innerHTML = saved.html;
    if (saved.editable === null) saved.el.removeAttribute('contenteditable');
    else saved.el.setAttribute('contenteditable', saved.editable);
    delete saved.el.dataset.aiChange;
    saved = null;
  };
  const hold = (block: HTMLElement) => {
    const el = wordsOf(block);
    if (!saved) saved = { el, html: el.innerHTML, editable: el.getAttribute('contenteditable') };
    el.setAttribute('contenteditable', 'false');
    el.dataset.aiChange = '';
    return el;
  };
  const place = (block: HTMLElement) => {
    const r = block.getBoundingClientRect();
    root.style.setProperty('--x', `${r.left + scrollX}px`);
    root.style.setProperty('--y', `${r.bottom + scrollY}px`);
  };

  const show = (v: AiView) => {
    const block = blockAt(v.index);
    if (v.phase === 'closed' || !block) {
      restore();
      root.hidden = true;
      at = -1;
      return;
    }
    const opening = root.hidden || at !== v.index;
    const was = root.dataset.state;
    if (at !== v.index) restore();
    at = v.index;
    root.dataset.state = v.phase;
    root.hidden = false;
    if (v.service !== undefined) service.textContent = v.service;
    status.textContent = v.phase === 'working' ? (v.status ?? '') : '';
    summary.textContent = v.phase === 'proposed' ? (v.summary ?? '') : '';
    noteText.textContent = v.phase === 'note' ? (v.note ?? '') : '';
    for (const c of choices) c.hidden = !v.choices?.includes(c.dataset.aiChoice as AiChoice);
    setupLabel.textContent = v.setup ?? CHOICES.setup;
    root.toggleAttribute('data-back', v.phase === 'note' && !!v.back);
    const shown = v.shown ?? 0;
    const count = v.count ?? 0;
    triesText.textContent = triesLine(shown, count);
    tries.hidden = count < 2;
    const left = document.activeElement;
    prev.disabled = shown <= 0;
    next.disabled = shown >= count - 1;
    if (left === prev && prev.disabled && !next.disabled) next.focus();
    else if (left === next && next.disabled && !prev.disabled) prev.focus();
    if (v.phase === 'working' && v.words) hold(block).textContent = v.words;
    else if (v.phase === 'proposed' && v.after !== undefined) {
      const el = hold(block);
      drawChange(el, saved ? (Object.assign(document.createElement('div'), { innerHTML: saved.html }).textContent ?? '') : '', v.after);
    } else if (v.phase !== 'working') restore();
    place(block);
    if (opening && v.phase === 'ready') field.focus();
    // from Ask AI to the prompt in place (perf/budgets.json: editor/interaction/ai-prompt-open)
    if (opening && performance.getEntriesByName('editor:ai-ask', 'mark').length) {
      performance.measure('editor:ai-prompt-open', 'editor:ai-ask');
      performance.clearMarks('editor:ai-ask');
    }
    if (v.phase === 'proposed' && was !== 'proposed') $('[data-ai-keep]').focus();
    if (v.phase === 'working' && was !== 'working') $('[data-ai-stop]').focus();
    // a note takes the focus to its first choice, or back to the field
    if (v.phase === 'note' && was !== 'note') (choices.find((c) => !c.hidden)?.querySelector('button') ?? field).focus();
  };

  window.addEventListener(
    'message',
    (e) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as { source?: string; type?: string; view?: AiView };
      if (m?.source === 'editor' && m.type === 'ai' && m.view) show(m.view);
    },
    { signal },
  );

  form.addEventListener(
    'submit',
    (e) => {
      e.preventDefault();
      const instruction = field.value.trim();
      if (instruction) post({ do: 'send', instruction });
    },
    { signal },
  );
  more.addEventListener(
    'submit',
    (e) => {
      e.preventDefault();
      const instruction = moreField.value.trim();
      if (!instruction) return;
      moreField.value = '';
      post({ do: 'more', instruction });
    },
    { signal },
  );
  for (const [input, owner] of [
    [field, form],
    [moreField, more],
  ] as const)
    input.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          owner.requestSubmit();
        }
      },
      { signal },
    );
  root.addEventListener(
    'click',
    (e) => {
      const hit = (sel: string) => (e.target as Element).closest<HTMLElement>(sel);
      const action = hit('[data-ai-action]')?.dataset.aiAction;
      const choice = hit('[data-ai-choice]')?.dataset.aiChoice as Exclude<AiChoice, 'settings'> | undefined;
      if (action) post({ do: 'send', instruction: field.value.trim(), action });
      else if (choice && hit('button')) post({ do: choice });
      else if (hit('[data-ai-keep]')) post({ do: 'keep' });
      else if (hit('[data-ai-discard]')) post({ do: 'discard' });
      else if (hit('[data-ai-stop]')) post({ do: 'stop' });
      else if (hit('[data-ai-again]')) post({ do: 'retry' });
      else if (hit('[data-ai-prev]')) post({ do: 'step', by: -1 });
      else if (hit('[data-ai-next]')) post({ do: 'step', by: 1 });
      else if (hit('[data-ai-back]')) post({ do: 'back' });
      else if (hit('[data-ai-close]')) post({ do: 'close' });
    },
    { signal },
  );
  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      const state = root.dataset.state;
      post({ do: state === 'working' ? 'stop' : state === 'proposed' ? 'discard' : 'close' });
    },
    { signal },
  );
}
