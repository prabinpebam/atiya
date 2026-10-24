import { describe, expect, it } from 'vitest';
import { storyBaselineGaps } from '../../scripts/lib/storyBaselines.mjs';

describe('story screenshots', () => {
  it('every story example has its baseline, and every baseline its example', () => {
    const gaps = storyBaselineGaps(process.cwd()).map(
      (g) => `${g.story}: ${g.missing.length ? `no baseline for example ${g.missing.join(', ')}` : ''}${g.missing.length && g.stale.length ? '; ' : ''}${g.stale.length ? `baselines left for example ${g.stale.join(', ')}` : ''} (run npm run visual:update -- -g "${g.story.replace('editor ', '')}" and look at each image)`,
    );
    expect(gaps).toEqual([]);
  });
});
