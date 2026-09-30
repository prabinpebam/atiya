import type { LandmarkData } from '../../src/game/types';
import { PLACES } from '../../src/game/world/places';

/** The seven buildings as the game has them: the world's own data (world/places.ts), with placeholder-free stand-in words. */
export const FIXTURE_LANDMARKS: LandmarkData[] = PLACES.map((p) => ({ ...p, title: p.id, kicker: p.id, summary: p.id, pages: [], siteHref: '/' }));
