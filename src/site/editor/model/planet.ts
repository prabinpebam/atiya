/**
 * The planet structure, as edit mode changes it (documentation/sections/spec.md §7.4): each building's own
 * words and the section of the site it shows. What a building holds isn't kept here: it follows its
 * section (§5.2), so moving a page between sections moves it between buildings. Pure and immutable: each
 * function returns a new structure, and keeps everything it doesn't change.
 */
import type { PlaceId, PlanetStructure, SiteStructure } from '../../content/schema';
import { sectionOf } from './structure';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** The building that shows a section on the planet, if any. */
export const placeOfSection = (planet: PlanetStructure, section: string): PlaceId | undefined => planet.places.find((p) => p.site === section)?.id;

/** The building a page is in: the one showing its section (a private page is never on the planet: V28). */
export function placeOfPage(planet: PlanetStructure, structure: SiteStructure, pageId: string): PlaceId | undefined {
  const section = sectionOf(structure, { type: 'article', id: pageId });
  return section ? placeOfSection(planet, section) : undefined;
}

/** Changes a building's own words, or the section it shows. */
export function updatePlace(planet: PlanetStructure, placeId: PlaceId, fields: Partial<Pick<PlanetStructure['places'][number], 'title' | 'kicker' | 'summary' | 'site'>>): PlanetStructure {
  const next = clone(planet);
  const place = next.places.find((p) => p.id === placeId);
  if (!place) return planet;
  Object.assign(place, fields);
  return next;
}
