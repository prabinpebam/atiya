/**
 * The Markdown subset allowed inside content blocks (documentation/content/model.md §6): paragraphs,
 * emphasis, strong, inline code, links (https, http, mailto and ref:), bulleted and numbered lists and
 * hard line breaks (a backslash, or two spaces, at the end of a line). Everything else is text: the input
 * is escaped first, so raw HTML can never reach a page.
 */
export interface MarkdownOptions {
  /** Turns a ref: link (`ref:caseStudy/some-id`) into an href; an unknown ref is an error. */
  resolveRef?: (ref: string) => string | undefined;
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function inline(text: string, opts: MarkdownOptions): string {
  const held: string[] = [];
  const hold = (html: string) => `\u0000${held.push(html) - 1}\u0000`;
  let s = escape(text);
  s = s.replace(/`([^`]+)`/g, (_, code: string) => hold(`<code>${code}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, raw: string) => {
    const href = raw.replace(/&amp;/g, '&');
    let target: string | undefined;
    if (href.startsWith('ref:')) {
      target = opts.resolveRef?.(href.slice(4));
      if (!target) throw new Error(`unknown link target: ${href}`);
    } else if (SAFE_HREF.test(href)) target = href;
    else throw new Error(`links may only go to https, http, mailto or ref: (${href})`);
    return hold(`<a href="${escape(target)}">${emphasis(label)}</a>`);
  });
  s = emphasis(s);
  s = s.replace(/(\\| {2,})\n/g, '<br>\n');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => held[Number(i)]);
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([\s\S]*?\S)\*(?![*\w])/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)([\s\S]*?\S)_(?![_\w])/g, '$1<em>$2</em>');
}

/** The subset, as HTML. */
export function renderMarkdown(md: string, opts: MarkdownOptions = {}): string {
  return md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n[ \t]*\n/)
    .map((para) => {
      const lines = para.split('\n');
      if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''), opts)}</li>`).join('')}</ul>`;
      if (lines.every((l) => /^\s*\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\. /, ''), opts)}</li>`).join('')}</ol>`;
      return `<p>${inline(para, opts)}</p>`;
    })
    .join('\n');
}

/** The words a reader reads: the subset with its markup taken off (for reading time and plain labels). */
export function plainText(md: string): string {
  return md
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|\*|_)/g, '')
    .replace(/\\\n/g, '\n')
    .replace(/^\s*([-*]|\d+\.) /gm, '');
}
