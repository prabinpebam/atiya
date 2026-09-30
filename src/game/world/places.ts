/**
 * The planet's seven buildings, as the world has them (documentation/sections/spec.md §5.1): where each
 * stands, which way it faces, how big it is, which model it is and its colour, and its fast-travel order.
 * They're the game's sections, so they're fixed here; what each one holds (its words and its pages) is
 * content, in content/structures/planet.json, whose contract names the same seven IDs (a unit test keeps
 * the two lists in step). The /play page joins the two; the game's own code reads the result.
 */
export interface PlaceWorld {
  id: string;
  /** Its place in fast travel (its number key). */
  order: number;
  lat: number;
  lon: number;
  modelYawDeg: number;
  footprintU: number;
  approachDistanceU: number;
  /** The model it's built from (world/models.ts). */
  variant: string;
  /** Its colour: the card's accent and the model's trim. */
  accent: string;
}

export const PLACES: readonly PlaceWorld[] = [
  { id: 'workshop', order: 1, lat: 57, lon: 0, modelYawDeg: 0, footprintU: 1.6, approachDistanceU: 2.6, variant: 'workshop', accent: '#e07a3f' },
  { id: 'town-hall', order: 2, lat: 57, lon: 90, modelYawDeg: 0, footprintU: 1.7, approachDistanceU: 2.7, variant: 'town-hall', accent: '#4f7cff' },
  { id: 'lighthouse', order: 3, lat: 25, lon: 135, modelYawDeg: 0, footprintU: 1.1, approachDistanceU: 2.1, variant: 'lighthouse', accent: '#d94c4c' },
  { id: 'library', order: 4, lat: 57, lon: 180, modelYawDeg: 0, footprintU: 1.5, approachDistanceU: 2.5, variant: 'library', accent: '#8a5cf6' },
  { id: 'amphitheater', order: 5, lat: 25, lon: -135, modelYawDeg: 0, footprintU: 1.8, approachDistanceU: 2.8, variant: 'amphitheater', accent: '#e0b43f' },
  { id: 'greenhouse', order: 6, lat: 25, lon: 45, modelYawDeg: 0, footprintU: 1.5, approachDistanceU: 2.5, variant: 'greenhouse', accent: '#3fb67a' },
  { id: 'post-office', order: 7, lat: 57, lon: -90, modelYawDeg: 0, footprintU: 1.3, approachDistanceU: 2.3, variant: 'post-office', accent: '#2fa3b5' },
];
