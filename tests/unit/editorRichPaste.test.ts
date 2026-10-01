/**
 * Pasting a rich copy (documentation/editor/spec.md §3.2): the clipboard's HTML from a web page, Word,
 * Google Docs, a chat or the site itself, as the closest blocks and marks the site has.
 */
import { describe, expect, it } from 'vitest';
import { blocksFromHtml } from '../../src/site/editor/model/richPaste';
import { kindOf, linesOf, wordsOf } from '../../src/site/editor/model/paste';
import type { MiniNode } from '../../src/site/editor/model/dom';

const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'wbr', 'col', 'source']);
const ENTITIES: Record<string, string> = { nbsp: '\u00a0', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const decode = (s: string) => s.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m));

interface El extends MiniNode {
  childNodes: MiniNode[];
}

/** Clipboard HTML as a minimal node tree: enough of a parser for these fixtures (tags, attributes, text, comments). */
function html(source: string): MiniNode {
  const root: El = { nodeType: 1, nodeName: 'BODY', textContent: null, childNodes: [], getAttribute: () => null };
  const stack: El[] = [root];
  const re = /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) top.childNodes.push({ nodeType: 3, nodeName: '#text', textContent: decode(m[5]), childNodes: [] });
    else if (m[1]) {
      const at = stack.map((s) => s.nodeName).lastIndexOf(m[1].toUpperCase());
      if (at > 0) stack.length = at;
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      const node: El = { nodeType: 1, nodeName: m[2].toUpperCase(), textContent: null, childNodes: [], getAttribute: (n) => attrs[n] ?? null };
      top.childNodes.push(node);
      if (!VOID.has(m[2].toLowerCase()) && !m[4]) stack.push(node);
    } else top.childNodes.push({ nodeType: 8, nodeName: '#comment', textContent: '', childNodes: [] });
  }
  const fill = (n: MiniNode): string => {
    if (n.nodeType === 3) return n.textContent ?? '';
    if (n.nodeType !== 1) return '';
    const t = Array.from(n.childNodes).map(fill).join('');
    (n as El).textContent = t;
    return t;
  };
  fill(root);
  return root;
}

const paste = (source: string) => blocksFromHtml(html(source));

