import { describe, expect, it } from 'vitest';
import { listOf, listTree, parseInline, parseMarkdown, plainText, renderMarkdown, runs, serializeBlocks, serializeInline, type MdList } from '../../src/site/content/markdown';

describe('strikethrough (~~)', () => {
  it('reads two tildes as struck through, nests with the other marks, and leaves one tilde as text', () => {
    expect(parseInline('a ~~gone~~ b')).toEqual([{ t: 'text', v: 'a ' }, { t: 'del', c: [{ t: 'text', v: 'gone' }] }, { t: 'text', v: ' b' }]);
    expect(parseInline('~~**both**~~')).toEqual([{ t: 'del', c: [{ t: 'strong', c: [{ t: 'text', v: 'both' }] }] }]);
    expect(parseInline('about ~5 minutes')).toEqual([{ t: 'text', v: 'about ~5 minutes' }]);
    expect(parseInline('~~ not ~~')).toEqual([{ t: 'text', v: '~~ not ~~' }]);
    expect(renderMarkdown('~~old~~ new')).toBe('<p><del>old</del> new</p>');
    expect(runs(parseInline('~~a~~b'))).toEqual([{ del: true, text: 'a' }, { text: 'b' }]);
  });

  it('writes back what it read, and escapes tildes that would read as a mark', () => {
    for (const md of ['a ~~gone~~ b', '~~**both**~~', '**~~both~~** and _~~it~~_', 'about ~5 minutes']) expect(serializeInline(parseInline(md))).toBe(md);
    expect(serializeInline([{ t: 'text', v: 'a ~~b' }])).toBe('a \\~\\~b');
    expect(parseInline(serializeInline([{ t: 'text', v: 'a ~~b~~' }]))).toEqual([{ t: 'text', v: 'a ~~b~~' }]);
  });
});

describe('nested lists', () => {
  const nested = '- One\n  - One a\n  - One b\n    1. Deep\n- Two\n  1. Two a';

  it('reads a line indented under an item as an item of a list inside it, of its own kind', () => {
    const [b] = parseMarkdown(nested) as MdList[];
    expect(b.t).toBe('ul');
    expect(b.depth).toEqual([0, 1, 1, 2, 0, 1]);
    expect(b.kinds).toEqual(['ul', 'ul', 'ul', 'ol', 'ul', 'ol']);
    expect(renderMarkdown(nested)).toBe('<ul><li>One<ul><li>One a</li><li>One b<ol><li>Deep</li></ol></li></ul></li><li>Two<ol><li>Two a</li></ol></li></ul>');
  });

  it('writes nesting back indented to where the parent item’s words start, numbered within each list', () => {
    expect(serializeBlocks(parseMarkdown(nested))).toBe(nested);
    const numbered = '1. Plan\n   - Draft\n   - Review\n2. Ship';
    expect(serializeBlocks(parseMarkdown(numbered))).toBe(numbered);
    expect(listOf(listTree(parseMarkdown(numbered)[0] as MdList))).toEqual(parseMarkdown(numbered)[0]);
  });

  it('a flat list stays as it was, with no levels; a list goes no deeper than three levels', () => {
    expect(parseMarkdown('- a\n- b')).toEqual([{ t: 'ul', items: [[{ t: 'text', v: 'a' }], [{ t: 'text', v: 'b' }]] }]);
    const [deep] = parseMarkdown('- a\n  - b\n    - c\n      - d') as MdList[];
    expect(deep.depth).toEqual([0, 1, 2, 2]);
    // the list's own items keep one kind, as before nesting: mixed, it's a paragraph
    expect(parseMarkdown('- a\n1. b')[0].t).toBe('p');
    expect(plainText(nested)).toBe('One\nOne a\nOne b\nDeep\nTwo\nTwo a');
  });
});
