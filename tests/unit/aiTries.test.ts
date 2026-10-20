import { describe, expect, it } from 'vitest';
import { STOPPED_TRY, stepTo, stoppedTry, triesLine, tryLine } from '../../src/site/editor/model/aiTries';
import type { Block } from '../../src/site/content/schema';

const text = { type: 'text', key: 'k1', markdown: 'The old words, all of them.' } as Block;
const quote = { type: 'quote', key: 'k2', text: 'An old quote.' } as Block;
const figure = { type: 'figure', key: 'k3', media: 'ref:media/a' } as unknown as Block;

describe('Ask AI tries', () => {
  it('names where the result bar is only once there are two', () => {
    expect(triesLine(0, 1)).toBe('');
    expect(triesLine(0, 2)).toBe('1 of 2');
    expect(triesLine(2, 3)).toBe('3 of 3');
    expect(tryLine(1, 3, 'Shortened it')).toBe('Try 2 of 3: Shortened it');
  });

  it('steps between tries without leaving the list', () => {
    expect(stepTo(0, -1, 3)).toBe(0);
    expect(stepTo(0, 1, 3)).toBe(1);
    expect(stepTo(2, 1, 3)).toBe(2);
    expect(stepTo(0, 1, 0)).toBe(0);
  });

  it('keeps what arrived when stopped, in the field that streams', () => {
    expect(stoppedTry(text, 'The new')).toEqual({ summary: STOPPED_TRY, block: { type: 'text', key: 'k1', markdown: 'The new' } });
    expect(stoppedTry(quote, 'A new')).toEqual({ summary: STOPPED_TRY, block: { type: 'quote', key: 'k2', text: 'A new' } });
  });

  it('keeps nothing when no words came, or for a block whose words never stream', () => {
    expect(stoppedTry(text, '  ')).toBeNull();
    expect(stoppedTry(figure, 'words')).toBeNull();
    expect(stoppedTry(undefined, 'words')).toBeNull();
  });
});
