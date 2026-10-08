/**
 * The Markdown subset allowed inside content blocks (documentation/content/model.md §6), as one inline
 * tree with one parser, one renderer and one serializer, so what the editor writes back is exactly what
 * the site renders (documentation/editor/spec.md §3.2, §9).
 *
 * - Blocks: paragraphs, and bulleted or numbered lists (every line "- " or "1. "). A list nests: a line indented
 *   under the item above (to where that item's words start) is an item of a list inside it, bulleted or
 *   numbered as its own marker says, up to three levels.
 * - Inline: text, **strong**, *emphasis* (or _emphasis_ between words), ~~struck through~~, `code`
 *   (``code with a ` ``), [links](https://…) and hard line breaks (a backslash, or two spaces, at the end of a
 *   line). Strong, emphasis and strikethrough may nest; code holds plain text; a link holds text and marks.
 * - Escapes: a backslash before \ * _ ~ ` [ ] - . makes it literal.
 *
 * Everything else is text: HTML is escaped, so raw markup can never reach a page.
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'del'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'br' };

/**
 * A block: a paragraph, or a list. A list's items are in reading order; a nested list keeps each item's
 * level (`depth`, 0 for the list's own items, at most `LIST_DEPTH_MAX`) and the kind of the list it's in
 * (`kinds`), both left out when nothing is nested, so a flat list is just its items.
 */
export type MdBlock = { t: 'p'; c: Inline[] } | { t: 'ul' | 'ol'; items: Inline[][]; depth?: number[]; kinds?: ('ul' | 'ol')[] };
export type MdList = Extract<MdBlock, { t: 'ul' | 'ol' }>;

/** The deepest a list nests: its own items at 0, then two lists inside. */
export const LIST_DEPTH_MAX = 2;

export interface MarkdownOptions {
  /** Turns a ref: link (`ref:caseStudy/some-id`) into an href; an unknown ref is an error. */
  resolveRef?: (ref: string) => string | undefined;
  /** Keeps each link's written target on it (data-md-href), so the editor can write it back unchanged. */
  annotate?: boolean;
}

const ESCAPABLE = new Set(['\\', '*', '_', '~', '`', '[', ']', '-', '.']);
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const WORD = /[\p{L}\p{N}_]/u;
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isWord = (c: string | undefined) => c !== undefined && WORD.test(c);

// ---------- parsing ----------

/** Where the code span or link starting at `i` ends (the index after it), or -1. */
function codeEnd(s: string, i: number): { end: number; v: string } | null {
  let n = 0;
  while (s[i + n] === '`') n++;
  const fence = '`'.repeat(n);
  let j = i + n;
  while ((j = s.indexOf(fence, j)) >= 0) {
    if (s[j + n] !== '`' && s[j - 1] !== '`') {
      let v = s.slice(i + n, j);
      if (n > 1 && v.length > 2 && v.startsWith(' ') && v.endsWith(' ') && v.trim()) v = v.slice(1, -1);
      return { end: j + n, v };
    }
    j += n;
  }
  return null;
}

function linkEnd(s: string, i: number): { end: number; label: string; href: string } | null {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === '`') {
      const code = codeEnd(s, j);
      if (code) j = code.end - 1;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']' && --depth === 0) {
      const m = /^\(([^()\s]+)\)/.exec(s.slice(j + 1));
      return m ? { end: j + 1 + m[0].length, label: s.slice(i + 1, j), href: m[1] } : null;
    }
  }
  return null;
}

function push(out: Inline[], node: Inline) {
  const last = out[out.length - 1];
  if (node.t === 'text' && last?.t === 'text') last.v += node.v;
  else if (node.t !== 'text' || node.v) out.push(node);
}

/** A run of * or _ that may open or close emphasis (CommonMark's delimiter run, with the site's own flanking). */
interface Delim {
  ch: '*' | '_' | '~';
  count: number;
  open: boolean;
  close: boolean;
}
type Item = Inline | Delim;
const isDelim = (x: Item): x is Delim => 'ch' in x;

/**
 * The inline tree of a line of Markdown. Code spans, links and escapes are read first; emphasis is then
 * matched from the delimiter runs as CommonMark does (nearest opener, strong when both runs have two, and
 * the rule of three), so `***x***`, `**a *b***` and `*a **b***` all read as they look. Flanking is the
 * site's: `*` opens before a non-space and closes after one (so it works inside words); `_` only opens and
 * closes between words.
 */
