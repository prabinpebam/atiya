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
import { DECK_BUILD, ribbon, runs, type DeckPlan, type Piece, type Stage } from './deckPlan';

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

/** A slab between two quads in the planet's frame (top corners, then the bottom ones below them), in a local frame at its middle so the wood grain runs `along`. */
function prism(c: Ctx, top: readonly Vector3[], bottom: readonly Vector3[], colour: string, along: Vector3): void {
  const mid = top.reduce((a, v) => a.add(v), new Vector3()).multiplyScalar(1 / top.length);
  const q = upright(mid.clone().normalize(), along);
  const inv = q.clone().invert();
  const L = (v: Vector3) => v.clone().sub(mid).applyQuaternion(inv);
  const T = top.map(L);
  const B = bottom.map(L);
  const centre = [...T, ...B].reduce((a, v) => a.add(v), new Vector3()).multiplyScalar(1 / 8);
  const tris: Vector3[][] = [];
  const quad = (a: Vector3, b: Vector3, cc: Vector3, d: Vector3) => tris.push([a, b, cc], [a, cc, d]);
  quad(T[0], T[1], T[2], T[3]);
  quad(B[3], B[2], B[1], B[0]);
  for (let i = 0; i < 4; i++) quad(T[i], B[i], B[(i + 1) % 4], T[(i + 1) % 4]);
  const pos: number[] = [];
  const e1 = new Vector3();
  const e2 = new Vector3();
  const nrm = new Vector3();
  for (const [x, y, z] of tris) {
    // (wound outward, whichever way the corners came)
    nrm.crossVectors(e1.subVectors(y, x), e2.subVectors(z, x));
    const out = x.clone().add(y).add(z).multiplyScalar(1 / 3).sub(centre);
    const tri = nrm.dot(out) >= 0 ? [x, y, z] : [x, z, y];
    for (const v of tri) pos.push(v.x, v.y, v.z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  c.k.add(g, colour, { p: [mid.x, mid.y, mid.z], q });
}

/**
 * One run of steps as a single unit (viewing-deck.md §4.3): everything follows the run's ribbon (its
 * centreline by arc length and its two mitred edges), so the treads, the landing boards, the
 * stringers, the supports and the handrails of one flight carry straight on into the next, meeting
 * in clean corners at the bends instead of crossing each other. Stone steps (at the foot) are solid
 * blocks down into the ground; the wood stands on stringers and posts.
 */
function runModel(c: Ctx, run: readonly Piece[], openEnd: boolean): void {
  const B = DECK_BUILD;
  const rb = ribbon(run, c.R);
  const half = W / 2;
  const rises = (k: Piece['kind']) => k === 'stone' || k === 'wood' || k === 'steps';
  const dirAt = (x: number) => {
    const p = run[rb.at(x).i];
    return new Vector3().subVectors(p.b, p.a);
  };
  // the walkway in slices: a tread per step on the flights (its top halfway up its rise, so the walk
  // height runs through the treads' middles), a board every ≈ 0.17 u on the landings
  const slices: Array<{ s0: number; s1: number; top: number; stone: boolean }> = [];
  run.forEach((p, i) => {
    const s0 = rb.s[i];
    const L = rb.s[i + 1] - s0;
    if (rises(p.kind)) {
      const N = Math.max(2, Math.round((p.hb - p.ha) / B.rise));
      for (let k = 0; k < N; k++) slices.push({ s0: s0 + (L * k) / N, s1: s0 + (L * (k + 1)) / N, top: p.ha + ((p.hb - p.ha) * (k + 0.5)) / N, stone: p.kind === 'stone' });
    } else {
      const N = Math.max(2, Math.round(L / 0.17));
      for (let k = 0; k < N; k++) slices.push({ s0: s0 + (L * k) / N, s1: s0 + (L * (k + 1)) / N, top: p.ha, stone: false });
    }
  });
  const corners = (x0: number, x1: number, off: number) => [rb.edge(x0, -1, off), rb.edge(x1, -1, off), rb.edge(x1, 1, off), rb.edge(x0, 1, off)];
  c.k.surface('stone', () => {
    slices.forEach((sl, i) => {
      if (!sl.stone) return;
      // a solid block from the tread down into the ground, a little wider than the walkway
      const q = corners(sl.s0, sl.s1 + 0.01, half + 0.05);
      const g = Math.min(...q.map(c.ground)) - 0.12;
      const shade = hash3(i, 3.1, 7.7);
      prism(c, q.map((n) => world(c, n, sl.top)), q.map((n) => world(c, n, g)), shade < 0.33 ? '#a9a194' : shade < 0.66 ? '#9d968b' : '#b3ab9d', dirAt((sl.s0 + sl.s1) / 2));
    });
  });
  c.k.surface('wood', () => {
    slices.forEach((sl, i) => {
      if (sl.stone) return;
      const flat = !rises(run[rb.at((sl.s0 + sl.s1) / 2).i].kind);
      // (a hair of gap between boards; treads a little shorter than their run)
      const gap = flat ? 0.012 : (sl.s1 - sl.s0) * 0.05;
      const q = corners(sl.s0 + gap, sl.s1 - gap, half);
      prism(c, q.map((n) => world(c, n, sl.top)), q.map((n) => world(c, n, sl.top - 0.05)), flat && hash3(i, 1.3, 2.9) < 0.5 ? '#b07f4c' : PLANK, dirAt((sl.s0 + sl.s1) / 2));
    });
    // the wood's stations: every node, and between them no more than 0.8 u apart (none on the stone)
    const woodFrom = run[0].kind === 'stone' ? rb.s[1] : 0;
    const stations: number[] = [];
    for (let i = 0; i < rb.s.length; i++) {
      if (rb.s[i] < woodFrom) continue;
      stations.push(rb.s[i]);
      if (i + 1 < rb.s.length) {
        const n = Math.ceil((rb.s[i + 1] - rb.s[i]) / 0.8);
        for (let k = 1; k < n; k++) stations.push(rb.s[i] + ((rb.s[i + 1] - rb.s[i]) * k) / n);
      }
    }
    const inset = half - 0.05;
    // stringers under both edges, one straight beam per piece, meeting at the bends' corners
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < run.length; i++) {
        if (rb.s[i] < woodFrom) continue;
        const a = rb.edge(rb.s[i], side, inset);
        const b = rb.edge(rb.s[i + 1], side, inset);
        beam(c, world(c, a, rb.at(rb.s[i]).h - 0.12), world(c, b, rb.at(rb.s[i + 1]).h - 0.12), a, 0.14, 0.07, BEAM);
      }
    }
    // posts under the stringers down to the ground, a cross beam between each pair, X braces between pairs where it's tall
    let prev: Array<{ n: Vector3; h: number; g: number }> | null = null;
    for (const x of stations) {
      const h = rb.at(x).h - 0.19;
      const pair = ([-1, 1] as const).map((side) => {
        const n = rb.edge(x, side, inset);
        return { n, h, g: c.ground(n) };
      });
      const d = dirAt(Math.min(x + 1e-3, rb.length));
      for (const p of pair) if (p.h - p.g > 0.08) post(c, p.n, p.h, d);
      const low = Math.max(pair[0].g, pair[1].g);
      if (h - low > 0.35) beam(c, world(c, pair[0].n, (h + low) / 2), world(c, pair[1].n, (h + low) / 2), pair[0].n, 0.07, 0.07, BEAM);
      if (prev) {
        for (const k of [0, 1]) {
          const p0 = prev[k];
          const p1 = pair[k];
          if (Math.min(p0.h - p0.g, p1.h - p1.g) < 0.55) continue;
          beam(c, world(c, p0.n, p0.h - 0.05), world(c, p1.n, p1.g + 0.12), p0.n, 0.05, 0.05, BEAM);
          beam(c, world(c, p0.n, p0.g + 0.12), world(c, p1.n, p1.h - 0.05), p0.n, 0.05, 0.05, BEAM);
        }
      }
      prev = pair;
    }
    // the handrails along both edges, the whole run as one: posts at every bend and between them no more
    // than `postGap` apart, a top rail and a mid rail carried from post to post (sloping with the flights);
    // (where the run ends at the platform, its railing's post stands there already)
    const rails: number[] = [];
    for (let i = 0; i < rb.s.length; i++) {
      rails.push(rb.s[i]);
      if (i + 1 < rb.s.length) {
        const n = Math.ceil((rb.s[i + 1] - rb.s[i]) / B.postGap);
        for (let k = 1; k < n; k++) rails.push(rb.s[i] + ((rb.s[i + 1] - rb.s[i]) * k) / n);
      }
    }
    const off = half + B.railOut;
    for (const side of [-1, 1] as const) {
      const tops: Vector3[] = [];
      rails.forEach((x, i) => {
        const n = rb.edge(x, side, off);
        const h = rb.at(x).h;
        const last = i === rails.length - 1;
        if (!(last && openEnd)) block(c, [0.06, B.railTop + 0.16, 0.06], RAIL, n, h + (B.railTop - 0.16) / 2, dirAt(Math.min(x + 1e-3, rb.length)));
        tops.push(world(c, n, h + B.railTop - 0.02));
      });
      for (let i = 0; i + 1 < tops.length; i++) {
        const up = tops[i].clone().normalize();
        beam(c, tops[i], tops[i + 1], up, 0.05, 0.08, RAIL);
        beam(c, tops[i].clone().addScaledVector(up, -0.28), tops[i + 1].clone().addScaledVector(up, -0.28), up, 0.035, 0.035, RAIL);
      }
    }
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

/** Flat stepping stones along a stretch of lawn the route crosses, so a flight's end and the next one's start read as one way. */
function steppingStones(c: Ctx, p: Piece, seed: number): void {
  const len = p.a.angleTo(p.b) * c.R;
  const N = Math.floor((len - 0.2) / 0.36);
  if (N < 1) return;
  const d = new Vector3().subVectors(p.b, p.a);
  c.k.surface('rock', () => {
    for (let i = 0; i < N; i++) {
      const t = (0.1 + 0.36 * (i + 0.5) + (len - 0.2 - 0.36 * N) / 2) / len;
      const n = p.a.clone().lerp(p.b, t).normalize();
      const q = upright(n, d);
      const side = new Vector3(0, 0, 1).applyQuaternion(q);
      const r = 0.15 + 0.03 * hash3(seed, i, 1.7);
      const m = moveAlong(n, side, ((i % 2 ? 1 : -1) * 0.06) / c.R);
      const shade = hash3(seed, i, 4.2);
      c.k.add(new CylinderGeometry(r, r * 1.06, 0.07, 7), shade < 0.5 ? '#a9a194' : '#b3ab9d', { p: at(c, m, c.ground(m) - 0.015), q: q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), hash3(seed, i, 9.1) * Math.PI)), s: [1.15, 1, 0.9] });
    }
  });
}

/** One stage of the deck as a kit (stage 1: the lower steps; 2: the upper steps; 3: the platform and its steps). */
export function deckStageModel(plan: DeckPlan, stage: Stage, ground: (n: Vector3) => number, R: number): KitGeometry {
  const c: Ctx = { k: new Kit(), R, ground };
  // (the platform's steps end at its railing, whose gap posts stand where their rails end)
  for (const run of runs(plan.pieces.filter((p) => p.stage === stage))) runModel(c, run, stage === 3);
  plan.pieces.forEach((p, i) => {
    if (p.stage === stage && p.kind === 'path') steppingStones(c, p, i);
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
