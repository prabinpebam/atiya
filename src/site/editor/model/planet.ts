/**
 * The planet structure, as edit mode changes it (documentation/sections/spec.md §7.4): which pages each
 * building holds, and in what order. Pure and immutable: each function returns a new structure, and keeps
 * everything it doesn't change.
 */
import type { PlaceId, PlanetStructure } from '../../content/schema';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** The building a page is in, if any. */
export const placeOfPage = (planet: PlanetStructure, pageId: string): PlaceId | undefined => planet.places.find((p) => p.pages.some((r) => r.id === pageId))?.id;

/** Takes a page off the planet (the page itself stays on the site and in content). */
export function takeOff(planet: PlanetStructure, pageId: string): PlanetStructure {
  const next = clone(planet);
  for (const p of next.places) p.pages = p.pages.filter((r) => r.id !== pageId);
  return next;
}

/** Puts a page in a building, at `index` (the end if left out), moving it if it was anywhere else: a page is in one building at most (V15). */
export function putIn(planet: PlanetStructure, placeId: PlaceId, pageId: string, index?: number): PlanetStructure {
  return putAllIn(planet, placeId, [pageId], index);
}

/** Puts several pages in a building together, in the order given, from `index` among the pages that stay (the end if left out), moving each from wherever it was (V15). */
export function putAllIn(planet: PlanetStructure, placeId: PlaceId, pageIds: string[], index?: number): PlanetStructure {
  const next = pageIds.reduce((p, id) => takeOff(p, id), planet);
  const place = next.places.find((p) => p.id === placeId);
  if (place) place.pages.splice(index === undefined ? place.pages.length : Math.max(0, Math.min(index, place.pages.length)), 0, ...pageIds.map((id) => ({ type: 'article' as const, id })));
  return next;
}

/** Moves a page one place up (-1) or down (1) in its building; nothing moves past either end. */
export function movePage(planet: PlanetStructure, placeId: PlaceId, index: number, by: -1 | 1): PlanetStructure {
  const place = planet.places.find((p) => p.id === placeId);
  const to = index + by;
  if (!place || index < 0 || index >= place.pages.length || to < 0 || to >= place.pages.length) return planet;
  const next = clone(planet);
  const pages = next.places.find((p) => p.id === placeId)!.pages;
  [pages[index], pages[to]] = [pages[to], pages[index]];
  return next;
}

/** The building that shows a section on the planet (the first whose `site` it is), if any. */
export const placeOfSection = (planet: PlanetStructure, section: string): PlaceId | undefined => planet.places.find((p) => p.site === section)?.id;

/** A page's section before and after a change to the site (null: not on the site). */
export interface SectionMove {
  id: string;
  from: string | null;
  to: string | null;
}

/**
 * Pages follow their section onto the planet (documentation/sections/spec.md §7.6). A page placed in a
 * section, or moved to another, goes to the end of the building that shows its new section, when it's in
 * no building or in the one that showed its old section; with no building for its new section, it leaves
 * the old one. A page put in another building by hand stays there, and one taken off the site keeps its
 * building (V13 refuses that, saying why).
 */
export function followSections(planet: PlanetStructure, moves: SectionMove[]): PlanetStructure {
  let next = planet;
  for (const m of moves) {
    if (m.from === m.to || m.to === null) continue;
    const now = placeOfPage(next, m.id);
    if (now && now !== (m.from === null ? undefined : placeOfSection(next, m.from))) continue;
    const target = placeOfSection(next, m.to);
    if (target === now) continue;
    next = target ? putIn(next, target, m.id) : takeOff(next, m.id);
  }
  return next;
}

/** Changes a building's own words, its view or its section on the site (an empty section goes back to none). */
export function updatePlace(planet: PlanetStructure, placeId: PlaceId, fields: Partial<Pick<PlanetStructure['places'][number], 'title' | 'kicker' | 'summary' | 'view' | 'site'>>): PlanetStructure {
  const next = clone(planet);
  const place = next.places.find((p) => p.id === placeId);
  if (!place) return planet;
  Object.assign(place, fields);
  if (!place.site) delete place.site;
  return next;
}
