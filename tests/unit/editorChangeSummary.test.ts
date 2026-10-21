import { describe, expect, it } from 'vitest';
import { blocksChanged, documentChanged, listOf, mediaChanged, pageChanged, structureChanged, summariseChange, type SummaryContext } from '../../src/site/editor/model/changeSummary';
import { parseCatFileBatch } from '../../src/site/editor/server/git';
import type { Status } from '../../src/site/editor/model/names';

const titles = { article: (id: string) => ({ a: 'Alpha', b: 'Beta' })[id], person: () => undefined };
const page = (over: Record<string, unknown> = {}) => ({ id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'Alpha', summary: 'S', status: 'published', updatedAt: '2026-01-01', locale: 'en', body: [] as unknown[], ...over });
const p = (text: string, key?: string) => ({ type: 'text', text, ...(key ? { key } : {}) });

function ctx(files: Record<string, Status>, before: Record<string, unknown>, after: Record<string, unknown>): SummaryContext {
  return { status: (k) => files[k], before: (k) => before[k], after: (k) => after[k], titles };
}

describe('change summaries on Save to remote (documentation/editor/spec.md §7.2)', () => {
  it('names at most two things, then counts the rest', () => {
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['a', 'b', 'c', 'd'])).toBe('a, b and 2 more');
  });

  it("a page: its status, its fields in words, and its blocks (matched by key, else by content)", () => {
    expect(pageChanged(page({ status: 'draft' }), page())).toBe('Published');
    expect(pageChanged(page(), page({ status: 'draft' }))).toBe('Unpublished');
    expect(pageChanged(page(), page({ title: 'New', slug: 'n', hero: { media: 'x/y' } }))).toBe('Address, title and 1 more changed');
    expect(pageChanged(page(), page({ updatedAt: '2026-02-02' }))).toBe('Dates updated');
    expect(pageChanged(page(), page())).toBe('Formatting only');
    expect(pageChanged(undefined, page({ kind: 'gallery', status: 'draft' }))).toBe('New gallery');
    expect(pageChanged(undefined, page())).toBe('New article, published');
    const body = [p('one', 'k1'), p('two', 'k2'), { type: 'divider', key: 'k3' }];
    expect(pageChanged(page({ body }), page({ title: 'T', body: [p('one!', 'k1'), body[1], body[2], { type: 'heading', text: 'H', key: 'k4' }] }))).toBe('Title changed, a paragraph changed, a heading added');
    expect(blocksChanged(body, [body[1], body[0], body[2]])).toEqual(['blocks reordered']);
    expect(blocksChanged(body, [body[0]])).toEqual(['2 blocks removed']);
    expect(blocksChanged([p('x'), p('y')], [p('x'), p('y edited')])).toEqual(['a paragraph changed']);
    expect(blocksChanged([], [p('x'), p('y')])).toEqual(['2 paragraphs added']);
  });

  it("a picture: its files replaced, added or removed, and the words someone chose (never the measures)", () => {
    const keys = ['/content/media/a/b.webp', '/content/media/a/b.dark.webp', '/content/media/a/b.json'];
    const side = { kind: 'image', file: 'b.webp', alt: 'A', facts: { width: 1 } };
    const row = { kind: 'Media', status: 'changed' as const, keys };
    expect(mediaChanged(row, ctx({ [keys[0]]: 'changed', [keys[2]]: 'changed' }, { [keys[2]]: side }, { [keys[2]]: { ...side, facts: { width: 2 } } }))).toBe('Picture replaced');
    expect(mediaChanged(row, ctx({ [keys[1]]: 'added', [keys[2]]: 'changed' }, { [keys[2]]: side }, { [keys[2]]: { ...side, alt: 'B', focus: '1% 1%', dark: { file: 'b.dark.webp' } } }))).toBe('Dark version added, alt text and focus point changed');
    expect(mediaChanged({ ...row, status: 'added' }, ctx({}, {}, { [keys[2]]: side }))).toBe('New picture with a dark version');
    expect(mediaChanged({ ...row, status: 'deleted' }, ctx({}, {}, {}))).toBeNull();
  });

  it('the site structure: sections and pages added, removed, moved, changed, reordered, and the navigation', () => {
    const tree = (children: unknown[], menus: unknown = { primary: [] }) => ({ home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children }, menus });
    const work = (children: unknown[] = []) => ({ id: 'work', kind: 'hub', slug: 'work', title: 'Work', children });
    const item = (id: string) => ({ id: `n-${id}`, kind: 'item', item: { type: 'article', id } });
    const before = tree([work([item('a'), item('b')]), { id: 'notes', kind: 'hub', slug: 'notes', title: 'Notes', children: [] }]);
    expect(structureChanged(before, tree([work([item('a')]), { id: 'notes', kind: 'hub', slug: 'notes', title: 'Notes', children: [item('b')] }]), titles)).toBe('Beta moved');
    expect(structureChanged(before, tree([work([item('b'), item('a')]), { id: 'notes', kind: 'hub', slug: 'notes', title: 'Notes', children: [] }]), titles)).toBe('Order changed');
    expect(structureChanged(before, tree([work([item('a'), item('b')])], { primary: [{ node: 'work' }] }), titles)).toBe('Notes removed, navigation changed');
    expect(structureChanged(before, tree([{ ...work([item('a'), item('b')]), title: 'Projects' }, { id: 'notes', kind: 'hub', slug: 'notes', title: 'Notes', children: [] }]), titles)).toBe('Projects changed');
  });

  it('any other document: fields named, lists of things with IDs counted', () => {
    expect(documentChanged({ name: 'A', positioning: 'x' }, { name: 'A', positioning: 'y' })).toBe('Positioning changed');
    expect(documentChanged({ grants: [{ id: 'g1', a: 1 }, { id: 'g2' }] }, { grants: [{ id: 'g1', a: 2 }, { id: 'g3' }, { id: 'g4' }] })).toBe('2 grants added, a grant changed, a grant removed');
  });

  it('a page made private (or open) is said on both of its rows, with what else changed', () => {
    const open = '/content/articles/a.json';
    const priv = '/private/articles/a.json';
    const c = ctx({ [open]: 'deleted', [priv]: 'added' }, { [open]: page() }, { [priv]: page({ title: 'Alpha 2' }) });
    expect(summariseChange({ kind: 'Article', status: 'deleted', keys: [open] }, c)).toBe('Made private: moves to the private pages');
    expect(summariseChange({ kind: 'Private page', status: 'added', keys: [priv] }, c)).toBe('Made private, title changed');
    const back = ctx({ [priv]: 'deleted', [open]: 'added' }, { [priv]: page() }, { [open]: page() });
    expect(summariseChange({ kind: 'Article', status: 'added', keys: [open] }, back)).toBe('Made open');
    const media = ['/private/media/articles/a/x.webp', '/private/media/articles/a/x.json'];
    const moved = ctx({ [media[1]]: 'added', '/content/media/articles/a/x.json': 'deleted' }, {}, {});
    expect(summariseChange({ kind: 'Private media', status: 'added', keys: media }, moved)).toBe('Made private with its page');
  });

  it('never fails a row: a summary it cannot make is left out', () => {
    expect(summariseChange({ kind: 'File', status: 'changed', keys: ['/content/x.txt'] }, ctx({}, {}, {}))).toBeNull();
    expect(summariseChange({ kind: 'Settings', status: 'changed', keys: ['/content/site.json'] }, ctx({}, { '/content/site.json': 'x' }, {}))).toBeNull();
  });

  it("reads git cat-file --batch output by its byte sizes (UTF-8 words included), a missing object as null", () => {
    const one = Buffer.from('{"t":"Café"}');
    const out = Buffer.concat([Buffer.from(`abc123 blob ${one.length}\n`), one, Buffer.from('\nHEAD:content/x.json missing\n'), Buffer.from('def456 blob 2\n{}\n')]);
    expect(parseCatFileBatch(out, 3).map((b) => b?.toString('utf8') ?? null)).toEqual(['{"t":"Café"}', null, '{}']);
    expect(parseCatFileBatch(Buffer.alloc(0), 2)).toEqual([null, null]);
  });
});
