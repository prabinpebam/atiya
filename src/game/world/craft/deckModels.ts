/**
 * The viewing deck's models (docs: viewing-deck.md §4.3): each build stage as one kit, laid out in
 * the planet's own frame along the plan (every part upright on the ground under it): stone steps
 * from the meadow, wooden flights on stringers with posts, cross beams and braces down to the
 * ground, plank landings, handrails on both sides, and on the upper tier the platform on its braced
 * frame with a railing, a bench and small lanterns. Also the iron ore on the boulders that carry it.
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, hash3, type KitGeometry, type V3 } from '../kit';
import { moveAlong } from '../../math/sphere';
import { ARCH, bench } from '../parts';
import { DECK } from '../deckSpec';
import { DECK_BUILD, type DeckPlan, type Piece, type Stage } from './deckPlan';

const PLANK = '#b98752';
const BEAM = '#8d5c33';
const POST = '#7b4d2a';
const RAIL = '#a2703f';
const LAMP_GLOW = '#ffd594';

const W = DECK.width;

interface Ctx {
  k: Kit;
  R: number;
  ground: (n: Vector3) => number;
}

const _m = new Matrix4();

/** Upright at `n`, its +x along `along` (a tangent), +y up. */
function upright(n: Vector3, along: Vector3): Quaternion {
  const y = n.clone().normalize();
  const x = along.clone().addScaledVector(y, -along.dot(y)).normalize();
  const z = new Vector3().crossVectors(x, y);
  return new Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
}

const at = (c: Ctx, n: Vector3, h: number): V3 => {
  const p = n.clone().normalize().multiplyScalar(c.R + h);
  return [p.x, p.y, p.z];
};
const world = (c: Ctx, n: Vector3, h: number) => n.clone().normalize().multiplyScalar(c.R + h);

function block(c: Ctx, size: V3, colour: string, n: Vector3, h: number, along: Vector3): void {
  c.k.add(new BoxGeometry(size[0], size[1], size[2]), colour, { p: at(c, n, h), q: upright(n, along) });
}

/** A beam between two points in the planet's frame, its top face toward `up`. */
function beam(c: Ctx, a: Vector3, b: Vector3, up: Vector3, t: number, w: number, colour: string): void {
  const d = b.clone().sub(a);
  const len = d.length();
  if (len < 1e-4) return;
  const x = d.normalize();
  const z = new Vector3().crossVectors(x, up).normalize();
  const y = new Vector3().crossVectors(z, x);
  const q = new Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  c.k.add(new BoxGeometry(len, t, w), colour, { p: [mid.x, mid.y, mid.z], q });
}

/** A post from the ground up to `top` (u above the base sphere). */
function post(c: Ctx, n: Vector3, top: number, along: Vector3, s = 0.09, colour = POST): void {
  const g = c.ground(n) - 0.06;
  if (top - g < 0.05) return;
  block(c, [s, top - g, s], colour, n, (top + g) / 2, along);
}

/** A small lantern: an iron cage round a warm bulb (the glow layer brightens it at night). */
function lantern(c: Ctx, n: Vector3, h: number, along: Vector3): void {
  const q = upright(n, along);
  const p = at(c, n, h);
  c.k.group({ p, q }, () => {
    c.k.surface('metal', () => {
      c.k.add(new BoxGeometry(0.17, 0.03, 0.17), ARCH.iron, { p: [0, -0.1, 0] });
      c.k.add(new CylinderGeometry(0.015, 0.1, 0.07, 4), ARCH.iron, { p: [0, 0.12, 0], r: [0, Math.PI / 4, 0] });
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        c.k.add(new BoxGeometry(0.018, 0.2, 0.018), ARCH.iron, { p: [x * 0.075, 0, z * 0.075] });
    });
    c.k.add(new BoxGeometry(0.11, 0.15, 0.11), LAMP_GLOW, {}, 'glow');
  });
}

/** Where along a piece: its centre at `t` (0 … 1), `s` u across (toward the piece's left), and the walk height there. */
function along(p: Piece, t: number, s: number, R: number): { n: Vector3; h: number } {
  const c = p.a.clone().lerp(p.b, t).normalize();
  const lat = new Vector3().crossVectors(p.a, new Vector3().subVectors(p.b, p.a)).normalize();
  return { n: s ? moveAlong(c, lat, s / R) : c, h: p.ha + (p.hb - p.ha) * t };
}

