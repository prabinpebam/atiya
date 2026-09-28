/**
 * The viewing deck's plan (docs: viewing-deck.md), from where `deckSpec.ts` puts it: the heights of
 * its steps and landings, the platform, where you walk (the walk surfaces), what blocks you (the
 * rails, the cliff's rims, the bench) at each stage of the build, the corridors the route planner
 * keeps open up the steps, the build sites, the seats and the lanterns. Pure: unit-tested against
 * the real layout.
 */
import { Vector3 } from 'three';
import { arcDistance, moveAlong, tangentToward, type Obstacle } from '../../math/sphere';
import { mesaDir, mesaRadius, tierEdge, type Mesa } from '../features';
import { DECK, type DeckSite } from '../deckSpec';
import type { HomeSpot } from '../homestead';
import { BENCH } from '../parts';

/** What each stretch is: stone steps, a wooden flight, a flat landing, the landing over a rim, a path (no build), or the platform's steps. */
export type PieceKind = 'stone' | 'wood' | 'landing' | 'top' | 'path' | 'steps';
export type Stage = 1 | 2 | 3;

export interface Piece {
  kind: PieceKind;
  stage: Stage;
  a: Vector3;
  b: Vector3;
  /** Walk heights at `a` and `b` (u above the base sphere). */
  ha: number;
  hb: number;
}

/** A way the route planner keeps open: every cell within `r` of the segment a → b. */
export interface Corridor {
  a: Vector3;
  b: Vector3;
  r: number;
}

/** Sizes (u): step rise, rail posts and rail circles, the fine rims, the lanterns. */
export const DECK_BUILD = {
  rise: 0.14,
  /** Rail circles: their radius and spacing, and how far past the walkway's edge they stand. */
  railR: 0.06,
  railGap: 0.13,
  railOut: 0.03,
  /** Once the steps are up, the cliff's rims block with small circles close to the edge (the stage-0 cliff is one big block). */
  rimR: 0.2,
  rimIn: 0.1,
  rimGap: 0.24,
  /** The bench on the platform: where its middle stands (u across from the platform's middle, away from the entry; and in from its back). */
  benchX: -0.36,
  benchBack: 0.33,
  /** Where you and the family sit on it (u along it from its middle), how far in front you stand up. */
  seatVisitor: 0.25,
  seatFamily: -0.25,
  stand: 0.6,
  /** The opening in the front rail (u wide): exactly the steps' width between their rails, so their rails meet its posts. */
  opening: DECK.width + 2 * 0.03,
  /** Rail posts: their spacing along a run (u), their height above the walkway, and the lanterns' above that. */
  postGap: 0.55,
  railTop: 0.6,
  lampOver: 0.12,
} as const;

export interface DeckPlan {
  site: DeckSite;
  pieces: Piece[];
  /** The platform's floor (u above the base sphere). */
  deckH: number;
  /** A point on the platform in its own frame: `x` across (toward the entry's side), `z` toward the view (u from its middle). */
  at(x: number, z: number): Vector3;
  /** Where each stage is built from (its site's target): the steps' foot, the lower terrace, the upper tier behind the platform. */
  sites: HomeSpot[];
  /** The bench's middle and front (facing the view), and the two seats on it: the visitor's and the family's. */
  bench: HomeSpot;
  seats: { visitor: HomeSpot; family: HomeSpot; stand: Vector3 };
  /** The lanterns: on the platform's corners and its entry, the landings and the foot (unit position, height of the bulb). */
  lamps: Array<{ n: Vector3; h: number; stage: Stage }>;
}

const W = DECK.width;

/** A chain's walk heights: rising from `h0` to `h1` over its stone, wooden and step pieces by length; flat elsewhere; never under the ground. */
function chain(nodes: readonly Vector3[], kinds: readonly PieceKind[], h0: number, h1: number, stage: Stage, ground: (n: Vector3) => number, R: number): Piece[] {
  const rises = (k: PieceKind) => k === 'stone' || k === 'wood' || k === 'steps';
  const len = kinds.map((k, i) => (rises(k) ? arcDistance(nodes[i], nodes[i + 1], R) : 0));
  const total = len.reduce((a, b) => a + b, 0) || 1;
  const out: Piece[] = [];
  let h = h0;
  kinds.forEach((kind, i) => {
    const hb = i === kinds.length - 1 ? h1 : h + ((h1 - h0) * len[i]) / total;
    out.push({ kind, stage, a: nodes[i], b: nodes[i + 1], ha: h, hb: Math.max(hb, kind === 'wood' ? ground(nodes[i + 1]) + 0.05 : -Infinity) });
    h = out[out.length - 1].hb;
  });
  return out;
}

