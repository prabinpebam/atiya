import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { arcDistance, moveAlong, tangentToward } from '../math/sphere';
import { CHEST_RADIUS, type ChestSpot, type FlowerKind, type PropLayout } from '../world/layout';
import { SEAT, type Seat } from './seating';

/**
 * Things you can walk up to and use with E (docs: collection-inventory.md §3.1): what's in range,
 * and which one gets the prompt (the one you face, nearest first, with hysteresis).
 */
export type TargetKind = 'tree' | 'boulder' | 'flower' | 'chest' | 'bench' | 'dog' | 'npc' | 'craft' | 'site';
export type TreeKind = 'hardwood' | 'apple' | 'orange' | 'cedar';

export interface Target {
  kind: TargetKind;
  /** Unique and stable, e.g. `tree:apple:3`, `flower:tulip:12`. */
  key: string;
  /** Centre (planet-local unit vector). */
  n: Vector3;
  /** Radius of the thing itself (u): distances are measured from its edge. */
  edgeU: number;
  /** Offered while you're within `edgeU + reachU` of the centre. */
  reachU: number;
  /** Where the character works from (centre distance, u). */
  standU: number;
  /** Index into its layout list (trees: into `hardwood`/`fruit`/`cedar`; flowers: into `flowers[kind]`). */
  index: number;
  tree?: TreeKind;
  flower?: FlowerKind;
  /** Bloom colour index (flowers). */
  colour?: number;
  /** Bench: only offered from in front (or the ends). */
  facing?: Vector3;
  seat?: Seat;
  /** The family member's id and name (npc targets). */
  who?: string;
  name?: string;
  scale: number;
}

export const REACH = {
  tree: 1.05,
  boulder: 1.0,
  flower: 0.9,
  chest: 0.95,
  /** Chopper (measured from his centre; he moves, so his target follows him). */
  dog: 1.2,
  /** Chopper only takes E when you face him (within this of your heading, rad), and near a landmark only this close (u). */
  dogCone: (65 * Math.PI) / 180,
  dogNearLandmark: 0.8,
  /** The family (family.md §6): talk from this close (u), facing them. */
  npc: 1.3,
  /** The crafting table and Chopper's house site (crafting.md). */
  craft: 0.95,
  site: 1.0,
  /** Walk out this far past a target's range before its prompt goes (hysteresis). */
  keep: 0.25,
  /** More than this off your heading (rad), a target only counts within arm's reach. */
  behind: (100 * Math.PI) / 180,
  armU: 0.35,
  /** Score penalty per radian off your heading (u). */
  anglePenalty: 0.35,
  /** Near a landmark (its preview card is up), a flower needs you this close to take E. */
  flowerNearLandmark: 0.5,
} as const;

/** Visual trunk radius at scale 1 (the collision circle is wider: 0.42 hardwood, 0.36 cedar). */
const TRUNK_U = { hardwood: 0.3, cedar: 0.24 } as const;

/** Every usable thing on the planet. Mesa-top trees are included but can never be reached (cliffs). */
export function buildTargets(layout: PropLayout, seats: readonly Seat[], chest: ChestSpot | null, bloomCount = 7): Target[] {
  const out: Target[] = [];
  const tree = (kind: TreeKind, list: readonly { n: Vector3; scale: number }[], offset = 0, step = 1) =>
    list.forEach((t, i) => {
      if ((i - offset) % step !== 0) return;
      const trunk = (kind === 'cedar' ? TRUNK_U.cedar : TRUNK_U.hardwood) * t.scale;
      const coll = (kind === 'cedar' ? 0.36 : 0.42) * t.scale;
      out.push({ kind: 'tree', key: `tree:${kind}:${i}`, n: t.n, edgeU: coll, reachU: REACH.tree, standU: trunk + 0.34, index: i, tree: kind, scale: t.scale });
    });
  tree('hardwood', layout.hardwood);
  tree('cedar', layout.cedar);
  // fruit trees alternate apples (even) and oranges (odd), as drawn in Props.tsx
  tree('apple', layout.fruit, 0, 2);
  tree('orange', layout.fruit, 1, 2);
  layout.boulders.forEach((b, i) => {
    const r = 0.4 * b.scale;
    // a pickaxe's length back from the rock, so its head lands on the face
    out.push({ kind: 'boulder', key: `boulder:${i}`, n: b.n, edgeU: r, reachU: REACH.boulder, standU: r + 0.62, index: i, scale: b.scale });
  });
  for (const kind of Object.keys(layout.flowers) as FlowerKind[]) {
    layout.flowers[kind].forEach((f, i) => {
      out.push({
        kind: 'flower',
        key: `flower:${kind}:${i}`,
        n: f.n,
        edgeU: 0,
        reachU: REACH.flower,
        standU: 0.42,
        index: i,
        flower: kind,
        colour: Math.floor(f.tint * bloomCount) % bloomCount,
        scale: f.scale,
      });
    });
  }
  if (chest) out.push({ kind: 'chest', key: 'chest', n: chest.n, edgeU: CHEST_RADIUS, reachU: REACH.chest, standU: CHEST_RADIUS + CONFIG.playerRadius + 0.05, index: 0, facing: chest.facing, scale: 1 });
  seats.forEach((s, i) => out.push({ kind: 'bench', key: `bench:${i}`, n: s.n, edgeU: 0, reachU: SEAT.enterU, standU: SEAT.standU, index: i, facing: s.facing, seat: s, scale: 1 }));
  return out;
}

