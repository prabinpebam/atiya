/**
 * Pasting a rich copy on the canvas (documentation/editor/spec.md §3.2): what's copied from a web page,
 * Word, Google Docs, a chat or the site itself arrives as the clipboard's HTML, and becomes the closest
 * blocks and marks the site has, as pasted Markdown does (paste.ts): headings (H1 and H2 a heading 2, H3 a
 * heading 3, H4 to H6 a heading 4, their words only), paragraphs with their bold, italic, code and links,
 * bulleted and numbered lists (Word's and Docs' too), quotes, dividers, code blocks (a line each, as
 * code), and a table's rows as paragraphs. Pictures are left out (they come from the media library), and
 * so is anything the site can't show (colours, fonts, sizes, underline). A copy from a code editor (all of
 * it monospaced or preformatted, like VS Code's) is left to its plain text, so Markdown copied from one
 * still arrives as Markdown. Written against a minimal node interface, so it runs in the unit tests.
 */
import type { Block } from '../../content/schema';
import { normalize, serializeBlocks, type Inline } from '../../content/markdown';
import type { MiniNode } from './dom';
import type { Pasted } from './paste';

const TEXT = 3;
const ELEMENT = 1;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const BLOCK = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'body', 'html', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'address', 'details', 'summary']);
const SKIP = new Set(['head', 'style', 'script', 'meta', 'title', 'link', 'template', 'noscript', 'svg', 'math', 'button', 'input', 'select', 'textarea', 'video', 'audio', 'iframe', 'object', 'canvas']);
const MONO = /monospace|consolas|courier|menlo|monaco|fira code|cascadia|source code|sf mono|jetbrains/i;

/** The styles a run of words carries, as the elements around it set them. */
interface Style {
  strong: boolean;
  em: boolean;
  code: boolean;
  pre: boolean;
}

const kids = (n: MiniNode) => Array.from(n.childNodes);
const tagOf = (n: MiniNode) => n.nodeName.toLowerCase();
const attr = (n: MiniNode, name: string) => n.getAttribute?.(name) ?? null;

/** A style attribute's declarations, by property (lowercase). */
function styleOf(n: MiniNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of (attr(n, 'style') ?? '').split(';')) {
    const i = d.indexOf(':');
    if (i > 0) out[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

/** The style inside an element: its tag's meaning, then its own style attribute (Docs and Word say it there). */
function within(n: MiniNode, st: Style): Style {
  const tag = tagOf(n);
  const s = styleOf(n);
  const next = { ...st };
  if (tag === 'b' || tag === 'strong') next.strong = true;
  if (tag === 'i' || tag === 'em' || tag === 'cite' || tag === 'dfn' || tag === 'var') next.em = true;
  if (tag === 'code' || tag === 'kbd' || tag === 'samp' || tag === 'tt') next.code = true;
  if (tag === 'pre') next.pre = true;
  const w = s['font-weight'];
  if (w) next.strong = w === 'bold' || w === 'bolder' || (/^\d+$/.test(w) && Number(w) >= 600);
  const fs = s['font-style'];
  if (fs) next.em = fs === 'italic' || fs === 'oblique';
  if (s['font-family'] && MONO.test(s['font-family'])) next.code = true;
  if (s['white-space'] && /^pre/.test(s['white-space'])) next.pre = true;
  return next;
}

const hidden = (n: MiniNode) => {
  const s = styleOf(n);
  // Word's list markers ("·", "1.") sit in a span it marks to be ignored
  return s['display'] === 'none' || s['mso-list'] === 'ignore' || attr(n, 'aria-hidden') === 'true';
};
/** The words of the first hidden element in a Word list paragraph: its marker ("·", "o", "1.", "a)"). */
const markerOf = (n: MiniNode): string | null => {
  for (const c of kids(n)) {
    if (c.nodeType !== ELEMENT) continue;
    if (hidden(c)) return c.textContent ?? '';
    const deeper = markerOf(c);
    if (deeper !== null) return deeper;
  }
  return null;
};
const hasBlock = (n: MiniNode): boolean => kids(n).some((c) => c.nodeType === ELEMENT && !SKIP.has(tagOf(c)) && (BLOCK.has(tagOf(c)) || hasBlock(c)));

/** The marked words of an element's inline content. */
function inline(n: MiniNode, st: Style, out: { pictures: number }, inLink = false): Inline[] {
  const res: Inline[] = [];
  for (const c of kids(n)) {
    if (c.nodeType === TEXT) {
      const raw = (c.textContent ?? '').replace(/\u00a0/g, ' ');
      const v = st.pre ? raw : raw.replace(/[ \t\r\n]+/g, ' ');
      if (!v) continue;
      let node: Inline = st.code ? { t: 'code', v: v.replace(/\s+/g, ' ') } : { t: 'text', v };
      if (st.em) node = { t: 'em', c: [node] };
      if (st.strong) node = { t: 'strong', c: [node] };
      res.push(node);
      continue;
    }
    if (c.nodeType !== ELEMENT) continue;
    const tag = tagOf(c);
    if (tag === 'img') {
      out.pictures++;
      continue;
    }
    if (SKIP.has(tag) || hidden(c)) continue;
    if (tag === 'br') {
      res.push({ t: 'br' });
      continue;
    }
    // a block inside inline content (two paragraphs in a list item) starts a line of its own
    if (BLOCK.has(tag) && res.length) res.push({ t: 'br' });
    const inner = within(c, st);
    if (tag === 'a' && !inLink) {
      const href = attr(c, 'data-md-href') ?? attr(c, 'href') ?? '';
      const words = inline(c, inner, out, true);
      if (SAFE_HREF.test(href)) res.push({ t: 'link', href, c: words });
      else res.push(...words);
      continue;
    }
    res.push(...inline(c, inner, out, inLink));
  }
  return res;
}

/** Inline content, tidied: marks merged, spaces at the edges and leading/trailing breaks dropped. */
function tidy(nodes: Inline[]): Inline[] {
  const out = normalize(nodes);
  while (out.length && out[0].t === 'br') out.shift();
  while (out.length && out[out.length - 1].t === 'br') out.pop();
  const first = out[0];
  if (first?.t === 'text') out[0] = { t: 'text', v: first.v.replace(/^\s+/, '') };
  const last = out[out.length - 1];
  if (last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v.replace(/\s+$/, '') };
  return normalize(out);
}

const wordsOf = (nodes: Inline[]): string => nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : n.t === 'br' ? ' ' : wordsOf(n.c))).join('');
const plain = (nodes: Inline[]) => wordsOf(nodes).replace(/\s+/g, ' ').trim();

