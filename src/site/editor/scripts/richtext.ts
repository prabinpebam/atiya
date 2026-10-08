/**
 * The inspector's rich fields (documentation/editor/spec.md §3.5): a collection item's words, edited as
 * they'll read (paragraphs and lists, bold, italic, strikethrough, code, links), with a toolbar and its
 * keys. The field's Markdown (model/richText.ts, the canvas's own subset and serializer) goes into its
 * hidden input when focus leaves the field, which saves it as any field's change does.
 */
import { blocksFromMarkdown } from '../model/paste';
import { blocksFromHtml } from '../model/richPaste';
import { pastedMarkdown, richHtml, richMarkdown, richShortcut, type RichOp } from '../model/richText';

/** Asks the editor's link dialog for an address; `apply` gets it ('' takes the link off). */
export type AskLink = (href: string, apply: (href: string) => void) => void;

const STATE: Partial<Record<RichOp, string>> = { bold: 'bold', italic: 'italic', strikethrough: 'strikeThrough', bulleted: 'insertUnorderedList', numbered: 'insertOrderedList' };

export function initRichFields(root: HTMLElement, signal: AbortSignal, askLink: AskLink): void {
  const fieldOf = (n: EventTarget | Node | null) => (n instanceof Node ? (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest<HTMLElement>('[data-rich-field]') : null) ?? null;
  const inputOf = (f: HTMLElement) => f.querySelector<HTMLElement>('[data-rich-input]')!;
  const valueOf = (f: HTMLElement) => f.querySelector<HTMLInputElement>('[data-rich-value]')!;
  const selected = () => {
    const s = getSelection();
    return s && s.rangeCount ? s.getRangeAt(0) : null;
  };
  const elementAt = (r: Range | null) => (r ? (r.commonAncestorContainer.nodeType === 1 ? (r.commonAncestorContainer as Element) : r.commonAncestorContainer.parentElement) : null);

  /** The field's words into its hidden input, and the change on to the editor (only when they changed). */
  const commit = (f: HTMLElement) => {
    const md = richMarkdown(inputOf(f));
    const v = valueOf(f);
    if (md === v.value) return;
    v.value = md;
    v.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /** The toolbar as the caret sees it: pressed for the marks and the list it's in; indents only in a list. */
  const reflect = (f: HTMLElement) => {
    const inside = inputOf(f).contains(elementAt(selected()));
    const inList = inside && !!elementAt(selected())?.closest('li');
    for (const b of f.querySelectorAll<HTMLButtonElement>('[data-rich-op]')) {
      const op = b.dataset.richOp as RichOp;
      const cmd = STATE[op];
      if (cmd) b.setAttribute('aria-pressed', String(inside && document.queryCommandState(cmd)));
      if (op === 'indent' || op === 'outdent') b.disabled = !inList;
    }
  };

  const run = (f: HTMLElement, op: RichOp) => {
    const input = inputOf(f);
    if (!input.contains(elementAt(selected()))) {
      input.focus();
      const r = document.createRange();
      r.selectNodeContents(input);
      r.collapse(false);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
    }
    const r = selected();
    if (op === 'bold' || op === 'italic') document.execCommand(op);
    else if (op === 'strikethrough') document.execCommand('strikeThrough');
    else if (op === 'bulleted') document.execCommand('insertUnorderedList');
    else if (op === 'numbered') document.execCommand('insertOrderedList');
    else if (op === 'indent' || op === 'outdent') {
      // only a list item indents: elsewhere the browser would make a quotation, which the subset hasn't
      if (elementAt(r)?.closest('li')) document.execCommand(op);
    } else if (op === 'code' && r) {
      const inCode = elementAt(r)?.closest('code');
      if (inCode) inCode.replaceWith(document.createTextNode(inCode.textContent ?? ''));
      else if (!r.collapsed) {
        const code = document.createElement('code');
        code.textContent = r.toString();
        r.deleteContents();
        r.insertNode(code);
      }
    } else if (op === 'link') {
      const saved = r?.cloneRange() ?? null;
      const a = elementAt(r)?.closest('a');
      askLink(a?.getAttribute('data-md-href') ?? a?.getAttribute('href') ?? '', (href) => {
        input.focus();
        if (saved) {
          getSelection()?.removeAllRanges();
          getSelection()?.addRange(saved);
        }
        if (!href) document.execCommand('unlink');
        else {
          document.execCommand('createLink', false, href);
          input.querySelectorAll('a').forEach((x) => x.getAttribute('href') === href && x.setAttribute('data-md-href', href));
        }
        commit(f);
        reflect(f);
      });
      return;
    }
    reflect(f);
  };

  // the toolbar keeps the field's selection: its buttons act on it
  root.addEventListener('mousedown', (e) => (e.target as Element).closest('[data-rich-op]') && e.preventDefault(), { signal });
  root.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-rich-op]');
      const f = fieldOf(b);
      if (b && f && !b.disabled) run(f, b.dataset.richOp as RichOp);
    },
    { signal },
  );
  root.addEventListener(
    'keydown',
    (e) => {
      const f = fieldOf(e.target);
      if (!f || !(e.target as Element).closest('[data-rich-input]') || e.isComposing) return;
      const op = richShortcut(e);
      if (op) {
        e.preventDefault();
        run(f, op);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') e.preventDefault(); // no underline in the subset
    },
    { signal },
  );
  // a paste comes in as the subset: a rich copy's paragraphs, lists and marks, or plain text as Markdown
  root.addEventListener(
    'paste',
    (e) => {
      if (!(e.target as Element).closest?.('[data-rich-input]')) return;
      e.preventDefault();
      const html = e.clipboardData?.getData('text/html') ?? '';
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const pasted = (html && blocksFromHtml(new DOMParser().parseFromString(html, 'text/html').body)) || blocksFromMarkdown(text);
      const md = pastedMarkdown(pasted.blocks);
      if (md) document.execCommand('insertHTML', false, richHtml(md));
    },
    { signal },
  );
  root.addEventListener(
    'focusout',
    (e) => {
      const f = fieldOf(e.target);
      if (f && !f.contains(e.relatedTarget as Node | null)) commit(f);
    },
    { signal },
  );
  document.addEventListener(
    'selectionchange',
    () => {
      const f = fieldOf(selected()?.commonAncestorContainer ?? null);
      if (f) reflect(f);
    },
    { signal },
  );
}
