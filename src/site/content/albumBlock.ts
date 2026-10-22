/**
 * The album block's place in a page's outline (documentation/gallery/spec.md §7.2): its band's title is one
 * heading level below the heading it follows, or a heading 2 under the page's title when no heading comes
 * before it. Pure, for Blocks.astro and its tests.
 */
import type { Block } from './schema';

/** The heading level of the album block at `index` in `blocks`: 2 to 5. */
export function albumHeadingLevel(blocks: readonly Block[], index: number): 2 | 3 | 4 | 5 {
  for (let n = Math.min(index, blocks.length) - 1; n >= 0; n--) {
    const b = blocks[n]!;
    if (b.type === 'heading') return (b.level + 1) as 3 | 4 | 5;
  }
  return 2;
}
