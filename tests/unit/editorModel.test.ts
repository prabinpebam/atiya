/**
 * Edit mode's pure model (documentation/editor/plan.md §4): document operations, the canvas's DOM back to
 * Markdown (over a minimal node interface, no browser), the site structure, IDs and slugs, the names the
 * Publish screen gives changes, the reference graph behind Used in and Delete, and the save queue.
 */
import { describe, expect, it } from 'vitest';
import * as ops from '../../src/site/editor/model/ops';
import * as paste from '../../src/site/editor/model/paste';
import * as planet from '../../src/site/editor/model/planet';
import { inlineOf, markdownOf, plainOf, type MiniNode } from '../../src/site/editor/model/dom';
import { addHub, addLink, inMenu, menuOf, moveEntry, nodeOf, childSlugs, findHub, hubs, nodeIds, place, placeAll, relabelEntry, removeEntry, reorder, sectionOf, setInMenu, unplace, updateHub } from '../../src/site/editor/model/structure';
import { slugify, today, unique } from '../../src/site/editor/model/ids';
import { actionsUrl, groupChanges, resourceName, resourceOf, suggestMessage, type Titles } from '../../src/site/editor/model/names';
import { ownerLabel, ownerOf, references } from '../../src/site/editor/model/references';
import { SaveQueue, type Outcome } from '../../src/site/editor/model/queue';
import { parseInline, parseMarkdown, runs } from '../../src/site/content/markdown';
import type { Article, Block, PlanetStructure, SiteStructure } from '../../src/site/content/schema';
import { block, COLLECTION_HEADINGS, COLLECTION_LAYOUTS } from '../../src/site/content/schema';
import { HEADING_CHOICES, LAYOUT_CHOICES, TAKES_COLUMNS, TAKES_LABEL, TIMELINES, startWidth } from '../../src/site/editor/model/collection';

// ---------- document operations ----------
const t = (markdown: string): Block => ({ type: 'text', markdown });
const h = (text: string, level: 2 | 3 = 2): Block => ({ type: 'heading', level, text });

