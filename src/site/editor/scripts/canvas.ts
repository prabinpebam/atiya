/**
 * Edit mode's canvas, inside the frame (documentation/editor/spec.md §3.1–§3.3). The page is the real
 * page; this finds each block (the comment the server writes before it), draws the overlay over it,
 * edits text in place and tells the article editor what the writer did. The editor owns the document
 * and saves it; this only reports (select, text, split, merge, insert, move…) and redraws when told.
 */
import { turnShortcut, type TextKind } from '../model/ops';
import { pasteKind, wordsOfPaste } from '../model/paste';
import { pictureOfPaste } from '../model/upload';
import { markdownOf, plainOf } from '../model/dom';
import { serializeInline } from '../../content/markdown';

type Kind = { kind: string; type: string };
type Field = 'title' | 'summary';
type Out =
  | { type: 'ready'; count: number }
  | { type: 'select'; index: number | null; field?: Field }
  | { type: 'text'; index: number; value: string; session: number; final: boolean }
  | { type: 'field'; field: Field; value: string; session: number; final: boolean }
  | { type: 'split'; index: number; parts: string[] }
  | { type: 'paste'; index: number; pending: boolean; before: string; after: string; text: string }
  | { type: 'paste-picture'; index: number; file: File }
  | { type: 'merge'; index: number }
  | { type: 'insert'; index: number }
  | { type: 'op'; index: number; op: 'up' | 'down' | 'duplicate' | 'delete' }
  | { type: 'pending'; index: number; kind: 'text' | 'heading'; value: string }
  | { type: 'link-request'; href: string }
  | { type: 'key'; key: 'undo' | 'redo' | 'save' | 'settings' }
  | { type: 'turn'; index: number; to?: TextKind };

