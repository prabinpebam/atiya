import { Vector3 } from 'three';
import type { LandmarkGeometry } from '../../math/landmarks';
import type { PropLayout } from '../layout';
import type { Pad } from '../pads';

/**
 * Where grass grows and how (docs: documentation/poc-3d-navigation/vegetation/spec.md §3): a pure
 * function of the planet's layout, evaluated per ground vertex and interpolated per blade.
 *
 * - Bare: paths, plaza, cobbles, sand, riverbed, banks, steep ground, the pond, structure bases, the
 *   picnic mat and the obstacles' footprints.
 * - Mown: round the landmarks and the plaza, and trimmed verges along the paths.
 * - Worn: the home is lived in: short, sparse, trodden grass round the house, the garden, the family's
 *   seats and along the ways they walk every day; round furniture and targets too.
 * - Wild: open country away from all of that, in low-frequency noise patches: denser, and a few
 *   knee-high meadows.
 *
 * The grass chunk imports nothing from the main bundle but types (each shared import re-splits the
 * bundle's chunks, which costs the initial JS more than the code itself), so the few helpers it needs
 * come in through the world (world/grassEnv.ts).
 */

export interface GrassWorld {
  R: number;
  geos: readonly LandmarkGeometry[];
  layout: PropLayout;
  pads: readonly Pad[];
  /** The plaza's radius (u; layout.ts PLAZA_RADIUS_U). */
  plazaU: number;
  /** The pond's shoreline radius (u) toward `n` (Terrain.pondShore). */
  pondShore(n: Vector3): number;
  /** Value noise, 0…1 (terrain.ts valueNoise). */
  noise(x: number, y: number, z: number): number;
  /** Distance (u) from `u` to a pad's base box, or null off its plane (pads.ts padLocal + boxDistance). */
  padDistance(p: Pad, u: Vector3): number | null;
  /** Arc distance (u) from `u` to the great-circle segment a–b (sphere.ts pointArcDistance). */
  segmentDistance(u: Vector3, a: Vector3, b: Vector3): number;
}

/** The ground mesh's surface weights at a point (Planet.tsx: aSurf, aSurf2). */
export interface GroundSurface {
  path: number;
  plaza: number;
  cobble: number;
  sand: number;
  bed: number;
  bank: number;
  steep: number;
}

export interface GrassSample {
  /** Share (0…1) of the full blade density. */
  density: number;
  /** Blade height (u). */
  height: number;
  /** 0…1: a knee-high meadow (tall blades and multi-blade cards). */
  tall: number;
  /** 0…1: trodden or mown (shorter, yellower). */
  wear: number;
  /** −1…1: a slow hue drift. */
  hue: number;
  /** 0…1: a drift of meadow flowers. */
  flowers: number;
}

export const GRASS_H = {
  /** Mown / trodden grass (u). */
  short: 0.05,
  /** The meadow's height range (u). */
  low: 0.08,
  high: 0.2,
  /** Knee-high grass (u): the characters' knees are at ≈ 0.3. */
  knee: 0.32,
  kneeVar: 0.1,
} as const;

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Two octaves of value noise at planet-local position `p` (u), frequency `f` (per u). */
function fbm(noise: GrassWorld['noise'], p: Vector3, f: number, o: number): number {
  return noise(p.x * f + o, p.y * f + o * 0.7, p.z * f - o) * 0.68 + noise(p.x * f * 2.3 - o, p.y * f * 2.3 + o, p.z * f * 2.3 + o * 0.3) * 0.32;
}

const UP = new Vector3(0, 1, 0);

interface Disc {
  n: Vector3;
  /** Full effect within `r0`, none past `r1` (u). */
  r0: number;
  r1: number;
  cos1: number;
}

interface Segment {
  a: Vector3;
  b: Vector3;
  half: number;
  mid: Vector3;
  cosReach: number;
}

export interface GrassRules {
  sample(u: Vector3, s: GroundSurface): GrassSample;
}

const PAD_REACH = 3;