describe('document operations', () => {
  const body: Block[] = [t('one'), t('two'), t('three')];

  it('insert, remove, duplicate and replace return new bodies and leave the old one alone', () => {
    expect(ops.insert(body, 1, t('new')).map((b) => (b as { markdown: string }).markdown)).toEqual(['one', 'new', 'two', 'three']);
    expect(ops.remove(body, 0)).toHaveLength(2);
    const dup = ops.duplicate(body, 1);
    expect(dup).toHaveLength(4);
    expect(dup[2]).toEqual(dup[1]);
    expect(dup[2]).not.toBe(dup[1]);
    expect(ops.replace(body, 2, h('Heading'))[2]).toEqual(h('Heading'));
    expect(body.map((b) => (b as { markdown: string }).markdown)).toEqual(['one', 'two', 'three']);
  });

  it('move puts a block at the position it ends up at, and ignores a move nowhere', () => {
    const names = (b: Block[]) => b.map((x) => (x as { markdown: string }).markdown).join(' ');
    expect(names(ops.move(body, 0, 2))).toBe('two three one');
    expect(names(ops.move(body, 2, 0))).toBe('three one two');
    expect(names(ops.move(body, 1, 99))).toBe('one three two');
    expect(ops.move(body, 1, 1)).toBe(body);
    expect(ops.move(body, 5, 0)).toBe(body);
  });

  it('moves a selection of blocks together, one step, keeping their order; stops at either end', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(ops.range(4, 1)).toEqual([1, 2, 3, 4]);
    // a run of blocks
    expect(ops.moveMany(list, [2, 3], -1)).toEqual({ body: ['a', 'c', 'd', 'b', 'e', 'f'], indices: [1, 2] });
    expect(ops.moveMany(list, [2, 3], 1)).toEqual({ body: ['a', 'b', 'e', 'c', 'd', 'f'], indices: [3, 4] });
    // blocks apart: each steps past its neighbour, the gap stays
    expect(ops.moveMany(list, [1, 4], -1)).toEqual({ body: ['b', 'a', 'c', 'e', 'd', 'f'], indices: [0, 3] });
    expect(ops.moveMany(list, [1, 4], 1)).toEqual({ body: ['a', 'c', 'b', 'd', 'f', 'e'], indices: [2, 5] });
    // at an end: nothing moves (the order never scrambles)
    expect(ops.moveMany(list, [0, 3], -1)).toEqual({ body: list, indices: [0, 3] });
    expect(ops.moveMany(list, [2, 5], 1)).toEqual({ body: list, indices: [2, 5] });
    expect(ops.moveMany(list, [], 1)).toEqual({ body: list, indices: [] });
  });

  it('drags a selection to a new place in one piece, in its order, and deletes a selection', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(ops.moveGroupTo(list, [1, 3], 5)).toEqual({ body: ['a', 'c', 'e', 'b', 'd', 'f'], indices: [3, 4] });
    expect(ops.moveGroupTo(list, [4, 5], 0)).toEqual({ body: ['e', 'f', 'a', 'b', 'c', 'd'], indices: [0, 1] });
    expect(ops.moveGroupTo(list, [0, 1], 6)).toEqual({ body: ['c', 'd', 'e', 'f', 'a', 'b'], indices: [4, 5] });
    expect(ops.moveGroupTo(list, [2, 3], 3)).toEqual({ body: list, indices: [2, 3] });
    expect(ops.removeMany(list, [0, 2, 5])).toEqual(['b', 'd', 'e']);
  });

  it('split keeps the first part and makes the rest new paragraphs; an empty head is dropped', () => {
    expect(ops.split(body, 0, ['on', 'e'])).toEqual([t('on'), t('e'), t('two'), t('three')]);
    expect(ops.split(body, 0, ['one', ''])).toEqual(body);
    expect(ops.split(body, 0, ['', 'one'])).toEqual([t('one'), t('two'), t('three')]);
    expect(ops.split([h('Title here')], 0, ['Title', ' here'])).toEqual([h('Title'), t(' here')]);
  });

  it('merge joins a paragraph to the one before it, and only paragraphs', () => {
    expect(ops.merge(body, 1)).toEqual([t('onetwo'), t('three')]);
    expect(ops.merge(body, 0)).toBe(body);
    expect(ops.merge([h('H'), t('x')], 1)).toEqual([h('H'), t('x')]);
  });

  it('setPath sets and removes values immutably (numbers are array indexes); getPath reads them', () => {
    const doc = { body: [{ type: 'figure', media: 'a', caption: 'c' }], seo: { title: 't' } };
    const next = ops.setPath(doc, 'body.0.caption', 'new');
    expect(ops.getPath(next, 'body.0.caption')).toBe('new');
    expect(doc.body[0].caption).toBe('c');
    expect(ops.getPath(ops.setPath(doc, 'seo.title', ''), 'seo')).toEqual({});
    expect(ops.getPath(ops.setPath(doc, 'seo.description', undefined), 'seo')).toEqual({ title: 't' });
    expect(ops.getPath(ops.setPath({}, 'hero.media', 'x'), 'hero')).toEqual({ media: 'x' });
    expect(Array.isArray(ops.getPath(ops.setPath({}, 'items.0.media', 'x'), 'items'))).toBe(true);
    expect(ops.getPath(doc, 'nothing.here')).toBeUndefined();
  });

  it('names blocks as the editor shows them, with a few words of each', () => {
    expect(ops.kindOf(h('x', 3))).toBe('Heading 3');
    expect(ops.kindOf(t('- a\n- b'))).toBe('List');
    expect(ops.kindOf(t('1. a'))).toBe('List');
    expect(ops.kindOf(t('plain'))).toBe('Paragraph');
    expect(ops.excerptOf(t('**Bold** and [a link](https://x.y)'))).toBe('Bold and a link');
    expect(ops.excerptOf(t('word '.repeat(40)), undefined, 20)).toMatch(/…$/);
    expect(ops.excerptOf({ type: 'figure', media: 'articles/a/cover', width: 'content' })).toBe('cover');
    expect(ops.excerptOf({ type: 'figure', media: 'articles/a/cover', width: 'content' }, () => 'A cover')).toBe('A cover');
    expect(ops.excerptOf({ type: 'divider' })).toBe('');
    const collection: Block = { type: 'collection', layout: 'tiles', items: [{ heading: 'Challenge', text: 'x' }, { subtext: '2024' }, { text: '**Own** it' }, { media: 'articles/a/cover' }] };
    expect(ops.kindOf(collection)).toBe('Collection');
    expect(ops.excerptOf(collection)).toBe('Challenge, 2024, Own it, cover');
  });

  it('counts only a change of words or blocks as meaningful (it moves Updated on)', () => {
    const a = { title: 'A', summary: 'S', body: [t('x')], seo: {} } as unknown as Article;
    expect(ops.isMeaningful(a, { ...a, seo: { title: 'new' } } as Article)).toBe(false);
    expect(ops.isMeaningful(a, { ...a, body: [t('y')] })).toBe(true);
    expect(ops.isMeaningful(a, { ...a, title: 'B' })).toBe(true);
  });

  it('knows one paragraph from two, where a drag lands, and video addresses and lengths', () => {
    expect(ops.tooManyParagraphs('one\n\ntwo')).toBe(true);
    expect(ops.tooManyParagraphs('- a\n- b')).toBe(false);
    expect(ops.dropTarget([10, 30, 50], 5, 2)).toBe(0);
    expect(ops.dropTarget([10, 30, 50], 60, 0)).toBe(2);
    expect(ops.dropTarget([10, 30, 50], 20, 1)).toBe(-1);
    expect(ops.parseVideo('https://youtu.be/vIVX-KVUWAE')).toEqual({ provider: 'youtube', id: 'vIVX-KVUWAE' });
    expect(ops.parseVideo('https://www.youtube.com/watch?v=vIVX-KVUWAE&t=3')).toEqual({ provider: 'youtube', id: 'vIVX-KVUWAE' });
    expect(ops.parseVideo('https://vimeo.com/12345')).toEqual({ provider: 'vimeo', id: '12345' });
    expect(ops.parseVideo('https://example.com/video')).toBeNull();
    expect(ops.parseDuration('2:20')).toBe(140);
    expect(ops.parseDuration('1:02:03')).toBe(3723);
    expect(ops.parseDuration('90')).toBe(90);
    expect(ops.parseDuration('')).toBeUndefined();
    expect(ops.parseDuration('two minutes')).toBeNull();
  });
});

