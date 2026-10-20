import { describe, expect, it } from 'vitest';
import { BLOCK_KEY, findKey, makeKey, withKeys, withoutKeys } from '../../src/site/editor/model/keys';
import { duplicate, isMeaningful, replace } from '../../src/site/editor/model/ops';
import type { Article, Block } from '../../src/site/content/schema';
import { block } from '../../src/site/content/schema';
import { keyedText } from '../../scripts/add-block-keys.mjs';

/** A generator that walks through the alphabet, so keys are predictable. */
const counter = () => {
  let n = 0;
  return (size: number) => Uint8Array.from({ length: size }, (_, i) => (i === size - 1 ? n++ : 0));
};

describe('block keys (ai-editing.md §3)', () => {
  it('every block type takes a key', () => {
    expect(block.options.length).toBeGreaterThanOrEqual(12);
    for (const o of block.options) expect(Object.keys((o as unknown as { shape: object }).shape)).toContain('key');
  });

  it('makes six lowercase letters and digits, never one already taken', () => {
    for (let i = 0; i < 200; i++) expect(makeKey()).toMatch(BLOCK_KEY);
    const random = counter();
    expect(makeKey(new Set(['aaaaaa', 'aaaaab']), random)).toBe('aaaaac');
  });

  it('fills missing keys and keeps the ones there', () => {
    const body = [{ type: 'text', markdown: 'A', key: 'keep01' }, { type: 'text', markdown: 'B' }];
    const out = withKeys(body);
    expect(out[0]).toBe(body[0]);
    expect(out[1].key).toMatch(BLOCK_KEY);
    expect(out[1].key).not.toBe('keep01');
    expect(out[1]).toMatchObject({ type: 'text', markdown: 'B' });
  });

  it('re-keys the later of two blocks with the same key (a duplicate keeps the original its name)', () => {
    const body = [{ markdown: 'A', key: 'same01' }, { markdown: 'A copy', key: 'same01' }, { markdown: 'C', key: 'BAD' }];
    const out = withKeys(body);
    expect(out[0].key).toBe('same01');
    expect(out[1].key).not.toBe('same01');
    expect(out[2].key).toMatch(BLOCK_KEY);
    expect(new Set(out.map((b) => b.key)).size).toBe(3);
  });

  it('returns the same body when every block is keyed, and finds a block by key', () => {
    const body = [{ key: 'one001' }, { key: 'two002' }];
    expect(withKeys(body)).toBe(body);
    expect(findKey(body, 'two002')).toEqual({ block: body[1], at: 1 });
    expect(findKey(body, 'nope00')).toBeNull();
  });

  it('the migration keys an article, changes nothing else, and run twice changes nothing', () => {
    const article = { id: 'a', title: 'A', body: [{ type: 'heading', level: 2, text: 'One' }, { type: 'text', markdown: 'Words.' }] };
    const first = keyedText(`${JSON.stringify(article, null, 2)}\n`);
    expect(first).not.toBeNull();
    const keyed = JSON.parse(first!);
    expect(keyed.body.map((b: { key?: string }) => b.key).every((k: unknown) => typeof k === 'string' && BLOCK_KEY.test(k))).toBe(true);
    expect({ ...keyed, body: keyed.body.map(({ key: _, ...rest }: { key?: string }) => rest) }).toEqual(article);
    expect(keyedText(first!)).toBeNull();
  });

  it('a duplicate is re-keyed on save, a rebuilt block keeps its key, and a key alone is no meaningful change', () => {
    const body: Block[] = [{ type: 'text', markdown: 'A', key: 'orig01' }];
    const twice = withKeys(duplicate(body, 0));
    expect(twice[0].key).toBe('orig01');
    expect(twice[1].key).toMatch(BLOCK_KEY);
    expect(twice[1].key).not.toBe('orig01');
    expect(replace(body, 0, { type: 'heading', level: 2, text: 'A' })[0].key).toBe('orig01');
    expect(replace(body, 0, { type: 'text', markdown: 'B', key: 'mine01' })[0].key).toBe('mine01');
    const article = { id: 'a', title: 'A', summary: 'S', body: [{ type: 'text', markdown: 'A' }] } as unknown as Article;
    expect(isMeaningful(article, { ...article, body: withKeys(article.body) })).toBe(false);
    expect(withoutKeys(withKeys(article.body))).toEqual(article.body);
  });
});
