import { describe, expect, it } from 'vitest';
import { mergeAfterAnchors } from '../../src/site/content/sectionOrder';

describe('section order with private pages', () => {
  it('keeps consecutive private pages in source order before the first and after the same open page', () => {
    const open = [{ id: 'open-a' }, { id: 'open-b' }];
    const hidden = [
      { after: null, value: { id: 'private-start-a' } },
      { after: null, value: { id: 'private-start-b' } },
      { after: 'open-a', value: { id: 'private-a' } },
      { after: 'open-a', value: { id: 'private-b' } },
    ];
    expect(mergeAfterAnchors(open, hidden, (item) => item.id).map((item) => item.id)).toEqual([
      'private-start-a',
      'private-start-b',
      'open-a',
      'private-a',
      'private-b',
      'open-b',
    ]);
  });

  it('puts an item with a missing public anchor at the end without disturbing its group', () => {
    const merged = mergeAfterAnchors(
      [{ id: 'open' }],
      [
        { after: 'missing', value: { id: 'orphan-a' } },
        { after: 'missing', value: { id: 'orphan-b' } },
      ],
      (item) => item.id,
    );
    expect(merged.map((item) => item.id)).toEqual(['open', 'orphan-a', 'orphan-b']);
  });
});
