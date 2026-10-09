/**
 * Document operations on an article's blocks (documentation/editor/spec.md §3): pure and immutable, so
 * the editor applies them in the browser and the unit tests hold them. The server checks the result
 * against the contract; these only keep the shape right.
 */
import type { Article, Block } from '../../content/schema';
import { paragraphsOf, parseMarkdown, plainText, serializeBlocks, type Inline } from '../../content/markdown';

export type Body = Block[];

export const insert = (body: Body, at: number, ...blocks: Block[]): Body => [...body.slice(0, at), ...blocks, ...body.slice(at)];
export const remove = (body: Body, at: number): Body => body.filter((_, i) => i !== at);
export const duplicate = (body: Body, at: number): Body => insert(body, at + 1, structuredClone(body[at]));
export const replace = (body: Body, at: number, block: Block): Body => body.map((b, i) => (i === at ? block : b));

/** Moves a block from one position to another (the position it ends up at). */
export function move(body: Body, from: number, to: number): Body {
  if (from === to || from < 0 || from >= body.length) return body;
  const next = [...body];
  const [b] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, b);
  return next;
}

/** Positions from one to another, both included, in order (a range picked with Shift). */
export const range = (a: number, b: number): number[] => Array.from({ length: Math.abs(a - b) + 1 }, (_, k) => Math.min(a, b) + k);

/**
 * Moves several blocks one step up (-1) or down (1) together, keeping their order among themselves: each
 * steps past the block beside it that isn't selected. Nothing moves if the group is already at that end.
 * Returns the body and where the moved blocks are now.
 */
export function moveMany<T>(body: T[], indices: number[], dir: -1 | 1): { body: T[]; indices: number[] } {
  const picked = new Set(indices.filter((i) => i >= 0 && i < body.length));
  const at = [...picked].sort((a, b) => a - b);
  if (!at.length || (dir < 0 && at[0] === 0) || (dir > 0 && at[at.length - 1] === body.length - 1)) return { body, indices: at };
  const order = body.map((_, i) => i);
  if (dir < 0) {
    for (let k = 1; k < order.length; k++) if (picked.has(order[k]) && !picked.has(order[k - 1])) [order[k - 1], order[k]] = [order[k], order[k - 1]];
  } else {
    for (let k = order.length - 2; k >= 0; k--) if (picked.has(order[k]) && !picked.has(order[k + 1])) [order[k], order[k + 1]] = [order[k + 1], order[k]];
  }
  return { body: order.map((i) => body[i]), indices: order.flatMap((i, k) => (picked.has(i) ? [k] : [])) };
}

/**
 * Moves several blocks together, in their order, to sit before the block now at `at` (the body's length:
 * the end): a dragged selection. Returns the body and where the moved blocks are now.
 */
export function moveGroupTo<T>(body: T[], indices: number[], at: number): { body: T[]; indices: number[] } {
  const picked = new Set(indices.filter((i) => i >= 0 && i < body.length));
  const group = body.filter((_, i) => picked.has(i));
  const rest = body.filter((_, i) => !picked.has(i));
  const slot = Math.max(0, Math.min(rest.length, at - [...picked].filter((i) => i < at).length));
  return { body: [...rest.slice(0, slot), ...group, ...rest.slice(slot)], indices: group.map((_, k) => slot + k) };
}

/** Removes several blocks. */
export const removeMany = <T>(body: T[], indices: number[]): T[] => {
  const picked = new Set(indices);
  return body.filter((_, i) => !picked.has(i));
};

/**
 * Splits a text block (Enter, or a paste with blank lines): the first part stays, the rest become new
 * text blocks after it. Empty parts are dropped, except that an Enter at the end leaves nothing after
 * (the editor opens a pending paragraph instead).
 */
export function split(body: Body, at: number, parts: string[]): Body {
  const b = body[at];
  if (!b || (b.type !== 'text' && b.type !== 'heading' && b.type !== 'subheading' && b.type !== 'marker')) return body;
  const [first, ...rest] = parts;
  const head: Block = b.type === 'text' ? { ...b, markdown: first } : { ...b, text: plainLines(first) };
  const tail: Block[] = rest.filter((p) => p.trim()).map((markdown) => ({ type: 'text', markdown }));
  const keepHead = b.type !== 'text' ? !!(head as { text: string }).text : !!first.trim();
  return [...body.slice(0, at), ...(keepHead ? [head] : []), ...tail, ...body.slice(at + 1)];
}

