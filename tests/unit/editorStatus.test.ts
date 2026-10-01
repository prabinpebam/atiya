/**
 * The save status's words (src/site/editor/model/status.ts; documentation/editor/spec.md §2.1): each
 * state's line, and how long ago a save was, the way a document app says it.
 */
import { describe, expect, it } from 'vitest';
import { SAVE_TEXT, savedLine } from '../../src/site/editor/model/status';

describe('the save status', () => {
  it('has words for every state', () => {
    expect(SAVE_TEXT).toMatchObject({ dirty: 'Unsaved changes', saving: 'Saving\u2026', saved: 'Saved', failed: 'Not saved' });
    expect(SAVE_TEXT.offline).toMatch(/^Offline/);
  });

  it('says how long ago a save was: just now, minutes, then the time', () => {
    const at = new Date(2026, 9, 1, 9, 5).getTime();
    expect(savedLine(at, at + 10_000)).toBe('just now');
    expect(savedLine(at, at + 44_000)).toBe('just now');
    expect(savedLine(at, at + 90_000)).toBe('2 min ago');
    expect(savedLine(at, at + 59 * 60_000)).toBe('59 min ago');
    expect(savedLine(at, at + 3 * 3600_000)).toBe('at 09:05');
    expect(savedLine(at, at - 5_000)).toBe('just now');
  });
});