export function deckPlan(site: DeckSite, ground: (n: Vector3) => number, R: number): DeckPlan {
  const D = DECK.deck;
  const B = DECK_BUILD;
  const at = (x: number, z: number) => moveAlong(moveAlong(site.centre, site.side, x / R), site.fwd, z / R);
  const lowerK: PieceKind[] = ['stone', 'wood', 'landing', 'landing', 'wood', 'landing', 'top'];
  const upperK: readonly PieceKind[] = DECK.upperKinds;
  const g0 = ground(site.lower[0]);
  // (a landing over a rim lies just above the highest ground under it, which rises past the rim)
  const over = (a: Vector3, b: Vector3) => Math.max(...Array.from({ length: 11 }, (_, i) => ground(a.clone().lerp(b, i / 10).normalize()))) + 0.04;
  const lo = site.lower;
  const up = site.upper;
  // (the lower steps end flush with the rim, level with the terrace just in from it: the ground only
  // reaches the terrace's height a little inside the outline, and the walk surface carries on past the end)
  const la = lo[lo.length - 2];
  const lb = lo[lo.length - 1];
  const g1 = over(la, lb.clone().lerp(la, -0.4 / arcDistance(la, lb, R)).normalize());
  const g2 = ground(site.entry);
  const gTop = Math.max(over(up[up.length - 4], up[up.length - 3]), over(up[up.length - 3], up[up.length - 2]), g2 + 0.04);
  // the platform stands `lift` above the highest ground under it
  const under = [at(0, 0), ...[-1, 1].flatMap((i) => [-1, 1].map((j) => at((i * D.w) / 2, (j * D.d) / 2)))];
  const deckH = Math.max(...under.map(ground)) + D.lift;
  // (to the platform's railing line, where its gap posts stand)
  const edgeIn = at(D.entryX, D.d / 2 - B.railR);
  const pieces = [
    ...chain(site.lower, lowerK, g0, g1, 1, ground, R),
    ...chain(site.upper, upperK, ground(up[1]), gTop, 2, ground, R),
    { kind: 'steps' as const, stage: 3 as const, a: site.entry, b: edgeIn, ha: g2, hb: deckH },
  ];
  const bz = -D.d / 2 + B.benchBack;
  const facing = (n: Vector3) => site.fwd.clone().addScaledVector(n, -site.fwd.dot(n)).normalize();
  const spot = (n: Vector3): HomeSpot => ({ n, facing: facing(n) });
  // the lanterns: on the platform's corners, on the outer rail post at each stage's jutting landing, and on a post beside the foot
  const m = site.mesa;
  const lampAt = (stage: Stage, node: number, c: Vector3) => {
    const run = runs(pieces.filter((p) => p.stage === stage))[0];
    const rb = ribbon(run, R);
    const off = W / 2 + B.railOut;
    const [l, r] = ([-1, 1] as const).map((side) => rb.edge(rb.s[node], side, off));
    return { n: arcDistance(l, c, R) > arcDistance(r, c, R) ? l : r, h: rb.at(rb.s[node]).h + B.railTop + B.lampOver, stage };
  };
  const lat0 = new Vector3().crossVectors(site.lower[0], _e.subVectors(site.lower[1], site.lower[0])).normalize();
  const lamps: DeckPlan['lamps'] = [
    ...[-1, 1].flatMap((i) => [-1, 1].map((j) => ({ n: at(i * (D.w / 2 - B.railR), j * (D.d / 2 - B.railR)), h: deckH + B.railTop + B.lampOver, stage: 3 as Stage }))),
    lampAt(1, 3, m.n),
    lampAt(2, 3, m.tier!.n),
    { n: moveAlong(site.lower[0], lat0, (W / 2 + 0.25) / R), h: g0 + 0.72, stage: 1 },
  ];
  return {
    site,
    pieces,
    deckH,
    at,
    sites: [
      spot(site.lower[0]),
      spot(site.upper[1]),
      { n: site.entry, facing: facing(site.entry) },
    ],
    bench: spot(at(B.benchX, bz)),
    seats: {
      visitor: spot(at(B.benchX + B.seatVisitor, bz)),
      family: spot(at(B.benchX + B.seatFamily, bz)),
      stand: at(B.benchX + B.seatVisitor, bz + B.stand),
    },
    lamps,
  };
}

