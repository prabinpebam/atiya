import { describe, expect, it } from 'vitest';
import type { Block } from '../../src/site/content/schema';
import { applyDecisions, applyLabel, changesOf, conflictOf, headLine, kindTag, reviewItems, sameBlock, unchangedLine } from '../../src/site/editor/model/aiReview';

const t = (key: string, markdown: string): Block => ({ type: 'text', key, markdown }) as Block;
const h = (key: string, text: string): Block => ({ type: 'heading', key, level: 2, text }) as Block;
const base: Block[] = [t('aaaaaa', 'One.'), h('bbbbbb', 'Two'), t('cccccc', 'Three.'), t('dddddd', 'Four.'), t('eeeeee', 'Five.')];
const label = (type: string) => ({ text: 'Text', heading: 'Heading', list: 'List' })[type] ?? type;

describe('the review (ai-editing §8)', () => {
  it('compares blocks by content, whatever their keys or field order', () => {
    expect(sameBlock(t('aaaaaa', 'One.'), { markdown: 'One.', type: 'text', key: 'zzzzzz' } as Block)).toBe(true);
    expect(sameBlock(t('aaaaaa', 'One.'), t('aaaaaa', 'One!'))).toBe(false);
  });

  it('finds each kind of change by key, in the article order, with unchanged runs folded', () => {
    const proposed: Block[] = [
      t('aaaaaa', 'One, shorter.'),
      h('bbbbbb', 'Two'),
      { type: 'list', key: 'cccccc', style: 'bullet', items: ['Three'] } as unknown as Block,
      t('newone', 'Added.'),
      t('eeeeee', 'Five.'),
    ];
    const items = reviewItems(base, proposed);
    expect(items.map((i) => ('change' in i ? `${i.change.kind}:${i.change.key}` : `same:${i.unchanged}`))).toEqual([
      'changed:aaaaaa',
      'same:1',
      'retyped:cccccc',
      'removed:dddddd',
      'added:newone',
      'same:1',
    ]);
    expect(changesOf(items).find((c) => c.key === 'newone')!.afterKey).toBe('cccccc');
  });

  it('finds a move, and a move that changed the block too', () => {
    const moved = reviewItems(base, [base[0], base[3], base[1], base[2], base[4]]);
    expect(changesOf(moved).map((c) => [c.kind, c.key, c.afterKey])).toEqual([['moved', 'dddddd', 'aaaaaa']]);
    const both = reviewItems(base, [base[0], t('dddddd', 'Four, moved.'), base[1], base[2], base[4]]);
    const c = changesOf(both)[0];
    expect([c.kind, c.edited]).toEqual(['moved', true]);
    expect(kindTag(c, label)).toBe('Moved and changed');
  });

  it('says nothing changed when nothing did', () => {
    expect(reviewItems(base, base)).toEqual([{ unchanged: 5 }]);
  });

  it('applies only the accepted changes, as one body', () => {
    const proposed: Block[] = [t('aaaaaa', 'One, shorter.'), h('bbbbbb', 'Two'), t('cccccc', 'Three, rewritten.'), t('newone', 'Added.'), t('eeeeee', 'Five.')];
    const items = reviewItems(base, proposed);
    const out = applyDecisions(base, items, { aaaaaa: 'accept', cccccc: 'reject', newone: 'accept', dddddd: 'accept' });
    expect(out.map((b) => [b.key, (b as { markdown?: string }).markdown ?? (b as { text?: string }).text])).toEqual([
      ['aaaaaa', 'One, shorter.'],
      ['bbbbbb', 'Two'],
      ['cccccc', 'Three.'],
      ['newone', 'Added.'],
      ['eeeeee', 'Five.'],
    ]);
    // undecided changes are dropped
    expect(applyDecisions(base, items, {})).toBe(base);
  });

  it('places an accepted insert after the nearest neighbour the body still has', () => {
    const proposed: Block[] = [...base.slice(0, 3), t('firstn', 'A.'), t('second', 'B.'), ...base.slice(3)];
    const items = reviewItems(base, proposed);
    const out = applyDecisions(base, items, { firstn: 'reject', second: 'accept' });
    expect(out.map((b) => b.key)).toEqual(['aaaaaa', 'bbbbbb', 'cccccc', 'second', 'dddddd', 'eeeeee']);
  });

  it('applies a move', () => {
    const items = reviewItems(base, [base[0], base[3], base[1], base[2], base[4]]);
    expect(applyDecisions(base, items, { dddddd: 'accept' }).map((b) => b.key)).toEqual(['aaaaaa', 'dddddd', 'bbbbbb', 'cccccc', 'eeeeee']);
  });

  it('applies on the article as it is now: your other edits stay, and a block you removed is skipped', () => {
    const proposed: Block[] = [t('aaaaaa', 'One, shorter.'), ...base.slice(1, 4), t('eeeeee', 'Five, longer.')];
    const items = reviewItems(base, proposed);
    const now = [t('aaaaaa', 'One.'), h('bbbbbb', 'Two, mine'), t('cccccc', 'Three.'), t('dddddd', 'Four.')];
    const out = applyDecisions(now, items, { aaaaaa: 'accept', eeeeee: 'accept' });
    expect(out.map((b) => b.key)).toEqual(['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd']);
    expect((out[1] as { text: string }).text).toBe('Two, mine');
    expect((out[0] as { markdown: string }).markdown).toBe('One, shorter.');
  });

  it('knows when you changed or removed a block since (§8.3)', () => {
    const items = reviewItems(base, [t('aaaaaa', 'One, shorter.'), ...base.slice(1, 4), t('eeeeee', 'Five, longer.'), t('newone', 'Added.')]);
    const [a, e, added] = changesOf(items);
    const now = [t('aaaaaa', 'One, mine.'), ...base.slice(1, 4)];
    expect(conflictOf(a, now)).toBe('mine');
    expect(conflictOf(e, now)).toBe('removed');
    expect(conflictOf(added, now)).toBeNull();
    expect(conflictOf(a, base)).toBeNull();
  });

  it('says it in the spec\'s words', () => {
    expect(headLine('OpenAI', 6, 'Shortened the intro and merged two sections.')).toBe('OpenAI proposed 6 changes: Shortened the intro and merged two sections.');
    expect(headLine('Ollama', 1, '')).toBe('Ollama proposed 1 change.');
    expect(applyLabel(4)).toBe('Apply 4 changes');
    expect(applyLabel(1)).toBe('Apply 1 change');
    expect(unchangedLine(12)).toBe('12 blocks unchanged');
    const retyped = changesOf(reviewItems([t('aaaaaa', 'x')], [{ type: 'list', key: 'aaaaaa', style: 'bullet', items: ['x'] } as unknown as Block]))[0];
    expect(kindTag(retyped, label)).toBe('Retyped (from Text to List)');
  });
});