const dirOf = (p: Piece) => new Vector3().subVectors(p.b, p.a);

/** Handrails on both sides of a piece: posts every ≈ 0.55 u and a rail along their tops (sloped with the flight). */
function handrails(c: Ctx, p: Piece, from: number, to: number): void {
  const L = p.a.distanceTo(p.b) * c.R;
  const n = Math.max(1, Math.round((L * (to - from)) / 0.55));
  const off = W / 2 + DECK_BUILD.railOut;
  const dir = dirOf(p);
  for (const side of [-1, 1]) {
    const tops: Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n;
      const { n: q, h } = along(p, t, side * off, c.R);
      block(c, [0.06, 0.6, 0.06], RAIL, q, h + 0.26, dir);
      tops.push(world(c, q, h + 0.56));
    }
    for (let i = 0; i + 1 < tops.length; i++) {
      const upN = tops[i].clone().normalize();
      beam(c, tops[i], tops[i + 1], upN, 0.05, 0.08, RAIL);
      beam(c, tops[i].clone().addScaledVector(upN, -0.26), tops[i + 1].clone().addScaledVector(upN, -0.26), upN, 0.035, 0.035, RAIL);
    }
  }
}

function stoneSteps(c: Ctx, p: Piece): void {
  const N = Math.max(2, Math.round((p.hb - p.ha) / DECK_BUILD.rise));
  const L = p.a.distanceTo(p.b) * c.R;
  const dir = dirOf(p);
  c.k.surface('stone', () => {
    for (let i = 0; i < N; i++) {
      const { n } = along(p, (i + 0.5) / N, 0, c.R);
      const top = p.ha + ((p.hb - p.ha) * (i + 1)) / N;
      const g = c.ground(n) - 0.12;
      const shade = hash3(i, 3.1, 7.7);
      const col = shade < 0.33 ? '#a9a194' : shade < 0.66 ? '#9d968b' : '#b3ab9d';
      block(c, [(L / N) * 1.04, top - g, W + 0.08 + shade * 0.06], col, n, (top + g) / 2, dir);
    }
  });
}

function flight(c: Ctx, p: Piece): void {
  const N = Math.max(2, Math.round((p.hb - p.ha) / DECK_BUILD.rise));
  const L = p.a.distanceTo(p.b) * c.R;
  const dir = dirOf(p);
  c.k.surface('wood', () => {
    // treads (open stairs), each a thick plank
    for (let i = 0; i < N; i++) {
      const { n } = along(p, (i + 0.5) / N, 0, c.R);
      const top = p.ha + ((p.hb - p.ha) * (i + 1)) / N;
      block(c, [(L / N) * 0.92, 0.05, W], PLANK, n, top - 0.025, dir);
    }
    // stringers under the treads' ends, and posts with cross beams and braces down to the ground
    const posts = Math.max(1, Math.round(L / 0.85));
    for (const side of [-1, 1]) {
      const a = along(p, 0, side * (W / 2 - 0.05), c.R);
      const b = along(p, 1, side * (W / 2 - 0.05), c.R);
      beam(c, world(c, a.n, a.h - 0.1), world(c, b.n, b.h - 0.1), a.n, 0.14, 0.07, BEAM);
    }
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const ends = [-1, 1].map((side) => along(p, t, side * (W / 2 - 0.05), c.R));
      for (const e of ends) post(c, e.n, e.h - 0.16, dir);
      const h = ends[0].h - 0.16;
      const g = Math.max(c.ground(ends[0].n), c.ground(ends[1].n));
      if (h - g > 0.3) beam(c, world(c, ends[0].n, (h + g) / 2), world(c, ends[1].n, (h + g) / 2), ends[0].n, 0.07, 0.07, BEAM);
      // an X brace to the next pair on the outer side, where it's tall enough to need one
      if (i < posts) {
        const next = [-1, 1].map((side) => along(p, (i + 1) / posts, side * (W / 2 - 0.05), c.R));
        for (const k of [0, 1]) {
          const e0 = ends[k];
          const e1 = next[k];
          const g0 = c.ground(e0.n);
          const g1 = c.ground(e1.n);
          if (Math.min(e0.h - g0, e1.h - g1) < 0.55) continue;
          beam(c, world(c, e0.n, e0.h - 0.2), world(c, e1.n, g1 + 0.12), e0.n, 0.05, 0.05, BEAM);
          beam(c, world(c, e0.n, g0 + 0.12), world(c, e1.n, e1.h - 0.2), e0.n, 0.05, 0.05, BEAM);
        }
      }
    }
    handrails(c, p, 0, 1);
  });
}