type Piece = { kind: 'p'; c: Inline[] } | { kind: 'li'; ordered: boolean; list: number; c: Inline[] } | { kind: 'h'; level: 2 | 3 | 4; text: string } | { kind: 'quote'; text: string } | { kind: 'hr' } | { kind: 'code'; lines: string[] };

/** Is everything with words in it monospaced or preformatted (a copy from a code editor)? */
function allCode(n: MiniNode, st: Style): { code: number; all: number } {
  let code = 0;
  let all = 0;
  for (const c of kids(n)) {
    if (c.nodeType === TEXT) {
      const len = (c.textContent ?? '').replace(/\s+/g, '').length;
      all += len;
      if (st.code || st.pre) code += len;
    } else if (c.nodeType === ELEMENT && !SKIP.has(tagOf(c))) {
      const r = allCode(c, within(c, st));
      code += r.code;
      all += r.all;
    }
  }
  return { code, all };
}

/**
 * The blocks a rich copy describes, or null when its HTML should give way to its plain text: nothing in
 * it, or a copy from a code editor.
 */
export function blocksFromHtml(root: MiniNode): Pasted | null {
  const base: Style = { strong: false, em: false, code: false, pre: false };
  const size = allCode(root, base);
  if (!size.all || size.code === size.all) return null;
  const counts = { pictures: 0 };
  const pieces: Piece[] = [];
  let run: Inline[] = [];
  const flush = () => {
    const c = tidy(run);
    if (plain(c)) pieces.push({ kind: 'p', c });
    run = [];
  };

  let lists = 0;
  // a list's items, and those of the lists inside it: the site's lists are one level, so they join it
  const listItems = (list: MiniNode, st: Style, ordered: boolean, id = ++lists) => {
    for (const li of kids(list)) {
      if (li.nodeType !== ELEMENT) continue;
      const tag = tagOf(li);
      if (tag === 'ul' || tag === 'ol') {
        listItems(li, st, ordered, id);
        continue;
      }
      if (tag !== 'li') {
        walk(li, st);
        continue;
      }
      const own: MiniNode = { nodeType: li.nodeType, nodeName: li.nodeName, textContent: li.textContent, childNodes: kids(li).filter((c) => !(c.nodeType === ELEMENT && (tagOf(c) === 'ul' || tagOf(c) === 'ol'))), getAttribute: li.getAttribute?.bind(li) };
      const c = tidy(inline(own, within(li, st), counts));
      if (plain(c)) pieces.push({ kind: 'li', ordered, list: id, c });
      for (const sub of kids(li)) if (sub.nodeType === ELEMENT && (tagOf(sub) === 'ul' || tagOf(sub) === 'ol')) listItems(sub, st, ordered, id);
    }
  };

  function walk(n: MiniNode, st: Style) {
    for (const c of kids(n)) {
      if (c.nodeType === TEXT) {
        run.push(...inline({ nodeType: ELEMENT, nodeName: 'span', textContent: c.textContent, childNodes: [c] }, st, counts));
        continue;
      }
      if (c.nodeType !== ELEMENT) continue;
      const tag = tagOf(c);
      if (SKIP.has(tag) || hidden(c)) continue;
      const inner = within(c, st);
      if (tag === 'img') {
        counts.pictures++;
        continue;
      }
      if (tag === 'br') {
        run.push({ t: 'br' });
        continue;
      }
      // inline content: part of the paragraph being gathered (unless it wraps blocks, as Docs' outer <b> does)
      if (!BLOCK.has(tag) && !hasBlock(c)) {
        run.push(...inline({ nodeType: ELEMENT, nodeName: 'span', textContent: c.textContent, childNodes: [c] }, st, counts));
        continue;
      }
      flush();
      if (/^h[1-6]$/.test(tag)) {
        const text = plain(inline(c, inner, counts));
        const level = Number(tag[1]);
        if (text) pieces.push({ kind: 'h', level: level <= 2 ? 2 : level === 3 ? 3 : 4, text });
      } else if (tag === 'ul' || tag === 'ol') listItems(c, st, tag === 'ol');
      else if (tag === 'li') listItems({ nodeType: ELEMENT, nodeName: 'ul', textContent: c.textContent, childNodes: [c] }, st, false);
      else if (tag === 'blockquote') {
        const text = plain(inline(c, inner, counts));
        if (text) pieces.push({ kind: 'quote', text });
      } else if (tag === 'hr') pieces.push({ kind: 'hr' });
      else if (tag === 'pre') {
        const lines = (c.textContent ?? '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
        if (lines.length) pieces.push({ kind: 'code', lines });
      } else if (tag === 'table' || tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
        for (const row of kids(c)) {
          if (row.nodeType !== ELEMENT) continue;
          if (tagOf(row) !== 'tr') {
            walk({ nodeType: ELEMENT, nodeName: 'table', textContent: row.textContent, childNodes: [row] }, inner);
            continue;
          }
          // a row as a paragraph: its cells' words, side by side
          const cells = kids(row)
            .filter((x) => x.nodeType === ELEMENT && (tagOf(x) === 'td' || tagOf(x) === 'th'))
            .map((x) => tidy(inline(x, within(x, within(row, inner)), counts)))
            .filter((x) => plain(x));
          const joined = cells.flatMap((x, k): Inline[] => (k ? [{ t: 'text', v: ' · ' }, ...x] : x));
          if (joined.length) pieces.push({ kind: 'p', c: normalize(joined) });
        }
      } else if (/mso-list/.test(attr(c, 'style') ?? '') || /msolistparagraph/i.test(attr(c, 'class') ?? '')) {
        // a Word list item: a paragraph it marks as one; its hidden marker says if it's numbered
        const marker = markerOf(c) ?? '';
        const item = tidy(inline(c, inner, counts));
        if (plain(item)) pieces.push({ kind: 'li', ordered: /\w[.)]/.test(marker), list: 0, c: item });
      } else if (hasBlock(c)) walk(c, inner);
      else {
        const p = tidy(inline(c, inner, counts));
        if (plain(p)) pieces.push({ kind: 'p', c: p });
      }
    }
  }

  walk(root, base);
  flush();

  // pieces into blocks: list items side by side make one list, as in the site's Markdown
  const blocks: Block[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.kind === 'p') blocks.push({ type: 'text', markdown: serializeBlocks([{ t: 'p', c: p.c }]) });
    else if (p.kind === 'li') {
      const items: Inline[][] = [p.c];
      for (let q = pieces[i + 1]; q?.kind === 'li' && q.ordered === p.ordered && q.list === p.list; q = pieces[i + 1]) items.push((pieces[++i] as { c: Inline[] }).c);
      blocks.push({ type: 'text', markdown: serializeBlocks([{ t: p.ordered ? 'ol' : 'ul', items }]) });
    } else if (p.kind === 'h') blocks.push({ type: 'heading', level: p.level, text: p.text });
    else if (p.kind === 'quote') blocks.push({ type: 'quote', variant: 'block', text: p.text });
    else if (p.kind === 'hr') {
      if (blocks.length && blocks[blocks.length - 1].type !== 'divider') blocks.push({ type: 'divider' });
    } else if (p.kind === 'code') blocks.push({ type: 'text', markdown: serializeBlocks([{ t: 'p', c: p.lines.flatMap((v, k): Inline[] => (k ? [{ t: 'br' }, { t: 'code', v }] : [{ t: 'code', v }])) }]) });
  }
  while (blocks[blocks.length - 1]?.type === 'divider') blocks.pop();
  return { blocks, pictures: counts.pictures };
}