export { CHEST_RADIUS };

const _off = new Vector3();
const _dir = new Vector3();

/**
 * The target that gets the prompt at `p` facing `fwd` (planet-local tangent), or null.
 * `usable` filters out what can't be used right now (a picked flower, …).
 */
export function pickTarget(
  p: Vector3,
  fwd: Vector3,
  targets: readonly Target[],
  currentKey: string | null,
  usable: (t: Target) => boolean = () => true,
  R = CONFIG.planetRadius,
  nearLandmark = false,
): Target | null {
  let best: Target | null = null;
  let bestScore = Infinity;
  const near = Math.cos(3 / R); // quick reject: nothing usable is further than ~3 u away
  for (const t of targets) {
    if (t.n.dot(p) < near) continue;
    const d = arcDistance(p, t.n, R);
    const past = d - t.edgeU;
    const keep = t.key === currentKey ? REACH.keep : 0;
    const reach = nearLandmark && t.kind === 'flower' ? REACH.flowerNearLandmark : nearLandmark && t.kind === 'dog' ? REACH.dogNearLandmark : t.reachU;
    if (past > reach + keep) continue;
    if (t.kind === 'bench' && t.facing) {
      _off.copy(p).addScaledVector(t.n, -p.dot(t.n));
      const len = _off.length();
      if (len > 1e-9 && _off.dot(t.facing) / len < SEAT.frontCos) continue;
    }
    if (!usable(t)) continue;
    const to = tangentToward(p, t.n, _dir);
    const ang = to ? Math.acos(Math.max(-1, Math.min(1, to.dot(fwd)))) : 0;
    // (a bench goes by which side of it you're on, not your heading: you stand up facing away from it)
    if (t.kind !== 'bench' && ang > REACH.behind && past > REACH.armU) continue;
    // a dog trotting beside you (or a child running past) isn't one you're turning to greet
    if ((t.kind === 'dog' || t.kind === 'npc') && ang > REACH.dogCone) continue;
    // benches keep their wide, facing-independent reach (you sit facing away from them)
    const score = Math.max(0, past) + (t.kind === 'bench' ? 0.2 : ang * REACH.anglePenalty) - (keep ? 0.15 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Where the character stands to use `t`, coming from `p` (on the line from the target out to `p`). */
export function standSpot(t: Target, p: Vector3, R = CONFIG.planetRadius): Vector3 {
  const out = tangentToward(t.n, p) ?? t.facing ?? new Vector3(1, 0, 0);
  return moveAlong(t.n, out, t.standU / R);
}

/** Just outside a target's collision circle on the same line (where the character steps back to). */
export function clearSpot(t: Target, p: Vector3, R = CONFIG.planetRadius): Vector3 {
  const out = tangentToward(t.n, p) ?? new Vector3(1, 0, 0);
  return moveAlong(t.n, out, Math.max(t.standU, t.edgeU + CONFIG.playerRadius + CONFIG.skin + 0.01) / R);
}

export function targetLabel(t: Target, flowerName?: string): string {
  switch (t.kind) {
    case 'tree':
      return 'Shake tree';
    case 'boulder':
      return 'Mine boulder';
    case 'flower':
      return `Pick ${flowerName ?? 'flower'}`;
    case 'chest':
      return 'Open chest';
    case 'bench':
      return 'Sit on the bench';
    case 'dog':
      return 'Meet Chopper';
    case 'npc':
      return `Talk to ${t.name ?? 'them'}`;
    case 'craft':
      return 'Use crafting table';
    case 'site':
      return t.name ?? "Chopper's house";
  }
}
