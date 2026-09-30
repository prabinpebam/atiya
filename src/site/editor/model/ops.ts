/**
 * Document operations on an article's blocks (documentation/editor/spec.md §3): pure and immutable, so
 * the editor applies them in the browser and the unit tests hold them. The server checks the result
 * against the contract; these only keep the shape right.
 */
import type { Article, Block } from '../../content/schema';
import { parseMarkdown, plainText } from '../../content/markdown';

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

/**
 * Splits a text block (Enter, or a paste with blank lines): the first part stays, the rest become new
 * text blocks after it. Empty parts are dropped, except that an Enter at the end leaves nothing after
 * (the editor opens a pending paragraph instead).
 */
export function split(body: Body, at: number, parts: string[]): Body {
  const b = body[at];
  if (!b || (b.type !== 'text' && b.type !== 'heading')) return body;
  const [first, ...rest] = parts;
  const head: Block = b.type === 'text' ? { ...b, markdown: first } : { ...b, text: plainText(first).replace(/\s+/g, ' ').trim() };
  const tail: Block[] = rest.filter((p) => p.trim()).map((markdown) => ({ type: 'text', markdown }));
  const keepHead = b.type === 'heading' ? !!(head as { text: string }).text : !!first.trim();
  return [...body.slice(0, at), ...(keepHead ? [head] : []), ...tail, ...body.slice(at + 1)];
}

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
  figure: 'Picture',
  gallery: 'Gallery',
  carousel: 'Carousel',
  video: 'Video',
  quote: 'Quote',
  divider: 'Divider',
  facts: 'Facts',
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
    case 'quote':
      return cut(b.text);
    case 'figure':
      return cut(alt(b.media) ?? b.media.split('/').pop()!);
    case 'gallery':
    case 'carousel':
      return `${b.items.length} pictures`;
    case 'video':
      return cut(b.title);
    case 'facts':
      return cut(b.items.map((i) => i.value).join(', '));
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
