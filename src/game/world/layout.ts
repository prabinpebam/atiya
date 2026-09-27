import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward, type Obstacle } from '../math/sphere';
import { rotateAbout } from '../math/steer';
import type { LandmarkGeometry } from '../math/landmarks';
import { nearPlateauRim } from './cliffs';
import { buildMesas, buildRiver, findBridges, mesaDir, mesaPolar, mesaRadius, riverDistance, tierEdge, tierPolar, type Bridge, type Mesa, type River } from './features';
import { pondAngle, pondFrame, shoreRadius } from './pond';
import { HOME_R, POND_BENCH, homesteadLayout, type Homestead } from './homestead';
import { DECK, deckFootprint, deckSite, type DeckSite } from './deckSpec';

export type FlowerKind = 'tulip' | 'cosmos' | 'pansy';
export const FLOWER_KINDS: FlowerKind[] = ['tulip', 'cosmos', 'pansy'];

export interface PropInstance {
  /** Planet-local unit position. */
  n: Vector3;
  scale: number;
  yaw: number;
  /** 0..1 random value used for colour variation. */
  tint: number;
  /** Ground height (u above the base sphere), filled in once the terrain is known. */
  h?: number;
  /** A boulder streaked with iron ore (mining it gives iron too: viewing-deck.md). */
  iron?: boolean;
}

export type FurnitureKind = 'lamp' | 'bench' | 'planter' | 'notice';

export interface Furniture {
  kind: FurnitureKind;
  n: Vector3;
  /** Planet-local unit tangent the item faces (toward the plaza centre). */
  facing: Vector3;
  /** A bench the visitor shares: they sit this far along it (u, toward its local +x) rather than in the middle. */
  sitSide?: number;
  /** The bench by the pond (feeding the ducks). */
  byPond?: boolean;
}

/** The storage chest by the Workshop: where it stands and the tangent its front faces. */
export interface ChestSpot {
  n: Vector3;
  facing: Vector3;
}

/** The chest's collision radius (u). */
export const CHEST_RADIUS = 0.4;
/** The crafting table's collision radius (u). */
export const CRAFT_RADIUS = 0.5;
/** Round the chest, the crafting table and Chopper's house site: no flowers within this (u, from their edge)… */
export const KEEP_CLEAR = 1.5;
/** …and no tree, bush or rock edge within this of their edge (u). */
export const KEEP_SOLID = 0.9;

export interface Pond {
  n: Vector3;
  radiusU: number;
}

export interface PropLayout {
  hardwood: PropInstance[];
  fruit: PropInstance[];
  cedar: PropInstance[];
  /** All trees (hardwood + fruit + cedar). */
  trees: PropInstance[];
  bushes: PropInstance[];
  flowerBushes: PropInstance[];
  rocks: PropInstance[];
  /** Big boulders at cliff feet and in open country (blocking). */
  boulders: PropInstance[];
  /** Small decorative stones along banks, paths and cliffs (walk-through). */
  pebbles: PropInstance[];
  flowers: Record<FlowerKind, PropInstance[]>;
  /** Low flowering sprigs (walk-through): along the paths and through the meadows. */
  sprigs: PropInstance[];
  grass: PropInstance[];
  furniture: Furniture[];
  /** The storage chest by the Workshop (null if there's no clear spot). */
  chest: ChestSpot | null;
  /** The owner's home by the pond (family.md), or null without a pond. */
  home: Homestead | null;
  /** The crafting table by the Workshop (crafting.md), or null if there's no clear spot. */
  craft: ChestSpot | null;
  pond: Pond | null;
  river: River | null;
  bridges: Bridge[];
  mesas: Mesa[];
  /** Where the viewing deck's steps and platform go (viewing-deck.md), or null without its cliff. */
  deck: DeckSite | null;
  /** Everything that blocks movement (landmarks are added by the controller). */
  obstacles: Obstacle[];
}

/** Deterministic PRNG so the planet looks the same on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnit(rand: () => number): Vector3 {
  const u = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new Vector3(s * Math.cos(phi), u, s * Math.sin(phi));
}

export const TREE_TRUNK_RADIUS = 0.3;
export const PLAZA_RADIUS_U = 3.0;
export const FURNITURE_RADIUS: Record<FurnitureKind, number> = { lamp: 0.14, bench: 0.5, planter: 0.36, notice: 0.34 };

/** Plaza furniture placed in the angular gaps between the paths leaving the plaza (lamps and planters). */
export function plazaFurniture(landmarks: readonly LandmarkGeometry[], cfg = CONFIG): Furniture[] {
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  const bearings = landmarks
    .map((g) => {
      const t = tangentToward(spawn, g.approach) ?? new Vector3(0, 0, -1);
      return Math.atan2(t.x, -t.z);
    })
    .sort((a, b) => a - b);
  const gaps = bearings.map((b, i) => {
    const next = i + 1 < bearings.length ? bearings[i + 1] : bearings[0] + Math.PI * 2;
    return { mid: (b + next) / 2, size: next - b };
  });
  const widest = gaps.reduce((a, b) => (b.size > a.size ? b : a), gaps[0]);
  const place = (bearing: number, dist: number, kind: FurnitureKind): Furniture => {
    const dir = new Vector3(Math.sin(bearing), 0, -Math.cos(bearing));
    const n = moveAlong(spawn, dir, dist / R);
    return { kind, n, facing: tangentToward(n, spawn) ?? dir.clone().negate() };
  };
  const items: Furniture[] = [];
  gaps.forEach((g, i) => {
    if (g === widest) {
      // (the bench stands by the Greenhouse bridge now, and the way out to the
      // workyard between the Post Office and the Workshop is left open: just a lamp at its side)
      items.push(place(g.mid + g.size * 0.28, 2.8, 'lamp'));
    } else if (g.size > 0.6) {
      items.push(place(g.mid, 2.8, i % 2 ? 'planter' : 'lamp'));
    }
  });
  return items;
}