// ---------------------------------------------------------------------------
// where you walk

const _d = new Vector3();
const _e = new Vector3();
const _l = new Vector3();

/** Along a piece: its parameter (0 at `a`, 1 at `b`) and the distance off its centreline (u) at `p`. */
export function onPiece(pc: { a: Vector3; b: Vector3 }, p: Vector3, R: number): { t: number; s: number; len: number } {
  _e.subVectors(pc.b, pc.a);
  const len2 = _e.lengthSq();
  _d.subVectors(p, pc.a);
  const t = len2 > 0 ? _d.dot(_e) / len2 : 0;
  _l.crossVectors(pc.a, _e).normalize();
  return { t, s: _d.dot(_l) * R, len: Math.sqrt(len2) * R };
}

/** How far `p` is from a piece's centreline (u), past its ends from the nearer end. */
export function centreDistance(pc: { a: Vector3; b: Vector3 }, p: Vector3, R: number): number {
  const { t, s } = onPiece(pc, p, R);
  if (t >= 0 && t <= 1) return Math.abs(s);
  return arcDistance(p, t < 0 ? pc.a : pc.b, R);
}

/** The platform's frame: `x` across (toward the entry's side), `z` toward the view (u) at `p`. */
export function onDeck(plan: DeckPlan, p: Vector3, R: number): { x: number; z: number } {
  _d.subVectors(p, plan.site.centre);
  return { x: _d.dot(plan.site.side) * R, z: _d.dot(plan.site.fwd) * R };
}

/**
 * The walk surface of the built stages (`Terrain.addSurface`): the height of the steps, the landings
 * and the platform where you're on them, −∞ elsewhere.
 */
export function deckSurface(plan: DeckPlan, stage: number, R: number): (n: Vector3) => number {
  const D = DECK.deck;
  const pieces = plan.pieces.filter((p) => p.stage <= stage && p.kind !== 'path');
  const m = plan.site.mesa;
  const cosNear = Math.cos((m.radiusU + 2.5) / R);
  const half = W / 2 + 0.02;
  return (n) => {
    if (n.dot(m.n) < cosNear || stage < 1) return -Infinity;
    // the piece whose centreline is nearest (round a bend, its end: the landing pad's disc)
    let h = -Infinity;
    let best = half;
    for (const p of pieces) {
      const { t, s } = onPiece(p, n, R);
      const cd = t >= 0 && t <= 1 ? Math.abs(s) : arcDistance(n, t < 0 ? p.a : p.b, R);
      if (cd > best) continue;
      best = cd;
      h = p.ha + (p.hb - p.ha) * Math.min(1, Math.max(0, t));
    }
    if (stage >= 3) {
      const { x, z } = onDeck(plan, n, R);
      if (Math.abs(x) <= D.w / 2 && Math.abs(z) <= D.d / 2) h = Math.max(h, plan.deckH);
    }
    return h;
  };
}

// ---------------------------------------------------------------------------
// what blocks you

/** Small circles just inside a rim (the base's or the upper tier's), leaving out the ones in the way of `keep` (built steps crossing it, the platform). */
function rim(m: Mesa, tier: boolean, R: number, keep: (n: Vector3) => boolean): Obstacle[] {
  const B = DECK_BUILD;
  const c = tier ? m.tier!.n : m.n;
  const edge = (a: number) => (tier ? tierEdge(m.tier!, a) : mesaRadius(m.radiusU, m.seed, a));
  const count = Math.ceil((Math.PI * 2 * (tier ? m.tier!.radiusU : m.radiusU)) / B.rimGap);
  const out: Obstacle[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const n = moveAlong(c, mesaDir(m, c, a), (edge(a) - B.rimIn) / R);
    if (!keep(n)) out.push({ n, radiusU: B.rimR, mesa: true });
  }
  return out;
}

