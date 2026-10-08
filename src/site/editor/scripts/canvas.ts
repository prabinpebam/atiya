/**
 * Edit mode's canvas, inside the frame (documentation/editor/spec.md §3.1–§3.3). The page is the real
 * page; this finds each block (the comment the server writes before it), draws the overlay over it,
 * edits text in place and tells the article editor what the writer did. The editor owns the document
 * and saves it; this only reports (select, text, split, merge, insert, move…) and redraws when told.
 */
import { turnShortcut, type TextKind } from '../model/ops';
import { blocksFromMarkdown, kindOf, linesOf, wordsOf } from '../model/paste';
import { blocksFromHtml } from '../model/richPaste';
import { pictureOfPaste } from '../model/upload';
import { markdownOf, plainLinesOf, plainOf } from '../model/dom';
import { serializeInline, type Inline } from '../../content/markdown';
import type { Block } from '../../content/schema';

type Kind = { kind: string; type: string };
type Field = 'title' | 'summary';
type Out =
  | { type: 'ready'; count: number }
  | { type: 'select'; index: number | null; field?: Field }
  | { type: 'text'; index: number; value: string; session: number; final: boolean }
  | { type: 'field'; field: Field; value: string; session: number; final: boolean }
  | { type: 'split'; index: number; parts: string[] }
  | { type: 'paste'; index: number; pending: boolean; before: string; after: string; blocks: Block[]; pictures: number }
  | { type: 'paste-picture'; index: number; file: File }
  | { type: 'typing' }
  | { type: 'merge'; index: number }
  | { type: 'insert'; index: number }
  | { type: 'op'; index: number; op: 'up' | 'down' | 'duplicate' | 'delete' }
  | { type: 'pending'; index: number; kind: Pending; value: string }
  | { type: 'link-request'; href: string }
  | { type: 'key'; key: 'undo' | 'redo' | 'save' | 'settings' }
  | { type: 'turn'; index: number; to?: TextKind };

const SOURCE = 'editor-canvas';
const TEXTY = new Set(['text', 'heading', 'subheading', 'marker', 'quote']);
/** What a new, still empty block will be once it has words. */
type Pending = 'text' | 'heading' | 'subheading' | 'marker';
/** Blocks of plain words that keep their lines: Enter splits them, Shift + Enter breaks the line. */
const LINED = new Set(['heading', 'subheading', 'marker']);
/** Plain lines as a paragraph's Markdown, a line break between them. */
const linesMarkdown = (text: string) => serializeInline(text.split('\n').flatMap((v, k): Inline[] => (k ? [{ t: 'br' }, { t: 'text', v }] : [{ t: 'text', v }])));
const PENDING_KIND: Record<Pending, string> = { text: 'Paragraph', heading: 'Heading 2', subheading: 'Subheading', marker: 'Section marker' };
const ALLOWED_INPUT = new Set([
  'insertText',
  'insertReplacementText',
  'insertLineBreak',
  'insertCompositionText',
  'insertFromComposition',
  'deleteContentBackward',
  'deleteContentForward',
  'deleteWordBackward',
  'deleteWordForward',
  'deleteSoftLineBackward',
  'deleteSoftLineForward',
  'deleteHardLineBackward',
  'deleteHardLineForward',
  'deleteByCut',
  'deleteContent',
  'historyUndo',
  'historyRedo',
  'insertLink',
]);