/** Plain words as a heading's or a subheading's text: each line's spaces collapsed, empty lines dropped. */
const plainLines = (text: string) =>
  text
    .split('\n')
    .map((l) => plainText(l).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

/** Joins a text block to the text block before it (Backspace at its start). */
export function merge(body: Body, at: number): Body {
  const prev = body[at - 1];
  const cur = body[at];
  if (!prev || !cur || prev.type !== 'text' || cur.type !== 'text') return body;
  const joined: Block = { ...prev, markdown: `${prev.markdown.replace(/\s+$/, '')}${cur.markdown.replace(/^\s+/, '')}` };
  return [...body.slice(0, at - 1), joined, ...body.slice(at + 1)];
}

/** Sets a value at a path (`body.3.caption`), immutably; `undefined` or an empty string removes an optional key. */
export function setPath<T>(doc: T, path: string, value: unknown): T {
  const keys = path.split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  const walk = (node: unknown, i: number): unknown => {
    const k = keys[i];
    const base = (Array.isArray(node) ? [...node] : { ...(node as object) }) as Record<string | number, unknown>;
    if (i === keys.length - 1) {
      if (value === undefined || value === '') delete base[k];
      else base[k] = value;
    } else base[k] = walk(base[k] ?? (typeof keys[i + 1] === 'number' ? [] : {}), i + 1);
    return base;
  };
  return walk(doc, 0) as T;
}

export function getPath(doc: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((n, k) => (n == null ? undefined : (n as Record<string, unknown>)[k]), doc);
}

const KIND_LABEL: Record<Block['type'], string> = {
  text: 'Paragraph',
  heading: 'Heading',
  subheading: 'Subheading',
  marker: 'Section marker',
  figure: 'Picture',
  gallery: 'Gallery',
  carousel: 'Carousel',
  video: 'Video',
  quote: 'Quote',
  divider: 'Divider',
  collection: 'Collection',
  table: 'Table',
};

/** The block's kind as the editor names it ("Heading 2", "Paragraph"). */
export function kindOf(b: Block): string {
  if (b.type === 'heading') return `Heading ${b.level}`;
  if (b.type === 'text' && /^\s*([-*]|\d+\.) /.test(b.markdown)) return 'List';
  return KIND_LABEL[b.type];
}

/** A few words that say which block this is, for the outline and announcements. */
export function excerptOf(b: Block, alt: (mediaId: string) => string | undefined = () => undefined, max = 60): string {
  const cut = (s: string) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
  switch (b.type) {
    case 'text':
      return cut(plainText(b.markdown).replace(/\s+/g, ' ').trim());
    case 'heading':
    case 'subheading':
    case 'marker':
    case 'quote':
      return cut(b.text.replace(/\n/g, ' '));
    case 'figure':
      return cut(alt(b.media) ?? b.media.split('/').pop()!);
    case 'gallery':
    case 'carousel':
      return `${b.items.length} pictures`;
    case 'video':
      return cut(b.title ?? (b.media ? (alt(b.media) ?? b.media.split('/').pop()!) : ''));
    case 'collection':
      return cut(b.items.map((i) => i.heading ?? i.subtext ?? i.when ?? (i.text ? plainText(i.text) : i.media ? (alt(i.media) ?? i.media.split('/').pop()!) : '')).join(', '));
    case 'table':
      return cut(b.caption ?? b.columns.map((c) => plainText(c)).join(', '));
    case 'divider':
      return '';
  }
}

/** Whether an edit to the article counts as a change of its words or blocks (§9: it moves "Updated" on). */
export function isMeaningful(before: Article, after: Article): boolean {
  const pick = (a: Article) => JSON.stringify([a.title, a.summary, a.hero, a.body]);
  return pick(before) !== pick(after);
}

/** A text block's Markdown is one paragraph or one list (the contract's rule): true if it would be more. */
export const tooManyParagraphs = (markdown: string) => parseMarkdown(markdown).length > 1;

/**
 * Where a dragged row lands: the position among the rows (their vertical middles, in order) that the
 * pointer is before. Returns the index the block ends up at, or -1 if it wouldn't move.
 */
export function dropTarget(middles: number[], y: number, from: number): number {
  let at = middles.findIndex((m) => y < m);
  if (at < 0) at = middles.length;
  const to = at > from ? at - 1 : at;
  return to === from ? -1 : to;
}

/** A YouTube or Vimeo address as the video block's embed, or null. */
export function parseVideo(url: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  const u = url.trim();
  let m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{6,})/i.exec(u);
  if (m) return { provider: 'youtube', id: m[1] };
  m = /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/i.exec(u);
  if (m) return { provider: 'vimeo', id: m[1] };
  return null;
}

/** "2:20" or "140" as seconds; empty is undefined; anything else is null (not a length). */
export function parseDuration(text: string): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$|^(\d+):(\d{2})$|^(\d+)$/.exec(t);
  if (!m) return null;
  if (m[6]) return Number(m[6]) || null;
  if (m[4] !== undefined) return Number(m[4]) * 60 + Number(m[5]) || null;
  return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) || null;
}

