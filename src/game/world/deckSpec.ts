/**
 * The viewing deck on the two-tier cliff near the home (docs: viewing-deck.md): where its steps and
 * its platform go, in the cliff's own north/east frame. Pure. The layout only needs the footprint (to
 * keep it clear of trees, rocks and flowers); the heights, rails, walk surfaces and obstacles are the
 * crafting chunk's (craft/deckPlan.ts).
 */
import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { arcDistance, moveAlong, tangentAwayFrom, tangentToward } from '../math/sphere';
import { mesaDir, mesaRadius, tierEdge, type Mesa } from './features';

type Pt = readonly [number, number];

export const DECK = {
  /** The view (rad, in the cliff's north/east frame): toward the home. */
  face: (160 * Math.PI) / 180,
  /** The steps' walkable width (u). */
  width: 1,
  /**
   * Stage 1, round the lower cliff, foot first: [angle from `face` (rad), distance out from the rim (u)].
   * Stone steps up from the meadow, a flight, a landing that juts out, a second flight, a landing that
   * cuts the corner, and one that ends at the rim (flush with its edge: nothing of it stands on the
   * terrace). Every bend is obtuse (about 126° or more): no wedge-shaped corners.
   */
  lower: [
    [0.34, 1.55],
    [0.22, 0.7],
    [-0.16, 0.7],
    [-0.28, 0.86],
    [-0.4, 0.7],
    [-0.77, 0.7],
    [-0.9, 0.3],
    [-0.9, -0.04],
  ] as readonly Pt[],
  /** Stage 2, round the upper tier (in its frame): from the lower steps' top across the terrace to the foot of a flight along its wall (in line with it, so you walk in square between its rails), a landing, a flight, and in over its rim. */
  upper: [
    [-0.94, 0.58],
    [-0.72, 0.58],
    [-0.46, 0.58],
    [-0.2, 0.58],
    [-0.08, 0.66],
    [0.04, 0.58],
    [0.3, 0.58],
    [0.56, 0.58],
  ] as readonly Pt[],
  /** What each stretch of the upper steps is, from the lower steps' top (across the top to the platform's steps at the end). */
  upperKinds: ['path', 'path', 'wood', 'wood', 'landing', 'landing', 'wood', 'wood', 'landing', 'top', 'path'] as const,
  /**
   * The platform on the upper tier: its size (u, across and deep), how high it stands, how far its
   * middle stands back from the tier's (u: the tier's top is too narrow beside it for a way round, so
   * it stands at the back, facing the view over the lawn in front), and the entry: a gap in its front
   * rail (its middle, u across from the platform's middle, toward the steps' side) with steps up from
   * the lawn.
   */
  deck: { w: 2.0, d: 1.4, lift: 0.45, shift: -0.35, entryX: 0.5, steps: 0.6, over: 0.55, corner: 0.3 },
} as const;

export interface DeckSite {
  mesa: Mesa;
  /** Stage 1's centreline, from the foot on the meadow to the lower terrace. */
  lower: Vector3[];
  /** Stage 2's, from the lower steps' top to the platform's entry on the upper tier. */
  upper: Vector3[];
  /** The platform's middle on the upper tier, its front (the view) and the side its entry is on (unit tangents). */
  centre: Vector3;
  fwd: Vector3;
  side: Vector3;
  /** Where you step up onto the platform: on the upper tier's lawn, in front of the gap in its front rail. */
  entry: Vector3;
}

/** Where the deck goes (null if there's no deck cliff). */
export function deckSite(mesas: readonly Mesa[], cfg = CONFIG): DeckSite | null {
  const m = mesas.find((x) => x.deck && x.tier);
  const t = m?.tier;
  if (!m || !t) return null;
  const R = cfg.planetRadius;
  const base = ([a, r]: Pt) => {
    const ang = DECK.face + a;
    return moveAlong(m.n, mesaDir(m, m.n, ang), (mesaRadius(m.radiusU, m.seed, ang) + r) / R);
  };
  const onTier = ([a, r]: Pt) => {
    const ang = DECK.face + a;
    return moveAlong(t.n, mesaDir(m, t.n, ang), (tierEdge(t, ang) + r) / R);
  };
  const D = DECK.deck;
  const centre = moveAlong(t.n, mesaDir(m, t.n, DECK.face), D.shift / R);
  const fwd = mesaDir(m, centre, DECK.face);
  const upper = DECK.upper.map(onTier);
  const top = upper[upper.length - 1];
  const side = new Vector3().crossVectors(centre, fwd).normalize();
  if (side.dot(top) < side.dot(centre)) side.negate();
  const entry = moveAlong(moveAlong(centre, side, D.entryX / R), fwd, (D.d / 2 + D.steps) / R);
  // from the flights' top in over the rim, heading for the platform's steps (then across the lawn to them)
  const over = top.clone().lerp(entry, D.over).normalize();
  // (a landing cuts the corner between them, `corner` u out between the two ways, so both bends are obtuse)
  const bis = tangentAwayFrom(top, upper[upper.length - 2])!.multiplyScalar(0.8).add(tangentToward(top, over)!).normalize();
  const cut = moveAlong(top, bis, D.corner / R);
  const lower = DECK.lower.map(base);
  return { mesa: m, lower, upper: [lower[lower.length - 1], ...upper, cut, over, entry], centre, fwd, side, entry };
}

/** Discs (centre, radius u) over the steps and the platform, which the layout keeps clear. */
export function deckFootprint(s: DeckSite, cfg = CONFIG): Array<{ n: Vector3; r: number }> {
  const R = cfg.planetRadius;
  const out: Array<{ n: Vector3; r: number }> = [];
  for (const line of [s.lower, s.upper]) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const L = arcDistance(a, b, R);
      for (let k = 0; k <= Math.ceil(L / 0.35); k++) out.push({ n: a.clone().lerp(b, k / Math.ceil(L / 0.35)).normalize(), r: DECK.width / 2 + 0.2 });
    }
  }
  const D = DECK.deck;
  out.push({ n: s.centre.clone(), r: Math.hypot(D.w, D.d) / 2 + 0.15 });
  return out;
}