describe('a rich copy arrives as the closest blocks and marks', () => {
  it('keeps bold, italic, code and links in paragraphs', () => {
    expect(paste('<p>A <b>bold</b> and <em>italic</em> idea, with <code>npm test</code> and <a href="https://example.com/x">a link</a>.</p><p>Second.</p>')).toEqual({
      blocks: [
        { type: 'text', markdown: 'A **bold** and _italic_ idea, with `npm test` and [a link](https://example.com/x).' },
        { type: 'text', markdown: 'Second.' },
      ],
      pictures: 0,
    });
  });

  it('reads marks from styles (Google Docs), and Docs’ outer bold that isn’t bold', () => {
    const docs =
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr" style="line-height:1.38"><span style="font-size:11pt;font-weight:400;">Plain then </span><span style="font-size:11pt;font-weight:700;">bold</span><span style="font-weight:400;font-style:italic;"> and italic</span></p><ul><li dir="ltr" style="list-style-type:disc"><p dir="ltr"><span style="font-weight:400">One</span></p></li><li dir="ltr"><p dir="ltr"><span style="font-weight:700">Two</span></p></li></ul></b>';
    expect(paste(docs)?.blocks).toEqual([
      { type: 'text', markdown: 'Plain then **bold** _and italic_' },
      { type: 'text', markdown: '- One\n- **Two**' },
    ]);
  });

  it('maps headings to the levels the body has (H1 and H2 a heading 2), their words only', () => {
    expect(paste('<h1>Big <b>title</b></h1><h2>Two</h2><h3>Three</h3><h5>Five</h5><p>Words.</p>')?.blocks).toEqual([
      { type: 'heading', level: 2, text: 'Big title' },
      { type: 'heading', level: 2, text: 'Two' },
      { type: 'heading', level: 3, text: 'Three' },
      { type: 'heading', level: 4, text: 'Five' },
      { type: 'text', markdown: 'Words.' },
    ]);
  });

  it('makes bulleted and numbered lists, flattening nested ones into their items', () => {
    expect(paste('<ol><li>First <i>step</i></li><li>Second<ul><li>inner</li></ul></li></ol><ul><li>Dot</li></ul><ul><li>Apart</li></ul>')?.blocks).toEqual([
      { type: 'text', markdown: '1. First _step_\n2. Second\n3. inner' },
      { type: 'text', markdown: '- Dot' },
      { type: 'text', markdown: '- Apart' },
    ]);
  });

  it('reads Word’s list paragraphs as list items, numbered when the marker is', () => {
    const word =
      "<!--StartFragment--><p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt \"Times New Roman\"'>&nbsp;&nbsp; </span></span></span><![endif]><b>Bold</b> item<o:p></o:p></p>" +
      "<p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>·&nbsp;</span>Another</p>" +
      "<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>1.&nbsp;</span>Numbered</p><p class=MsoNormal>After.</p><!--EndFragment-->";
    expect(paste(word)?.blocks).toEqual([
      { type: 'text', markdown: '- **Bold** item\n- Another' },
      { type: 'text', markdown: '1. Numbered' },
      { type: 'text', markdown: 'After.' },
    ]);
  });

  it('makes quotes, dividers, code blocks and table rows', () => {
    expect(paste('<blockquote><p>Said <b>this</b>.</p></blockquote><hr><pre><code>a = 1\n\nb = 2</code></pre><table><tr><th>Name</th><td><b>Value</b></td></tr></table>')?.blocks).toEqual([
      { type: 'quote', variant: 'block', text: 'Said this.' },
      { type: 'divider' },
      { type: 'text', markdown: '`a = 1`\\\n`b = 2`' },
      { type: 'text', markdown: 'Name · **Value**' },
    ]);
  });

  it('leaves out pictures (counting them) and what the site can’t show', () => {
    expect(paste('<p style="color:red;font-size:30px"><u>Under</u> <span style="font-family:Arial">words</span><img src="x.png"></p><script>alert(1)</script><style>p{}</style><figure><img src="y.png"><figcaption>A caption</figcaption></figure>')).toEqual({
      blocks: [
        { type: 'text', markdown: 'Under words' },
        { type: 'text', markdown: 'A caption' },
      ],
      pictures: 2,
    });
  });

  it('keeps only the words of links the site can’t follow', () => {
    expect(paste('<p><a href="javascript:alert(1)">bad</a> <a href="/relative">rel</a> <a href="mailto:a@b.c">mail</a></p>')?.blocks).toEqual([{ type: 'text', markdown: 'bad rel [mail](mailto:a@b.c)' }]);
  });

  it('keeps line breaks inside a paragraph, and drops the empty ones', () => {
    expect(paste('<p>One<br>Two<br></p><p>&nbsp;</p><div><br></div>')?.blocks).toEqual([{ type: 'text', markdown: 'One\\\nTwo' }]);
  });

  it('leaves a copy from a code editor (all monospaced or preformatted) to its plain text', () => {
    const vscode = '<div style="color:#ccc;font-family:Consolas, \'Courier New\', monospace;white-space:pre;"><div><span style="color:#569cd6;">###</span><span> Heading</span></div><div><span>**bold**</span></div></div>';
    expect(paste(vscode)).toBeNull();
    expect(paste('<pre>only code</pre>')).toBeNull();
    expect(paste('')).toBeNull();
    expect(paste('<img src="a.png">')).toBeNull();
  });

  it('decides what a paste is, and gives its words and lines', () => {
    const words = paste('<span>just words</span>')!;
    expect(kindOf(words.blocks)).toBe('words');
    const rich = paste('<p>A <b>bold</b> line</p><ul><li>item <i>one</i></li></ul><h2>Head</h2>')!;
    expect(kindOf(rich.blocks)).toBe('blocks');
    expect(wordsOf(rich.blocks)).toBe('A bold line\n\nitem one\n\nHead');
    expect(linesOf(rich.blocks)).toEqual([
      [{ t: 'text', v: 'A ' }, { t: 'strong', c: [{ t: 'text', v: 'bold' }] }, { t: 'text', v: ' line' }],
      [{ t: 'text', v: 'item ' }, { t: 'em', c: [{ t: 'text', v: 'one' }] }],
      [{ t: 'text', v: 'Head' }],
    ]);
  });
});