// ---------- turning text into another kind ----------
describe('turning text into another kind, any time', () => {
  const para = (markdown: string): Block => ({ type: 'text', markdown });

  it('knows each kind of text, and nothing else', () => {
    expect(ops.textKindOf(para('words'))).toBe('paragraph');
    expect(ops.textKindOf(para('- a\n- b'))).toBe('bulleted');
    expect(ops.textKindOf(para('1. a\n2. b'))).toBe('numbered');
    expect(ops.textKindOf(h('Title', 3))).toBe('heading-3');
    expect(ops.textKindOf({ type: 'quote', text: 'q', variant: 'pull' })).toBe('pull-quote');
    expect(ops.textKindOf({ type: 'divider' })).toBeNull();
    expect(ops.TEXT_KINDS.map((k) => k.value)).toEqual(['paragraph', 'heading-2', 'heading-3', 'heading-4', 'quote', 'pull-quote', 'bulleted', 'numbered']);
  });

  it('keeps the words: marks where the kind holds them, plain words where it doesn\'t, lines as items and back', () => {
    const p = para('A **bold** start,\\\nand a [link](https://example.com).');
    expect(ops.convertText(p, 'heading-2')).toEqual({ type: 'heading', level: 2, text: 'A bold start, and a link.' });
    expect(ops.convertText(p, 'pull-quote')).toEqual({ type: 'quote', variant: 'pull', text: 'A bold start, and a link.' });
    const list = ops.convertText(p, 'bulleted');
    expect(list).toEqual({ type: 'text', markdown: '- A **bold** start,\n- and a [link](https://example.com).' });
    expect(ops.convertText(list, 'numbered')).toEqual({ type: 'text', markdown: '1. A **bold** start,\n2. and a [link](https://example.com).' });
    expect(ops.convertText(list, 'paragraph')).toEqual(p);
    // a heading's words, escaped where Markdown would read them
    expect(ops.convertText(h('2024: *the* year'), 'paragraph')).toEqual({ type: 'text', markdown: '2024: \\*the\\* year' });
  });

  it("keeps a heading's anchor and a quote's source while only the level or the style changes", () => {
    expect(ops.convertText({ type: 'heading', level: 2, text: 'T', id: 'intro' }, 'heading-4')).toEqual({ type: 'heading', level: 4, text: 'T', id: 'intro' });
    expect(ops.convertText({ type: 'quote', text: 'Q', cite: 'Someone', variant: 'block' }, 'pull-quote')).toEqual({ type: 'quote', text: 'Q', cite: 'Someone', variant: 'pull' });
    expect(ops.convertText({ type: 'heading', level: 2, text: 'T', id: 'intro' }, 'paragraph')).toEqual({ type: 'text', markdown: 'T' });
    expect(ops.convertText({ type: 'divider' }, 'paragraph')).toEqual({ type: 'divider' });
  });

  it('splits a list or a paragraph of lines into paragraphs, and joins blocks into one list', () => {
    expect(ops.splitLines(para('- one\n- **two**'))).toEqual([para('one'), para('**two**')]);
    expect(ops.splitLines(para('just one line'))).toBeNull();
    expect(ops.joinAsList([h('Intro'), para('a\\\nb'), para('- c')], true)).toEqual({ type: 'text', markdown: '1. Intro\n2. a\n3. b\n4. c' });
  });

  it('makes a collection (as tiles) from heading and text pairs, says why not otherwise, and turns it back', () => {
    const pairs: Block[] = [h('Challenge', 3), para('Re-energize the team.'), h('Core idea', 3), para('**Do what makes you proud.** A standard.')];
    const made = ops.asCollection(pairs);
    expect(made).toEqual({ ok: true, block: { type: 'collection', layout: 'tiles', width: 'popout', items: [{ heading: 'Challenge', text: 'Re-energize the team.' }, { heading: 'Core idea', text: '**Do what makes you proud.** A standard.' }] } });
    expect(made.ok && ops.collectionToText(made.block)).toEqual(pairs);
    expect(ops.asCollection(pairs.slice(0, 3))).toMatchObject({ ok: false });
    expect(ops.asCollection(pairs.slice(0, 2))).toMatchObject({ ok: true });
    expect(ops.asCollection([h('x'.repeat(81)), para('y'), h('a'), para('b')])).toMatchObject({ ok: false, why: expect.stringMatching(/80 characters/) });
    expect(ops.asCollection([h('a'), { type: 'divider' }, h('b'), para('c')])).toMatchObject({ ok: false, why: expect.stringMatching(/Only text/) });
    // one text block alone is a single item: a heading as its heading, anything else as its words
    expect(ops.asCollection([para('A **standard** chosen from within.')])).toEqual({ ok: true, block: { type: 'collection', layout: 'tiles', width: 'popout', items: [{ text: 'A **standard** chosen from within.' }] } });
    expect(ops.asCollection([h('Core idea', 3)])).toMatchObject({ ok: true, block: { items: [{ heading: 'Core idea' }] } });
    expect(ops.asCollection([h('x'.repeat(81))])).toMatchObject({ ok: false, why: expect.stringMatching(/80 characters/) });
    expect(ops.asCollection([{ type: 'divider' }])).toMatchObject({ ok: false, why: expect.stringMatching(/Only text/) });
    expect(ops.collectionToText(para('x'))).toBeNull();
    // every part of an item comes back: its picture, its heading, its time (in bold, as a résumé has it), its subtext and its words
    expect(ops.collectionToText({ type: 'collection', layout: 'rows', items: [{ media: 'articles/a/cover', heading: 'H', when: '2016 to 2019', subtext: 'S', text: 'T' }] })).toEqual([
      { type: 'figure', media: 'articles/a/cover', width: 'content' },
      h('H', 3),
      para('**2016 to 2019**'),
      para('S'),
      para('T'),
    ]);
  });

  it("offers every layout and heading style the contract has, in its order, and columns only where they're used", () => {
    expect(LAYOUT_CHOICES.map((c) => c.value)).toEqual([...COLLECTION_LAYOUTS]);
    expect(HEADING_CHOICES.map((c) => c.value)).toEqual([...COLLECTION_HEADINGS]);
    expect([...TAKES_COLUMNS].sort()).toEqual(['masonry', 'tiles']);
    // the strips take a label, the timelines set each item by its time, and a new strip or grid starts a little wider
    expect([...TAKES_LABEL].sort()).toEqual(['carousel', 'timeline-scroll']);
    expect([...TIMELINES].sort()).toEqual(['timeline', 'timeline-scroll']);
    expect(COLLECTION_LAYOUTS.filter((l) => startWidth(l) === 'popout')).toEqual(['tiles', 'masonry', 'carousel', 'timeline-scroll']);
  });

  it('reads the keys by their place: Ctrl or Cmd + Alt + 0, 2, 3, 4; Ctrl or Cmd + Shift + 7, 8, 9', () => {
    const key = (code: string, o: { alt?: boolean; shift?: boolean; meta?: boolean } = {}) => ops.turnShortcut({ ctrlKey: !o.meta, metaKey: !!o.meta, altKey: !!o.alt, shiftKey: !!o.shift, code });
    expect(key('Digit0', { alt: true })).toBe('paragraph');
    expect(key('Digit2', { alt: true })).toBe('heading-2');
    expect(key('Numpad4', { alt: true, meta: true })).toBe('heading-4');
    expect(key('Digit7', { shift: true })).toBe('numbered');
    expect(key('Digit8', { shift: true })).toBe('bulleted');
    expect(key('Digit9', { shift: true })).toBe('quote');
    expect(key('Digit1', { alt: true })).toBeNull();
    expect(key('Digit2', { alt: true, shift: true })).toBeNull();
    expect(ops.turnShortcut({ ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, code: 'Digit2' })).toBeNull();
    expect(key('KeyB', { shift: true })).toBeNull();
  });
});