const SOURCE = 'editor-canvas';
const TEXTY = new Set(['text', 'heading', 'quote']);
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
    if (turnButton) turnButton.hidden = selected === null || !(TEXTY.has(typeOf(selected)) || typeOf(selected) === 'tiles');
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
        insert.style.setProperty('--x', `${p.left + scrollX + p.width / 2}px`);
        insert.style.setProperty('--y', `${(top + bottom) / 2 + scrollY}px`);
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
  on(
    'click',
    (e) => {
      if (preview) return;
      const t = e.target as Element;
      if (chrome.contains(t)) return;
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
      const b = (e.target as Element).closest<HTMLElement>('[data-chrome-op], [data-chrome-insert-button], [data-chrome-format-op]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.chromeOp && selected !== null) {
        const op = b.dataset.chromeOp;
        if (op === 'add') post({ type: 'insert', index: selected + 1 });
        else if (op === 'turn') post({ type: 'turn', index: selected });
        else post({ type: 'op', index: selected, op: op as 'up' | 'down' | 'duplicate' | 'delete' });
      } else if (b.hasAttribute('data-chrome-insert-button') && insertAt >= 0) post({ type: 'insert', index: insertAt });
      else if (b.dataset.chromeFormatOp) formatOp(b.dataset.chromeFormatOp);
    },
    { signal },
  );
  // a toolbar button doesn't take the text's selection away
  chrome.addEventListener('mousedown', (e) => (e.target as Element).closest('[data-chrome-format-op]') && e.preventDefault(), { signal });

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
  const valueOf = (el: HTMLElement, index: number | null) => (index !== null && typeOf(index) === 'text' && el.dataset.editorEditable === 'rich' ? markdownOf(el) : plainOf(el));

  const send = (final: boolean) => {
    clearTimeout(timer);
    if (!dirty || composing) return;
    const { el, index, field } = dirty;
    if (el.hasAttribute('data-editor-pending')) {
      const value = el.nodeName === 'P' ? markdownOf(el) : plainOf(el);
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
      kinds.splice(at, 0, { kind: el.nodeName === 'P' ? 'Paragraph' : 'Heading 2', type: el.nodeName === 'P' ? 'text' : 'heading' });
      makeEditable(el, el.nodeName === 'P');
      post({ type: 'pending', index: at, kind: el.nodeName === 'P' ? 'text' : 'heading', value });
      dirty = null;
      return;
    }
    if (field) post({ type: 'field', field, value: plainOf(el), session, final });
    else if (index !== null && index >= 0) post({ type: 'text', index, value: valueOf(el, index), session, final });
    if (final) dirty = null;
  };
  const markDirty = () => {
    const c = current();
    if (!c) return;
    dirty = c;
    clearTimeout(timer);
    timer = window.setTimeout(() => send(false), 800);
    requestAnimationFrame(redraw);
  };

  // the drop cap's big letter moves the caret: it's off while its paragraph is edited
  on('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-editor-editable], [data-editor-pending]');
    if (!el) return;
    session++;
    if (prose?.hasAttribute('data-dropcap') && el.nodeName === 'P' && el === prose.querySelector(':scope > p')) {
      prose.dataset.dropcapPaused = '';
      prose.removeAttribute('data-dropcap');
    }
    const i = indexOf(el);
    if (i >= 0 && i !== selected) select(i);
  });
  on('focusout', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-editor-editable], [data-editor-pending]');
    if (!el) return;
    send(true);
    if (prose && prose.dataset.dropcapPaused !== undefined) {
      delete prose.dataset.dropcapPaused;
      prose.setAttribute('data-dropcap', '');
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

  on('beforeinput', (e) => {
    const c = current();
    if (!c) return;
    const { el, index } = c;
    const rich = el.dataset.editorEditable === 'rich' || (el.hasAttribute('data-editor-pending') && el.nodeName === 'P');
    const type = e.inputType;
    if (type === 'insertParagraph') {
      e.preventDefault();
      if (el.closest('li') || index === null || index < 0 || composing) return;
      const t = typeOf(index);
      if (t !== 'text' && t !== 'heading') return;
      if (el.nodeName === 'UL' || el.nodeName === 'OL') return;
      const h = halves(el);
      if (!h) return;
      dirty = null;
      clearTimeout(timer);
      const parts = t === 'text' ? [markdownOf(h[0]), markdownOf(h[1])] : [plainOf(h[0]), serializeInline([{ t: 'text', v: plainOf(h[1]) }])];
      post({ type: 'split', index, parts });
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
      const kind = pasteKind(text);
      if (kind === 'nothing') return;
      // Markdown (headings, lists, quotes, marks, several paragraphs) in a paragraph arrives as its blocks
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
        post({ type: 'paste', index: at, pending, before: markdownOf(h[0]), after: markdownOf(h[1]), text });
        return;
      }
      const paras = (kind === 'blocks' ? wordsOfPaste(text) : text)
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
  on('selectionchange', () => {
    const r = caretRange();
    const c = current();
    const show = !!r && !r.collapsed && !!c && c.el.dataset.editorEditable === 'rich' && !preview;
    format.hidden = !show;
    if (!show) return;
    const rect = r!.getBoundingClientRect();
    format.style.setProperty('--x', `${rect.left + rect.width / 2 + scrollX}px`);
    format.style.setProperty('--y', `${rect.top + scrollY}px`);
  });
  const formatOp = (op: string) => {
    const c = current();
    if (!c || c.el.dataset.editorEditable !== 'rich') return;
    if (op === 'bold' || op === 'italic') document.execCommand(op);
    else if (op === 'code') {
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
      if (editing) {
        if (e.key === 'Escape') {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
          if (editing.index !== null && editing.index >= 0) focusBlock(editing.index);
        } else if (mod && e.key.toLowerCase() === 'k' && editing.el.dataset.editorEditable === 'rich') {
          e.preventDefault();
          formatOp('link');
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
      } else if (m.type === 'pending') addPending(m.index as number, m.kind as 'text' | 'heading');
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

  const addPending = (at: number, kind: 'text' | 'heading') => {
    if (!prose) return;
    const el = document.createElement(kind === 'text' ? 'p' : 'h2');
    el.dataset.editorPending = String(at);
    el.dataset.placeholder = kind === 'text' ? 'Write here, or press + to add a block' : 'A heading';
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