export function parseInline(s: string, inLink = false): Inline[] {
  const items: Item[] = [];
  const text = (v: string) => {
    const last = items[items.length - 1];
    if (last && !isDelim(last) && last.t === 'text') last.v += v;
    else if (v) items.push({ t: 'text', v });
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const next = s[i + 1];
      if (next === '\n') {
        items.push({ t: 'br' });
        i += 2;
      } else if (next !== undefined && ESCAPABLE.has(next)) {
        text(next);
        i += 2;
      } else {
        text(c);
        i++;
      }
      continue;
    }
    if (c === ' ' && /^ {2,}\n/.test(s.slice(i))) {
      items.push({ t: 'br' });
      i = s.indexOf('\n', i) + 1;
      continue;
    }
    if (c === '`') {
      const code = codeEnd(s, i);
      if (code) {
        items.push({ t: 'code', v: code.v });
        i = code.end;
      } else {
        let n = 0;
        while (s[i + n] === '`') n++;
        text('`'.repeat(n));
        i += n;
      }
      continue;
    }
    if (c === '[' && !inLink) {
      const link = linkEnd(s, i);
      if (link) {
        items.push({ t: 'link', href: link.href, c: parseInline(link.label, true) });
        i = link.end;
        continue;
      }
    }
    if (c === '~' && s[i + 1] === '~') {
      // ~~struck through~~: a run of two or more, opening before a non-space and closing after one
      let n = 0;
      while (s[i + n] === '~') n++;
      const open = !isSpace(s[i + n]);
      const close = i > 0 && !isSpace(s[i - 1]);
      if (open || close) items.push({ ch: '~', count: n, open, close });
      else text('~'.repeat(n));
      i += n;
      continue;
    }
    if (c === '*' || c === '_') {
      let n = 0;
      while (s[i + n] === c) n++;
      const before = s[i - 1];
      const after = s[i + n];
      const open = c === '*' ? !isSpace(after) : !isSpace(after) && !isWord(before);
      const close = c === '*' ? i > 0 && !isSpace(before) : i > 0 && !isSpace(before) && !isWord(after);
      if (open || close) items.push({ ch: c, count: n, open, close });
      else text(c.repeat(n));
      i += n;
      continue;
    }
    text(c);
    i++;
  }

  // match closers to openers, innermost first
  for (let ci = 0; ci < items.length; ci++) {
    const closer = items[ci];
    if (!isDelim(closer) || !closer.close || closer.count === 0) continue;
    let oi = ci - 1;
    for (; oi >= 0; oi--) {
      const o = items[oi];
      if (!isDelim(o) || o.ch !== closer.ch || !o.open || o.count === 0) continue;
      if (o.ch === '~') {
        if (o.count < 2 || closer.count < 2) continue;
        break;
      }
      const either = (o.open && o.close) || (closer.open && closer.close);
      if (either && (o.count + closer.count) % 3 === 0 && !(o.count % 3 === 0 && closer.count % 3 === 0)) continue;
      break;
    }
    if (oi < 0) continue;
    const opener = items[oi] as Delim;
    const use = opener.count >= 2 && closer.count >= 2 ? 2 : 1;
    opener.count -= use;
    closer.count -= use;
    const node: Inline = { t: closer.ch === '~' ? 'del' : use === 2 ? 'strong' : 'em', c: flatten(items.slice(oi + 1, ci)) };
    items.splice(oi + 1, ci - oi - 1, node);
    ci = oi + 1; // the loop moves on to this closer again, in case it has more to give
  }
  return flatten(items);
}

function flatten(items: Item[]): Inline[] {
  const out: Inline[] = [];
  for (const x of items) push(out, isDelim(x) ? { t: 'text', v: x.ch.repeat(x.count) } : x);
  return out;
}

const ITEM = /^( *)([-*]|\d+\.) (.*)$/;

/**
 * A paragraph's lines as a list, or null when they aren't one. Every line is an item ("- " or "1. "); a
 * line indented past the item before it opens a list inside that item (its own marker says which kind),
 * one level at a time and no deeper than LIST_DEPTH_MAX; a line indented less goes back out to the level
 * it lines up with. The list's own items must all be of its kind, as before nesting was allowed.
 */