// ---------- pasting Markdown ----------
describe('pasted Markdown arrives as the blocks it describes', () => {
  const md = (s: string) => paste.blocksFromMarkdown(s).blocks;
  const story = `## A rebrand designed to move the team, not simply rename it.

The Windows Design team in India needed more than a visual refresh. I wanted
the identity to help people reconnect with why they design.

### **Challenge**

Re-energize the team and make purpose feel personal, practical, and visible.

### **Intent**

Shift the conversation from completing tasks to owning meaningful outcomes.

### **My role**

Identity concept, narrative framing, visual direction, and team activation.

### **Core idea**

**Do what makes you proud.** A standard chosen from within.
`;

  it('makes headings (their words only), and joins a hard-wrapped paragraph into one', () => {
    const b = md(story);
    expect(b.map((x) => (x.type === 'heading' ? `h${x.level}` : x.type))).toEqual(['h2', 'text', 'h3', 'text', 'h3', 'text', 'h3', 'text', 'h3', 'text']);
    expect(b[0]).toEqual(h('A rebrand designed to move the team, not simply rename it.'));
    expect(b[1]).toEqual(t('The Windows Design team in India needed more than a visual refresh. I wanted the identity to help people reconnect with why they design.'));
    expect(b[2]).toEqual(h('Challenge', 3));
    expect(b[9]).toEqual(t('**Do what makes you proud.** A standard chosen from within.'));
  });

  it('and those heading and text pairs, selected, turn into a collection', () => {
    const r = ops.asCollection(md(story).slice(2));
    expect(r.ok && r.block).toEqual({
      type: 'collection',
      layout: 'tiles',
      width: 'popout',
      items: [
        { heading: 'Challenge', text: 'Re-energize the team and make purpose feel personal, practical, and visible.' },
        { heading: 'Intent', text: 'Shift the conversation from completing tasks to owning meaningful outcomes.' },
        { heading: 'My role', text: 'Identity concept, narrative framing, visual direction, and team activation.' },
        { heading: 'Core idea', text: '**Do what makes you proud.** A standard chosen from within.' },
      ],
    });
  });

  it('maps heading levels onto the page: # and ## a heading 2, ### a 3, #### and beyond a 4; underlined lines too', () => {
    expect(md('# One\n## Two\n### Three\n#### Four\n###### Six\n#hashtag')).toEqual([h('One'), h('Two'), h('Three', 3), { type: 'heading', level: 4, text: 'Four' }, { type: 'heading', level: 4, text: 'Six' }, t('#hashtag')]);
    expect(md('Title\n=====\n\nSubtitle\n---\n## Closed ##')).toEqual([h('Title'), h('Subtitle'), h('Closed')]);
  });

  it('keeps hard breaks, marks and safe links; a link the site cannot follow keeps its words; pictures are left out', () => {
    expect(md('one\\\ntwo  \nthree\nfour')).toEqual([t('one\\\ntwo\\\nthree four')]);
    expect(md('*so* **very** `code` [site](https://example.com) and [here](./local) or [top](#top)')).toEqual([t('_so_ **very** `code` [site](https://example.com) and here or top')]);
    expect(paste.blocksFromMarkdown('Look:\n\n![A cat](cat.png)\n\nNice.')).toEqual({ blocks: [t('Look:'), t('Nice.')], pictures: 1 });
  });

  it('makes lists, quotes (a last line with a dash is the source), dividers and code', () => {
    expect(md('- one\n* two\n  still two\n+ three\n\n1. first\n2) second\n\nThe year was\n1990. A good year')).toEqual([t('- one\n- two still two\n- three'), t('1. first\n2. second'), t('The year was 1990. A good year')]);
    expect(md('Intro\n- a\n- b')).toEqual([t('Intro'), t('- a\n- b')]);
    expect(md('> Be better\n> than yesterday.\n> — A wise person\n\n> Just words')).toEqual([
      { type: 'quote', variant: 'block', text: 'Be better than yesterday.', cite: 'A wise person' },
      { type: 'quote', variant: 'block', text: 'Just words' },
    ]);
    expect(md('---\nA\n\n***\n\n- - -\n\nB\n___')).toEqual([t('A'), { type: 'divider' }, t('B')]);
    expect(md('```js\nconst a = 1;\n\n# not a heading\n```')).toEqual([t('`const a = 1;`\\\n`# not a heading`')]);
  });

  it('every block it makes is one the contract accepts', () => {
    for (const b of md(`${story}\n> q\n\n- a\n\n1. b\n\n---\n\n\`\`\`\nx\n\`\`\``)) expect(block.safeParse(b).success, JSON.stringify(b)).toBe(true);
  });

  it('knows what the canvas keeps in place: plain words typed in, nothing for pictures, blocks for anything more', () => {
    expect(paste.pasteKind('just words\non two lines')).toBe('words');
    expect(paste.pasteKind('  \n ')).toBe('nothing');
    expect(paste.pasteKind('![x](y.png)')).toBe('nothing');
    expect(paste.pasteKind('some **bold**')).toBe('blocks');
    expect(paste.pasteKind('one\n\ntwo')).toBe('blocks');
    expect(paste.pasteKind('### Label')).toBe('blocks');
    expect(paste.wordsOfPaste('### **Challenge**\n\nSome *words*')).toBe('Challenge\n\nSome words');
  });

  it('places the blocks at the caret: the words before join the first paragraph and the words after the last', () => {
    const body = [t('Start'), t('Before after'), t('End')];
    const r = paste.pasteAt(body, 1, { replace: true, before: 'Before ', after: ' after' }, md('**one**\n\n## Two\n\nthree '));
    expect(r.body).toEqual([t('Start'), t('Before **one**'), h('Two'), t('three after'), t('End')]);
    expect(r).toMatchObject({ focus: 3, caret: 'three'.length });
    // a heading at either edge: the words round it stay paragraphs of their own
    expect(paste.pasteAt(body, 1, { replace: true, before: 'Before ', after: 'after' }, [h('Only')]).body).toEqual([t('Start'), t('Before'), h('Only'), t('after'), t('End')]);
    // one paragraph: all three join
    expect(paste.pasteAt(body, 1, { replace: true, before: 'a ', after: ' c' }, [t('**b**')])).toEqual({ body: [t('Start'), t('a **b** c'), t('End')], focus: 1, caret: 3 });
    // a new paragraph that isn't in the article yet: the blocks go in, nothing is replaced
    expect(paste.pasteAt(body, 1, { replace: false, before: '', after: '' }, [h('New'), t('x')])).toEqual({ body: [t('Start'), h('New'), t('x'), t('Before after'), t('End')], focus: 2, caret: 'end' });
  });
});

