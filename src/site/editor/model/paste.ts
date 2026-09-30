/**
 * Pasting Markdown on the canvas (documentation/editor/spec.md §3.2): text copied from a Markdown file,
 * a note or a chat arrives as the blocks it describes, not as its marks. Pure, so the unit tests hold it.
 *
 * - `#` and `##` make a heading 2 (the page's title is its one H1), `###` a heading 3, and `####` or more
 *   a heading 4; a heading keeps only its words (`### **Challenge**` is "Challenge"). A line of `=` or
 *   `-` under a paragraph makes it a heading 2 too.
 * - A paragraph's lines join into one (the lines of a hard-wrapped file are one paragraph); a line that
 *   ends with a backslash or two spaces keeps its break, as the site's Markdown does.
 * - `-`, `*`, `+` and `1.` lines make a list; `>` lines a quote, whose last line becomes its source when
 *   it starts with a dash (`— A wise person`); `---`, `***` or `___` a divider.
 * - Code fences keep their lines as code, one line each. Pictures (`![…](…)`) are left out: they come
 *   from the media library. A link the site can't follow (only https, http and mailto) keeps its words.
 */
import type { Block } from '../../content/schema';
import { parseInline, parseMarkdown, plainText, serializeBlocks, type Inline, type MdBlock } from '../../content/markdown';
import type { Body } from './ops';

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const ITEM = /^ {0,3}([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const PICTURE = /!\[[^\]]*\]\([^)]*\)/g;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const CITE = /^(?:—|–|--)\s*(.+)$/;

const words = (nodes: Inline[]): string => nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : n.t === 'br' ? ' ' : words(n.c))).join('');
const plainLine = (md: string) => words(parseInline(md.trim())).replace(/\s+/g, ' ').trim();

/** Links the site can't follow keep their words (rendering would refuse them). */
const safeLinks = (nodes: Inline[]): Inline[] =>
  nodes.flatMap((n): Inline[] => {
    if (n.t === 'link') return SAFE_HREF.test(n.href) ? [{ ...n, c: safeLinks(n.c) }] : safeLinks(n.c);
    if (n.t === 'strong' || n.t === 'em') return [{ ...n, c: safeLinks(n.c) }];
    return [n];
  });

const textBlock = (md: MdBlock): Block | null => {
  const markdown = serializeBlocks([md]);
  return markdown.trim() ? { type: 'text', markdown } : null;
};

/** A paragraph's lines as one paragraph: soft wraps become spaces, hard breaks (`\` or two spaces) stay. */
function paragraph(lines: string[]): Block | null {
  const md = lines
    .map((l, k) => {
      const last = k === lines.length - 1;
      const line = l.replace(/^\s+/, '');
      if (last) return line.trimEnd();
      return /(\\| {2,})$/.test(line) ? `${line.replace(/ {2,}$/, '  ')}\n` : `${line.trimEnd()} `;
    })
    .join('');
  return textBlock({ t: 'p', c: safeLinks(parseInline(md)) });
}

/** A fenced block's lines as code, a line each (the site's Markdown has code spans, not code blocks). */
function codeBlock(lines: string[]): Block | null {
  const code = lines.filter((l) => l.trim());
  return code.length ? textBlock({ t: 'p', c: code.flatMap((v, k): Inline[] => (k ? [{ t: 'br' }, { t: 'code', v }] : [{ t: 'code', v }])) }) : null;
}

export interface Pasted {
  blocks: Block[];
  /** Pictures left out (they come from the media library). */
  pictures: number;
}

