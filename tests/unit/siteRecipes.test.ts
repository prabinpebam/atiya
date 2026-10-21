/**
 * The website's recipes written once (DS2-18) and the container queries' script side (DS2-08): the token
 * model writes a typography composite as the font shorthand and a picture's shadow as a filter, the media
 * helpers pick a video's sources and say when a column is narrower than a breakpoint, and the design
 * library documents the types a component re-exports from tier 0. Docs: documentation/site-ui/design-system.md.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { toCss } from '../../src/site/design/tokenModel';
import { narrowerThan, videoSources } from '../../src/site/scripts/media';
import { examplesOf, reexportedTypes } from '../../src/site/library/registry';

const ref = (p: string) => `var(--${p.split('.').join('-')})`;

describe('token model: composites', () => {
  it('a typography token is the font shorthand: weight, size / line height, family', () => {
    const v = { fontFamily: '{font.ui}', fontSize: '{text.sm}', fontWeight: '{weight.semibold}', lineHeight: '{leading.ui}' };
    expect(toCss(v, 'typography', ref)).toBe('var(--weight-semibold) var(--text-sm)/var(--leading-ui) var(--font-ui)');
    expect(toCss({ fontFamily: ['Figtree', 'system-ui'], fontSize: { value: 0.875, unit: 'rem' }, fontWeight: 600, lineHeight: 1.4 }, 'typography', ref)).toBe('600 0.875rem/1.4 Figtree, system-ui');
  });

  it('a shadow marked site.css: drop-shadow is the filter function, without a spread; otherwise a box shadow', () => {
    const v = { color: '{c.image.shadow}', offsetX: { value: 0, unit: 'rem' }, offsetY: '{c.image.shadow-y}', blur: '{c.image.shadow-blur}', spread: { value: 0, unit: 'rem' } };
    expect(toCss(v, 'shadow', ref, undefined, 'drop-shadow')).toBe('drop-shadow(0rem var(--c-image-shadow-y) var(--c-image-shadow-blur) var(--c-image-shadow))');
    expect(toCss(v, 'shadow', ref)).toBe('0rem var(--c-image-shadow-y) var(--c-image-shadow-blur) 0rem var(--c-image-shadow)');
  });
});

describe('media helpers', () => {
  it('a video file goes to the Video fundamental as its src (MP4) or its webm (WebM)', () => {
    expect(videoSources({ src: '/a.mp4', type: 'video/mp4' })).toEqual({ src: '/a.mp4', webm: undefined });
    expect(videoSources({ src: '/a.webm', type: 'video/webm' })).toEqual({ src: undefined, webm: '/a.webm' });
  });

  it('a column narrower than its container query size token, as the @container (width < …) says it', () => {
    expect(narrowerThan(583, '36.45rem')).toBe(true);
    expect(narrowerThan(583.2, ' 36.45rem')).toBe(false);
    expect(narrowerThan(700, '36.45rem', 20)).toBe(true);
  });
});

describe('design library: types a component re-exports from tier 0', () => {
  it("documents Collection's item and picture types, in the order it names them", () => {
    const types = reexportedTypes("export type { CollectionPicture, CollectionItem } from '../../scripts/collection';", join(__dirname, '../../src/site/components/compounds'));
    expect(types.map((t) => t.name)).toEqual(['CollectionPicture', 'CollectionItem']);
    expect(types[1].props.map((p) => p.name)).toEqual(['when', 'heading', 'picture', 'illustration', 'subtext', 'html']);
    expect(types[0].props.every((p) => p.description.length > 0)).toBe(true);
  });
});

describe("design library: a story's code", () => {
  it("is the same whatever the checkout's line endings (the engine build and the source build agree)", () => {
    const lf = '<Example title="A">\n  <Button>Go</Button>\n</Example>\n';
    expect(examplesOf(lf.replace(/\n/g, '\r\n'))).toEqual(examplesOf(lf));
    expect(examplesOf(lf.replace(/\n/g, '\r\n')).A).toBe('<Button>Go</Button>');
  });
});