// ---------- the canvas's DOM, back to Markdown ----------
const text = (v: string): MiniNode => ({ nodeType: 3, nodeName: '#text', textContent: v, childNodes: [] });
const el = (name: string, kids: MiniNode[] = [], attrs: Record<string, string> = {}): MiniNode => ({
  nodeType: 1,
  nodeName: name.toUpperCase(),
  get textContent() {
    return kids.map((k) => k.textContent ?? '').join('');
  },
  childNodes: kids,
  getAttribute: (n: string) => attrs[n] ?? null,
});

describe('the canvas DOM back to the Markdown subset', () => {
  it('keeps bold, italic, code, links (their written target) and line breaks, and drops every other element', () => {
    const p = el('p', [
      text('Hello '),
      el('b', [text('bold')]),
      text(', '),
      el('em', [text('italic')]),
      text(', '),
      el('code', [text('x = 1')]),
      text(' and '),
      el('a', [text('a story')], { href: '/atiya/work/a/', 'data-md-href': 'ref:article/a' }),
      el('br'),
      el('span', [text('next '), el('font', [text('line')])]),
      el('img', [], { src: 'x.png' }),
    ]);
    const md = markdownOf(p);
    expect(runs(parseInline(md))).toEqual(runs(inlineOf(p)));
    expect(md).toContain('**bold**');
    expect(md).toContain('[a story](ref:article/a)');
    expect(md).toContain('`x = 1`');
    expect(plainOf(p)).toBe('Hello bold, italic, x = 1 and a storynext line');
  });

  it("drops the browser's trailing placeholder break, collapses white space, and keeps a typed non-breaking space as a space", () => {
    expect(markdownOf(el('p', [text('  one\n  two\u00a0'), el('br')]))).toBe('one two');
  });

  it('turns lists back into lists, one item per li', () => {
    const md = markdownOf(el('ul', [el('li', [text('first')]), text('\n'), el('li', [el('strong', [text('second')])])]));
    expect(parseMarkdown(md)).toEqual([{ t: 'ul', items: [[{ t: 'text', v: 'first' }], [{ t: 'strong', c: [{ t: 'text', v: 'second' }] }]] }]);
  });

  it('leaves out a list item not written in (a new bullet after Enter)', () => {
    expect(markdownOf(el('ul', [el('li', [text('first')]), el('li', [el('br')]), el('li', [text('third')])]))).toBe('- first\n- third');
    expect(markdownOf(el('ol', [el('li', [text('one')]), el('li', [el('br')])]))).toBe('1. one');
  });

  it('never nests a link in a link (a pasted one keeps only its text)', () => {
    const md = markdownOf(el('p', [el('a', [text('out '), el('a', [text('in')], { href: 'https://in' })], { href: 'https://out' })]));
    expect(md).toBe('[out in](https://out)');
  });

  it('round-trips marks in marks by meaning (what a reader sees stays the same)', () => {
    const p = el('p', [el('strong', [text('all '), el('em', [text('both')]), text(' strong')]), text(' plain')]);
    expect(runs(parseInline(markdownOf(p)))).toEqual(runs(inlineOf(p)));
  });
});

// ---------- the site structure ----------
const STRUCTURE: SiteStructure = {
  home: {
    id: 'home',
    kind: 'hub',
    slug: '',
    title: 'Home',
    children: [
      { id: 'lead', kind: 'hub', slug: 'leadership', title: 'Leadership', view: 'bento', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }, { id: 'b', kind: 'item', slug: 'bee', navLabel: 'Bee', item: { type: 'article', id: 'b' } }] },
      { id: 'notes', kind: 'hub', slug: 'notes', title: 'Notes', view: 'list', children: [] },
    ],
  },
  menus: { primary: [{ node: 'lead' }, { node: 'b' }, { label: 'GitHub', href: 'https://github.com/x' }] },
};

