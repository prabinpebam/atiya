/**
 * A rich field's words (documentation/editor/spec.md §3.5): Markdown in, the HTML the field edits, and
 * that HTML back to Markdown through the same subset, parser and serializer as the canvas and the site,
 * so what the field shows is what the page shows. Pure, so the unit tests run it without a browser.
 */
import { normalize, parseMarkdown, renderBlocks, serializeBlocks, serializeInline, type Inline } from '../../content/markdown';
import type { Block } from '../../content/schema';
import { blocksOf, type MiniNode } from './dom';

/** The HTML a rich field starts with: its Markdown rendered, each link keeping its written target. */
export const richHtml = (md: string | undefined): string => (md?.trim() ? renderBlocks(parseMarkdown(md), { annotate: true, resolveRef: () => '#' }) : '');

/** A rich field's content back to Markdown: its paragraphs and lists, a blank line between them. */
export const richMarkdown = (root: MiniNode): string => serializeBlocks(blocksOf(root));

/** Pasted blocks as a rich field's Markdown: text kept with its marks and lists, a heading or a quote as a paragraph, the rest left out. */
export function pastedMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === 'text' ? b.markdown : b.type === 'heading' || b.type === 'quote' ? serializeInline([{ t: 'text', v: b.text }]) : ''))
    .filter(Boolean)
    .join('\n\n');
}

/** Pasted content as one table cell: inline marks kept, every block boundary flattened to one space. */
export function pastedCellMarkdown(blocks: Block[]): string {
  const parts: Inline[][] = [];
  const oneLine = (nodes: Inline[]): Inline[] =>
    nodes.map((n): Inline => {
      if (n.t === 'br') return { t: 'text', v: ' ' };
      if (n.t === 'strong' || n.t === 'em' || n.t === 'del' || n.t === 'link') return { ...n, c: oneLine(n.c) };
      return n;
    });
  const take = (md: string) => {
    for (const b of parseMarkdown(md)) {
      if (b.t === 'p') parts.push(oneLine(b.c));
      else parts.push(...b.items.map(oneLine));
    }
  };
  for (const b of blocks) {
    if (b.type === 'text') take(b.markdown);
    else if (b.type === 'heading' || b.type === 'subheading' || b.type === 'marker' || b.type === 'quote') parts.push([{ t: 'text', v: b.text }]);
    else if (b.type === 'table') [...b.columns, ...b.rows.flat()].forEach(take);
  }
  return serializeInline(
    normalize(
      parts.flatMap((part, index): Inline[] => (index ? [{ t: 'text', v: ' ' }, ...part] : part)),
    ),
  );
}

/** The toolbar's groups, in order: the marks, the words that are code or go somewhere, and lists. */
export const RICH_GROUPS = ['marks', 'words', 'lists'] as const;

/** The formatting a rich field's toolbar offers, in its order, with the keys that do the same. */
export const RICH_TOOLS = [
  { op: 'bold', label: 'Bold', icon: 'bold', key: 'Ctrl+B', group: 'marks' },
  { op: 'italic', label: 'Italic', icon: 'italic', key: 'Ctrl+I', group: 'marks' },
  { op: 'strikethrough', label: 'Strikethrough', icon: 'strikethrough', key: 'Ctrl+Shift+X', group: 'marks' },
  { op: 'code', label: 'Code', icon: 'code', key: 'Ctrl+E', group: 'words' },
  { op: 'link', label: 'Link', icon: 'link', key: 'Ctrl+K', group: 'words' },
  { op: 'bulleted', label: 'Bulleted list', icon: 'bulleted', key: 'Ctrl+Shift+8', group: 'lists' },
  { op: 'numbered', label: 'Numbered list', icon: 'numbered', key: 'Ctrl+Shift+7', group: 'lists' },
  { op: 'outdent', label: 'Indent less', icon: 'outdent', key: 'Ctrl+[', group: 'lists' },
  { op: 'indent', label: 'Indent more', icon: 'indent', key: 'Ctrl+]', group: 'lists' },
] as const;
export type RichOp = (typeof RICH_TOOLS)[number]['op'];

/** The toolbar's op for a key in a rich field, or null. */
export function richShortcut(e: { key: string; code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): RichOp | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (e.shiftKey) {
    if (k === 'x') return 'strikethrough';
    if (e.code === 'Digit8' || e.code === 'Numpad8') return 'bulleted';
    if (e.code === 'Digit7' || e.code === 'Numpad7') return 'numbered';
    return null;
  }
  if (k === 'b') return 'bold';
  if (k === 'i') return 'italic';
  if (k === 'e') return 'code';
  if (k === 'k') return 'link';
  if (e.key === ']') return 'indent';
  if (e.key === '[') return 'outdent';
  return null;
}