function parseList(lines: string[]): MdList | null {
  const found = lines.map((l) => ITEM.exec(l));
  if (!found.every(Boolean)) return null;
  const kindOf = (m: RegExpExecArray) => (/\d/.test(m[2]) ? 'ol' : 'ul') as 'ul' | 'ol';
  const top = kindOf(found[0]!);
  const indents: number[] = [];
  const runKind: ('ul' | 'ol')[] = [];
  const depth: number[] = [];
  const kinds: ('ul' | 'ol')[] = [];
  for (const m of found as RegExpExecArray[]) {
    const indent = m[1].length;
    if (!indents.length) indents.push(indent);
    else if (indent > indents[indents.length - 1]) {
      if (indents.length <= LIST_DEPTH_MAX) {
        indents.push(indent);
        runKind[indents.length - 1] = kindOf(m);
      }
    } else while (indents.length > 1 && indent < indents[indents.length - 1]) indents.pop();
    const d = indents.length - 1;
    if (d === 0 && kindOf(m) !== top) return null;
    depth.push(d);
    kinds.push(d === 0 ? top : runKind[d]);
  }
  const items = (found as RegExpExecArray[]).map((m) => parseInline(m[3]));
  return depth.some((d) => d > 0) ? { t: top, items, depth, kinds } : { t: top, items };
}

export function parseMarkdown(md: string): MdBlock[] {
  return md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n[ \t]*\n/)
    .filter((p) => p.trim())
    .map((para): MdBlock => parseList(para.split('\n')) ?? { t: 'p', c: parseInline(para) });
}

/** A list as a tree: each item with the list nested in it, if any (what the page draws). */
export interface ListTree {
  t: 'ul' | 'ol';
  items: { c: Inline[]; sub?: ListTree }[];
}

export function listTree(b: MdList): ListTree {
  const root: ListTree = { t: b.t, items: [] };
  const open: ListTree[] = [root];
  b.items.forEach((c, i) => {
    const d = Math.min(b.depth?.[i] ?? 0, open.length, LIST_DEPTH_MAX);
    while (open.length > d + 1) open.pop();
    const here = open[open.length - 1];
    const parent = here.items[here.items.length - 1];
    if (d === open.length && parent) {
      parent.sub ??= { t: b.kinds?.[i] ?? b.t, items: [] };
      open.push(parent.sub);
    }
    open[open.length - 1].items.push({ c });
  });
  return root;
}

/** A tree back as a list's items with their levels and kinds (what's written). */
export function listOf(tree: ListTree): MdList {
  const items: Inline[][] = [];
  const depth: number[] = [];
  const kinds: ('ul' | 'ol')[] = [];
  const walk = (l: ListTree, d: number) => {
    for (const it of l.items) {
      items.push(it.c);
      depth.push(d);
      kinds.push(l.t);
      if (it.sub && d < LIST_DEPTH_MAX) walk(it.sub, d + 1);
      else if (it.sub) for (const x of listOf(it.sub).items) (items.push(x), depth.push(d), kinds.push(l.t));
    }
  };
  walk(tree, 0);
  return depth.some((d) => d > 0) ? { t: tree.t, items, depth, kinds } : { t: tree.t, items };
}

// ---------- rendering ----------

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderInline(nodes: Inline[], opts: MarkdownOptions): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case 'text':
          return escapeHtml(n.v);
        case 'strong':
          return `<strong>${renderInline(n.c, opts)}</strong>`;
        case 'em':
          return `<em>${renderInline(n.c, opts)}</em>`;
        case 'del':
          return `<del>${renderInline(n.c, opts)}</del>`;
        case 'code':
          return `<code>${escapeHtml(n.v)}</code>`;
        case 'br':
          return '<br>\n';
        case 'link': {
          let target: string | undefined;
          if (n.href.startsWith('ref:')) {
            target = opts.resolveRef?.(n.href.slice(4));
            if (!target) throw new Error(`unknown link target: ${n.href}`);
          } else if (SAFE_HREF.test(n.href)) target = n.href;
          else throw new Error(`links may only go to https, http, mailto or ref: (${n.href})`);
          const written = opts.annotate ? ` data-md-href="${escapeHtml(n.href)}"` : '';
          return `<a href="${escapeHtml(target)}"${written}>${renderInline(n.c, opts)}</a>`;
        }
      }
    })
    .join('');
}

