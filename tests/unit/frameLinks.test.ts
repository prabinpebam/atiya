/**
 * Where a link in a page read on the planet leads (documentation/sections/spec.md §6.4): a building's pages
 * lead only to each other; another building's page gets a note, not a visit; everything else a new tab.
 */
import { describe, expect, it } from 'vitest';
import { sortLink, type FrameContext } from '../../src/site/scripts/frameLinks';

const map = {
  '/atiya/leadership/proud/': { place: 'lighthouse', title: 'Lighthouse', href: '/atiya/play/lighthouse/proud/' },
  '/atiya/leadership/second/': { place: 'lighthouse', title: 'Lighthouse', href: '/atiya/play/lighthouse/second/' },
  '/atiya/work/case/': { place: 'workshop', title: 'Workshop', href: '/atiya/play/workshop/case/' },
};
const ctx: FrameContext = { origin: 'https://x.github.io', base: '/atiya', here: 'lighthouse', current: '/atiya/play/lighthouse/proud/', map };
const at = (href: string) => sortLink(href, ctx);

describe('links in a page read on the planet', () => {
  it("stay in the building: its own frame routes, and a site page that's in it (at its frame address)", () => {
    expect(at('/atiya/play/lighthouse/')).toEqual({ kind: 'stay', href: '/atiya/play/lighthouse/' });
    expect(at('/atiya/play/lighthouse/second/')).toEqual({ kind: 'stay', href: '/atiya/play/lighthouse/second/' });
    expect(at('https://x.github.io/atiya/leadership/second/#part')).toEqual({ kind: 'stay', href: '/atiya/play/lighthouse/second/#part' });
  });

  it('never go to another building: its page, or its frame route, says where it is instead', () => {
    expect(at('/atiya/work/case/')).toEqual({ kind: 'elsewhere', place: 'workshop', title: 'Workshop', siteHref: '/atiya/work/case/' });
    expect(at('/atiya/play/workshop/case/')).toEqual({ kind: 'elsewhere', place: 'workshop', title: 'Workshop', siteHref: '/atiya/work/case/' });
    expect(at('/atiya/play/library/')).toMatchObject({ kind: 'elsewhere', place: 'library', title: 'library' });
  });

  it("open a new tab for a site page that isn't on the planet, the docs, and other sites; a jump within the page stays put", () => {
    expect(at('/atiya/writing/essay/')).toEqual({ kind: 'away', href: 'https://x.github.io/atiya/writing/essay/' });
    expect(at('/atiya/docs/')).toMatchObject({ kind: 'away' });
    expect(at('https://example.com/a')).toEqual({ kind: 'away', href: 'https://example.com/a' });
    expect(at('#the-team-video')).toEqual({ kind: 'anchor' });
    expect(at('/atiya/play/lighthouse/proud/#x')).toEqual({ kind: 'anchor' });
  });

  it('works at the root too (no base path)', () => {
    const root = { ...ctx, base: '', current: '/play/lighthouse/', map: { '/work/case/': { place: 'workshop', title: 'Workshop', href: '/play/workshop/case/' } } };
    expect(sortLink('/play/lighthouse/x/', root)).toEqual({ kind: 'stay', href: '/play/lighthouse/x/' });
    expect(sortLink('/work/case/', root)).toMatchObject({ kind: 'elsewhere', title: 'Workshop' });
  });
});