// ---------- turning text into another kind (documentation/editor/spec.md §3.3) ----------

/** The kinds a text block can be turned into, and back, at any time. */
export type TextKind = 'paragraph' | 'heading-2' | 'heading-3' | 'heading-4' | 'subheading' | 'marker' | 'quote' | 'pull-quote' | 'bulleted' | 'numbered';

export const TEXT_KINDS: { value: TextKind; label: string; what: string }[] = [
  { value: 'paragraph', label: 'Paragraph', what: 'Words, with bold, italic and links' },
  { value: 'heading-2', label: 'Heading 2', what: 'A section' },
  { value: 'heading-3', label: 'Heading 3', what: 'Within a section' },
  { value: 'heading-4', label: 'Heading 4', what: 'A small heading' },
  { value: 'subheading', label: 'Subheading', what: 'A line more about the heading above' },
  { value: 'marker', label: 'Section marker', what: 'A big number or word, like Chapter 1' },
  { value: 'quote', label: 'Quote', what: 'A quotation in the column' },
  { value: 'pull-quote', label: 'Pull quote', what: 'A line lifted out and set large' },
  { value: 'bulleted', label: 'Bulleted list', what: 'One item a line' },
  { value: 'numbered', label: 'Numbered list', what: 'One item a line, in order' },
];

/** The text kind a block is, or null for a block that isn't text (a picture, a collection, a divider). */
export function textKindOf(b: Block): TextKind | null {
  if (b.type === 'heading') return `heading-${b.level}`;
  if (b.type === 'subheading') return 'subheading';
  if (b.type === 'marker') return 'marker';
  if (b.type === 'quote') return b.variant === 'pull' ? 'pull-quote' : 'quote';
  if (b.type !== 'text') return null;
  const first = parseMarkdown(b.markdown)[0];
  return first?.t === 'ul' ? 'bulleted' : first?.t === 'ol' ? 'numbered' : 'paragraph';
}

const words = (nodes: Inline[]): string => nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : n.t === 'br' ? ' ' : words(n.c))).join('');

/** A text block's words as lines: a paragraph's lines (split at its line breaks), a list's items, a heading's or a quote's text. */
export function linesOf(b: Block): Inline[][] {
  const kept = (lines: Inline[][]) => lines.filter((l) => words(l).trim());
  if (b.type === 'text')
    return kept(
      parseMarkdown(b.markdown).flatMap((m) => {
        if (m.t !== 'p') return m.items;
        const lines: Inline[][] = [[]];
        for (const n of m.c) {
          if (n.t === 'br') lines.push([]);
          else lines[lines.length - 1].push(n);
        }
        return lines;
      }),
    );
  if (b.type === 'heading' || b.type === 'subheading' || b.type === 'marker' || b.type === 'quote') return kept(b.text.split(/\n+/).map((l): Inline[] => [{ t: 'text', v: l.trim() }]));
  return [];
}

/**
 * Lines as a block of a text kind. A paragraph keeps its marks and puts each line on its own (a line
 * break between them); a list makes each line an item; a heading or a subheading takes the plain words,
 * a line each (a line break between them); a quote takes them on one line. A heading keeps its anchor, and a quote its source, when it only changes level or style.
 */