export function initCanvas(chrome: HTMLElement, signal: AbortSignal) {
  if (window.parent === window) return; // only inside the editor's frame
  const post = (m: Out) => window.parent.postMessage({ source: SOURCE, ...m }, location.origin);
  const kinds: Kind[] = JSON.parse(chrome.querySelector('[data-editor-blocks]')?.textContent ?? '[]');
  const turnButton = chrome.querySelector<HTMLElement>('[data-chrome-turn]');
  const prose = document.querySelector<HTMLElement>('.prose');
  const header = document.querySelector<HTMLElement>('.article-header');
  const fields: Record<Field, HTMLElement | null> = {
    title: header?.querySelector<HTMLElement>('h1') ?? null,
    summary: header?.querySelector<HTMLElement>('[data-variant="standfirst"]') ?? null,
  };
  const $ = <T extends HTMLElement>(sel: string) => chrome.querySelector<T>(sel)!;
  const hoverBox = $('[data-chrome-hover]');
  const hoverLabel = $('[data-chrome-hover-label]');
  const selBox = $('[data-chrome-selected]');
  const toolbar = $('[data-chrome-toolbar]');
  const toolLabel = $('[data-chrome-label]');
  const insert = $('[data-chrome-insert]');
  const format = $('[data-chrome-format]');
  const on = <K extends keyof DocumentEventMap>(type: K, fn: (e: DocumentEventMap[K]) => void, capture = false) => document.addEventListener(type, fn, { signal, capture });

  // ---------- the blocks, from the comments before them ----------
  let blocks: HTMLElement[] = [];
  const map = () => {
    blocks = [];
    if (!prose) return;
    let current = -1;
    for (const n of Array.from(prose.childNodes)) {
      if (n.nodeType === Node.COMMENT_NODE) {
        const m = /^editor-block:(\d+)$/.exec((n as Comment).data.trim());
        if (m) current = Number(m[1]);
      } else if (n.nodeType === Node.ELEMENT_NODE && current >= 0 && !blocks[current]) blocks[current] = n as HTMLElement;
    }
  };
  map();
  const indexOf = (el: Element | null): number => {
    if (!el) return -1;
    return blocks.findIndex((b) => b === el || b.contains(el));
  };
  const typeOf = (i: number) => kinds[i]?.type ?? 'text';
  const editableOf = (i: number): HTMLElement | null => {
    const b = blocks[i];
    if (!b) return null;
    if (typeOf(i) === 'quote') return b.querySelector('blockquote');
    return TEXTY.has(typeOf(i)) ? b : null;
  };

  // text blocks take the subset's marks; headings, quotes, the title and the standfirst are plain
  const makeEditable = (el: HTMLElement | null, rich: boolean) => {
    if (!el) return;
    el.contentEditable = rich ? 'true' : 'plaintext-only';
    el.spellcheck = true;
    el.dataset.editorEditable = rich ? 'rich' : 'plain';
  };
  const arm = () => {
    blocks.forEach((_, i) => makeEditable(editableOf(i), typeOf(i) === 'text'));
    makeEditable(fields.title, false);
    makeEditable(fields.summary, false);
  };
  arm();

  // ---------- the overlay ----------
  let selected: number | null = null;
  let selectedField: Field | null = null;
  let preview = false;
  const place = (box: HTMLElement, rect: DOMRect) => {
    box.style.setProperty('--x', `${rect.left + scrollX}px`);
    box.style.setProperty('--y', `${rect.top + scrollY}px`);
    box.style.setProperty('--w', `${rect.width}px`);
    box.style.setProperty('--h', `${rect.height}px`);
  };
  const redraw = () => {
    const el = selected !== null ? blocks[selected] : selectedField ? fields[selectedField] : null;
    selBox.hidden = !el || preview;
    toolbar.hidden = selected === null || !el || preview;
    if (!el) return;
    const r = el.getBoundingClientRect();
    place(selBox, r);
    toolbar.style.setProperty('--x', `${r.right + scrollX}px`);
    toolbar.style.setProperty('--y', `${r.top + scrollY}px`);
    toolLabel.textContent = selected !== null ? (kinds[selected]?.kind ?? '') : '';
    if (turnButton) turnButton.hidden = selected === null || !(TEXTY.has(typeOf(selected)) || typeOf(selected) === 'collection');
  };
  const select = (i: number | null, field: Field | null = null, tell = true, scroll = false) => {
    selected = i;
    selectedField = field;
    hoverBox.hidden = true;
    redraw();
    if (scroll && i !== null) blocks[i]?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (tell) post({ type: 'select', index: i, ...(field ? { field } : {}) });
  };
  const hover = (i: number) => {
    hoverBox.hidden = i < 0 || i === selected || preview;
    if (i < 0) return;
    place(hoverBox, blocks[i].getBoundingClientRect());
    hoverLabel.textContent = kinds[i]?.kind ?? '';
  };

  // the "+" in the space between two blocks (and above the first, below the last), never over a block
  let insertAt = -1;
  const REACH = 24;
  const showInsert = (x: number, y: number, over: number) => {
    insertAt = -1;
    const p = prose?.getBoundingClientRect();
    const rects = blocks.flatMap((b, i) => (b ? [{ i, r: b.getBoundingClientRect() }] : []));
    if (!p || preview || over >= 0 || !rects.length || x < p.left || x > p.right) return (insert.hidden = true);
    for (let k = 0; k <= rects.length; k++) {
      const top = k > 0 ? rects[k - 1].r.bottom : rects[0].r.top - REACH;
      const bottom = k < rects.length ? rects[k].r.top : rects[rects.length - 1].r.bottom + REACH;
      if (y >= top && y <= bottom) {
        insertAt = k < rects.length ? rects[k].i : rects[rects.length - 1].i + 1;
        // a line as wide as the blocks either side (the narrower: the text column beside a wide picture)
        // shows where the block goes; the "+" is in its middle
        const n = [k > 0 ? rects[k - 1].r : null, k < rects.length ? rects[k].r : null].filter((r): r is DOMRect => !!r).sort((u, v) => u.width - v.width)[0];
        insert.style.setProperty('--x', `${n.left + scrollX}px`);
        insert.style.setProperty('--w', `${n.width}px`);
        insert.style.setProperty('--y', `${(top + bottom) / 2 + scrollY}px`);
        // never under the block toolbar: where it would cover the "+" in the middle, the "+" goes to the line's
        // start, outside the column when there's room for it there (clear of the words too)
        const plus = insert.querySelector<HTMLElement>('[data-chrome-insert-button]')?.offsetWidth || 40;
        const bar = toolbar.hidden ? null : toolbar.getBoundingClientRect();
        const cx = n.left + n.width / 2;
        const cy = (top + bottom) / 2;
        const covered = !!bar && cx + plus / 2 > bar.left && cx - plus / 2 < bar.right && cy + plus / 2 > bar.top && cy - plus / 2 < bar.bottom;
        if (!covered) delete insert.dataset.side;
        else insert.dataset.side = n.left >= plus * 1.25 ? 'outside' : 'start';
        break;
      }
    }
    insert.hidden = insertAt < 0;
  };

  on('pointermove', (e) => {
    if (preview) return;
    const t = e.target as Element;
    if (chrome.contains(t)) return;
    const over = indexOf(t);
    hover(over);
    showInsert(e.clientX, e.clientY, over);
  });
  addEventListener('scroll', () => requestAnimationFrame(redraw), { signal, passive: true });
  addEventListener('resize', () => requestAnimationFrame(redraw), { signal });

  // ---------- clicks: select, and keep links and players inert ----------
  /** The page's own way round it, not its content: the minimap works in the canvas as on the site. */
  const wayfinding = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-minimap]');
  on(
    'click',
    (e) => {
      if (preview) return;
      const t = e.target as Element;
      if (chrome.contains(t) || wayfinding(t)) return;
      const editable = t.closest<HTMLElement>('[data-editor-editable]');
      const link = t.closest('a');
      if (link || !editable) e.preventDefault();
      const i = indexOf(t);
      if (i >= 0) {
        if (!editable) e.stopPropagation();
        select(i);
      } else if (fields.title?.contains(t)) select(null, 'title');
      else if (fields.summary?.contains(t)) select(null, 'summary');
      else {
        e.stopPropagation();
        select(null);
      }
    },
    true,
  );

  chrome.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-chrome-op], [data-chrome-insert-button], [data-chrome-format-op], [data-chrome-more-toggle]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.chromeOp && selected !== null) {
        const op = b.dataset.chromeOp;
        if (op === 'turn') post({ type: 'turn', index: selected });
        else post({ type: 'op', index: selected, op: op as 'up' | 'down' | 'duplicate' | 'delete' });
      } else if (b.hasAttribute('data-chrome-insert-button') && insertAt >= 0) post({ type: 'insert', index: insertAt });
      else if (b.hasAttribute('data-chrome-more-toggle')) showMore(moreMenu.hidden);
      else if (b.dataset.chromeFormatOp) {
        showMore(false);
        formatOp(b.dataset.chromeFormatOp);
      }
    },
    { signal },
  );
  // a toolbar button doesn't take the text's selection away
  chrome.addEventListener('mousedown', (e) => (e.target as Element).closest('[data-chrome-format-op], [data-chrome-more-toggle]') && e.preventDefault(), { signal });

  // ---------- editing text ----------
  let session = 0;
  let composing = false;
  let dirty: { el: HTMLElement; index: number | null; field: Field | null } | null = null;
  let timer = 0;
  const current = (): { el: HTMLElement; index: number | null; field: Field | null } | null => {
    const el = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-editor-editable], [data-editor-pending]');
    if (!el) return null;
    if (el === fields.title) return { el, index: null, field: 'title' };
    if (el === fields.summary) return { el, index: null, field: 'summary' };
    return { el, index: indexOf(el), field: null };
  };
  const valueOf = (el: HTMLElement, index: number | null) =>
    index !== null && typeOf(index) === 'text' && el.dataset.editorEditable === 'rich' ? markdownOf(el) : index !== null && LINED.has(typeOf(index)) ? plainLinesOf(el) : plainOf(el);

  const send = (final: boolean) => {
    clearTimeout(timer);
    if (!dirty || composing) return;
    const { el, index, field } = dirty;
    if (el.hasAttribute('data-editor-pending')) {
      const value = el.dataset.pendingKind === 'text' ? markdownOf(el) : plainLinesOf(el);
      if (!value.trim()) {
        if (final) {
          el.remove();
          dirty = null;
          redraw();
        }
        return;
      }
      if (!final) return;
      const at = Number(el.dataset.editorPending);
      el.removeAttribute('data-editor-pending');
      el.removeAttribute('data-placeholder');
      blocks.splice(at, 0, el);
      const kind = (el.dataset.pendingKind ?? 'text') as Pending;
      el.removeAttribute('data-pending-kind');
      kinds.splice(at, 0, { kind: PENDING_KIND[kind], type: kind });
      makeEditable(el, kind === 'text');
      post({ type: 'pending', index: at, kind, value });
      dirty = null;
      return;
    }
    if (field) post({ type: 'field', field, value: plainOf(el), session, final });
    else if (index !== null && index >= 0) post({ type: 'text', index, value: valueOf(el, index), session, final });
    if (final) dirty = null;
  };
  let typedAt = 0;
  const markDirty = () => {
    const c = current();
    if (!c) return;
    dirty = c;
    clearTimeout(timer);
    timer = window.setTimeout(() => send(false), 800);
    // the editor's status says "Unsaved changes" from the first key, not once the words are sent
    if (Date.now() - typedAt > 700) {
      typedAt = Date.now();
      post({ type: 'typing' });
    }
    requestAnimationFrame(redraw);
  };

  // the drop cap's big letter moves the caret: it's off while its paragraph is edited
  on('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-editor-editable], [data-editor-pending]');
    if (!el) return;
    session++;
    if (el.hasAttribute('data-dropcap')) {
      el.dataset.dropcapPaused = '';
      el.removeAttribute('data-dropcap');
    }
    const i = indexOf(el);
    if (i >= 0 && i !== selected) select(i);
  });
  on('focusout', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-editor-editable], [data-editor-pending]');
    if (!el) return;
    // a new block left without words goes (it was never written)
    if (el.hasAttribute('data-editor-pending') && !(el.textContent ?? '').trim()) {
      if (dirty?.el === el) dirty = null;
      el.remove();
      redraw();
      return;
    }
    send(true);
    if (el.dataset.dropcapPaused !== undefined) {
      delete el.dataset.dropcapPaused;
      el.setAttribute('data-dropcap', '');
    }
  });
  on('compositionstart', () => (composing = true));
  on('compositionend', () => {
    composing = false;
    markDirty();
  });
  on('input', (e) => {
    if ((e.target as HTMLElement).closest('[data-editor-editable], [data-editor-pending]')) markDirty();
  });

  const caretRange = () => {
    const s = getSelection();
    return s && s.rangeCount ? s.getRangeAt(0) : null;
  };
  /** The element's content before and after the caret, each as its own element of the same kind. */
  const halves = (el: HTMLElement): [HTMLElement, HTMLElement] | null => {
    const r = caretRange();
    if (!r) return null;
    const before = document.createRange();
    before.setStart(el, 0);
    before.setEnd(r.startContainer, r.startOffset);
    const after = document.createRange();
    after.setStart(r.endContainer, r.endOffset);
    after.setEnd(el, el.childNodes.length);
    const a = document.createElement(el.nodeName);
    a.append(before.cloneContents());
    const b = document.createElement(el.nodeName);
    b.append(after.cloneContents());
    return [a, b];
  };
  /** One side of the caret as Markdown, keeping a space at the caret (markdownOf trims a block's edges). */
  const seam = (half: HTMLElement, side: 'start' | 'end') => {
    const md = markdownOf(half);
    const words = half.textContent ?? '';
    if (!md.trim()) return md;
    if (side === 'end' && /\s$/.test(words)) return `${md} `;
    if (side === 'start' && /^\s/.test(words)) return ` ${md}`;
    return md;
  };
  const atStart = (el: HTMLElement) => {
    const r = caretRange();
    if (!r || !r.collapsed) return false;
    const pre = document.createRange();
    pre.setStart(el, 0);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString() === '' && !pre.cloneContents().querySelector('br');
  };
  const insertPlain = (text: string, lineBreaks: boolean) => {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((line, n) => {
      if (n && lineBreaks) document.execCommand('insertLineBreak');
      else if (n) document.execCommand('insertText', false, ' ');
      if (line) document.execCommand('insertText', false, line);
    });
  };
  /** Marked words as the canvas's own elements (the ones markdownOf reads back). */
  const fragmentOf = (nodes: Inline[]): DocumentFragment => {
    const f = document.createDocumentFragment();
    for (const n of nodes) {
      if (n.t === 'text') f.append(n.v);
      else if (n.t === 'br') f.append(document.createElement('br'));
      else if (n.t === 'code') f.append(Object.assign(document.createElement('code'), { textContent: n.v }));
      else if (n.t === 'link') {
        if (!/^(https?:\/\/|mailto:|ref:)/i.test(n.href)) {
          f.append(fragmentOf(n.c));
          continue;
        }
        const a = document.createElement('a');
        a.href = n.href;
        a.dataset.mdHref = n.href;
        a.append(fragmentOf(n.c));
        f.append(a);
      } else {
        const m = document.createElement(n.t);
        m.append(fragmentOf(n.c));
        f.append(m);
      }
    }
    return f;
  };
  /** Lines pasted in a list as its items: the first joins the words before the caret, the last those after it. */
  const pasteItems = (list: HTMLElement, lines: Inline[][]): boolean => {
    const r = caretRange();
    const at = r && (r.startContainer.nodeType === Node.ELEMENT_NODE ? (r.startContainer as Element) : r.startContainer.parentElement);
    const li = at?.closest('li');
    if (!r || !li || !list.contains(li) || !lines.length) return false;
    r.deleteContents();
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(li, li.childNodes.length);
    const after = tail.extractContents();
    let item: HTMLElement = li;
    lines.forEach((line, k) => {
      if (k) {
        const next = document.createElement('li');
        item.after(next);
        item = next;
      }
      item.append(fragmentOf(line));
    });
    const caret = document.createRange();
    caret.selectNodeContents(item);
    caret.collapse(false);
    item.append(after);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(caret);
    return true;
  };

  /**
   * Enter in a list: a new item after the caret's, taking the words after the caret with it. On an empty
   * last item, the list ends there: the item goes, and a paragraph starts after the list.
   */
  const newItem = (list: HTMLElement, index: number) => {
    const r = caretRange();
    const at = r && (r.startContainer.nodeType === Node.ELEMENT_NODE ? (r.startContainer as Element) : r.startContainer.parentElement);
    const li = at?.closest('li');
    if (!r || !li || !list.contains(li)) return;
    if (!li.textContent?.trim() && !li.nextElementSibling && li.previousElementSibling) {
      li.remove();
      return paragraphAfter(list, index);
    }
    r.deleteContents();
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(li, li.childNodes.length);
    const next = document.createElement('li');
    next.append(tail.extractContents());
    li.after(next);
    // an empty item needs a line in it to show its bullet and hold the caret
    for (const item of [li, next]) if (!item.textContent) item.replaceChildren(document.createElement('br'));
    const caret = document.createRange();
    caret.setStart(next, 0);
    caret.collapse(true);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(caret);
    markDirty();
  };
  /** A new paragraph after the block being written in (Ctrl or Cmd + Enter, or Enter on a list's empty last item): the block keeps all its words. */
  const paragraphAfter = (el: HTMLElement, index: number) => {
    const t = typeOf(index);
    if (t !== 'text' && t !== 'heading' && t !== 'subheading') return;
    dirty = null;
    clearTimeout(timer);
    post({ type: 'split', index, parts: [t === 'text' ? markdownOf(el) : plainLinesOf(el), ''] });
  };

  /** Enter: the words before the caret stay in the block, the words after it start a new paragraph (at the end, an empty one opens). */
  /** The text being written is a heading or a subheading (one on the page, or a new one still pending). */
  const lined = (c: { el: HTMLElement; index: number | null; field: Field | null }) =>
    c.el.hasAttribute('data-editor-pending') ? LINED.has(c.el.dataset.pendingKind ?? '') : c.index !== null && c.index >= 0 && LINED.has(typeOf(c.index));
  const splitAt = (el: HTMLElement, index: number) => {
    const t = typeOf(index);
    if (t !== 'text' && !LINED.has(t)) return;
    const h = halves(el);
    if (!h) return;
    dirty = null;
    clearTimeout(timer);
    const parts = t === 'text' ? [markdownOf(h[0]), markdownOf(h[1])] : [plainLinesOf(h[0]), linesMarkdown(plainLinesOf(h[1]))];
    post({ type: 'split', index, parts });
  };
  /** Shift + Enter in a heading or a subheading: a line break at the caret (a second one at the very end, so the new line shows). */
  const lineBreak = (el: HTMLElement) => {
    const r = caretRange();
    if (!r || !el.contains(r.commonAncestorContainer)) return;
    r.deleteContents();
    const br = document.createElement('br');
    r.insertNode(br);
    const rest = document.createRange();
    rest.setStartAfter(br);
    rest.setEnd(el, el.childNodes.length);
    if (!rest.toString() && !rest.cloneContents().querySelector('br')) br.after(document.createElement('br'));
    const caret = document.createRange();
    caret.setStartAfter(br);
    caret.collapse(true);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(caret);
    markDirty();
  };

  on('beforeinput', (e) => {
    const c = current();
    if (!c) return;
    const { el, index } = c;
    const rich = el.dataset.editorEditable === 'rich' || (el.hasAttribute('data-editor-pending') && el.dataset.pendingKind === 'text');
    const type = e.inputType;
    if (type === 'insertParagraph') {
      e.preventDefault();
      if (index === null || index < 0 || composing) return;
      if (el.nodeName === 'UL' || el.nodeName === 'OL') return newItem(el, index);
      if (el.closest('li')) return;
      splitAt(el, index);
      return;
    }
    if (type === 'deleteContentBackward' && index !== null && index > 0 && typeOf(index) === 'text' && typeOf(index - 1) === 'text' && el.nodeName === 'P' && atStart(el)) {
      e.preventDefault();
      dirty = null;
      clearTimeout(timer);
      post({ type: 'text', index, value: markdownOf(el), session, final: true });
      post({ type: 'merge', index });
      return;
    }
    if (type === 'insertFromPaste' || type === 'insertFromDrop' || type === 'insertFromYank') {
      e.preventDefault();
      // a plaintext-only block (heading, quote, caption…) gets the text in data, with no dataTransfer
      const text = e.dataTransfer?.getData('text/plain') || e.data || '';
      // a rich copy (a web page, Word, Docs, a chat) keeps its structure and marks; Markdown arrives as plain text
      const html = rich ? (e.dataTransfer?.getData('text/html') ?? '') : '';
      const pasted = (html && blocksFromHtml(new DOMParser().parseFromString(html, 'text/html').body)) || blocksFromMarkdown(text);
      const kind = kindOf(pasted.blocks);
      if (kind === 'nothing') return;
      // blocks (headings, lists, quotes, marks, several paragraphs) in a paragraph arrive as blocks
      const pending = el.hasAttribute('data-editor-pending');
      if (kind === 'blocks' && rich && el.nodeName === 'P' && (pending || (index !== null && index >= 0))) {
        const h = halves(el);
        if (!h) return;
        dirty = null;
        clearTimeout(timer);
        const at = pending ? Number(el.dataset.editorPending) : index!;
        if (pending) {
          el.removeAttribute('data-editor-pending');
          el.remove();
          redraw();
        }
        post({ type: 'paste', index: at, pending, before: seam(h[0], 'end'), after: seam(h[1], 'start'), blocks: pasted.blocks, pictures: pasted.pictures });
        return;
      }
      // in a list, each pasted line is an item, its marks kept
      if (kind === 'blocks' && rich && (el.nodeName === 'UL' || el.nodeName === 'OL') && pasteItems(el, linesOf(pasted.blocks))) {
        markDirty();
        return;
      }
      const paras = (kind === 'blocks' ? wordsOf(pasted.blocks) : text || wordsOf(pasted.blocks))
        .replace(/\r\n?/g, '\n')
        .split(/\n[ \t]*\n/)
        .filter((p) => p.trim());
      insertPlain(paras.join('\n'), rich);
      return;
    }
    if ((type === 'formatBold' || type === 'formatItalic') && rich) return;
    if (!ALLOWED_INPUT.has(type)) e.preventDefault();
    if (type === 'insertLineBreak' && !rich) e.preventDefault();
  });

  // a picture pasted (a screenshot, a copied image) becomes a figure after the block, once it's uploaded
  on(
    'paste',
    (e) => {
      if (preview) return;
      const data = e.clipboardData;
      const file = data ? pictureOfPaste([...data.files], data.getData('text/plain')) : null;
      if (!file) return;
      const c = current();
      let at: number;
      if (c?.el.hasAttribute('data-editor-pending')) {
        at = Number(c.el.dataset.editorPending);
        c.el.removeAttribute('data-editor-pending');
        c.el.remove();
        redraw();
      } else if (c?.field) at = 0;
      else if (c && c.index !== null && c.index >= 0) at = c.index + 1;
      else if (selected !== null) at = selected + 1;
      else at = blocks.length;
      e.preventDefault();
      post({ type: 'paste-picture', index: at, file });
    },
    true,
  );

  // ---------- the format bar ----------
  let savedRange: Range | null = null;
  const moreWrap = format.querySelector<HTMLElement>('[data-chrome-more]')!;
  const moreMenu = format.querySelector<HTMLElement>('[data-chrome-more-menu]')!;
  const moreToggle = format.querySelector<HTMLElement>('[data-chrome-more-toggle]')!;
  const showMore = (open: boolean) => {
    moreMenu.hidden = !open;
    moreToggle.setAttribute('aria-expanded', String(open));
  };
  // the tools that go under More formatting when the bar is wider than the page, least used first
  const OVERFLOW = ['indent', 'outdent', 'code', 'strikethrough', 'numbered'];
  const ORDER = ['bold', 'italic', 'strikethrough', 'code', 'link', 'bulleted', 'numbered', 'outdent', 'indent'];
  const homes = new Map<HTMLElement, { parent: HTMLElement; next: Node | null }>();
  const fit = () => {
    for (const [b, h] of [...homes].reverse()) h.parent.insertBefore(b, h.next);
    homes.clear();
    const room = document.documentElement.clientWidth - 16;
    moreWrap.hidden = true;
    for (const op of OVERFLOW) {
      if (format.offsetWidth <= room) break;
      const b = format.querySelector<HTMLElement>(`[data-chrome-format-op="${op}"]`);
      if (!b || b.closest('[hidden]')) continue;
      moreWrap.hidden = false;
      homes.set(b, { parent: b.parentElement!, next: b.nextSibling });
      moreMenu.append(b);
    }
    if (moreWrap.hidden) showMore(false);
    // the menu keeps the bar's own order
    const order = (b: Element) => ORDER.indexOf((b as HTMLElement).dataset.chromeFormatOp ?? '');
    moreMenu.append(...[...moreMenu.children].sort((a, b) => order(a) - order(b)));
  };
  const STATE: Record<string, string> = { bold: 'bold', italic: 'italic', strikethrough: 'strikeThrough' };
  on('selectionchange', () => {
    const r = caretRange();
    const c = current();
    const show = !!r && !r.collapsed && !!c && c.el.dataset.editorEditable === 'rich' && !preview;
    format.hidden = !show;
    if (!show) return showMore(false);
    const at = r!.commonAncestorContainer.nodeType === 1 ? (r!.commonAncestorContainer as Element) : r!.commonAncestorContainer.parentElement;
    const indents = format.querySelector<HTMLElement>('[data-chrome-in-list]');
    const tag = c!.el.nodeName.toLowerCase();
    // the indents show only in a list (fit puts any under More formatting back in their group first)
    if (indents) indents.hidden = !at?.closest('li');
    for (const b of format.querySelectorAll<HTMLElement>('[data-chrome-format-op]')) {
      const op = b.dataset.chromeFormatOp!;
      if (STATE[op]) b.setAttribute('aria-pressed', String(document.queryCommandState(STATE[op])));
      else if (op === 'bulleted' || op === 'numbered') b.setAttribute('aria-pressed', String(tag === (op === 'bulleted' ? 'ul' : 'ol')));
    }
    fit();
    // over the selection, kept inside the page
    const rect = r!.getBoundingClientRect();
    const half = format.offsetWidth / 2 + 8;
    const x = Math.min(Math.max(rect.left + rect.width / 2, half), document.documentElement.clientWidth - half);
    format.style.setProperty('--x', `${x + scrollX}px`);
    format.style.setProperty('--y', `${rect.top + scrollY}px`);
  });
  const formatOp = (op: string) => {
    const c = current();
    if (!c || c.el.dataset.editorEditable !== 'rich') return;
    if (op === 'bold' || op === 'italic') document.execCommand(op);
    else if (op === 'strikethrough') document.execCommand('strikeThrough');
    else if (op === 'bulleted' || op === 'numbered') {
      // a list is a block's kind: the paragraph turns into one (its words sent first), and the same list back
      if (c.index === null || c.index < 0) return;
      const tag = c.el.nodeName.toLowerCase();
      const to = (op === 'bulleted' && tag === 'ul') || (op === 'numbered' && tag === 'ol') ? 'paragraph' : op;
      send(true);
      post({ type: 'turn', index: c.index, to });
      return;
    }
    else if (op === 'indent' || op === 'outdent') {
      // only a list's items indent (as nested lists, to the subset's three levels); elsewhere the browser would make a quotation
      const r = caretRange();
      const at = r && (r.commonAncestorContainer.nodeType === 1 ? (r.commonAncestorContainer as Element) : r.commonAncestorContainer.parentElement);
      if (!at?.closest('li')) return;
      document.execCommand(op);
    } else if (op === 'code') {
      const r = caretRange();
      if (!r) return;
      const inCode = (r.commonAncestorContainer.nodeType === 1 ? (r.commonAncestorContainer as Element) : r.commonAncestorContainer.parentElement)?.closest('code');
      if (inCode) inCode.replaceWith(document.createTextNode(inCode.textContent ?? ''));
      else if (!r.collapsed) {
        const code = document.createElement('code');
        code.textContent = r.toString();
        r.deleteContents();
        r.insertNode(code);
      }
    } else if (op === 'link') {
      const r = caretRange();
      savedRange = r ? r.cloneRange() : null;
      const a = (r?.commonAncestorContainer.nodeType === 1 ? (r.commonAncestorContainer as Element) : r?.commonAncestorContainer.parentElement)?.closest('a');
      post({ type: 'link-request', href: a?.getAttribute('data-md-href') ?? a?.getAttribute('href') ?? '' });
      return;
    }
    markDirty();
  };
  const applyLink = (href: string) => {
    if (!savedRange) return;
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(savedRange);
    const host = (savedRange.commonAncestorContainer.nodeType === 1 ? (savedRange.commonAncestorContainer as HTMLElement) : savedRange.commonAncestorContainer.parentElement)?.closest<HTMLElement>('[data-editor-editable]');
    host?.focus();
    if (!href) document.execCommand('unlink');
    else {
      document.execCommand('createLink', false, href);
      host?.querySelectorAll('a').forEach((a) => {
        if (a.getAttribute('href') === href) a.setAttribute('data-md-href', href);
      });
    }
    savedRange = null;
    markDirty();
  };

  // ---------- keys ----------
  on(
    'keydown',
    (e) => {
      if (e.isComposing || preview) return;
      // the minimap's own keys (Enter, Space, the arrows) are the minimap's
      if (wayfinding(e.target) && !((e.ctrlKey || e.metaKey) && ['s', 'z', 'y'].includes(e.key.toLowerCase()))) return;
      const mod = e.ctrlKey || e.metaKey;
      const editing = current();
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        send(true);
        post({ type: 'key', key: 'save' });
        return;
      }
      // turn the block into another kind of text, even while its words are being typed (they're sent first)
      const kind = turnShortcut(e);
      if (kind) {
        const at = editing ? editing.index : selected;
        if (at === null || at < 0) return;
        e.preventDefault();
        send(true);
        post({ type: 'turn', index: at, to: kind });
        return;
      }
      if (e.key === 'Escape' && !moreMenu.hidden) {
        e.preventDefault();
        showMore(false);
        return;
      }
      if (editing) {
        if (e.key === 'Escape') {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
          if (editing.index !== null && editing.index >= 0) focusBlock(editing.index);
        } else if (mod && e.key.toLowerCase() === 'k' && editing.el.dataset.editorEditable === 'rich') {
          e.preventDefault();
          formatOp('link');
        } else if (mod && e.shiftKey && e.key.toLowerCase() === 'x' && editing.el.dataset.editorEditable === 'rich') {
          e.preventDefault();
          formatOp('strikethrough');
        } else if (mod && !e.shiftKey && (e.key === ']' || e.key === '[') && editing.el.dataset.editorEditable === 'rich') {
          e.preventDefault();
          formatOp(e.key === ']' ? 'indent' : 'outdent');
        } else if (mod && e.key === 'Enter' && !e.shiftKey && !e.altKey && editing.index !== null && editing.index >= 0 && !composing) {
          // out of a list (or any paragraph or heading) into a new paragraph after it
          e.preventDefault();
          paragraphAfter(editing.el, editing.index);
        } else if (e.key === 'Enter' && !mod && !e.altKey && !composing && lined(editing)) {
          // a heading or a subheading: Shift + Enter breaks the line, Enter goes on in a new paragraph
          e.preventDefault();
          if (e.shiftKey) lineBreak(editing.el);
          else if (editing.el.hasAttribute('data-editor-pending')) {
            if (!plainLinesOf(editing.el)) return;
            dirty = editing;
            send(true);
            const at = blocks.indexOf(editing.el);
            if (at >= 0) addPending(at + 1, 'text');
          } else splitAt(editing.el, editing.index!);
        } else if (editing.el.dataset.editorEditable === 'plain' && (e.key === 'Enter' || (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase()))) && editing.field) {
          e.preventDefault();
          if (e.key === 'Enter') (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        post({ type: 'key', key: e.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        post({ type: 'key', key: 'redo' });
        return;
      }
      if (selected === null) return;
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        post({ type: 'op', index: selected, op: e.key === 'ArrowUp' ? 'up' : 'down' });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const to = Math.max(0, Math.min(blocks.length - 1, selected + (e.key === 'ArrowUp' ? -1 : 1)));
        select(to, null, true, true);
        focusBlock(to);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        post({ type: 'op', index: selected, op: 'duplicate' });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        post({ type: 'op', index: selected, op: 'delete' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const ed = editableOf(selected);
        if (ed) focusText(ed, 'end');
        else post({ type: 'key', key: 'settings' });
      } else if (e.key === 'Escape') select(null);
    },
    true,
  );

  const focusBlock = (i: number) => {
    const b = blocks[i];
    if (!b) return;
    if (!b.hasAttribute('tabindex')) b.tabIndex = -1;
    b.focus({ preventScroll: true });
  };
  const focusText = (el: HTMLElement, at: 'start' | 'end' | number) => {
    el.focus({ preventScroll: true });
    const r = document.createRange();
    if (typeof at === 'number') {
      // a character offset into the text
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let left = at;
      let node = walker.nextNode();
      while (node && left > (node.textContent ?? '').length) {
        left -= (node.textContent ?? '').length;
        node = walker.nextNode();
      }
      if (node) r.setStart(node, Math.max(0, left));
      else r.selectNodeContents(el);
    } else r.selectNodeContents(el);
    r.collapse(at === 'start');
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  };

  // ---------- messages from the editor ----------
  addEventListener(
    'message',
    (e) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as { source?: string; type: string; [k: string]: unknown };
      if (m?.source !== 'editor') return;
      if (m.type === 'select') select(m.index as number | null, (m.field as Field) ?? null, false, !!m.scroll);
      else if (m.type === 'focus') {
        const i = m.index as number;
        const ed = editableOf(i);
        select(i, null, false, true);
        if (ed) focusText(ed, (m.at as 'start' | 'end' | number) ?? 'start');
        else focusBlock(i);
      } else if (m.type === 'pending') addPending(m.index as number, m.kind as Pending);
      else if (m.type === 'link') applyLink(String(m.href ?? ''));
      else if (m.type === 'flush') send(true);
      else if (m.type === 'mode') {
        preview = !!m.preview;
        document.querySelectorAll<HTMLElement>('[data-editor-editable]').forEach((el) => (el.contentEditable = preview ? 'false' : el.dataset.editorEditable === 'rich' ? 'true' : 'plaintext-only'));
        hoverBox.hidden = insert.hidden = format.hidden = true;
        redraw();
      }
    },
    { signal },
  );

  const addPending = (at: number, kind: Pending) => {
    if (!prose) return;
    const el = document.createElement(kind === 'heading' ? 'h2' : 'p');
    if (kind === 'subheading') el.dataset.subheading = '';
    if (kind === 'marker') el.dataset.sectionMark = '';
    el.dataset.editorPending = String(at);
    el.dataset.pendingKind = kind;
    el.dataset.placeholder = kind === 'text' ? 'Write here, or press + to add a block' : kind === 'heading' ? 'A heading' : kind === 'marker' ? '1, or Chapter 1' : 'More about the heading';
    el.contentEditable = kind === 'text' ? 'true' : 'plaintext-only';
    const before = blocks[at - 1];
    if (before) before.after(el);
    else prose.prepend(el);
    el.focus();
    select(null, null, false);
    selBox.hidden = false;
    place(selBox, el.getBoundingClientRect());
  };

  // ---------- where the editor left off ----------
  const key = `editor.canvas.scroll.${location.pathname}`;
  addEventListener('pagehide', () => sessionStorage.setItem(key, String(scrollY)), { signal });
  const y = Number(sessionStorage.getItem(key) ?? 0);
  if (y) requestAnimationFrame(() => scrollTo(0, y));
  post({ type: 'ready', count: blocks.length });
}