/** Pasted Markdown as the article's blocks. */
export function blocksFromMarkdown(text: string): Pasted {
  const source = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const pictures = source.match(PICTURE)?.length ?? 0;
  const lines = source.replace(PICTURE, '').split('\n');
  const out: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] | null = null;
  let fence: { mark: string; lines: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      const b = paragraph(para);
      if (b) out.push(b);
    }
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((i) => safeLinks(parseInline(i.trim()))).filter((i) => words(i).trim());
      const b = items.length ? textBlock({ t: list.ordered ? 'ol' : 'ul', items }) : null;
      if (b) out.push(b);
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote) {
      const kept = quote.map(plainLine).filter(Boolean);
      const cite = kept.length > 1 ? CITE.exec(kept[kept.length - 1]) : null;
      const said = (cite ? kept.slice(0, -1) : kept).join(' ');
      if (said) out.push({ type: 'quote', variant: 'block', text: said, ...(cite ? { cite: cite[1].trim() } : {}) });
    }
    quote = null;
  };
  const flush = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (fence) {
      if (line.trimStart().startsWith(fence.mark)) {
        const b = codeBlock(fence.lines);
        if (b) out.push(b);
        fence = null;
      } else fence.lines.push(line);
      continue;
    }
    const f = FENCE.exec(line);
    if (f) {
      flush();
      fence = { mark: f[1], lines: [] };
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (para.length && SETEXT.test(line)) {
      const title = plainLine(para.join(' '));
      para = [];
      if (title) out.push({ type: 'heading', level: 2, text: title });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      const title = plainLine(h[2] ?? '');
      if (title) out.push({ type: 'heading', level: Math.min(Math.max(h[1].length, 2), 4) as 2 | 3 | 4, text: title });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      if (out.length && out[out.length - 1].type !== 'divider') out.push({ type: 'divider' });
      continue;
    }
    const q = QUOTE.exec(line);
    if (q) {
      flushPara();
      flushList();
      (quote ??= []).push(q[1].replace(/^(?:[ \t]*>)+[ \t]?/, ''));
      continue;
    }
    const i = ITEM.exec(line);
    // a numbered line breaks into a paragraph only as a list's first item ("1."), as in CommonMark
    if (i && !(para.length && /^\d/.test(i[1]) && parseInt(i[1], 10) !== 1)) {
      flushPara();
      flushQuote();
      const ordered = /\d/.test(i[1]);
      if (list && list.ordered !== ordered) flushList();
      (list ??= { ordered, items: [] }).items.push(i[2]);
      continue;
    }
    if (list) {
      // a line under an item continues it (indented or not, as in CommonMark)
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushQuote();
    para.push(line);
  }
  if (fence) {
    const b = codeBlock(fence.lines);
    if (b) out.push(b);
  }
  flush();
  while (out[out.length - 1]?.type === 'divider') out.pop();
  while (out[0]?.type === 'divider') out.shift();
  return { blocks: out, pictures };
}

const inlineOf = (md: string): Inline[] => {
  const b = parseMarkdown(md)[0];
  return b?.t === 'p' ? b.c : [];
};
const isParagraph = (b: Block | undefined): b is Extract<Block, { type: 'text' }> => b?.type === 'text' && parseMarkdown(b.markdown)[0]?.t === 'p';
/** Two pieces of a paragraph as one, spaces at the seam kept (the caret may sit after a space). */
const join = (a: string, b: string): string => serializeBlocks([{ t: 'p', c: [...parseInline(a), ...parseInline(b)] }]);
/** The words either side of the caret as a paragraph of their own. */
const alone = (md: string): Block => ({ type: 'text', markdown: serializeBlocks(parseMarkdown(md)) });

/**
 * What a paste is: `nothing` the site can show (blank, or only pictures); `words`, one paragraph of plain
 * words that the canvas types in place; or `blocks`, anything more, which a paragraph takes as blocks.
 */
export function pasteKind(text: string): 'nothing' | 'words' | 'blocks' {
  const { blocks } = blocksFromMarkdown(text);
  if (!blocks.length) return 'nothing';
  if (blocks.length > 1 || !isParagraph(blocks[0])) return 'blocks';
  return inlineOf(blocks[0].markdown).every((n) => n.t === 'text' || n.t === 'br') ? 'words' : 'blocks';
}

/** A paste's words without their marks, a paragraph each block: for a heading, a quote or a caption. */
export const wordsOfPaste = (text: string): string =>
  blocksFromMarkdown(text)
    .blocks.map((b) => (b.type === 'text' ? plainText(b.markdown) : b.type === 'heading' || b.type === 'quote' ? b.text : ''))
    .filter((w) => w.trim())
    .join('\n\n');

/**
 * Pasted blocks placed at the caret in a paragraph: what was before the caret joins the first pasted
 * paragraph (or stays a paragraph of its own before a heading, a list or a quote), and what was after it
 * joins the last. `replace` is the paragraph being edited; without it (a new paragraph that isn't in the
 * article yet) the blocks go in at `at`. Returns where the caret goes: the end of what was pasted.
 */
export function pasteAt(body: Body, at: number, where: { replace: boolean; before: string; after: string }, pasted: Block[]): { body: Body; focus: number; caret: number | 'end' } {
  if (!pasted.length) return { body, focus: at, caret: 'end' };
  const out = [...pasted];
  const before = where.before.trim() ? where.before : '';
  const after = where.after.trim() ? where.after : '';
  if (before) {
    if (isParagraph(out[0])) out[0] = { type: 'text', markdown: join(before, out[0].markdown) };
    else out.unshift(alone(before));
  }
  const last = out.length - 1;
  let caret: number | 'end' = 'end';
  const lastBlock = out[last];
  if (after) {
    if (isParagraph(lastBlock)) {
      caret = plainText(lastBlock.markdown).length;
      out[last] = { type: 'text', markdown: join(lastBlock.markdown, after) };
    } else out.push(alone(after));
  }
  const next = [...body.slice(0, at), ...out, ...body.slice(where.replace ? at + 1 : at)];
  return { body: next, focus: at + last, caret };
}