describe('the site structure', () => {
  it('lists hubs in tree order with their paths, finds them, and says where an item sits', () => {
    expect(hubs(STRUCTURE)).toEqual([
      { id: 'home', title: 'Home', path: '/', depth: 0 },
      { id: 'lead', title: 'Leadership', path: '/leadership/', depth: 1 },
      { id: 'notes', title: 'Notes', path: '/notes/', depth: 1 },
    ]);
    expect(findHub(STRUCTURE, 'notes')?.title).toBe('Notes');
    expect(findHub(STRUCTURE, 'nope')).toBeUndefined();
    expect(sectionOf(STRUCTURE, { type: 'article', id: 'b' })).toBe('lead');
    expect(sectionOf(STRUCTURE, { type: 'article', id: 'z' })).toBeNull();
    expect([...nodeIds(STRUCTURE)].sort()).toEqual(['a', 'b', 'home', 'lead', 'notes']);
    expect([...childSlugs(STRUCTURE, 'lead', (i) => (i.id === 'a' ? 'a-slug' : undefined))].sort()).toEqual(['a-slug', 'bee']);
  });

  it('places, moves and takes items off the site without changing the structure it was given', () => {
    const before = JSON.stringify(STRUCTURE);
    const placed = place(STRUCTURE, 'notes', { type: 'article', id: 'a' }, 'a');
    expect(sectionOf(placed, { type: 'article', id: 'a' })).toBe('notes');
    expect(findHub(placed, 'lead')?.children).toHaveLength(1);
    const off = unplace(STRUCTURE, { type: 'article', id: 'b' });
    expect(sectionOf(off, { type: 'article', id: 'b' })).toBeNull();
    const moved = reorder(STRUCTURE, 'lead', 0, 1);
    expect(findHub(moved, 'lead')?.children?.map((c) => c.id)).toEqual(['b', 'a']);
    expect(JSON.stringify(STRUCTURE)).toBe(before);
  });

  it("edits a hub's fields (an empty menu label or summary is removed) and adds hubs", () => {
    const edited = updateHub(STRUCTURE, 'notes', { title: 'Field notes', navLabel: '', summary: 'Short notes.' });
    expect(findHub(edited, 'notes')).toMatchObject({ title: 'Field notes', summary: 'Short notes.' });
    expect(findHub(edited, 'notes')).not.toHaveProperty('navLabel');
    const added = addHub(STRUCTURE, 'home', { id: 'talks', kind: 'hub', slug: 'talks', title: 'Talks', view: 'list', children: [] });
    expect(hubs(added).map((x) => x.path)).toContain('/talks/');
    expect(findHub(updateHub(STRUCTURE, 'notes', { view: 'tiles' }), 'notes')?.view).toBe('tiles');
  });

  it('keeps the navigation through every operation on the tree (documentation/sections/spec.md §7.2)', () => {
    const menus = JSON.stringify(STRUCTURE.menus);
    const ops = [
      place(STRUCTURE, 'notes', { type: 'article', id: 'a' }, 'a'),
      place(STRUCTURE, 'notes', { type: 'article', id: 'new' }, 'new'),
      reorder(STRUCTURE, 'lead', 0, 1),
      updateHub(STRUCTURE, 'notes', { title: 'Field notes' }),
      addHub(STRUCTURE, 'home', { id: 'talks', kind: 'hub', slug: 'talks', title: 'Talks', children: [] }),
      unplace(STRUCTURE, { type: 'article', id: 'a' }),
    ];
    for (const o of ops) expect(JSON.stringify(o.menus)).toBe(menus);
  });

  it("moves a page with its node, so its address and its navigation entry follow it (V21); taking it off the site takes its entry too", () => {
    const moved = place(STRUCTURE, 'notes', { type: 'article', id: 'b' }, 'fresh-id');
    const node = findHub(moved, 'notes')?.children?.[0];
    expect(node).toEqual({ id: 'b', kind: 'item', slug: 'bee', navLabel: 'Bee', item: { type: 'article', id: 'b' } });
    expect(nodeOf(moved, { type: 'article', id: 'b' })?.id).toBe('b');
    expect(moved.menus?.primary).toEqual(STRUCTURE.menus?.primary);
    const off = unplace(STRUCTURE, { type: 'article', id: 'b' });
    expect(off.menus?.primary).toEqual([{ node: 'lead' }, { label: 'GitHub', href: 'https://github.com/x' }]);
  });

  it('moves several pages together, in the order given, each with its node, to a place among the pages that stay (a selection in the list)', () => {
    const A = { type: 'article', id: 'a' } as const;
    const B = { type: 'article', id: 'b' } as const;
    const NEW = { type: 'article', id: 'new' } as const;
    const both = placeAll(STRUCTURE, 'notes', [{ item: B, nodeId: 'x' }, { item: A, nodeId: 'y' }]);
    expect(findHub(both, 'notes')?.children?.map((c) => c.id)).toEqual(['b', 'a']);
    expect(findHub(both, 'lead')?.children).toEqual([]);
    expect(nodeOf(both, B)).toEqual(nodeOf(STRUCTURE, B));
    expect(both.menus).toEqual(STRUCTURE.menus);
    const three = placeAll(STRUCTURE, 'lead', [{ item: NEW, nodeId: 'new' }], 1);
    expect(findHub(three, 'lead')?.children?.map((c) => c.id)).toEqual(['a', 'new', 'b']);
    // a and new leave, b stays: index 1 is after b
    const after = placeAll(three, 'lead', [{ item: A, nodeId: 'a' }, { item: NEW, nodeId: 'new' }], 1);
    expect(findHub(after, 'lead')?.children?.map((c) => c.id)).toEqual(['b', 'a', 'new']);
    expect(place(STRUCTURE, 'notes', A, 'a')).toEqual(placeAll(STRUCTURE, 'notes', [{ item: A, nodeId: 'a' }]));
  });
});

describe('the navigation, as edit mode changes it (documentation/sections/spec.md §7.3)', () => {
  it('puts a node in (at the end) and takes it out; a second time changes nothing', () => {
    expect(inMenu(STRUCTURE, 'notes')).toBe(false);
    const on = setInMenu(STRUCTURE, 'notes', true);
    expect(menuOf(on).at(-1)).toEqual({ node: 'notes' });
    expect(setInMenu(on, 'notes', true)).toBe(on);
    expect(menuOf(setInMenu(on, 'notes', false))).toEqual(menuOf(STRUCTURE));
    expect(setInMenu(STRUCTURE, 'notes', false)).toBe(STRUCTURE);
    // a structure without a menu gets one
    const bare: SiteStructure = { home: STRUCTURE.home };
    expect(menuOf(setInMenu(bare, 'lead', true))).toEqual([{ node: 'lead' }]);
  });

  it('adds a link, moves an entry within the ends, relabels (an empty label goes back to the node’s own; a link keeps one) and removes', () => {
    const linked = addLink(STRUCTURE, 'Mail', 'mailto:a@b.c');
    expect(menuOf(linked).at(-1)).toEqual({ label: 'Mail', href: 'mailto:a@b.c' });
    expect(menuOf(moveEntry(STRUCTURE, 1, -1)).map((e) => ('node' in e ? e.node : e.label))).toEqual(['b', 'lead', 'GitHub']);
    expect(moveEntry(STRUCTURE, 0, -1)).toBe(STRUCTURE);
    expect(moveEntry(STRUCTURE, 2, 1)).toBe(STRUCTURE);
    const named = relabelEntry(STRUCTURE, 0, ' Leading ');
    expect(menuOf(named)[0]).toEqual({ node: 'lead', label: 'Leading' });
    expect(menuOf(relabelEntry(named, 0, ''))[0]).toEqual({ node: 'lead' });
    expect(menuOf(relabelEntry(STRUCTURE, 2, ''))[2]).toEqual({ label: 'GitHub', href: 'https://github.com/x' });
    expect(menuOf(relabelEntry(STRUCTURE, 2, 'Code'))[2]).toEqual({ label: 'Code', href: 'https://github.com/x' });
    expect(menuOf(removeEntry(STRUCTURE, 1))).toEqual([{ node: 'lead' }, { label: 'GitHub', href: 'https://github.com/x' }]);
    // the tree is untouched by all of it
    expect(removeEntry(STRUCTURE, 1).home).toEqual(STRUCTURE.home);
  });
});

