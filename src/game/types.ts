/** Serializable landmark data (content-collection frontmatter + id). Shared by game and classic pages. */
export interface LandmarkData {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  order: number;
  lat: number;
  lon: number;
  modelYawDeg: number;
  footprintU: number;
  approachDistanceU: number;
  variant: string;
  accent: string;
  dialog: {
    intro: string;
    highlights: string[];
  };
}

export interface MoveIntent {
  /** Screen-right component, −1..1 */
  x: number;
  /** Screen-up component (W / ArrowUp = +1), −1..1 */
  y: number;
  run: boolean;
}
