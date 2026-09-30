/**
 * The edited text on the canvas, back to the inline tree (documentation/editor/spec.md §3.2): only what
 * the Markdown subset holds survives: bold (b, strong), italic (i, em), code, links (keeping the written
 * target a rendered link carries in data-md-href) and line breaks. Every other element keeps only its
 * text. Written against a minimal node interface, so it runs in the unit tests without a browser.
 */
import { normalize, serializeBlocks, serializeInline, type Inline, type MdBlock } from '../../content/markdown';

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

/** The inline tree of an element's content. */
export function inlineOf(node: MiniNode, inLink = false): Inline[] {
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
    else if (tag === 'b' || tag === 'strong') out.push({ t: 'strong', c: inlineOf(c, inLink) });
    else if (tag === 'i' || tag === 'em') out.push({ t: 'em', c: inlineOf(c, inLink) });
    else if (tag === 'code') out.push({ t: 'code', v: (c.textContent ?? '').replace(/\s+/g, ' ') });
    else if (tag === 'a' && !inLink) {
      const href = c.getAttribute?.('data-md-href') ?? c.getAttribute?.('href') ?? '';
      if (href) out.push({ t: 'link', href, c: inlineOf(c, true) });
      else out.push(...inlineOf(c, inLink));
    } else if (tag === 'script' || tag === 'style' || tag === 'img' || tag === 'svg') continue;
    else out.push(...inlineOf(c, inLink));
  }
  return normalize(trimEdges(out));
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

/** A text block's element (p, ul or ol) back to its Markdown. */
export function markdownOf(el: MiniNode): string {
  const tag = el.nodeName.toLowerCase();
  let block: MdBlock;
  if (tag === 'ul' || tag === 'ol') block = { t: tag, items: kids(el).filter((c) => c.nodeType === ELEMENT && c.nodeName.toLowerCase() === 'li').map((li) => inlineOf(li)) };
  else block = { t: 'p', c: inlineOf(el) };
  return serializeBlocks([block]);
}

/** Plain text of an element (a heading, a quote, the title): line breaks become spaces. */
export function plainOf(el: MiniNode): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export { serializeInline };