describe('the planet, as edit mode changes it (documentation/sections/spec.md §7.4)', () => {
  const PLANET: PlanetStructure = {
    places: [
      { id: 'workshop', title: 'Workshop', kicker: 'K', summary: 'S', site: 'work' },
      { id: 'library', title: 'Library', kicker: 'K', summary: 'S', site: 'writing' },
    ],
  };
  const SITE: SiteStructure = {
    home: {
      id: 'home',
      kind: 'hub',
      slug: '',
      title: 'Home',
      children: [
        { id: 'work', kind: 'hub', slug: 'work', title: 'Work', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] },
        { id: 'talks', kind: 'hub', slug: 'talks', title: 'Talks', children: [{ id: 't', kind: 'item', item: { type: 'article', id: 't' } }] },
      ],
    },
  };

  it('a page is in the building that shows its section, and only there (§5.2)', () => {
    expect(planet.placeOfSection(PLANET, 'writing')).toBe('library');
    expect(planet.placeOfSection(PLANET, 'talks')).toBeUndefined();
    expect(planet.placeOfPage(PLANET, SITE, 'a')).toBe('workshop');
    expect(planet.placeOfPage(PLANET, SITE, 't')).toBeUndefined();
    expect(planet.placeOfPage(PLANET, SITE, 'nowhere')).toBeUndefined();
  });

  it("changes a building's words and section, keeping the rest", () => {
    const before = JSON.stringify(PLANET);
    const edited = planet.updatePlace(PLANET, 'workshop', { kicker: 'Case studies', site: 'talks' });
    expect(edited.places[0]).toEqual({ id: 'workshop', title: 'Workshop', kicker: 'Case studies', summary: 'S', site: 'talks' });
    expect(edited.places[1]).toEqual(PLANET.places[1]);
    expect(JSON.stringify(PLANET)).toBe(before);
  });
});

