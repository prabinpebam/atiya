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

/**
 * Full planet: the whole planet in view, to turn and look at, with no character to move. Its own chunk
 * (camera/overview.ts), attached when the planet is complete; the controller only hands it what it asks for.
 */
export interface OverviewMode {
  /** On, or still easing back to the character's view: the character's controls are off. */
  readonly on: boolean;
  /** A key on the planet: true when the mode took it (a key it doesn't take goes on as usual). */
  key(action: import('./input/keyboard').GameAction, down: boolean, code: string): boolean;
  /** A drag on the planet (px): true when the mode took it. */
  drag(dx: number, dy: number): boolean;
  /** The menu's View buttons: a step round (turn) or up and down (tilt); true when the mode took it. */
  nudge(turn: number, tilt: number): boolean;
  /** Each frame, after the camera rig: eases the camera, the world's turn and the focus. */
  frame(camera: import('three').Camera, dt: number): void;
}