function landing(c: Ctx, p: Piece, rails: boolean): void {
  const L = p.a.distanceTo(p.b) * c.R;
  const dir = dirOf(p);
  const boards = Math.max(2, Math.round(L / 0.17));
  c.k.surface('wood', () => {
    for (let i = 0; i < boards; i++) {
      const { n, h } = along(p, (i + 0.5) / boards, 0, c.R);
      block(c, [(L / boards) * 0.94, 0.05, W + 0.04], hash3(i, 1.3, 2.9) < 0.5 ? PLANK : '#b07f4c', n, h - 0.025, dir);
    }
    for (const side of [-1, 1]) {
      const a = along(p, 0, side * (W / 2 - 0.02), c.R);
      const b = along(p, 1, side * (W / 2 - 0.02), c.R);
      beam(c, world(c, a.n, a.h - 0.1), world(c, b.n, b.h - 0.1), a.n, 0.12, 0.08, BEAM);
      for (const t of [0.08, 0.5, 0.92]) {
        const e = along(p, t, side * (W / 2 - 0.05), c.R);
        post(c, e.n, e.h - 0.14, dir);
      }
    }
    if (rails) handrails(c, p, 0, 1);
  });
}

/** Where two pieces meet at a bend: a round landing pad, so the planks leave no gap (the walk surface's joint disc). */
function joint(c: Ctx, n: Vector3, h: number, dir: Vector3): void {
  c.k.surface('wood', () => {
    c.k.add(new CylinderGeometry(W / 2, W / 2, 0.05, 10), '#b07f4c', { p: at(c, n, h - 0.03), q: upright(n, dir) });
    post(c, n, h - 0.08, dir, 0.1);
  });
}

function platform(c: Ctx, plan: DeckPlan): void {
  const D = DECK.deck;
  const B = DECK_BUILD;
  const fwd = plan.site.fwd;
  const side = plan.site.side;
  const P = (x: number, z: number) => plan.at(x, z);
  const H = plan.deckH;
  c.k.surface('wood', () => {
    // floor boards across, on a frame of beams round the edge and joists, on braced posts
    const boards = Math.round(D.d / 0.16);
    for (let i = 0; i < boards; i++) {
      const z = -D.d / 2 + ((i + 0.5) * D.d) / boards;
      block(c, [D.w, 0.05, (D.d / boards) * 0.93], hash3(i, 5.1, 0.7) < 0.5 ? PLANK : '#b07f4c', P(0, z), H - 0.025, side);
    }
    const hx = D.w / 2 - 0.04;
    const hz = D.d / 2 - 0.04;
    for (const z of [-hz, 0, hz]) beam(c, world(c, P(-hx, z), H - 0.11), world(c, P(hx, z), H - 0.11), P(0, z), 0.12, 0.08, BEAM);
    for (const x of [-hx, hx]) beam(c, world(c, P(x, -hz), H - 0.11), world(c, P(x, hz), H - 0.11), P(x, 0), 0.12, 0.08, BEAM);
    const legs: Array<[number, number]> = [];
    for (const x of [-hx, 0, hx]) for (const z of [-hz, hz]) legs.push([x, z]);
    for (const [x, z] of legs) post(c, P(x, z), H - 0.16, side, 0.11);
    // X braces on each side of the frame
    const brace = (x0: number, z0: number, x1: number, z1: number) => {
      const a = P(x0, z0);
      const b = P(x1, z1);
      beam(c, world(c, a, H - 0.18), world(c, b, c.ground(b) + 0.06), a, 0.05, 0.05, BEAM);
      beam(c, world(c, a, c.ground(a) + 0.06), world(c, b, H - 0.18), a, 0.05, 0.05, BEAM);
    };
    for (const z of [-hz, hz]) {
      brace(-hx, z, 0, z);
      brace(0, z, hx, z);
    }
    for (const x of [-hx, hx]) brace(x, -hz, x, hz);
    // the railing, open at the back for the steps: posts, a top rail and a mid rail
    const rx = D.w / 2 - B.railR;
    const rz = D.d / 2 - B.railR;
    const run = (pts: Vector3[]) => {
      for (const q of pts) block(c, [0.07, 0.62, 0.07], RAIL, q, H + 0.29, side);
      for (let i = 0; i + 1 < pts.length; i++) {
        const up = pts[i];
        beam(c, world(c, pts[i], H + 0.58), world(c, pts[i + 1], H + 0.58), up, 0.05, 0.09, RAIL);
        beam(c, world(c, pts[i], H + 0.3), world(c, pts[i + 1], H + 0.3), up, 0.035, 0.035, RAIL);
      }
    };
    const edge = (x0: number, z0: number, x1: number, z1: number) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5));
      return Array.from({ length: n + 1 }, (_, i) => P(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n));
    };
    const gap0 = D.entryX - B.opening / 2;
    const gap1 = D.entryX + B.opening / 2;
    // (from the gap's one side round the back to its other side)
    run([...edge(gap0, rz, -rx, rz), ...edge(-rx, rz, -rx, -rz).slice(1), ...edge(-rx, -rz, rx, -rz).slice(1), ...edge(rx, -rz, rx, rz).slice(1), ...edge(rx, rz, gap1, rz).slice(1)]);
  });
  // the bench, facing the view (bench space: +z is its front, +y up)
  const bn = plan.bench.n.clone().normalize();
  const z = fwd.clone().projectOnPlane(bn).normalize();
  const face = new Quaternion().setFromRotationMatrix(_m.makeBasis(new Vector3().crossVectors(bn, z), bn, z));
  bench(c.k, { p: at(c, bn, H), q: face });
}

