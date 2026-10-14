/**
 * Which ways in a site has (plan stage 8A, D-W1): its ways file, or, without one, what it has always had:
 * the little planet when there's a planet structure, and the site as the first offer. Pure.
 */
import type { Ways } from './contract';

/** The little planet's ID. */
export const LITTLE_PLANET = 'little-planet';

/**
 * @param o the ways file as read (null when there's none) and whether a planet structure exists. Without a
 * file, a site with a planet structure offers it first, as its home page always has.
 */
export function effectiveWays(o: { ways: Ways | null; hasPlanet: boolean }): Ways {
  if (o.ways) return o.ways;
  return o.hasPlanet ? { modes: [{ id: LITTLE_PLANET, on: true, mount: 'play' }], primary: LITTLE_PLANET } : { modes: [], primary: 'site' };
}

/** Is this mode on? */
export const isOn = (ways: Ways, id: string) => ways.modes.some((m) => m.id === id && m.on);