/** Pick the open spot furthest from spawn, landmarks and their paths. */
export function choosePond(landmarks: readonly LandmarkGeometry[], cfg = CONFIG): Pond | null {
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  let best: { n: Vector3; clearance: number } | null = null;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const t = Math.PI * (3 - Math.sqrt(5)) * i;
    const n = new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
    let c = arcDistance(n, spawn, R) - PLAZA_RADIUS_U;
    for (const g of landmarks) {
      c = Math.min(c, arcDistance(n, g.n, R) - g.footprintU - 1.2);
      c = Math.min(c, pointArcDistance(n, spawn, g.approach, R) - 1.0);
    }
    if (!best || c > best.clearance) best = { n, clearance: c };
  }
  if (!best || best.clearance < 1.6) return null;
  return { n: best.n, radiusU: Math.min(1.8, best.clearance - 0.2) };
}

export function generateProps(landmarks: readonly LandmarkGeometry[], seed = 7, cfg = CONFIG): PropLayout {
  const rand = mulberry32(seed);
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  const corridor = (n: Vector3) => Math.min(...landmarks.map((g) => pointArcDistance(n, spawn, g.approach, R)));
  const pond = choosePond(landmarks, cfg);
  const furniture = plazaFurniture(landmarks, cfg);
  const mesas = buildMesas(cfg);
  const river = buildRiver(pond, mesas[0] ?? null, cfg);
  const bridges = findBridges(river, landmarks, cfg);

  const nearLandmark = (n: Vector3, pad: number) => landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + pad || arcDistance(n, g.approach, R) < 1.2 + pad * 0.3);
  const pondF = pond ? pondFrame(pond, river) : null;
  const inPond = (n: Vector3, pad: number) => (pond && pondF ? arcDistance(n, pond.n, R) < shoreRadius(pond, pondF, pondAngle(pond, pondF, n)) + pad : false);
  const inPlaza = (n: Vector3, pad: number) => arcDistance(n, spawn, R) < PLAZA_RADIUS_U + pad;
  /** Signed distance (u) from `n` to the water's edge (negative = in the river). */
  const riverEdge = (n: Vector3) => {
    const { d, i } = riverDistance(river, n, cfg);
    return d - river.halfWidth[i];
  };
  const nearRiver = (n: Vector3, pad: number) => riverEdge(n) < pad;
  /** Signed distance (u) from `n` to the nearest mesa rim (negative = on top). */
  const mesaEdge = (n: Vector3) => {
    let best = Infinity;
    for (const m of mesas) {
      const { r, angle } = mesaPolar(m, n, cfg);
      best = Math.min(best, r - mesaRadius(m.radiusU, m.seed, angle));
    }
    return best;
  };
  const nearMesa = (n: Vector3, pad: number) => mesaEdge(n) < pad;
  const blocked = (n: Vector3, pads: { river: number; mesa: number }) => nearRiver(n, pads.river) || nearMesa(n, pads.mesa);

  const hardwood: PropInstance[] = [];
  const fruit: PropInstance[] = [];
  const cedar: PropInstance[] = [];
  const trees: PropInstance[] = [];
  for (let tries = 0; trees.length < 40 && tries < 5000; tries++) {
    const n = randomUnit(rand);
    const kind = rand();
    const scale = 0.85 + rand() * 0.35;
    const isCedar = kind >= 0.72;
    if (inPlaza(n, 0.6) || nearLandmark(n, 1.9) || inPond(n, 1.0)) continue;
    // the whole crown stays clear of the cliff walls (it would otherwise cut into the rock)
    if (corridor(n) < 1.35 || blocked(n, { river: 0.9, mesa: canopyRadius(isCedar) * scale + 0.15 })) continue;
    if (trees.some((t) => arcDistance(t.n, n, R) < 1.7)) continue;
    const inst = { n, scale, yaw: rand() * Math.PI * 2, tint: rand() };
    (kind < 0.55 ? hardwood : isCedar ? cedar : fruit).push(inst);
    trees.push(inst);
  }
  // a tree or two on each mesa top (unreachable, so no obstacles): trunks well inside the rims,
  // one on the upper tier of a two-tier mesa and one on its lower terrace, clear of the tier wall
  const mesaTop: PropInstance[] = [];
  mesas.forEach((m, i) => {
    const isCedar = i % 2 === 0;
    const count = m.radiusU > 1.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const scale = 0.7 + rand() * 0.2;
      const onTier = Boolean(m.tier) && k === 0;
      let n: Vector3 | null = null;
      for (let t = 0; t < 80 && !n; t++) {
        const a = rand() * Math.PI * 2;
        const f = rand();
        const c = onTier ? m.tier!.n : m.n;
        const cand = moveAlong(c, mesaDir(m, c, a), ((onTier ? tierEdge(m.tier!, a) : mesaRadius(m.radiusU, m.seed, a)) * (onTier ? 0.6 : 0.85) * Math.sqrt(f)) / R);
        if (mesaTopClearance(m, cand, isCedar, scale, onTier, cfg)) n = cand;
      }
      if (!n) continue;
      const inst = { n, scale, yaw: rand() * Math.PI * 2, tint: rand() };
      (isCedar ? cedar : hardwood).push(inst);
      // (the viewing deck's cliff can be climbed once its steps are built: its trees block)
      if (!m.deck) mesaTop.push(inst);
    }
  });

  const bushes: PropInstance[] = [];
  const flowerBushes: PropInstance[] = [];
  const allBushes: PropInstance[] = [];
  for (let tries = 0; allBushes.length < 18 && tries < 4000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.3) || nearLandmark(n, 0.9) || inPond(n, 0.6)) continue;
    if (corridor(n) < 1.0 || blocked(n, { river: 0.5, mesa: 0.6 })) continue;
    if ([...trees, ...allBushes].some((t) => arcDistance(t.n, n, R) < 1.1)) continue;
    const inst = { n, scale: 0.8 + rand() * 0.4, yaw: rand() * Math.PI * 2, tint: rand() };
    (rand() < 0.35 ? flowerBushes : bushes).push(inst);
    allBushes.push(inst);
  }

  const rocks: PropInstance[] = [];
  for (let tries = 0; rocks.length < 18 && tries < 3000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.2) || nearLandmark(n, 0.8) || inPond(n, 0.2)) continue;
    if (corridor(n) < 0.95 || blocked(n, { river: 0.35, mesa: 0.3 })) continue;
    if ([...trees, ...allBushes, ...rocks].some((t) => arcDistance(t.n, n, R) < 1.0)) continue;
    rocks.push({ n, scale: 0.55 + rand() * 0.55, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  // boulders: huddled at the foot of each cliff, a few on the river banks and out in the open
  const boulders: PropInstance[] = [];
  const clear = (n: Vector3, gap: number) =>
    !inPlaza(n, 0.4) &&
    !nearLandmark(n, 0.8) &&
    !inPond(n, 0.4) &&
    corridor(n) >= 1.1 &&
    ![...trees, ...allBushes, ...rocks, ...boulders].some((t) => arcDistance(t.n, n, R) < gap);
  for (const m of mesas) {
    for (let k = 0, tries = 0; k < 4 && tries < 60; tries++) {
      const a = rand() * Math.PI * 2;
      const dir = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
      const edge = mesaRadius(m.radiusU, m.seed, a);
      const n = moveAlong(m.n, dir, (edge + 0.35 + rand() * 0.3) / R);
      if (!clear(n, 0.7) || nearRiver(n, 0.3)) continue;
      boulders.push({ n, scale: 0.75 + rand() * 0.55, yaw: rand() * Math.PI * 2, tint: rand() });
      k++;
    }
  }
  for (let k = 0, tries = 0; k < 7 && tries < 400; tries++) {
    const i = Math.floor(rand() * river.samples.length);
    const side = new Vector3().crossVectors(river.samples[i], river.tangent[i]).normalize().multiplyScalar(rand() < 0.5 ? -1 : 1);
    const n = moveAlong(river.samples[i], side, (river.halfWidth[i] + 0.45 + rand() * 0.3) / R);
    if (!clear(n, 1.0) || nearRiver(n, 0.2) || nearMesa(n, 0.3)) continue;
    boulders.push({ n, scale: 0.7 + rand() * 0.4, yaw: rand() * Math.PI * 2, tint: rand() });
    k++;
  }
  for (let k = 0, tries = 0; k < 6 && tries < 2000; tries++) {
    const n = randomUnit(rand);
    if (!clear(n, 1.4) || nearRiver(n, 0.6) || nearMesa(n, 0.4)) continue;
    boulders.push({ n, scale: 0.8 + rand() * 0.6, yaw: rand() * Math.PI * 2, tint: rand() });
    k++;
  }

  // pebbles: river banks, cliff feet and path edges (decorative, walk-through)
  const pebbles: PropInstance[] = [];
  for (let tries = 0; pebbles.length < 90 && tries < 6000; tries++) {
    const pick = rand();
    let n: Vector3;
    if (pick < 0.5) {
      const i = Math.floor(rand() * river.samples.length);
      const side = new Vector3().crossVectors(river.samples[i], river.tangent[i]).normalize().multiplyScalar(rand() < 0.5 ? -1 : 1);
      n = moveAlong(river.samples[i], side, (river.halfWidth[i] + 0.02 + rand() * 0.3) / R);
    } else if (pick < 0.75) {
      const m = mesas[Math.floor(rand() * mesas.length)];
      const a = rand() * Math.PI * 2;
      const dir = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
      n = moveAlong(m.n, dir, (mesaRadius(m.radiusU, m.seed, a) + 0.12 + rand() * 0.4) / R);
    } else {
      n = randomUnit(rand);
      const c = corridor(n);
      if (c < 0.42 || c > 0.62) continue;
    }
    if (inPlaza(n, 0) || nearLandmark(n, 0.3) || inPond(n, 0.1) || nearRiver(n, 0) || nearMesa(n, 0.08)) continue;
    pebbles.push({ n, scale: 0.12 + rand() * 0.16, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  // flowers grow in single-kind, single-colour clumps (walk-through, decorative): scattered
  // through the meadows, lining both sides of every path and ringing the plaza (art direction)
  const flowers: Record<FlowerKind, PropInstance[]> = { tulip: [], cosmos: [], pansy: [] };
  const solids = [...trees, ...allBushes, ...rocks, ...boulders];
  const sprigs: PropInstance[] = [];
  const sprig = (n: Vector3) => {
    if (inPlaza(n, 0.15) || corridor(n) < 0.6 || blocked(n, { river: 0.2, mesa: 0.15 }) || inPond(n, 0.15) || nearLandmark(n, 0.1)) return;
    if (solids.some((t) => arcDistance(t.n, n, R) < 0.45)) return;
    sprigs.push({ n, scale: 0.85 + rand() * 0.45, yaw: rand() * Math.PI * 2, tint: rand() });
  };
  const clump = (center: Vector3, count: number, spread: number) => {
    const kind = FLOWER_KINDS[Math.floor(rand() * FLOWER_KINDS.length)];
    const tint = rand();
    for (let i = 0; i < count; i++) {
      const dir = tangentToward(center, randomUnit(rand));
      if (!dir) continue;
      const n = moveAlong(center, dir, (0.1 + rand() * spread) / R);
      if (inPlaza(n, 0.15) || corridor(n) < 0.55 || blocked(n, { river: 0.2, mesa: 0.15 }) || inPond(n, 0.15)) continue;
      if (solids.some((t) => arcDistance(t.n, n, R) < 0.55)) continue;
      flowers[kind].push({ n, scale: 0.85 + rand() * 0.35, yaw: rand() * Math.PI * 2, tint });
    }
  };
  // (a flower is ≈ 700 triangles, a sprig ≈ 150: the abundance comes mostly from sprigs)
  for (let c = 0, tries = 0; c < 36 && tries < 6000; tries++) {
    const center = randomUnit(rand);
    if (inPlaza(center, -0.2) || nearLandmark(center, 0.5) || inPond(center, 0.4)) continue;
    if (corridor(center) < 0.8 || blocked(center, { river: 0.5, mesa: 0.4 })) continue;
    c++;
    clump(center, 5 + Math.floor(rand() * 6), 0.6);
  }
  // path edges: small clumps alternating sides along each plaza → landmark path
  for (const g of landmarks) {
    const along = tangentToward(spawn, g.approach);
    if (!along) continue;
    const length = arcDistance(spawn, g.approach, R);
    for (let d = PLAZA_RADIUS_U + 0.6, k = 0; d < length - 1.3; d += 0.9 + rand() * 0.5, k++) {
      const onPath = moveAlong(spawn, along, d / R);
      const side = tangentToward(onPath, g.approach);
      if (!side) continue;
      const across = new Vector3().crossVectors(onPath, side).normalize().multiplyScalar(k % 2 ? 1 : -1);
      const center = moveAlong(onPath, across, (0.85 + rand() * 0.3) / R);
      if (nearLandmark(center, 0.3) || blocked(center, { river: 0.35, mesa: 0.3 })) continue;
      if (k % 2 === 0) clump(center, 2 + Math.floor(rand() * 3), 0.3);
      // flowering sprigs line the path
      for (let q = 0; q < 3; q++) {
        const dir = tangentToward(center, randomUnit(rand));
        if (dir) sprig(moveAlong(center, dir, (0.25 + rand() * 0.35) / R));
      }
    }
  }
  // and scattered through the open meadows
  for (let tries = 0, placed = 0; placed < 90 && tries < 4000; tries++) {
    const n = randomUnit(rand);
    const before = sprigs.length;
    sprig(n);
    if (sprigs.length > before) placed++;
  }
  // plaza rim: a ring of clumps round the brick circle, clear of the path mouths
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rand() * 0.2;
    const out = new Vector3(Math.cos(a), 0, Math.sin(a));
    const center = moveAlong(spawn, out, (PLAZA_RADIUS_U + 0.7 + rand() * 0.3) / R);
    if (corridor(center) < 0.8 || nearLandmark(center, 0.3) || blocked(center, { river: 0.35, mesa: 0.3 })) continue;
    clump(center, 2 + Math.floor(rand() * 3), 0.35);
    for (let q = 0; q < 2; q++) {
      const dir = tangentToward(center, randomUnit(rand));
      if (dir) sprig(moveAlong(center, dir, (0.2 + rand() * 0.3) / R));
    }
  }

  const grass: PropInstance[] = [];
  for (let tries = 0; grass.length < 650 && tries < 8000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.1) || inPond(n, 0.4)) continue;
    if (landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + 0.6)) continue;
    if (corridor(n) < 0.6 || nearRiver(n, 0.12)) continue;
    // grass grows on mesa tops too, but not on the cliff rims (base or upper tier)
    if (nearPlateauRim(mesas, n, 0.3, 0.2)) continue;
    grass.push({ n, scale: 0.7 + rand() * 0.7, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  // the workyard (prabin-npc.md §4.7): the storage chest and the crafting table side by side in the
  // open ground between the Post Office's and the Workshop's paths, facing the plaza, clear of both
  // paths, both buildings and the water. Chosen after everything else is placed (so the rest of the
  // planet is unchanged); what stood there is cleared by the keep-clear sweep below
  const solidsAll = [...trees, ...allBushes, ...rocks, ...boulders];
  const yardOk = (n: Vector3, r: number) =>
    corridor(n) >= r + 0.9 &&
    !inPond(n, 0.4) &&
    !blocked(n, { river: r + 0.6, mesa: r + 0.8 }) &&
    !landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + r + 0.8) &&
    !furniture.some((f) => arcDistance(f.n, n, R) < 1.2);
  /** How roomy a spot is: its clearance from the paths, the buildings and the water (u). */
  const roomy = (n: Vector3, r: number) => Math.min(corridor(n) - r, ...landmarks.map((g) => arcDistance(n, g.n, R) - g.footprintU - r), riverEdge(n));
  const yard = ((): { chest: ChestSpot; craft: ChestSpot } | null => {
    const ws = landmarks.find((g) => g.id === 'workshop');
    const po = landmarks.find((g) => g.id === 'post-office');
    if (!ws || !po) return null;
    const tw = tangentToward(spawn, ws.approach);
    const tp = tangentToward(spawn, po.approach);
    if (!tw || !tp) return null;
    const mid = tw.clone().add(tp).normalize();
    // the roomiest pair: the table on the Workshop's side (and a little further out), the chest on the Post Office's
    let best: { chest: ChestSpot; craft: ChestSpot } | null = null;
    let bestScore = -Infinity;
    for (let dist = 3.9; dist <= 5.8; dist += 0.3) {
      for (let shift = -0.3; shift <= 0.3 + 1e-9; shift += 0.1) {
        const centre = moveAlong(spawn, rotateAbout(mid.clone(), spawn, shift), dist / R);
        const outward = tangentToward(centre, spawn)!.negate();
        const toWs = new Vector3().crossVectors(centre, outward).normalize();
        if (toWs.dot(tangentToward(centre, ws.n) ?? toWs) < 0) toWs.negate();
        for (const sep of [2.2, 2.6]) {
          for (const radial of [0, 0.6, 1.2]) {
            const craftN = moveAlong(moveAlong(centre, toWs, sep / 2 / R), outward, radial / 2 / R);
            const chestN = moveAlong(moveAlong(centre, toWs, -sep / 2 / R), outward, -radial / 2 / R);
            if (!yardOk(craftN, CRAFT_RADIUS) || !yardOk(chestN, CHEST_RADIUS)) continue;
            const score = Math.min(roomy(craftN, CRAFT_RADIUS), roomy(chestN, CHEST_RADIUS)) - radial * 0.1;
            if (score <= bestScore) continue;
            bestScore = score;
            best = {
              chest: { n: chestN, facing: tangentToward(chestN, spawn) ?? outward.clone().negate() },
              craft: { n: craftN, facing: tangentToward(craftN, spawn) ?? outward.clone().negate() },
            };
          }
        }
      }
    }
    return best;
  })();
  // (a layout without those two buildings: beside the first landmark's front, as before)
  const beside = (extra: readonly number[], degs: readonly number[], r: number, avoid: Vector3 | null): ChestSpot | null => {
    const ws = landmarks.find((g) => g.id === 'workshop') ?? landmarks[0];
    if (!ws) return null;
    const side = new Vector3().crossVectors(ws.n, ws.door).normalize();
    for (const deg of degs) {
      for (const e of extra) {
        const a = (deg * Math.PI) / 180;
        const dir = ws.door.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
        const n = moveAlong(ws.n, dir, (ws.footprintU + e) / R);
        if (corridor(n) < r + 0.5 || inPond(n, 0.3) || blocked(n, { river: 0.5, mesa: 0.5 })) continue;
        if (avoid && arcDistance(n, avoid, R) < 2.0) continue;
        if (solidsAll.some((t) => arcDistance(t.n, n, R) < 1.0)) continue;
        if (landmarks.some((g) => g !== ws && arcDistance(n, g.n, R) < g.footprintU + 1.0)) continue;
        return { n, facing: tangentToward(n, ws.approach) ?? dir };
      }
    }
    return null;
  };
  const chest = yard?.chest ?? beside([0.8, 1.0, 1.25], [55, -55, 70, -70, 40, -40, 85, -85], CHEST_RADIUS, null);
  const craft = yard?.craft ?? beside([1.3, 1.6, 1.9, 2.2], [-60, 60, -75, 75, -45, 45, -90, 90], CRAFT_RADIUS, chest?.n ?? null);
  // nothing walk-through underneath them
  for (const spot of [chest, craft]) {
    if (!spot) continue;
    const under = (p: PropInstance) => arcDistance(p.n, spot.n, R) < CRAFT_RADIUS + 0.25;
    const keep = <T extends PropInstance>(list: T[]) => {
      for (let i = list.length - 1; i >= 0; i--) if (under(list[i])) list.splice(i, 1);
    };
    keep(grass);
    keep(sprigs);
    keep(pebbles);
    for (const k of FLOWER_KINDS) keep(flowers[k]);
  }

  // the plaza's bench stands by the Greenhouse bridge (prabin-npc.md §4.7): on the bank beside the
  // path at the plaza's end of the bridge, facing the water, on dry ground off the path
  const bridgeSpots = ((): Furniture[] => {
    const gh = landmarks.find((g) => g.id === 'greenhouse');
    if (!bridges.length) return [];
    const line = (n: Vector3) => (gh ? pointArcDistance(n, spawn, gh.approach, R) : arcDistance(n, spawn, R));
    const b = bridges.reduce((x, y) => (line(y.n) < line(x.n) ? y : x));
    const L = b.halfLengthU;
    const toSpawn = arcDistance(moveAlong(b.n, b.along, L / R), spawn, R) < arcDistance(moveAlong(b.n, b.along, -L / R), spawn, R) ? 1 : -1;
    const along = b.along.clone().multiplyScalar(toSpawn);
    const rails = bridgeRailObstacles([b], cfg);
    const ok = (n: Vector3, r: number, bank: number) =>
      riverEdge(n) >= r + bank &&
      corridor(n) >= r + 0.55 &&
      !inPond(n, 0.4) &&
      !nearMesa(n, 0.5) &&
      !nearLandmark(n, r + 0.3) &&
      !rails.some((o) => arcDistance(o.n, n, R) < o.radiusU + r + 0.3) &&
      ![chest, craft].some((c) => c && arcDistance(c.n, n, R) < 2.5);
    const out: Furniture[] = [];
    search: for (const extra of [0.9, 1.3, 1.7, 2.2]) {
      for (const side of [1, -1]) {
        for (const acrossU of [1.35, 1.7, 2.1]) {
          const end = moveAlong(b.n, along, (L + extra) / R);
          const n = moveAlong(end, b.across.clone().multiplyScalar(side), acrossU / R);
          if (!ok(n, FURNITURE_RADIUS.bench, 0.6)) continue;
          // facing the water: back along the path, toward the river
          const facing = tangentToward(n, moveAlong(b.n, b.across.clone().multiplyScalar(side), acrossU / R)) ?? along.clone().negate();
          out.push({ kind: 'bench', n, facing });
          break search;
        }
      }
    }
    return out;
  })();
  // the notice board (how to play): beside the path out to the Lighthouse, a little past the plaza,
  // facing the path, so you pass it on the way
  const notice = ((): Furniture | null => {
    const lh = landmarks.find((g) => g.id === 'lighthouse');
    const along = lh && tangentToward(spawn, lh.approach);
    if (!lh || !along) return null;
    const r = FURNITURE_RADIUS.notice;
    for (const d of [1.3, 1.9, 0.8, 2.6]) {
      const onPath = moveAlong(spawn, along, (PLAZA_RADIUS_U + d) / R);
      const fwd = tangentToward(onPath, lh.approach) ?? along;
      for (const side of [1, -1]) {
        const across = new Vector3().crossVectors(onPath, fwd).normalize().multiplyScalar(side);
        for (const off of [1.05, 1.35]) {
          const n = moveAlong(onPath, across, off / R);
          if (corridor(n) < r + 0.55 || inPond(n, 0.4) || riverEdge(n) < r + 0.6 || nearMesa(n, 0.5) || nearLandmark(n, r + 0.6)) continue;
          if ([...furniture, ...bridgeSpots].some((f) => arcDistance(f.n, n, R) < 1.2) || [chest, craft].some((c) => c && arcDistance(c.n, n, R) < 2.5)) continue;
          return { kind: 'notice', n, facing: tangentToward(n, onPath) ?? across.clone().negate() };
        }
      }
    }
    return null;
  })();
  if (notice) bridgeSpots.push(notice);
  furniture.push(...bridgeSpots);
  // what stood there makes way (solids near them; plants under them)
  for (const f of bridgeSpots) {
    const r = FURNITURE_RADIUS[f.kind];
    for (const list of [hardwood, fruit, cedar, trees, bushes, flowerBushes, allBushes, rocks, boulders]) {
      for (let i = list.length - 1; i >= 0; i--) if (arcDistance(list[i].n, f.n, R) < r + 0.9 + 0.42 * list[i].scale) list.splice(i, 1);
    }
    for (const list of [grass, sprigs, pebbles]) for (let i = list.length - 1; i >= 0; i--) if (arcDistance(list[i].n, f.n, R) < r + 0.1) list.splice(i, 1);
  }

  // the owner's home by the pond: laid out last and cleared of whatever stood there, so the rest of
  // the planet is unchanged; the old oak (Laija's reading tree) joins the trees, but not the hardwoods:
  // the crafting chunk draws it (it has the swing's branch), it's an obstacle of the home's, and it
  // isn't shaken (swing.md §4.3)
  const home = pond ? homesteadLayout(pond, cfg) : null;
  if (home) {
    const inHome = (p: PropInstance) => home.clear.some((c) => arcDistance(p.n, c.n, R) < c.r);
    const drop = <T extends PropInstance>(list: T[]) => {
      for (let i = list.length - 1; i >= 0; i--) if (inHome(list[i])) list.splice(i, 1);
    };
    for (const list of [hardwood, fruit, cedar, trees, bushes, flowerBushes, allBushes, rocks, boulders, pebbles, sprigs, grass]) drop(list);
    for (const k of FLOWER_KINDS) drop(flowers[k]);
    trees.push({ n: home.tree, scale: 1.3, yaw: 1.3, tint: 0.35 });
    // the bench by the pond: the visitor sits on one side of it, the family on the other
    furniture.push({ kind: 'bench', n: home.pondBench.n.clone(), facing: home.pondBench.facing.clone(), sitSide: -POND_BENCH.side, byPond: true });
  }

  // the viewing deck's cliff (viewing-deck.md): nothing stands on its steps or its platform (no crown
  // over them either), and it keeps a tree on each level where it frames them
  const deck = deckSite(mesas, cfg);
  if (deck) {
    const zone = deckFootprint(deck, cfg);
    const inZone = (n: Vector3, pad: number) => zone.some((z) => arcDistance(n, z.n, R) < z.r + pad);
    const clearOf = <T extends PropInstance>(list: T[], pad: (p: T) => number) => {
      for (let i = list.length - 1; i >= 0; i--) if (inZone(list[i].n, pad(list[i]))) list.splice(i, 1);
    };
    for (const list of [hardwood, fruit, cedar, trees]) clearOf(list, (p) => canopyRadius(cedar.includes(p)) * p.scale * 0.85);
    for (const list of [bushes, flowerBushes, allBushes, rocks, boulders]) clearOf(list, (p) => 0.5 * p.scale + 0.25);
    for (const list of [pebbles, sprigs, grass]) clearOf(list, () => 0.1);
    for (const k of FLOWER_KINDS) clearOf(flowers[k], () => 0.15);
    const m = deck.mesa;
    const t = m.tier!;
    const onIt = (n: Vector3) => arcDistance(n, m.n, R) < m.radiusU + 0.5;
    const plant = (onTier: boolean, isCedar: boolean, scale: number) => {
      // (one's still there)
      const level = (n: Vector3) => (onTier ? arcDistance(n, t.n, R) < t.radiusU : onIt(n) && arcDistance(n, t.n, R) > t.radiusU + 0.2 && arcDistance(n, m.n, R) < m.radiusU);
      if (hardwood.concat(cedar).some((p) => level(p.n))) return;
      const c = onTier ? t.n : m.n;
      // from the back of the level (away from the view) round both ways: the first spot clear of the rims and the build
      for (let k = 0; k < 40; k++) {
        const a = DECK.face + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.16;
        const edge = onTier ? tierEdge(t, a) : mesaRadius(m.radiusU, m.seed, a);
        for (let f = 0.35; f <= 0.95; f += 0.06) {
          const n = moveAlong(c, mesaDir(m, c, a), (edge * f) / R);
          if (!mesaTopClearance(m, n, isCedar, scale, onTier, cfg) || inZone(n, canopyRadius(isCedar) * scale * 0.7)) continue;
          (isCedar ? cedar : hardwood).push({ n, scale, yaw: a * 3.1, tint: 0.4 });
          return;
        }
      }
    };
    // (on the terrace a hardwood tall enough that its crown clears the upper tier)
    plant(false, false, 0.8);
    // and one on the meadow beside the steps' foot, framing the way up
    const foot = deck.lower[0];
    const out = tangentToward(m.n, foot);
    if (out && !trees.some((p) => arcDistance(p.n, foot, R) < 3.2)) {
      search: for (const dr of [2.4, 2.9, 3.4]) {
        for (const da of [0.5, -0.5, 0.8, -0.8, 1.1]) {
          const a = DECK.face + DECK.lower[0][0] + da * (dr > 2.5 ? 0.8 : 1);
          const n = moveAlong(m.n, mesaDir(m, m.n, a), (mesaRadius(m.radiusU, m.seed, a) + dr) / R);
          const scale = 0.95;
          if (inZone(n, canopyRadius(false) * scale * 0.85) || blocked(n, { river: 0.9, mesa: canopyRadius(false) * scale + 0.15 }) || corridor(n) < 1.35) continue;
          if (nearLandmark(n, 1.9) || inPond(n, 1) || trees.some((p) => arcDistance(p.n, n, R) < 1.7)) continue;
          const inst = { n, scale, yaw: a * 2.3, tint: 0.55 };
          hardwood.push(inst);
          trees.push(inst);
          break search;
        }
      }
    }
  }

  // keep the special targets (the chest, the crafting table, Chopper's house site) apart from every
  // other usable thing, so walking up to one never offers another by mistake: no flowers inside
  // KEEP_CLEAR of them, and no tree, bush, rock or boulder whose edge is within KEEP_SOLID of theirs
  const specials = [
    chest && { n: chest.n, r: CHEST_RADIUS },
    craft && { n: craft.n, r: CRAFT_RADIUS },
    home && { n: home.dogHouse.n, r: HOME_R.dogHouse },
    home && { n: home.swing.n, r: HOME_R.swing },
    ...bridgeSpots.map((f) => ({ n: f.n, r: FURNITURE_RADIUS[f.kind] })),
    home && { n: home.pondBench.n, r: FURNITURE_RADIUS.bench },
    // the viewing deck's first build site, at the steps' foot
    deck && { n: deck.lower[0], r: 0.3 },
  ].filter(Boolean) as { n: Vector3; r: number }[];
  if (specials.length) {
    const near = (p: PropInstance, pad: number) => specials.some((s) => arcDistance(p.n, s.n, R) < s.r + pad);
    const keepOut = <T extends PropInstance>(list: T[], pad: number, radius = 0) => {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].n !== home?.tree && near(list[i], pad + radius * list[i].scale)) list.splice(i, 1);
    };
    for (const k of FLOWER_KINDS) keepOut(flowers[k], KEEP_CLEAR);
    keepOut(sprigs, KEEP_CLEAR * 0.6);
    for (const list of [hardwood, fruit, cedar, trees]) keepOut(list, KEEP_SOLID, 0.42);
    for (const list of [bushes, flowerBushes, allBushes]) keepOut(list, KEEP_SOLID, 0.42);
    keepOut(rocks, KEEP_SOLID, 0.36);
    keepOut(boulders, KEEP_SOLID, 0.4);
  }

  const onMesaTop = new Set(mesaTop);
  const obstacles: Obstacle[] = [
    ...hardwood.filter((t) => !onMesaTop.has(t)).map((t) => ({ n: t.n, radiusU: 0.42 * t.scale })),
    ...fruit.map((t) => ({ n: t.n, radiusU: 0.42 * t.scale })),
    ...cedar.filter((t) => !onMesaTop.has(t)).map((t) => ({ n: t.n, radiusU: 0.36 * t.scale })),
    ...allBushes.map((b) => ({ n: b.n, radiusU: 0.42 * b.scale })),
    ...rocks.map((r) => ({ n: r.n, radiusU: 0.36 * r.scale })),
    ...boulders.map((r) => ({ n: r.n, radiusU: 0.4 * r.scale })),
    ...furniture.map((f) => ({ n: f.n, radiusU: FURNITURE_RADIUS[f.kind] })),
    ...(chest ? [{ n: chest.n, radiusU: CHEST_RADIUS }] : []),
    ...(craft ? [{ n: craft.n, radiusU: CRAFT_RADIUS }] : []),
    // the stream and pond are shallow enough to wade through (spec §4.14), so water doesn't block
    ...bridgeRailObstacles(bridges, cfg),
    ...mesas.flatMap((m) => mesaObstacles(m, cfg)),
    ...(home?.obstacles ?? []),
  ];

  // one boulder in three is streaked with iron ore (viewing-deck.md)
  boulders.forEach((b, i) => {
    if (i % 3 === 1) b.iron = true;
  });

  return { hardwood, fruit, cedar, trees, bushes, flowerBushes, rocks, boulders, pebbles, flowers, sprigs, grass, furniture, chest, craft, home, pond, river, bridges, mesas, deck, obstacles };
}