/** One stage of the deck as a kit (stage 1: the lower steps; 2: the upper steps; 3: the platform and its steps). */
export function deckStageModel(plan: DeckPlan, stage: Stage, ground: (n: Vector3) => number, R: number): KitGeometry {
  const c: Ctx = { k: new Kit(), R, ground };
  const pieces = plan.pieces.filter((p) => p.stage === stage && p.kind !== 'path');
  pieces.forEach((p, i) => {
    if (p.kind === 'stone') stoneSteps(c, p);
    else if (p.kind === 'wood' || p.kind === 'steps') flight(c, p);
    else landing(c, p, true);
    const next = pieces[i + 1];
    if (next && next.a === p.b) joint(c, p.b, p.hb, dirOf(p));
  });
  if (stage === 3) platform(c, plan);
  for (const l of plan.lamps) {
    if (l.stage !== stage) continue;
    const d = plan.site.fwd;
    // the foot's lantern stands on its own post; the others on rail posts
    if (l === plan.lamps[plan.lamps.length - 1]) c.k.surface('wood', () => post(c, l.n, l.h - 0.1, d, 0.08));
    lantern(c, l.n, l.h, d);
  }
  return c.k.build();
}

/** Nuggets of iron ore on a boulder (in its own frame: the boulder model's main lump), as one geometry for an instanced draw. */
export function ironNuggets(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const az = (i / count) * Math.PI * 2 + hash3(i, 2, 5) * 0.4;
    const el = 0.15 + hash3(i, 7, 1) * 1.0;
    const dir = new Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    const p = new Vector3(dir.x * 0.575, dir.y * 0.475, dir.z * 0.475).multiplyScalar(0.84).add(new Vector3(0, 0.32, 0));
    const s = 0.08 + hash3(i, 4, 9) * 0.07;
    const g = new IcosahedronGeometry(1, 0);
    g.scale(s * (1 + hash3(i, 1, 1) * 0.5), s * 0.8, s);
    g.rotateY(az);
    g.translate(p.x, p.y, p.z);
    // rust round the dark metal: every other nugget carries a rusty crust (vertex colours)
    const rust = i % 2 === 0;
    const cols = new Float32Array(g.getAttribute('position').count * 3);
    for (let v = 0; v < cols.length; v += 3) {
      const k = hash3(i, v, 3);
      const [r, gg, b] = rust ? [0.72 + 0.1 * k, 0.33 + 0.08 * k, 0.16] : [0.3 + 0.08 * k, 0.29 + 0.06 * k, 0.3 + 0.08 * k];
      cols[v] = r;
      cols[v + 1] = gg;
      cols[v + 2] = b;
    }
    g.setAttribute('color', new Float32BufferAttribute(cols, 3));
    parts.push(g.toNonIndexed());
  }
  const out = mergeGeometries(parts, false);
  out.computeVertexNormals();
  return out;
}