/**
 * A run of steps as one unit (the model and the rails both follow it): its centreline by arc length,
 * and its two edges, mitred at every bend so they meet in a corner instead of crossing the walkway.
 */
export interface Ribbon {
  run: readonly Piece[];
  /** Arc length (u) at each node: node i is run[i].a, the last is the last piece's b. */
  s: number[];
  length: number;
  /** The centre, the walk height and which piece (and how far along it) at arc length `s`. */
  at(s: number): { n: Vector3; h: number; i: number; t: number };
  /** The point `off` u to one side (−1, +1) of the centre at `s`, on the mitred edge. */
  edge(s: number, side: -1 | 1, off: number): Vector3;
}

export function ribbon(run: readonly Piece[], R: number): Ribbon {
  const nodes = [run[0].a, ...run.map((p) => p.b)];
  const s = [0];
  for (const p of run) s.push(s[s.length - 1] + arcDistance(p.a, p.b, R));
  const lats = run.map((p) => new Vector3().crossVectors(p.a, new Vector3().subVectors(p.b, p.a)).normalize());
  // at each node the edge turns along the bisector, pushed out so it stays `off` from both pieces' sides
  const mitres = nodes.map((n, i) => {
    const a = lats[Math.max(0, i - 1)];
    const b = lats[Math.min(run.length - 1, i)];
    const m = a.clone().add(b).addScaledVector(n, -a.clone().add(b).dot(n));
    if (m.lengthSq() < 1e-12) return { dir: b.clone(), k: 1 };
    m.normalize();
    return { dir: m, k: Math.min(2, 1 / Math.max(0.5, m.dot(b))) };
  });
  const find = (x: number) => {
    let i = 0;
    while (i < run.length - 1 && x > s[i + 1]) i++;
    const L = s[i + 1] - s[i];
    return { i, t: L > 0 ? Math.min(1, Math.max(0, (x - s[i]) / L)) : 0 };
  };
  return {
    run,
    s,
    length: s[s.length - 1],
    at(x) {
      const { i, t } = find(x);
      const p = run[i];
      return { n: p.a.clone().lerp(p.b, t).normalize(), h: p.ha + (p.hb - p.ha) * t, i, t };
    },
    edge(x, side, off) {
      const { i, t } = find(x);
      const a = moveAlong(nodes[i], mitres[i].dir, (side * off * mitres[i].k) / R);
      const b = moveAlong(nodes[i + 1], mitres[i + 1].dir, (side * off * mitres[i + 1].k) / R);
      return a.lerp(b, t).normalize();
    },
  };
}

/** Rail circles along both mitred edges of a run (open at both ends), none in anyone's way. */
function rails(run: readonly Piece[], R: number, inside: (n: Vector3) => boolean): Obstacle[] {
  const B = DECK_BUILD;
  const off = W / 2 + B.railOut;
  const rb = ribbon(run, R);
  const at = new Set<number>(rb.s.filter((x) => x > 0.15 && x < rb.length - 0.15));
  for (let x = 0.15; x <= rb.length - 0.15 + 1e-6; x += B.railGap) at.add(x);
  const pts: Vector3[] = [];
  for (const x of at) for (const side of [-1, 1] as const) pts.push(rb.edge(x, side, off));
  return pts.filter((n) => !inside(n)).map((n) => ({ n, radiusU: B.railR }));
}

/** Runs of consecutive built pieces (the paths between them aren't built, so they split them). */
export function runs(pieces: readonly Piece[]): Piece[][] {
  const out: Piece[][] = [];
  for (const p of pieces) {
    if (p.kind === 'path') continue;
    const last = out[out.length - 1];
    if (last && last[last.length - 1].b === p.a && last[last.length - 1].stage === p.stage) last.push(p);
    else out.push([p]);
  }
  return out;
}

