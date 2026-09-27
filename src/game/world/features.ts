import { CatmullRomCurve3, Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, latLonToVec, localNorth, moveAlong, pointArcDistance, tangentToward } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';

/**
 * Terrain features (pure): a river that tumbles off a cliff near the Workshop, passes under a
 * bridge on one path and winds down the far side into the pond, plus a few rocky mesas.
 * Placement is authored in lat/lon and validated by tests (clear of landmarks, one crossing).
 */

/**
 * River control points (lat, lon), after the source. The source is computed on the waterfall
 * mesa's cliff edge (facing the first point) and the mouth just inside the pond rim.
 */
export const RIVER_POINTS: ReadonlyArray<readonly [number, number]> = [
  [47.6, 31.0],
  [51.2, 39.5],
  [52.3, 46.0],
  [50.6, 54.0],
  [45.5, 62.0],
  [37.0, 67.5],
  [26.0, 70.5],
  [13.0, 68.0],
  [0.0, 61.0],
  [-15.0, 50.0],
  [-31.0, 35.0],
  [-47.0, 17.0],
  [-61.0, -2.0],
  [-72.0, -22.0],
];

export interface MesaSpec {
  lat: number;
  lon: number;
  radiusU: number;
  heightU: number;
  seed: number;
  /** Optional upper tier: offset (u, in the mesa's north/east frame), radius and extra height. */
  tier?: { north: number; east: number; radiusU: number; heightU: number };
  /** The viewing deck's cliff (viewing-deck.md): its steps and platform can be built (deckSpec.ts). */
  deck?: boolean;
}

export const MESA_SPECS: readonly MesaSpec[] = [
  // the waterfall cliff, south-east of the Workshop
  { lat: 40.0, lon: 16.0, radiusU: 1.3, heightU: 1.25, seed: 1.3 },
  // two-tier terrace in the wide gap between the Post Office and Workshop paths
  { lat: 43.0, lon: -45.0, radiusU: 1.75, heightU: 0.75, seed: 4.1, tier: { north: -0.35, east: 0.2, radiusU: 0.95, heightU: 0.65 } },
  { lat: 38.0, lon: 160.0, radiusU: 1.3, heightU: 1.0, seed: 7.7 },
  // the viewing deck's cliff near the home (viewing-deck.md): a wide lower terrace on the home's side
  // for the steps, and an upper tier big enough for the platform
  { lat: -15.0, lon: -100.0, radiusU: 3.2, heightU: 1.1, seed: 2.9, tier: { north: 0.56, east: -0.2, radiusU: 1.9, heightU: 0.8 }, deck: true },
];

export interface River {
  /** Planet-local unit samples along the centre line, ~0.2 u apart. */
  samples: Vector3[];
  /** Arc length (u) from the source at each sample. */
  along: number[];
  /** Half-width of the water (u) at each sample. */
  halfWidth: number[];
  /** Unit tangent (downstream) at each sample. */
  tangent: Vector3[];
  lengthU: number;
}

export interface Bridge {
  n: Vector3;
  /** Planet-local unit tangent along the path (toward its landmark). */
  along: Vector3;
  /** Planet-local unit tangent across the path (downstream-ish). */
  across: Vector3;
  halfLengthU: number;
  halfWidthU: number;
  pathId: string;
}

export interface Mesa {
  n: Vector3;
  north: Vector3;
  east: Vector3;
  radiusU: number;
  heightU: number;
  seed: number;
  tier?: MesaTier;
  deck?: boolean;
}

/** Upper tier of a two-tier mesa. Its outline is sampled (`edge`) so it can be kept inside the base. */
export interface MesaTier {
  n: Vector3;
  radiusU: number;
  heightU: number;
  /** Outline radius (u) at TIER_SAMPLES evenly spaced angles in the mesa's north/east frame. */
  edge: Float32Array;
}

export const TIER_SAMPLES = 128;
/** Narrowest lower terrace left between the upper tier's rim and the base rim (u). */
export const TIER_TERRACE_U = 0.55;

export const RIVER_SAMPLE_U = 0.2;
export const RIVER_BASE_HALF_WIDTH = 0.46;

