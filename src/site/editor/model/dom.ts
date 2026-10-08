/**
 * Edited text (on the canvas, or in a rich field of the inspector) back to the Markdown subset
 * (documentation/editor/spec.md §3.2): only what the subset holds survives: bold (b, strong), italic (i, em),
 * strikethrough (s, del, strike), code, links (keeping the written target a rendered link carries in
 * data-md-href), line breaks, paragraphs and lists, nested as the browser nests them (a list inside an item,
 * or one right after it, as an indent makes it), to the subset's depth. Every other element keeps only its
 * text. Written against a minimal node interface, so it runs in the unit tests without a browser.
 */
import { LIST_DEPTH_MAX, listOf, normalize, serializeBlocks, serializeInline, type Inline, type ListTree, type MdBlock } from '../../content/markdown';

export interface MiniNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<MiniNode>;
  getAttribute?(name: string): string | null;
}

const TEXT = 3;
const ELEMENT = 1;
const kids = (n: MiniNode) => Array.from(n.childNodes);

/** The inline tree of an element's content: its edges trimmed (a mark inside keeps the spaces at its own edges, which the serializer moves outside it). */
export function inlineOf(node: MiniNode, inLink = false): Inline[] {
  return normalize(trimEdges(inlineIn(node, inLink)));
}

function inlineIn(node: MiniNode, inLink: boolean): Inline[] {
  const out: Inline[] = [];
  for (const c of kids(node)) {
    if (c.nodeType === TEXT) {
      // the browser shows runs of white space as one space; a non-breaking space typed at a line's end stays a space
      out.push({ t: 'text', v: (c.textContent ?? '').replace(/[ \t\r\n]+/g, ' ').replace(/\u00a0/g, ' ') });
      continue;
    }
    if (c.nodeType !== ELEMENT) continue;
    const tag = c.nodeName.toLowerCase();
    if (tag === 'br') out.push({ t: 'br' });
    else if (tag === 'b' || tag === 'strong') out.push({ t: 'strong', c: inlineIn(c, inLink) });
    else if (tag === 'i' || tag === 'em') out.push({ t: 'em', c: inlineIn(c, inLink) });
    else if (tag === 's' || tag === 'del' || tag === 'strike') out.push({ t: 'del', c: inlineIn(c, inLink) });
    else if (tag === 'code') out.push({ t: 'code', v: (c.textContent ?? '').replace(/\s+/g, ' ') });
    else if (tag === 'a' && !inLink) {
      const href = c.getAttribute?.('data-md-href') ?? c.getAttribute?.('href') ?? '';
      if (href) out.push({ t: 'link', href, c: inlineIn(c, true) });
      else out.push(...inlineIn(c, inLink));
    } else if (tag === 'script' || tag === 'style' || tag === 'img' || tag === 'svg' || tag === 'ul' || tag === 'ol') continue;
    else out.push(...inlineIn(c, inLink));
  }
  return out;
}

/** A trailing line break at the very end is the browser's placeholder, not the writer's. */
function trimEdges(nodes: Inline[]): Inline[] {
  const out = [...nodes];
  while (out.length && out[out.length - 1].t === 'br') out.pop();
  const first = out[0];
  if (first?.t === 'text') out[0] = { t: 'text', v: first.v.replace(/^\s+/, '') };
  const last = out[out.length - 1];
  if (last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v.replace(/\s+$/, '') };
  return out;
}

const tagOf = (n: MiniNode) => (n.nodeType === ELEMENT ? n.nodeName.toLowerCase() : '');
const isList = (n: MiniNode) => tagOf(n) === 'ul' || tagOf(n) === 'ol';

/**
 * A list element as a tree: each li's own words, and the lists in it (or right after it, where an indent
 * puts them) as its sub-list. Items left empty (a new bullet not written in) are left out; a list nested
 * deeper than the subset holds joins the deepest level.
 */
export function listTreeOf(el: MiniNode, depth = 0): ListTree {
  const tree: ListTree = { t: tagOf(el) === 'ol' ? 'ol' : 'ul', items: [] };
  const flat = (l: ListTree): ListTree['items'] => l.items.flatMap((x) => [{ c: x.c }, ...(x.sub ? flat(x.sub) : [])]);
  const nest = (item: ListTree['items'][number] | undefined, list: MiniNode) => {
    const sub = listTreeOf(list, depth + 1);
    if (!sub.items.length) return;
    // no item to hang it on, or as deep as the subset goes: its items join this list, in order
    if (!item || depth >= LIST_DEPTH_MAX) tree.items.push(...flat(sub));
    else if (item.sub) item.sub.items.push(...sub.items);
    else item.sub = sub;
  };
  for (const c of kids(el)) {
    if (tagOf(c) === 'li') {
      const item = { c: inlineOf(c) } as ListTree['items'][number];
      tree.items.push(item);
      for (const inner of kids(c)) if (isList(inner)) nest(item, inner);
    } else if (isList(c)) nest(tree.items[tree.items.length - 1], c);
  }
  tree.items = tree.items.filter((x) => x.c.length || x.sub);
  return tree;
}

/** A text block's element (p, ul or ol) back to its Markdown. */
export function markdownOf(el: MiniNode): string {
  if (isList(el)) return serializeBlocks([listOf(listTreeOf(el))]);
  return serializeBlocks([{ t: 'p', c: inlineOf(el) }]);
}

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'section', 'article']);

/**
 * A rich field's content as blocks: each paragraph (a p or div, as the browser makes them) or list, and
 * the words typed straight into the field as a paragraph of their own. Empty paragraphs are left out.
 */
export function blocksOf(root: MiniNode): MdBlock[] {
  const out: MdBlock[] = [];
  let run: MiniNode[] = [];
  const flush = () => {
    const c = inlineOf({ nodeType: ELEMENT, nodeName: 'SPAN', textContent: '', childNodes: run });
    if (c.length) out.push({ t: 'p', c });
    run = [];
  };
  for (const c of kids(root)) {
    if (isList(c)) {
      flush();
      const list = listOf(listTreeOf(c));
      if (list.items.length) out.push(list);
    } else if (BLOCK.has(tagOf(c))) {
      flush();
      // a block holding blocks (a div round a list, as some pastes leave it) is read for its blocks
      if (kids(c).some((k) => isList(k) || BLOCK.has(tagOf(k)))) out.push(...blocksOf(c));
      else {
        const p = inlineOf(c);
        if (p.length) out.push({ t: 'p', c: p });
      }
    } else run.push(c);
  }
  flush();
  return out;
}

/** Plain text of an element (a heading, a quote, the title): line breaks become spaces. */
export function plainOf(el: MiniNode): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Plain text of a heading or a subheading, keeping its line breaks (a `br`, Shift + Enter) as "\n": each
 * line's white space collapsed and trimmed, empty lines (the browser's trailing `br`) dropped.
 */
export function plainLinesOf(el: MiniNode): string {
  const lines = [''];
  const walk = (n: MiniNode) => {
    for (const c of kids(n)) {
      if (c.nodeType === TEXT) lines[lines.length - 1] += c.textContent ?? '';
      else if (c.nodeType === ELEMENT) {
        if (c.nodeName.toLowerCase() === 'br') lines.push('');
        // a heading 2's margin mark is its own field (the inspector's), never the heading's words
        else if (c.getAttribute?.('data-heading-mark') == null) walk(c);
      }
    }
  };
  walk(el);
  return lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export { serializeInline };
