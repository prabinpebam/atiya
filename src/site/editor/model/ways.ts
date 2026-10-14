/**
 * Ways to explore (plan stage 8A): turning the engine's modes on and off, choosing the home page's first
 * offer, and the little planet's starting map for a site that's never had one. Pure.
 */
import { PLACE_IDS, type PlanetStructure, type PlaceId } from '../../content/schema';
import type { Ways } from '../../modes/contract';
import { LITTLE_PLANET } from '../../modes/ways';

/** The buildings' own names, for a map made from scratch (the starter's too). */
export const BUILDING_NAMES: Record<PlaceId, string> = {
  workshop: 'Workshop',
  'town-hall': 'Town Hall',
  lighthouse: 'Lighthouse',
  library: 'Library',
  amphitheater: 'Amphitheater',
  greenhouse: 'Greenhouse',
  'post-office': 'Post Office',
};

/**
 * Turns a mode on or off. A mode turned off keeps its place in the list (and so its structure: V37); if it
 * was the home page's first offer, the site takes its place.
 */
export function setMode(ways: Ways, id: string, on: boolean, mount: string): Ways {
  const known = ways.modes.some((m) => m.id === id);
  const modes = known ? ways.modes.map((m) => (m.id === id ? { ...m, on } : m)) : [...ways.modes, { id, on, mount }];
  const primary = !on && ways.primary === id ? 'site' : ways.primary;
  return { modes, primary };
}

/** The home page's first offer: the site, or a mode that's on (anything else falls back to the site). */
export function setPrimary(ways: Ways, primary: string): Ways {
  const ok = primary === 'site' || ways.modes.some((m) => m.id === primary && m.on);
  return { ...ways, primary: ok ? primary : 'site' };
}

/** A section as the starting map reads it. */
export interface MapSection {
  id: string;
  title: string;
  summary?: string;
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/**
 * The little planet's starting map: each building shows one of the first seven sections, in the site's
 * order, with the building's own name and the section's words. Null when the site has fewer than seven
 * sections (every building shows a section: V14, V16).
 */
export function startingPlanet(sections: readonly MapSection[]): PlanetStructure | null {
  if (sections.length < PLACE_IDS.length) return null;
  return {
    places: PLACE_IDS.map((id, i) => {
      const s = sections[i];
      return { id, title: BUILDING_NAMES[id], kicker: clip(s.title, 60), summary: clip(s.summary?.trim() || s.title, 160), site: s.id };
    }),
  };
}

/** What the little planet needs that a site may not have: its structure, or enough sections for one. */
export const PLANET_NEEDS = `The little planet has ${PLACE_IDS.length} buildings, each showing a section of the site: add sections until there are ${PLACE_IDS.length}, then turn it on.`;

export { LITTLE_PLANET };
export type { Ways };
