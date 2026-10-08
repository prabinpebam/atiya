/**
 * The inspector's rich fields (documentation/editor/spec.md §3.5): a collection item's words go in as the
 * HTML the field edits and come back as the same Markdown, whatever the browser wrote while editing.
 */
import { describe, expect, it } from 'vitest';
import type { MiniNode } from '../../src/site/editor/model/dom';
import { pastedMarkdown, RICH_TOOLS, richHtml, richMarkdown, richShortcut } from '../../src/site/editor/model/richText';

interface El extends MiniNode {
  childNodes: MiniNode[];
}

/** HTML as a minimal node tree: tags, attributes and text, enough for these fixtures. */
function html(source: string): MiniNode {
  const root: El = { nodeType: 1, nodeName: 'DIV', textContent: null, childNodes: [], getAttribute: () => null };
  const stack: El[] = [root];
  const re = /<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) top.childNodes.push({ nodeType: 3, nodeName: '#text', textContent: m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'), childNodes: [] });
    else if (m[1]) {
      const at = stack.map((s) => s.nodeName).lastIndexOf(m[1].toUpperCase());
      if (at > 0) stack.length = at;
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? '';
      const node: El = { nodeType: 1, nodeName: m[2].toUpperCase(), textContent: null, childNodes: [], getAttribute: (n) => attrs[n] ?? null };
      top.childNodes.push(node);
      if (m[2].toLowerCase() !== 'br' && !m[4]) stack.push(node);
    }
  }
  const fill = (n: MiniNode): string => {
    if (n.nodeType === 3) return n.textContent ?? '';
    const t = Array.from(n.childNodes).map(fill).join('');
    (n as El).textContent = t;
    return t;
  };
  fill(root);
  return root;
}

describe('a rich field', () => {
  it('starts from its Markdown rendered, links keeping their written targets, and gives the same Markdown back', () => {
    expect(richHtml('A [case](ref:caseStudy/x) and ~~old~~')).toBe('<p>A <a href="#" data-md-href="ref:caseStudy/x">case</a> and <del>old</del></p>');
    expect(richHtml('')).toBe('');
    expect(richHtml(undefined)).toBe('');
    for (const md of [
      'One **bold** paragraph.\n\nAnd _another_, with `code` and [a link](https://example.com/).',
      '- First\n  - Inside, ~~struck~~\n    1. Deepest\n- Second\n\nAfter the list.',
      '1. One\n2. Two\n   - Two a',
    ])
      expect(richMarkdown(html(richHtml(md)))).toBe(md);
  });

  it('reads what the browser writes while editing: divs for new lines, b and strike, a list indented as a sibling', () => {
    const edited = html('Typed first<div>A <b>new</b> line</div><div><br></div><div><strike>gone</strike></div><ul><li>a</li><ul><li>b</li></ul><li>c</li></ul>');
    expect(richMarkdown(edited)).toBe('Typed first\n\nA **new** line\n\n~~gone~~\n\n- a\n  - b\n- c');
    // a space the browser leaves inside a mark stays a space, outside it
    expect(richMarkdown(html('<p><strike>Then </strike><strong>own</strong> it, <b>bold </b>next.</p>'))).toBe('~~Then~~ **own** it, **bold** next.');
    // a div round a list (a paste's wrapper) is read for its list
    expect(richMarkdown(html('<div><ol><li>x</li><li><br></li></ol></div>'))).toBe('1. x');
    // nested deeper than the subset holds: the items join the deepest level, in order
    expect(richMarkdown(html('<ul><li>a<ul><li>b<ul><li>c<ul><li>d</li></ul></li></ul></li></ul></li></ul>'))).toBe('- a\n  - b\n    - c\n    - d');
  });

  it('a paste keeps text with its marks and lists, makes a heading or a quote a paragraph, and leaves the rest out', () => {
    expect(
      pastedMarkdown([
        { type: 'heading', level: 2, text: 'Title *star*' },
        { type: 'text', markdown: '- one\n- **two**' },
        { type: 'divider' },
        { type: 'quote', text: 'Said', variant: 'block' },
      ]),
    ).toBe('Title \\*star\\*\n\n- one\n- **two**\n\nSaid');
  });

  it('offers the toolbar’s formatting by its keys too', () => {
    const key = (k: string, code = '', o: { shift?: boolean; meta?: boolean } = {}) => richShortcut({ key: k, code, ctrlKey: !o.meta, metaKey: !!o.meta, shiftKey: !!o.shift, altKey: false });
    expect(key('b')).toBe('bold');
    expect(key('i', '', { meta: true })).toBe('italic');
    expect(key('X', 'KeyX', { shift: true })).toBe('strikethrough');
    expect(key('*', 'Digit8', { shift: true })).toBe('bulleted');
    expect(key('&', 'Digit7', { shift: true })).toBe('numbered');
    expect(key(']')).toBe('indent');
    expect(key('[')).toBe('outdent');
    expect(key('k')).toBe('link');
    expect(key('e')).toBe('code');
    expect(key('u')).toBeNull();
    expect(richShortcut({ key: 'b', code: 'KeyB', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBeNull();
    expect(RICH_TOOLS.map((t) => t.op)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link', 'bulleted', 'numbered', 'outdent', 'indent']);
  });
});