export function renderBlocks(blocks: MdBlock[], opts: MarkdownOptions = {}): string {
  return blocks
    .map((b) => {
      if (b.t === 'p') return `<p>${renderInline(b.c, opts)}</p>`;
      const list = (l: ListTree): string => `<${l.t}>${l.items.map((i) => `<li>${renderInline(i.c, opts)}${i.sub ? list(i.sub) : ''}</li>`).join('')}</${l.t}>`;
      return list(listTree(b));
    })
    .join('\n');
}

/** The subset, as HTML. */
export function renderMarkdown(md: string, opts: MarkdownOptions = {}): string {
  return renderBlocks(parseMarkdown(md), opts);
}

/** A line of the subset (bold, italic, code, links, line breaks) as inline HTML, with no paragraph around it: a tile's statement. */
export function renderInlineMarkdown(md: string, opts: MarkdownOptions = {}): string {
  return renderInline(parseInline(md.replace(/\r\n/g, '\n').trim()), opts);
}

/** One styled stretch of a line: what a reader sees, whatever the nesting that made it. */
export interface Run {
  text?: string;
  br?: true;
  strong?: true;
  em?: true;
  del?: true;
  code?: true;
  href?: string;
}

/** A tree as the reader sees it: its styled runs, adjacent runs of the same style joined. Two trees mean the same when these match. */
export function runs(nodes: Inline[], style: Omit<Run, 'text' | 'br'> = {}): Run[] {
  const out: Run[] = [];
  const add = (r: Run) => {
    const last = out[out.length - 1];
    const same = last && last.text !== undefined && r.text !== undefined && last.strong === r.strong && last.em === r.em && last.del === r.del && last.code === r.code && last.href === r.href;
    if (same) last.text += r.text!;
    else if (r.br || r.text) out.push(r);
  };
  for (const n of nodes) {
    if (n.t === 'text') add({ ...style, text: n.v });
    else if (n.t === 'br') out.push({ br: true });
    else if (n.t === 'code') add({ ...style, code: true, text: n.v });
    else if (n.t === 'link') for (const r of runs(n.c, { ...style, href: n.href })) add(r);
    else for (const r of runs(n.c, { ...style, [n.t]: true })) add(r);
  }
  return out;
}

// ---------- serializing ----------

/**
 * The canonical tree, for comparing by meaning and for writing: adjacent text joined; empty marks and
 * text dropped; a mark inside the same mark flattened (bold in bold is bold); two runs of the same mark
 * side by side merged; spaces and breaks at a mark's edges moved outside it (as the serializer writes
 * them); and bold round a lone italic turned into italic round bold (what `***x***` reads as).
 */
export function normalize(nodes: Inline[], inside: { strong?: boolean; em?: boolean; del?: boolean } = {}): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    // a mark inside the same mark, at any depth, adds nothing
    if ((n.t === 'strong' && inside.strong) || (n.t === 'em' && inside.em) || (n.t === 'del' && inside.del)) {
      for (const x of normalize(n.c, inside)) push(out, x);
      continue;
    }
    if (n.t === 'strong' || n.t === 'em' || n.t === 'del' || n.t === 'link') {
      const c = normalize(n.c, n.t === 'link' ? inside : { ...inside, [n.t]: true });
      if (!c.length) continue;
      if (n.t !== 'link') {
        // spaces and line breaks at a mark's edges belong outside it
        const lead: Inline[] = [];
        const trail: Inline[] = [];
        while (c.length) {
          const f = c[0];
          if (f.t === 'br') lead.push(c.shift()!);
          else if (f.t === 'text' && /^\s/.test(f.v)) {
            const ws = /^\s+/.exec(f.v)![0];
            lead.push({ t: 'text', v: ws });
            f.v = f.v.slice(ws.length);
            if (!f.v) c.shift();
          } else break;
        }
        while (c.length) {
          const l = c[c.length - 1];
          if (l.t === 'br') trail.unshift(c.pop()!);
          else if (l.t === 'text' && /\s$/.test(l.v)) {
            const ws = /\s+$/.exec(l.v)![0];
            trail.unshift({ t: 'text', v: ws });
            l.v = l.v.slice(0, -ws.length);
            if (!l.v) c.pop();
          } else break;
        }
        for (const x of lead) push(out, x);
        const prev = out[out.length - 1];
        const node: Inline = n.t === 'strong' && c.length === 1 && c[0].t === 'em' ? { t: 'em', c: normalize([{ t: 'strong', c: c[0].c }], inside) } : { ...n, c };
        if (c.length && prev?.t === node.t) prev.c = normalize([...prev.c, ...(node as { c: Inline[] }).c], { ...inside, [node.t]: true });
        else if (c.length) out.push(node);
        for (const x of trail) push(out, x);
      } else out.push({ ...n, c });
    } else if (n.t === 'code') {
      const prev = out[out.length - 1];
      if (n.v && prev?.t === 'code') prev.v += n.v;
      else if (n.v) out.push({ ...n });
    } else push(out, n.t === 'text' ? { ...n } : n);
  }
  return out;
}

