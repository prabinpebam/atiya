/**
 * The generated responsive helpers (src/site/design/responsive.ts, from the site's tokens): the queries and
 * picture sizes scripts and props write, which must match the breakpoint and size tokens CSS reads.
 */
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, MEASURES, PICTURE_WIDTHS, media, sizes, width } from '../../src/site/design/responsive';
import { siteTokens } from '../../src/site/design/tokens';
import { resolve } from '../../src/site/design/tokenModel';

const model = siteTokens();
const rem = (path: string) => resolve(model.byPath.get(path)!, model.byPath);

describe('responsive.ts', () => {
  it('holds the tokens’ values', () => {
    for (const [k, v] of Object.entries(BREAKPOINTS)) expect(`${v}rem`, k).toBe(rem(`breakpoint.${k}`));
    for (const [k, v] of Object.entries(MEASURES)) expect(`${v}rem`, k).toBe(rem(`size.${k}`));
    expect(PICTURE_WIDTHS['story-card-row-picture']).toBe(Number.parseFloat(rem('c.story-card.row-picture')));
  });

  it('media() writes width queries, and a height query for short', () => {
    expect(media('md')).toBe('(max-width: 56rem)');
    expect(media('sm', 'min')).toBe('(min-width: 40rem)');
    expect(media('short')).toBe('(max-height: 30rem)');
  });

  it('sizes() writes the steps, then the width beyond them', () => {
    expect(sizes(['popout', '92vw'], 'popout')).toBe('(max-width: 52rem) 92vw, 52rem');
    expect(sizes(['sm', '92vw'], ['lg', '46vw'], '30vw')).toBe('(max-width: 40rem) 92vw, (max-width: 72rem) 46vw, 30vw');
    expect(sizes(['sm', 'story-card-row-picture-compact'], 'story-card-row-picture')).toBe('(max-width: 40rem) 6rem, 11rem');
    expect(sizes('collection-slide')).toBe('18rem');
  });

  it('a share of a measure rounds up to a whole rem', () => {
    expect(width({ share: 'wide', of: 3 })).toBe('26rem');
    expect(width({ share: 'measure', of: 2 })).toBe('20rem');
  });
});
