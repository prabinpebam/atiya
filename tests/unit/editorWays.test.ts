/** Ways to explore's model (src/site/editor/model/ways.ts; plan stage 8A.5). */
import { describe, expect, it } from 'vitest';
import { BUILDING_NAMES, setMode, setPrimary, startingPlanet } from '../../src/site/editor/model/ways';
import { PLACE_IDS, planetStructure } from '../../src/site/content/schema';

const ON = { modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'little-planet' };

describe('turning ways to explore on and off', () => {
  it('turning one off keeps it in the list, and the site becomes the first offer if it was', () => {
    expect(setMode(ON, 'little-planet', false, 'play')).toEqual({ modes: [{ id: 'little-planet', on: false, mount: 'play' }], primary: 'site' });
    expect(setMode({ ...ON, primary: 'site' }, 'little-planet', false, 'play').primary).toBe('site');
  });

  it('turning on one that was never listed adds it at its own address', () => {
    expect(setMode({ modes: [], primary: 'site' }, 'little-planet', true, 'play')).toEqual({ modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'site' });
  });

  it("keeps the home page's views and any other field (home-views plan 2a)", () => {
    const home = { default: 'classic' as const, offered: ['classic' as const, 'bento' as const] };
    expect(setMode({ ...ON, home }, 'little-planet', false, 'play')).toMatchObject({ home, primary: 'site' });
    expect(setPrimary({ ...ON, home }, 'site')).toMatchObject({ home });
  });

  it('the first offer is the site or a way that is on', () => {
    const off = setMode(ON, 'little-planet', false, 'play');
    expect(setPrimary(off, 'little-planet').primary).toBe('site');
    expect(setPrimary(ON, 'little-planet').primary).toBe('little-planet');
    expect(setPrimary(ON, 'orbit').primary).toBe('site');
  });
});

describe("the little planet's starting map", () => {
  const sections = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, title: `Section ${i + 1}`, summary: i % 2 ? '' : `What section ${i + 1} holds.` }));

  it('shows the first seven sections, in order, under the buildings\' own names, and fits the contract', () => {
    const map = startingPlanet(sections(9))!;
    expect(map.places.map((p) => p.id)).toEqual([...PLACE_IDS]);
    expect(map.places.map((p) => p.site)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
    expect(map.places[0]).toEqual({ id: 'workshop', title: BUILDING_NAMES.workshop, kicker: 'Section 1', summary: 'What section 1 holds.', site: 's1' });
    // a section without a summary lends its title
    expect(map.places[1].summary).toBe('Section 2');
    expect(planetStructure.safeParse(map).success).toBe(true);
  });

  it("clips long words to the contract's limits", () => {
    const long = [{ id: 'a', title: 'T'.repeat(80), summary: 'S'.repeat(300) }, ...sections(6)];
    const p = startingPlanet(long)!.places[0];
    expect(p.kicker.length).toBeLessThanOrEqual(60);
    expect(p.summary.length).toBeLessThanOrEqual(160);
    expect(planetStructure.safeParse(startingPlanet(long)).success).toBe(true);
  });

  it('needs seven sections', () => {
    expect(startingPlanet(sections(6))).toBeNull();
  });
});