/** Build the river centre line (Catmull-Rom through the control points, gentle meanders). */
export function buildRiver(pond: { n: Vector3; radiusU: number } | null, source: Mesa | null, cfg = CONFIG): River {
  const R = cfg.planetRadius;
  const ctrl = RIVER_POINTS.map(([lat, lon]) => latLonToVec(lat, lon));
  if (source) {
    // start at the foot of the cliff, where the waterfall lands
    const dir = tangentToward(source.n, ctrl[0]) ?? source.east;
    const { angle } = mesaPolar(source, moveAlong(source.n, dir, 0.1 / R), cfg);
    const edge = mesaRadius(source.radiusU, source.seed, angle);
    ctrl.unshift(moveAlong(source.n, dir, (edge + 0.42) / R));
  }
  if (pond) {
    // finish just inside the pond rim, approaching from the last control point
    const last = ctrl[ctrl.length - 1];
    const toLast = tangentToward(pond.n, last) ?? new Vector3(1, 0, 0);
    ctrl.push(moveAlong(pond.n, toLast, (pond.radiusU - 0.35) / R));
  }
  const curve = new CatmullRomCurve3(ctrl, false, 'centripetal');
  const lengthU = curve.getLength() * R;
  const count = Math.max(8, Math.ceil(lengthU / RIVER_SAMPLE_U));
  const raw = curve.getSpacedPoints(count).map((p) => p.normalize());

  const samples: Vector3[] = [];
  const along: number[] = [];
  const halfWidth: number[] = [];
  const tangent: Vector3[] = [];
  let s = 0;
  for (let i = 0; i < raw.length; i++) {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    const t = tangentToward(raw[i], next) ?? tangentToward(prev, raw[i]) ?? new Vector3(1, 0, 0);
    if (i > 0) s += arcDistance(raw[i - 1], raw[i], R);
    // meander: a small sideways sway that fades out at both ends
    const side = new Vector3().crossVectors(raw[i], t).normalize();
    const fade = Math.min(1, s / 2.5, (lengthU - s) / 2.5);
    const sway = 0.28 * Math.sin(s * 0.9) * Math.sin(s * 0.31 + 1.1) * Math.max(0, fade);
    const p = moveAlong(raw[i], side, sway / R);
    samples.push(p);
    along.push(s);
    // a plunge pool under the waterfall and a wider mouth at the pond
    const pool = 0.34 * Math.max(0, 1 - s / 1.1);
    const mouth = 0.16 * Math.max(0, 1 - (lengthU - s) / 1.6);
    halfWidth.push(RIVER_BASE_HALF_WIDTH + 0.07 * Math.sin(s * 0.8 + 0.4) + pool + mouth);
    tangent.push(t.clone());
  }
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    tangent[i] = tangentToward(samples[i], i + 1 < samples.length ? b : samples[i].clone().multiplyScalar(2).sub(a)) ?? tangent[i];
  }
  return { samples, along, halfWidth, tangent, lengthU: s };
}

/** Distance (u) from `n` to the river centre line, plus the nearest sample index. */
export function riverDistance(river: River, n: Vector3, cfg = CONFIG): { d: number; i: number } {
  const R = cfg.planetRadius;
  let best = -2;
  let bi = 0;
  const S = river.samples;
  for (let i = 0; i < S.length; i += 2) {
    const dot = S[i].x * n.x + S[i].y * n.y + S[i].z * n.z;
    if (dot > best) {
      best = dot;
      bi = i;
    }
  }
  let d = Infinity;
  let di = bi;
  for (let i = Math.max(0, bi - 3); i < Math.min(S.length - 1, bi + 3); i++) {
    const dd = pointArcDistance(n, S[i], S[i + 1], R);
    if (dd < d) {
      d = dd;
      di = arcDistance(n, S[i], R) < arcDistance(n, S[i + 1], R) ? i : i + 1;
    }
  }
  if (!Number.isFinite(d)) d = arcDistance(n, S[bi], R);
  return { d, i: di };
}

/** The spawn → approach corridor of each landmark (the dirt paths). */
export function corridorDistance(n: Vector3, landmarks: readonly LandmarkGeometry[], cfg = CONFIG): number {
  let d = Infinity;
  for (const g of landmarks) d = Math.min(d, pointArcDistance(n, UP as Vector3, g.approach, cfg.planetRadius));
  return d;
}

/** Where the river crosses a path, put a bridge (null if it never crosses). */
export function findBridges(river: River, landmarks: readonly LandmarkGeometry[], cfg = CONFIG): Bridge[] {
  const R = cfg.planetRadius;
  const out: Bridge[] = [];
  for (const g of landmarks) {
    let best = { d: Infinity, i: -1 };
    river.samples.forEach((p, i) => {
      const d = pointArcDistance(p, UP as Vector3, g.approach, R);
      if (d < best.d) best = { d, i };
    });
    if (best.i < 0 || best.d > river.halfWidth[best.i] + 0.2) continue;
    // nearest point on the path to that river sample
    const p = river.samples[best.i];
    const dir = tangentToward(UP as Vector3, g.approach)!;
    const total = arcDistance(UP as Vector3, g.approach, R);
    let bn = UP.clone();
    let bd = Infinity;
    for (let k = 0; k <= 600; k++) {
      const q = moveAlong(UP as Vector3, dir, ((total * k) / 600) / R);
      const d = arcDistance(q, p, R);
      if (d < bd) {
        bd = d;
        bn = q;
      }
    }
    const along = tangentToward(bn, g.approach) ?? dir.clone();
    const across = new Vector3().crossVectors(bn, along).normalize();
    out.push({ n: bn, along, across, halfLengthU: river.halfWidth[best.i] + 0.85, halfWidthU: 0.8, pathId: g.id });
  }
  return out;
}

