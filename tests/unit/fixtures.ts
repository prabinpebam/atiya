import type { LandmarkData } from '../../src/game/types';

/** Mirrors src/content/landmarks/*.md placement data (kept in sync by the content test). */
export const FIXTURE_LANDMARKS: LandmarkData[] = [
  mk('workshop', 1, 57, 0, 1.6),
  mk('town-hall', 2, 57, 90, 1.7),
  mk('lighthouse', 3, 25, 135, 1.1),
  mk('library', 4, 57, 180, 1.5),
  mk('amphitheater', 5, 25, -135, 1.8),
  mk('greenhouse', 6, 25, 45, 1.5),
  mk('post-office', 7, 57, -90, 1.3),
];

function mk(id: string, order: number, lat: number, lon: number, footprintU: number): LandmarkData {
  return {
    id,
    title: id,
    kicker: id,
    summary: id,
    order,
    lat,
    lon,
    modelYawDeg: 0,
    footprintU,
    approachDistanceU: footprintU + 1,
    variant: id,
    accent: '#888888',
    dialog: { intro: id, highlights: [] },
  };
}