/** Rails along both sides of each bridge deck. */
export function bridgeRailObstacles(bridges: readonly Bridge[], cfg = CONFIG): Obstacle[] {
  const R = cfg.planetRadius;
  const out: Obstacle[] = [];
  for (const b of bridges) {
    for (let t = -b.halfLengthU; t <= b.halfLengthU + 1e-6; t += 0.3) {
      for (const s of [-1, 1]) {
        const n = moveAlong(moveAlong(b.n, b.along, t / R), b.across, (s * (b.halfWidthU - 0.02)) / R);
        out.push({ n, radiusU: 0.08 });
      }
    }
  }
  return out;
}

/** Horizontal crown radius (u, at scale 1) of a hardwood or a cedar (foliage.ts). */
export function canopyRadius(isCedar: boolean): number {
  return isCedar ? 1.3 : 1.6;
}

/** Height (u, at scale 1) of the lowest foliage above the ground. */
export function canopyBottom(isCedar: boolean): number {
  return isCedar ? 0.65 : 1.25;
}

/**
 * Whether a tree on a mesa top at `n` stands clear: its trunk and roots at least 0.6 u inside
 * the rim it stands on, and, on the lower terrace of a two-tier mesa, clear of the tier's wall
 * (the whole crown, unless the crown starts above the tier's top).
 */