export function buildMesas(cfg = CONFIG): Mesa[] {
  const R = cfg.planetRadius;
  return MESA_SPECS.map((m) => {
    const n = latLonToVec(m.lat, m.lon);
    const north = localNorth(n);
    const east = new Vector3().crossVectors(north, n).normalize();
    const mesa: Mesa = { n, north, east, radiusU: m.radiusU, heightU: m.heightU, seed: m.seed, deck: m.deck };
    if (m.tier) {
      const tn = moveAlong(moveAlong(n, north, m.tier.north / R), east, m.tier.east / R);
      mesa.tier = { n: tn, radiusU: m.tier.radiusU, heightU: m.tier.heightU, edge: tierOutline(mesa, tn, m.tier.radiusU, cfg) };
    }
    return mesa;
  });
}

/** Tangent at `c` pointing along angle `a` of the mesa's north/east frame. */
export function mesaDir(m: { north: Vector3; east: Vector3 }, c: Vector3, a: number): Vector3 {
  const d = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
  return d.addScaledVector(c, -d.dot(c)).normalize();
}

/**
 * The tier's irregular outline, pulled in wherever it would come closer than TIER_TERRACE_U to
 * the base rim (so its wall never cuts into the lower cliff), then smoothed so the pull-in
 * reads as a natural bend rather than a flat cut.
 */
function tierOutline(m: Mesa, c: Vector3, radius: number, cfg = CONFIG): Float32Array {
  const R = cfg.planetRadius;
  const fits = (a: number, r: number) => {
    const p = moveAlong(c, mesaDir(m, c, a), r / R);
    const { r: rb, angle } = mesaPolar(m, p, cfg);
    return rb <= mesaRadius(m.radiusU, m.seed, angle) - TIER_TERRACE_U;
  };
  const limit = new Float32Array(TIER_SAMPLES);
  const edge = new Float32Array(TIER_SAMPLES);
  for (let i = 0; i < TIER_SAMPLES; i++) {
    const a = (i / TIER_SAMPLES) * Math.PI * 2;
    const want = mesaRadius(radius, m.seed + 2.2, a);
    let lo = 0;
    let hi = want;
    if (fits(a, want)) lo = want;
    else for (let it = 0; it < 18; it++) fits(a, (lo + hi) / 2) ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2);
    limit[i] = lo;
    edge[i] = lo;
  }
  const tmp = new Float32Array(TIER_SAMPLES);
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < TIER_SAMPLES; i++) {
      const l = edge[(i + TIER_SAMPLES - 1) % TIER_SAMPLES];
      const r = edge[(i + 1) % TIER_SAMPLES];
      tmp[i] = Math.min(limit[i], 0.25 * l + 0.5 * edge[i] + 0.25 * r);
    }
    edge.set(tmp);
  }
  return edge;
}

/** Upper-tier outline radius (u) at `angle` (radians, in the mesa's north/east frame). */
export function tierEdge(t: MesaTier, angle: number): number {
  const f = ((angle / (Math.PI * 2)) % 1 + 1) % 1 * TIER_SAMPLES;
  const i = Math.floor(f) % TIER_SAMPLES;
  const w = f - Math.floor(f);
  return t.edge[i] * (1 - w) + t.edge[(i + 1) % TIER_SAMPLES] * w;
}

/** Local polar coordinates (u, radians) of `p` around a mesa's upper tier. */
export function tierPolar(m: Mesa, p: Vector3, cfg = CONFIG): { r: number; angle: number } {
  return mesaPolar({ n: m.tier!.n, north: m.north, east: m.east }, p, cfg);
}

/** Irregular mesa outline: radius (u) in direction `angle` (radians, in the mesa's north/east frame). */
export function mesaRadius(radius: number, seed: number, angle: number): number {
  return radius * (1 + 0.07 * Math.sin(3 * angle + seed) + 0.045 * Math.sin(5 * angle + 2.1 * seed) + 0.03 * Math.sin(8 * angle + 3.3 * seed));
}

/** Local polar coordinates (u, radians) of `p` around a mesa centre. */
export function mesaPolar(m: { n: Vector3; north: Vector3; east: Vector3 }, p: Vector3, cfg = CONFIG): { r: number; angle: number } {
  const R = cfg.planetRadius;
  const d = arcDistance(m.n, p, R);
  const t = tangentToward(m.n, p);
  if (!t) return { r: 0, angle: 0 };
  return { r: d, angle: Math.atan2(t.dot(m.east), t.dot(m.north)) };
}