/** Whether `n` is on a built stage's walkway (a little inside its edges, or up to `reach` u past its ends: a landing ends at a rim, whose circles stand just inside it) or on the platform. */
function walkway(plan: DeckPlan, stage: number, R: number, margin = 0.02, reach = 0.25): (n: Vector3) => boolean {
  const D = DECK.deck;
  const pieces = plan.pieces.filter((p) => p.stage <= stage && p.kind !== 'path').map((p) => ({ p, L: arcDistance(p.a, p.b, R) }));
  return (n) => {
    for (const { p, L } of pieces) {
      const { t, s } = onPiece(p, n, R);
      if (t * L >= -reach && (t - 1) * L <= reach && Math.abs(s) < W / 2 - margin) return true;
    }
    if (stage >= 3) {
      const { x, z } = onDeck(plan, n, R);
      if (Math.abs(x) < D.w / 2 - 0.1 && Math.abs(z) < D.d / 2 - 0.1) return true;
    }
    return false;
  };
}

/**
 * Everything on the deck's cliff that blocks at `stage` (0: the plain cliff, one big block; the
 * layout's `mesaObstacles`): the rims close to their edges with a gap where the built steps cross
 * them, the steps' rails, and on the platform its railing (open at its entry) and the bench.
 */
export function deckObstacles(plan: DeckPlan, stage: number, R: number, plain: readonly Obstacle[]): Obstacle[] {
  if (stage < 1) return [...plain];
  const D = DECK.deck;
  const B = DECK_BUILD;
  const m = plan.site.mesa;
  const on = walkway(plan, stage, R, -0.15);
  const out: Obstacle[] = [...rim(m, false, R, on), ...rim(m, true, R, (n) => on(n) || (stage >= 3 && inDeck(plan, n, R, 0.2)))];
  // (no rail where it would stand in anyone's way: within reach of a walkway's centreline)
  const built = plan.pieces.filter((p) => p.stage <= stage && p.kind !== 'path');
  const inWay = (n: Vector3) => built.some((p) => centreDistance(p, n, R) < W / 2 - 0.04);
  for (const run of runs(plan.pieces.filter((p) => p.stage <= stage))) out.push(...rails(run, R, (n) => inWay(n) || (stage >= 3 && inDeck(plan, n, R, -0.05))));
  if (stage >= 3) {
    // the railing round the platform, open at the front for its steps
    const x0 = D.w / 2 - B.railR;
    const z0 = D.d / 2 - B.railR;
    for (let x = -x0; x <= x0 + 1e-6; x += B.railGap) {
      out.push({ n: plan.at(x, -z0), radiusU: B.railR });
      if (Math.abs(x - D.entryX) > B.opening / 2) out.push({ n: plan.at(x, z0), radiusU: B.railR });
    }
    for (let z = -z0; z <= z0 + 1e-6; z += B.railGap) for (const x of [-x0, x0]) out.push({ n: plan.at(x, z), radiusU: B.railR });
    // the bench: its two ends (the front, where you sit, stays clear)
    const bz = -D.d / 2 + B.benchBack - 0.08;
    for (const dx of [-0.44, 0.31]) out.push({ n: plan.at(B.benchX + dx, bz), radiusU: 0.16 });
  }
  // the lantern post beside the foot
  out.push({ n: plan.lamps[plan.lamps.length - 1].n, radiusU: 0.08 });
  return out;
}

/** Inside the platform's outline, grown by `pad` (u). */
export function inDeck(plan: DeckPlan, n: Vector3, R: number, pad = 0): boolean {
  const D = DECK.deck;
  const { x, z } = onDeck(plan, n, R);
  return Math.abs(x) <= D.w / 2 + pad && Math.abs(z) <= D.d / 2 + pad;
}

/** The corridors the route planner keeps open up the built steps (its clearance would close them). */
export function deckCorridors(plan: DeckPlan, stage: number): Corridor[] {
  const out: Corridor[] = plan.pieces.filter((p) => p.stage <= stage && p.kind !== 'path').map((p) => ({ a: p.a, b: p.b, r: 0.2 }));
  if (stage >= 3) out.push({ a: plan.site.entry, b: plan.at(DECK.deck.entryX, 0), r: 0.2 }, { a: plan.at(DECK.deck.entryX, 0), b: plan.seats.family.n, r: 0.2 });
  return out;
}

/** The family's seat on the bench, for `seats.ts` (the bench kind, with entry points in front on the platform). */
export const deckBenchTop = BENCH.seatTop;