// ---------- IDs and slugs ----------
describe('IDs, slugs and dates', () => {
  it('makes slugs lowercase and hyphenated, drops accents and odd characters, and caps them at 60', () => {
    expect(slugify('Do What Makes You Proud!')).toBe('do-what-makes-you-proud');
    expect(slugify('Café résumé — 2026')).toBe('cafe-resume-2026');
    expect(slugify('   ')).toBe('untitled');
    expect(slugify('word '.repeat(30)).length).toBeLessThanOrEqual(60);
    expect(slugify('word '.repeat(30))).not.toMatch(/-$/);
  });

  it('numbers a taken ID, and writes dates as the content model does', () => {
    expect(unique('a', new Set())).toBe('a');
    expect(unique('a', new Set(['a', 'a-2']))).toBe('a-3');
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

// ---------- the Publish screen's names ----------
const titles: Titles = { article: (id) => ({ a: 'Do what makes you proud' })[id], person: (id) => ({ prabin: 'Prabin Pebam' })[id] };

describe('changes, named as resources', () => {
  it('names each kind of file in words', () => {
    expect(resourceName('/content/articles/a.json', titles)).toEqual({ kind: 'Article', name: 'Do what makes you proud' });
    expect(resourceName('/content/articles/zz.json', titles)).toEqual({ kind: 'Article', name: 'zz' });
    expect(resourceName('/content/media/articles/a/cover.webp', titles)).toEqual({ kind: 'Media', name: 'articles/a/cover' });
    expect(resourceName('/content/media/articles/a/cover.json', titles)).toEqual({ kind: 'Media', name: 'articles/a/cover' });
    expect(resourceName('/content/people/prabin.json', titles)).toEqual({ kind: 'Person', name: 'Prabin Pebam' });
    expect(resourceName('/content/structures/site.json', titles).kind).toBe('Sections');
    expect(resourceName('/content/site.json', titles).kind).toBe('Settings');
  });

  it("groups a picture's master and sidecar into one resource, which is new only when both are", () => {
    expect(resourceOf('/content/media/shared/x.webp')).toBe(resourceOf('/content/media/shared/x.json'));
    // a picture's dark version is part of the picture
    expect(resourceOf('/content/media/shared/x.dark.webp')).toBe(resourceOf('/content/media/shared/x.json'));
    const grouped = groupChanges(
      [
        { key: '/content/site.json', status: 'changed' },
        { key: '/content/media/shared/x.json', status: 'added' },
        { key: '/content/media/shared/x.webp', status: 'added' },
        { key: '/content/media/shared/y.json', status: 'changed' },
        { key: '/content/media/shared/y.webp', status: 'added' },
        { key: '/content/articles/a.json', status: 'changed' },
      ],
      titles,
    );
    expect(grouped.map((g) => [g.kind, g.name, g.status, g.keys.length])).toEqual([
      ['Article', 'Do what makes you proud', 'changed', 1],
      ['Media', 'shared/x', 'added', 2],
      ['Media', 'shared/y', 'changed', 2],
      ['Settings', 'The site settings', 'changed', 1],
    ]);
  });

  it('suggests a message that names what changed', () => {
    expect(suggestMessage([{ key: '/content/articles/a.json' }, { key: '/content/media/a/x.webp' }, { key: '/content/media/a/x.json' }], titles)).toBe('Content: Do what makes you proud, 1 picture');
    expect(suggestMessage([{ key: '/content/site.json' }, { key: '/content/people/prabin.json' }], titles)).toBe("Content: the site settings, Prabin Pebam's profile");
    expect(suggestMessage([], titles)).toBe('Content: updates');
    expect(suggestMessage(['a', 'b', 'c', 'd'].map((id) => ({ key: `/content/articles/${id}.json` })), titles)).toMatch(/ and 1 more$/);
  });

  it("links a GitHub remote (https or ssh) to its Actions page, and nothing else", () => {
    expect(actionsUrl('https://github.com/prabinpebam/atiya.git')).toBe('https://github.com/prabinpebam/atiya/actions');
    expect(actionsUrl('git@github.com:prabinpebam/atiya.git')).toBe('https://github.com/prabinpebam/atiya/actions');
    expect(actionsUrl('https://github.com/prabinpebam/atiya')).toBe('https://github.com/prabinpebam/atiya/actions');
    expect(actionsUrl('E:/x/.editor-test-remote.git')).toBeNull();
    expect(actionsUrl('https://gitlab.com/a/b.git')).toBeNull();
  });
});

// ---------- the reference graph ----------
describe('the reference graph (Used in, and whether a picture can be deleted)', () => {
  const article = (id: string, over: Partial<Article>): Article => ({ id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 's', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], ...over }) as Article;
  const index = {
    articles: new Map([
      ['a', article('a', { hero: { media: 'articles/a/cover' }, body: [{ type: 'figure', media: 'shared/x', width: 'content' }, { type: 'gallery', items: [{ media: 'shared/x' }, { media: 'shared/y' }] } as unknown as Block] })],
      ['b', article('b', { body: [{ type: 'video', provider: 'youtube', id: 'abcdef', title: 'V', poster: 'shared/y' } as unknown as Block], seo: { image: 'shared/z' } })],
    ]),
    people: new Map([['p', { id: 'p', name: 'Pat', avatar: 'people/p/portrait' }]]),
    site: { name: 'N', description: 'D', owner: 'p', locale: 'en' as const, socialImage: 'shared/z' },
  };

  it('finds every use (heroes, blocks, video posters, social images, avatars and the site), once per document', () => {
    const refs = references(index);
    expect(refs.get('shared/x')).toEqual([{ label: 'Article: A', href: 'articles/a/' }]);
    expect(refs.get('shared/y')?.map((r) => r.label)).toEqual(['Article: A', 'Article: B']);
    expect(refs.get('shared/z')?.map((r) => r.label)).toEqual(['Article: B', 'Site settings']);
    expect(refs.get('people/p/portrait')?.[0].label).toBe('Person: Pat');
    expect(refs.get('articles/a/cover')?.[0].href).toBe('articles/a/');
    expect(refs.get('shared/unused')).toBeUndefined();
  });

  it("names a picture's folder", () => {
    expect(ownerOf('articles/a/cover')).toBe('articles/a');
    expect(ownerOf('shared/x')).toBe('shared');
    expect(ownerLabel(index, 'articles/a')).toBe('Article: A');
    expect(ownerLabel(index, 'people/p')).toBe('Person: Pat');
    expect(ownerLabel(index, 'shared')).toBe('Shared');
    expect(ownerLabel(index, 'site')).toBe('The site');
  });
});

// ---------- the save queue ----------
describe('the save queue: never two saves at once', () => {
  type Job = { n: number[] };
  const deferred = () => {
    let done!: (o: Outcome) => void;
    return { promise: new Promise<Outcome>((r) => (done = r)), done };
  };

  it('runs one save at a time, folding what was asked meanwhile into one next save, and keeps newer local edits', async () => {
    const started: Job[] = [];
    const gates: ReturnType<typeof deferred>[] = [];
    let running = 0;
    let most = 0;
    const saw: boolean[] = [];
    const q = new SaveQueue<Job>(
      (waiting, request) => ({ n: [...(waiting?.n ?? []), ...request.n] }),
      async (job, more) => {
        running++;
        most = Math.max(most, running);
        started.push(job);
        const g = deferred();
        gates.push(g);
        const outcome = await g.promise;
        saw.push(more());
        running--;
        return outcome;
      },
    );
    const first = q.push({ n: [1] });
    expect(q.pending).toBe(true);
    void q.push({ n: [2] });
    void q.push({ n: [3] });
    expect(started).toEqual([{ n: [1] }]);
    gates[0].done('ok');
    await new Promise((r) => setTimeout(r));
    expect(started).toEqual([{ n: [1] }, { n: [2, 3] }]);
    gates[1].done('ok');
    await first;
    expect(most).toBe(1);
    expect(saw).toEqual([true, false]);
    expect(q.pending).toBe(false);
  });

  it('carries on after a refused save, and stops for good after a conflict', async () => {
    const outcomes: Outcome[] = ['failed', 'stop'];
    const runs: number[] = [];
    const q = new SaveQueue<Job>(
      (w, r) => ({ n: [...(w?.n ?? []), ...r.n] }),
      async (job) => {
        runs.push(job.n[0]);
        return outcomes.shift() ?? 'ok';
      },
    );
    await q.push({ n: [1] });
    expect(q.stopped).toBe(false);
    await q.push({ n: [2] });
    expect(q.stopped).toBe(true);
    await q.push({ n: [3] });
    expect(runs).toEqual([1, 2]);
  });

  it('is free again after a save throws (the network failed), so the next one can run', async () => {
    let calls = 0;
    const q = new SaveQueue<Job>(
      (w, r) => ({ n: [...(w?.n ?? []), ...r.n] }),
      async () => {
        if (++calls === 1) throw new Error('offline');
        return 'ok';
      },
    );
    await expect(q.push({ n: [1] })).rejects.toThrow('offline');
    expect(q.pending).toBe(false);
    await q.push({ n: [2] });
    expect(calls).toBe(2);
  });
});
