import type { PlaceWorld } from './world/places';

/**
 * A building as the game has it (documentation/sections/spec.md §5.4): its world (world/places.ts) and
 * what the planet structure says of it (content/structures/planet.json), joined by the /play page.
 */
export interface LandmarkData extends PlaceWorld {
  /** Its name, on its card, in fast travel and at the head of its list. */
  title: string;
  /** What it holds, over its name. */
  kicker: string;
  summary: string;
  /** Its published pages, in its order: each one's ID, title and address on the site. */
  pages: { id: string; title: string; href: string }[];
  /** Where "Open classic page" leads: its section of the site, or the home page's list of sections. */
  siteHref: string;
}

export interface MoveIntent {
  /** Screen-right component, −1..1 */
  x: number;
  /** Screen-up component (W / ArrowUp = +1), −1..1 */
  y: number;
  run: boolean;
}