export function toTextKind(lines: Inline[][], to: TextKind, from?: Block): Block {
  const kept = lines.map((l) => words(l).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const plain = kept.join(' ');
  if (to === 'paragraph') return { type: 'text', markdown: serializeBlocks([{ t: 'p', c: lines.flatMap((l, k): Inline[] => (k ? [{ t: 'br' }, ...l] : l)) }]) };
  if (to === 'bulleted' || to === 'numbered') return { type: 'text', markdown: serializeBlocks([{ t: to === 'bulleted' ? 'ul' : 'ol', items: lines }]) };
  if (to === 'quote' || to === 'pull-quote') return { type: 'quote', variant: to === 'pull-quote' ? 'pull' : 'block', text: plain, ...(from?.type === 'quote' && from.cite ? { cite: from.cite } : {}) };
  // a heading and a subheading keep the lines (a line break each)
  if (to === 'subheading') return { type: 'subheading', text: kept.join('\n') };
  if (to === 'marker') return { type: 'marker', text: kept.join('\n').slice(0, 60) };
  // a heading keeps its anchor and its mark (and whether it's shown) while only its level changes
  const keep = from?.type === 'heading' ? { ...(from.id ? { id: from.id } : {}), ...(from.marker ? { marker: from.marker } : {}), ...(from.showMarker === false ? { showMarker: false } : {}) } : {};
  return { type: 'heading', level: Number(to.slice(-1)) as 2 | 3 | 4, text: kept.join('\n'), ...keep };
}

/** A text block turned into another text kind, keeping its words (a block that isn't text is left as it is). */
export const convertText = (b: Block, to: TextKind): Block => (textKindOf(b) === null ? b : toTextKind(linesOf(b), to, b));

/** A list, or a paragraph of several lines, as one paragraph a line (null if it has one line). */
export function splitLines(b: Block): Block[] | null {
  const lines = linesOf(b);
  if (b.type !== 'text' || lines.length < 2) return null;
  return lines.map((l) => ({ type: 'text', markdown: serializeBlocks([{ t: 'p', c: l }]) }));
}

/** Several text blocks as one list: each block's lines become its items. */
export const joinAsList = (blocks: Block[], ordered: boolean): Block => toTextKind(blocks.flatMap(linesOf), ordered ? 'numbered' : 'bulleted');

/**
 * Text as a collection, laid out as tiles: heading and text pairs (a heading, or a short line, then its
 * words), one to twelve times; or one text block alone, as a single item (a heading as its heading,
 * anything else as its words). Returns why not when the blocks are neither.
 */
export function asCollection(blocks: Block[]): { ok: true; block: Block } | { ok: false; why: string } {
  if (blocks.length === 1) {
    const [b] = blocks;
    if (textKindOf(b) === null) return { ok: false, why: 'Only text becomes a collection: headings, paragraphs, quotes and lists.' };
    const name = linesOf(b).map(words).join(' ').replace(/\s+/g, ' ').trim();
    if (b.type === 'heading') {
      if (!name || name.length > 80) return { ok: false, why: `An item's heading is at most 80 characters: "${name.slice(0, 80)}…" is longer.` };
      return { ok: true, block: { type: 'collection', layout: 'tiles', items: [{ heading: name }], width: 'popout' } };
    }
    return { ok: true, block: { type: 'collection', layout: 'tiles', items: [{ text: (toTextKind(linesOf(b), 'paragraph') as { markdown: string }).markdown }], width: 'popout' } };
  }
  if (blocks.length % 2 || blocks.length < 2 || blocks.length > 24) return { ok: false, why: 'A collection comes from one text block, or from pairs: a heading (or a short line), then its words, up to twelve times.' };
  const items: { heading: string; text: string }[] = [];
  for (let k = 0; k < blocks.length; k += 2) {
    const [heading, text] = [blocks[k], blocks[k + 1]];
    if (textKindOf(heading) === null || textKindOf(text) === null) return { ok: false, why: 'Only text becomes a collection: headings, paragraphs, quotes and lists.' };
    const name = linesOf(heading).map(words).join(' ').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 80) return { ok: false, why: `An item's heading is at most 80 characters: "${name.slice(0, 80)}…" is longer.` };
    items.push({ heading: name, text: (toTextKind(linesOf(text), 'paragraph') as { markdown: string }).markdown });
  }
  return { ok: true, block: { type: 'collection', layout: 'tiles', items, width: 'popout' } };
}

/**
 * A collection back as blocks: for each item, its picture, a heading (level 3), its time in bold (as a
 * timeline's item reads on a résumé) and a paragraph for its subtext and its words.
 */
export function collectionToText(b: Block): Block[] | null {
  if (b.type !== 'collection') return null;
  return b.items.flatMap((i): Block[] => [
    ...(i.media ? [{ type: 'figure', media: i.media, width: 'content' } as Block] : []),
    ...(i.heading ? [{ type: 'heading', level: 3, text: i.heading } as Block] : []),
    ...(i.when ? [{ type: 'text', markdown: `**${i.when}**` } as Block] : []),
    ...(i.subtext ? [{ type: 'text', markdown: i.subtext } as Block] : []),
    ...(i.text ? paragraphsOf(i.text).map((markdown) => ({ type: 'text', markdown }) as Block) : []),
  ]);
}

/**
 * The text kind a key asks for, by the key's place (Shift + 7 types "&"): Ctrl or Cmd + Alt + 0 a
 * paragraph, + 2, 3 or 4 a heading of that level; Ctrl or Cmd + Shift + 7 a numbered list, 8 a bulleted
 * list, 9 a quote. Null for any other key.
 */
export function turnShortcut(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; code: string }): TextKind | null {
  if (!(e.ctrlKey || e.metaKey)) return null;
  const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1];
  if (!d) return null;
  if (e.altKey && !e.shiftKey) return d === '0' ? 'paragraph' : ['2', '3', '4'].includes(d) ? (`heading-${d}` as TextKind) : null;
  if (e.shiftKey && !e.altKey) return d === '7' ? 'numbered' : d === '8' ? 'bulleted' : d === '9' ? 'quote' : null;
  return null;
}