const escapeText = (v: string) =>
  v
    .replace(/[\\*_`[\]]/g, (c) => `\\${c}`)
    .replace(/~(?=~)|(?<=~)~/g, '\\~')
    .replace(/ +\n/g, '\n')
    .replace(/\n+/g, '\n')
    // a line that would read as a list item
    .replace(/(^|\n)(\s*)([-*])( )/g, '$1$2\\$3$4')
    .replace(/(^|\n)(\s*\d+)(\.)( )/g, '$1$2\\$3$4');

function mark(inner: string, d: string): string {
  if (!inner.trim()) return inner;
  const lead = /^\s*/.exec(inner)![0];
  const trail = /\s*$/.exec(inner)![0];
  return `${lead}${d}${inner.trim()}${d}${trail}`;
}

export function serializeInline(nodes: Inline[]): string {
  const list = normalize(nodes);
  let out = '';
  list.forEach((n, i) => {
    switch (n.t) {
      case 'text':
        out += escapeText(n.v);
        break;
      case 'strong':
        out += mark(serializeInline(n.c), '**');
        break;
      case 'del':
        out += mark(serializeInline(n.c), '~~');
        break;
      case 'em': {
        // "_" never merges with a strong's "**" into one run, so it's the clearer choice; inside a word
        // (un*believ*able) only "*" can open and close
        const next = list[i + 1];
        const inWord = isWord(out[out.length - 1]) || (next?.t === 'text' && isWord(next.v[0]));
        out += mark(serializeInline(n.c), inWord ? '*' : '_');
        break;
      }
      case 'code': {
        const v = n.v.replace(/\n/g, ' ');
        const longest = Math.max(0, ...(v.match(/`+/g) ?? []).map((r) => r.length));
        const fence = '`'.repeat(longest + 1);
        out += longest ? `${fence} ${v} ${fence}` : `${fence}${v}${fence}`;
        break;
      }
      case 'br':
        out += '\\\n';
        break;
      case 'link':
        out += `[${serializeInline(n.c.filter((c) => c.t !== 'link'))}](${n.href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
        break;
    }
  });
  return out;
}

/** A list's lines: each item indented to where its parent's words start, numbered within its own list. */
function serializeList(b: MdList): string {
  const lines: string[] = [];
  const walk = (l: ListTree, indent: number) =>
    l.items.forEach((it, n) => {
      const marker = l.t === 'ul' ? '-' : `${n + 1}.`;
      lines.push(`${' '.repeat(indent)}${marker} ${serializeInline(it.c)}`);
      if (it.sub) walk(it.sub, indent + marker.length + 1);
    });
  walk(listTree(b), 0);
  return lines.join('\n');
}

export function serializeBlocks(blocks: MdBlock[]): string {
  return blocks.map((b) => (b.t === 'p' ? serializeInline(b.c) : serializeList(b))).join('\n\n');
}

/** The words a reader reads: the subset with its markup taken off (for reading time and plain labels). */
export function plainText(md: string): string {
  const flat = (nodes: Inline[]): string => nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : n.t === 'br' ? '\n' : flat(n.c))).join('');
  return parseMarkdown(md)
    .map((b) => (b.t === 'p' ? flat(b.c) : b.items.map(flat).join('\n')))
    .join('\n\n');
}

/** Markdown as its blocks (a collection item's words: its paragraphs and lists), as written: split at the blank lines, each trimmed, none empty. */
export const paragraphsOf = (md: string): string[] =>
  md
    .trim()
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