export function mesaTopClearance(m: Mesa, n: Vector3, isCedar: boolean, scale: number, onTier: boolean, cfg = CONFIG): boolean {
  const { r, angle } = mesaPolar(m, n, cfg);
  if (r > mesaRadius(m.radiusU, m.seed, angle) - 0.6) return false;
  if (!m.tier) return true;
  const t = tierPolar(m, n, cfg);
  const e = t.r - tierEdge(m.tier, t.angle);
  if (onTier) return e < -0.6;
  const crownClears = canopyBottom(isCedar) * scale > m.tier.heightU + 0.15;
  return e > (crownClears ? 0.5 : canopyRadius(isCedar) * scale + 0.1);
}

/** A cliff blocks with a core circle plus a ring that follows its irregular outline. */
export function mesaObstacles(m: Mesa, cfg = CONFIG): Obstacle[] {
  const R = cfg.planetRadius;
  const out: Obstacle[] = [{ n: m.n, radiusU: m.radiusU * 0.8, mesa: true }];
  const count = Math.ceil((Math.PI * 2 * m.radiusU) / 0.45);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const dir = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
    const edge = mesaRadius(m.radiusU, m.seed, a);
    out.push({ n: moveAlong(m.n, dir, (edge - 0.28) / R), radiusU: 0.36, mesa: true });
  }
  return out;
}