/** `full`: test every disc at every point (the unit test's reference for the bucketed lookup). */
export function grassRules(w: GrassWorld, full = false): GrassRules {
  const R = w.R;
  const disc = (n: Vector3, r0: number, r1: number): Disc => ({ n: n.clone().normalize(), r0, r1, cos1: Math.cos(Math.min(Math.PI, r1 / R)) });
  const seg = (a: Vector3, b: Vector3, half: number): Segment => {
    const mid = new Vector3().addVectors(a, b).normalize();
    const reach = a.angleTo(b) / 2 + (half * 2) / R;
    return { a, b, half, mid, cosReach: Math.cos(Math.min(Math.PI, reach)) };
  };
  const { layout, geos } = w;
  const home = layout.home;
  // bare: no grass at all inside these (the obstacles' footprints, the picnic mat); a mesa's collision
  // discs cover its whole top, which is a lawn (its walls are bare already, being steep)
  const bareDiscs: Disc[] = layout.obstacles.filter((o) => !o.mesa).map((o) => disc(o.n, o.radiusU + 0.02, o.radiusU + 0.12));
  if (home) bareDiscs.push(disc(home.mat.n, 0.62, 0.8));
  // mown: kept short round the plaza and the landmarks (public lawns)
  const mownDiscs: Disc[] = [disc(UP, w.plazaU + 0.3, w.plazaU + 2.4), ...geos.map((g) => disc(g.n, g.footprintU + 0.6, g.footprintU + 2.8))];
  // worn: the home is lived in (short, sparse, trodden) and everything people stop at
  const wornDiscs: Disc[] = [];
  const trodden: Segment[] = [];
  const furniture = [...layout.furniture.map((f) => f.n), ...(layout.chest ? [layout.chest.n] : []), ...(layout.craft ? [layout.craft.n] : [])];
  for (const n of furniture) wornDiscs.push(disc(n, 0.5, 1.5));
  let homeWild: Disc | null = null;
  if (home) {
    // the whole home ground is a kept lawn: never wild, never knee-high
    homeWild = disc(home.centre, home.range + 0.5, home.range + 3);
    mownDiscs.push(disc(home.centre, home.range - 3, home.range));
    wornDiscs.push(disc(home.house.n, 2.4, 5.2));
    // the vegetable garden and the yard behind the house: tended, short
    for (const b of home.yard.beds) wornDiscs.push(disc(b.n, 1.0, 2.2));
    wornDiscs.push(disc(home.yard.wateringCan.n, 0.5, 1.6), disc(home.yard.tulsi.n, 0.4, 1.2), disc(home.yard.woodpile.n, 0.5, 1.3));
    for (const s of [home.readingChair, home.table, home.fire, home.mat, home.dogHouse, home.treeSeat, home.shore, home.log]) wornDiscs.push(disc(s.n, 0.7, 1.9));
    // worn under the swing, and round each jute plant in its row (swing.md)
    wornDiscs.push(disc(home.swing.n, 0.8, 1.7));
    for (const j of home.yard.jute) wornDiscs.push(disc(j.n, 0.3, 0.9));
    // the ways they walk every day, trodden into the lawn
    const door = home.door.n;
    for (const to of [home.table.n, home.fire.n, home.dogHouse.n, home.readingChair.n, home.mat.n, home.yard.wateringCan.n]) trodden.push(seg(door, to, 0.22));
    trodden.push(seg(home.table.n, home.shore.n, 0.2), seg(home.fire.n, home.table.n, 0.2));
  }
  // the viewing deck (viewing-deck.md): bare under its stone steps (built or not), worn where you walk
  // up to them, across the terrace and the lawn to the platform, and short under the platform
  const deck = layout.deck;
  // and round its cliff, a wild meadow: knee-high in drifts from the foot of the walls out (and on its
  // terrace and top), but never over the steps or the ways to them (viewing-deck.md §4.6)
  let cliffMeadow: Disc | null = null;
  const steps: Segment[] = [];
  if (deck) {
    cliffMeadow = disc(deck.mesa.n, deck.mesa.radiusU + 1.2, deck.mesa.radiusU + 2.8);
    for (const line of [deck.lower, deck.upper]) for (let i = 0; i + 1 < line.length; i++) steps.push(seg(line[i], line[i + 1], 0.95));
    const [a, b] = deck.lower;
    for (const t of [0, 0.5, 1]) bareDiscs.push(disc(a.clone().lerp(b, t), 0.6, 0.8));
    wornDiscs.push(disc(a, 0.8, 1.9), disc(deck.centre, 1.3, 2.1));
    const up = deck.upper;
    trodden.push(seg(up[0], up[1], 0.3), seg(up[up.length - 2], up[up.length - 1], 0.3));
  }
  const paths = geos.map((g) => seg(UP, g.n, 0.7));
  const pond = layout.pond;
  const cosPond = pond ? Math.cos(Math.min(Math.PI, (pond.radiusU * 1.35 + 0.4) / R)) : 1;
  const pads = w.pads.map((p) => ({ p, landmark: p.id.startsWith('landmark:'), cos: Math.cos(Math.min(Math.PI / 2, (Math.hypot(Math.abs(p.cx) + p.bx, Math.abs(p.cz) + p.bz) + PAD_REACH) / R)) }));
  const p = new Vector3();

  const inDisc = (u: Vector3, d: Disc): number => {
    if (u.dot(d.n) < d.cos1) return 0;
    const a = Math.acos(Math.min(1, Math.max(-1, u.dot(d.n)))) * R;
    return 1 - smooth(d.r0, d.r1, a);
  };
  // the long disc lists are bucketed in a coarse grid over the unit sphere (≈ 0.8 u cells), so each
  // vertex tests only the discs that can reach it (exact: every disc is in every cell it overlaps)
  const CELL = 0.08;
  const cellOf = (v: number) => Math.floor((v + 1) / CELL);
  const key = (x: number, y: number, z: number) => x + y * 64 + z * 4096;
  const bucket = (list: readonly Disc[]): Map<number, Disc[]> => {
    const grid = new Map<number, Disc[]>();
    for (const d of list) {
      const e = d.r1 / R + 1e-3;
      for (let x = cellOf(d.n.x - e); x <= cellOf(d.n.x + e); x++)
        for (let y = cellOf(d.n.y - e); y <= cellOf(d.n.y + e); y++)
          for (let z = cellOf(d.n.z - e); z <= cellOf(d.n.z + e); z++) {
            const k = key(x, y, z);
            const at = grid.get(k);
            if (at) at.push(d);
            else grid.set(k, [d]);
          }
    }
    return grid;
  };
  const NONE: Disc[] = [];
  const near = (u: Vector3, grid: Map<number, Disc[]>, all: readonly Disc[]) => (full ? all : (grid.get(key(cellOf(u.x), cellOf(u.y), cellOf(u.z))) ?? NONE));
  const maxOver = (u: Vector3, list: readonly Disc[]): number => {
    let m = 0;
    for (const d of list) {
      const v = inDisc(u, d);
      if (v > m) m = v;
      if (m >= 1) break;
    }
    return m;
  };
  const bareGrid = bucket(bareDiscs);
  const wornGrid = bucket(wornDiscs);

  return {
    sample(u, s) {
      p.copy(u).multiplyScalar(R);
      // ---- bare ground: exactly 0 ----
      let lawn = 1;
      lawn *= 1 - smooth(0.02, 0.16, s.path);
      lawn *= 1 - smooth(0.01, 0.12, s.plaza);
      lawn *= 1 - smooth(0.02, 0.14, s.cobble);
      lawn *= 1 - smooth(0.03, 0.22, s.sand);
      lawn *= 1 - smooth(0.02, 0.15, s.bed);
      lawn *= 1 - smooth(0.12, 0.45, s.bank);
      lawn *= 1 - smooth(0.2, 0.5, s.steep);
      if (lawn > 0 && pond && u.dot(pond.n) > cosPond) {
        const d = Math.acos(Math.min(1, u.dot(pond.n))) * R;
        lawn *= smooth(0.25, 0.45, d - w.pondShore(u));
      }
      let mown = 0;
      let worn = 0;
      if (lawn > 0) {
        for (const q of pads) {
          if (u.dot(q.p.n) < q.cos) continue;
          const d = w.padDistance(q.p, u);
          if (d === null) continue;
          // nothing under a base, a thin fringe where the grass meets it
          if (d < 0.02) lawn = 0;
          else if (d < 0.14) lawn *= smooth(0.02, 0.14, d) * 0.6 + 0.4;
          if (q.landmark) mown = Math.max(mown, 1 - smooth(0.5, 2.4, d));
          else worn = Math.max(worn, 1 - smooth(0.3, 1.4, d));
        }
        lawn *= 1 - maxOver(u, near(u, bareGrid, bareDiscs));
      }
      if (lawn <= 0) return { density: 0, height: 0, tall: 0, wear: 1, hue: 0, flowers: 0 };

      mown = Math.max(mown, maxOver(u, mownDiscs));
      // trimmed verges along the paths
      for (const sg of paths) {
        if (u.dot(sg.mid) < sg.cosReach) continue;
        mown = Math.max(mown, (1 - smooth(0.7, 1.6, w.segmentDistance(u, sg.a, sg.b))) * 0.8);
      }
      worn = Math.max(worn, maxOver(u, near(u, wornGrid, wornDiscs)));
      let track = 0;
      for (const sg of trodden) {
        if (u.dot(sg.mid) < sg.cosReach) continue;
        track = Math.max(track, 1 - smooth(sg.half * 0.5, sg.half * 1.6, w.segmentDistance(u, sg.a, sg.b)));
      }
      const wild = homeWild ? 1 - inDisc(u, homeWild) : 1;

      // ---- low-frequency patches: never uniform ----
      const dN = fbm(w.noise, p, 0.22, 3.1);
      const hN = fbm(w.noise, p, 0.3, 7.9);
      const tN = fbm(w.noise, p, 0.15, 12.4);
      const hue = (fbm(w.noise, p, 0.45, 21.7) - 0.5) * 2;
      const fN = fbm(w.noise, p, 0.38, 31.3);

      let tall = smooth(0.6, 0.7, tN) * wild * (1 - smooth(0.05, 0.6, Math.max(mown, worn))) * smooth(0.5, 0.9, lawn);
      if (cliffMeadow) {
        let meadow = inDisc(u, cliffMeadow) * smooth(0.3, 0.46, tN) * (1 - track) * (1 - smooth(0.05, 0.6, Math.max(mown, worn))) * smooth(0.5, 0.9, lawn);
        for (const sg of steps) {
          if (meadow <= 0) break;
          if (u.dot(sg.mid) >= sg.cosReach) meadow *= smooth(sg.half, sg.half + 0.5, w.segmentDistance(u, sg.a, sg.b));
        }
        tall = Math.max(tall, meadow);
      }
      let density = lawn * (0.35 + 0.65 * smooth(0.2, 0.8, dN)) * (1 - 0.5 * worn) * (1 - 0.3 * mown) * (1 - 0.8 * track);
      density = Math.min(1, density + tall * 0.35);
      let height = GRASS_H.low + (GRASS_H.high - GRASS_H.low) * smooth(0.15, 0.85, hN);
      height += (GRASS_H.short - height) * Math.max(mown * 0.8, worn * 0.92, track);
      height += (GRASS_H.knee + GRASS_H.kneeVar * hN - height) * tall;
      // a thin fringe fades out, never a ruled edge
      height *= 0.55 + 0.45 * lawn;
      const wear = Math.min(1, Math.max(worn, mown * 0.6, track));
      const flowers = smooth(0.56, 0.7, fN) * lawn * (1 - 0.8 * worn) * (1 - track) * (1 - 0.7 * tall);
      return { density, height, tall, wear, hue, flowers };
    },
  };
}
