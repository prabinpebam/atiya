/**
 * Route planning over the whole planet (docs: prabin-npc.md §4.1): a navigation grid on the sphere
 * and A* on it, the standard recipe for NPCs in a static world. The sphere is split into the six
 * faces of a cube (an equal-angle cube map: cells stay nearly square and ≈ 0.25 u across); each
 * cell knows its eight neighbours, across the faces' seams too, and the arc length to each. Cells
 * inside an obstacle (grown by the walker's radius and a margin), in the pond or in deep water are
 * blocked. A path is found with 8-way A* (great-circle heuristic, no cutting a blocked corner), then
 * smoothed by string-pulling: each waypoint skips ahead to the furthest point it can see along a
 * clear great circle. Queries can block extra discs for a moment (someone standing in the way).
 * Pure: unit-tested against the real layout.
 */
import { Vector3 } from 'three';
import type { Obstacle } from '../../math/sphere';

/** The cube's faces: normal, then the two in-face axes (u × v = normal). */
const FACES: ReadonlyArray<[Vector3, Vector3, Vector3]> = [
  [new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(0, 1, 0)],
  [new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 1, 0)],
  [new Vector3(0, 1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, -1)],
  [new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1)],
  [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
  [new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, 1, 0)],
];
/** Neighbour order: E, N, W, S, then the diagonals NE, NW, SW, SE (each needs its two sides free). */
const DIRS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];
const DIAG_SIDES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [2, 1],
  [2, 3],
  [0, 3],
];
const Q = Math.PI / 4;

export interface NavBlock {
  n: Vector3;
  /** Radius (u), grown by the grid's clearance like an obstacle. */
  r: number;
}

const _p = new Vector3();
const _q = new Vector3();

export class SphereNav {
  readonly count: number;
  /** Cell size at a face's centre (u). */
  readonly cellU: number;
  private readonly S: number;
  private readonly cx: Float32Array;
  private readonly cy: Float32Array;
  private readonly cz: Float32Array;
  private readonly nbr: Int32Array;
  private readonly cost: Float32Array;
  private readonly blocked: Uint8Array;
  private readonly temp: Uint8Array;
  private readonly gCost: Float32Array;
  private readonly came: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private gen = 0;
  /** Nodes expanded by the last query (diagnostics). */
  lastExpanded = 0;

  constructor(
    readonly R: number,
    obstacles: readonly Obstacle[],
    wet: (n: Vector3) => boolean,
    /** The walker's radius plus a margin (u): obstacles are grown by it. */
    readonly clearance = 0.28,
    cellU = 0.25,
  ) {
    const S = Math.max(8, Math.round(((Math.PI / 2) * R) / cellU));
    this.S = S;
    this.cellU = ((Math.PI / 2) * R) / S;
    const N = 6 * S * S;
    this.count = N;
    this.cx = new Float32Array(N);
    this.cy = new Float32Array(N);
    this.cz = new Float32Array(N);
    for (let f = 0; f < 6; f++) {
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          this.virtual(f, i, j, _p);
          const k = (f * S + j) * S + i;
          this.cx[k] = _p.x;
          this.cy[k] = _p.y;
          this.cz[k] = _p.z;
        }
      }
    }
    // neighbours, and the arc to each (inside a face by index; across a seam through the point
    // where the missing cell would be)
    this.nbr = new Int32Array(N * 8).fill(-1);
    this.cost = new Float32Array(N * 8);
    for (let f = 0; f < 6; f++) {
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          const k = (f * S + j) * S + i;
          for (let d = 0; d < 8; d++) {
            const ni = i + DIRS[d][0];
            const nj = j + DIRS[d][1];
            let m: number;
            if (ni >= 0 && nj >= 0 && ni < S && nj < S) m = (f * S + nj) * S + ni;
            else m = this.cellOf(this.virtual(f, ni, nj, _q));
            if (m === k) continue;
            let dup = false;
            for (let e = 0; e < d; e++) if (this.nbr[k * 8 + e] === m) dup = true;
            if (dup) continue;
            this.nbr[k * 8 + d] = m;
            this.cost[k * 8 + d] = this.arc(k, m);
          }
        }
      }
    }
    this.blocked = new Uint8Array(N);
    this.temp = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (wet(this.centre(k, _p))) this.blocked[k] = 1;
    for (const o of obstacles) if (o.radiusU > 0) this.stampDisc(o.n, o.radiusU + clearance, this.blocked, null);
    this.gCost = new Float32Array(N);
    this.came = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
  }

  /** The point on the sphere at face `f`'s cell (i, j), which may lie past the face's edge. */
  private virtual(f: number, i: number, j: number, out: Vector3): Vector3 {
    const [n, u, v] = FACES[f];
    const a = ((i + 0.5) / this.S) * 2 * Q - Q;
    const b = ((j + 0.5) / this.S) * 2 * Q - Q;
    return out.copy(n).addScaledVector(u, Math.tan(a)).addScaledVector(v, Math.tan(b)).normalize();
  }

  /** The cell holding the unit vector `p`. */
  cellOf(p: Vector3): number {
    const ax = Math.abs(p.x);
    const ay = Math.abs(p.y);
    const az = Math.abs(p.z);
    const f = ax >= ay && ax >= az ? (p.x > 0 ? 0 : 1) : ay >= az ? (p.y > 0 ? 2 : 3) : p.z > 0 ? 4 : 5;
    const [n, u, v] = FACES[f];
    const d = p.dot(n);
    const a = Math.atan(p.dot(u) / d);
    const b = Math.atan(p.dot(v) / d);
    const S = this.S;
    const i = Math.min(S - 1, Math.max(0, Math.floor(((a + Q) / (2 * Q)) * S)));
    const j = Math.min(S - 1, Math.max(0, Math.floor(((b + Q) / (2 * Q)) * S)));
    return (f * S + j) * S + i;
  }

  centre(k: number, out = new Vector3()): Vector3 {
    return out.set(this.cx[k], this.cy[k], this.cz[k]);
  }

  private arc(a: number, b: number): number {
    const d = this.cx[a] * this.cx[b] + this.cy[a] * this.cy[b] + this.cz[a] * this.cz[b];
    return Math.acos(Math.min(1, Math.max(-1, d))) * this.R;
  }

  /** Mark every cell within `r` u of `n` (a flood fill from its cell); `list` collects them. */
  private stampDisc(n: Vector3, r: number, into: Uint8Array, list: number[] | null): void {
    const cosIn = Math.cos(r / this.R);
    const cosGo = Math.cos((r + this.cellU * 1.5) / this.R);
    const start = this.cellOf(n);
    const seen = new Set<number>([start]);
    const queue = [start];
    while (queue.length) {
      const k = queue.pop()!;
      const d = this.cx[k] * n.x + this.cy[k] * n.y + this.cz[k] * n.z;
      if (d >= cosIn && !into[k]) {
        into[k] = 1;
        list?.push(k);
      }
      if (d < cosGo) continue;
      for (let e = 0; e < 8; e++) {
        const m = this.nbr[k * 8 + e];
        if (m >= 0 && !seen.has(m)) {
          seen.add(m);
          queue.push(m);
        }
      }
    }
  }

  private open(k: number): boolean {
    return !this.blocked[k] && !this.temp[k];
  }

  /** Is `p` on open ground? */
  freeAt(p: Vector3): boolean {
    return this.open(this.cellOf(p));
  }

  /** The number of blocked cells (diagnostics). */
  blockedCount(): number {
    let n = 0;
    for (let k = 0; k < this.count; k++) n += this.blocked[k];
    return n;
  }

  /** Can you walk the great circle from `a` to `b` without crossing a blocked cell? */
  visible(a: Vector3, b: Vector3): boolean {
    const ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
    const steps = Math.ceil((ang * this.R) / (this.cellU * 0.5));
    if (steps < 1) return true;
    const s = Math.sin(ang);
    // (antipodes: no single great circle)
    if (s < 1e-6 && ang > 1) return false;
    for (let t = 1; t < steps; t++) {
      const f = t / steps;
      if (s < 1e-9) _p.copy(a);
      else _p.copy(a).multiplyScalar(Math.sin((1 - f) * ang) / s).addScaledVector(b, Math.sin(f * ang) / s);
      if (!this.open(this.cellOf(_p.normalize()))) return false;
    }
    return true;
  }

  /** The open cell nearest `k`, searching outward through the neighbours (−1 if none within `max` rings). */
  private nearestOpen(k: number, max = 10): number {
    if (this.open(k)) return k;
    let ring = [k];
    const seen = new Set<number>(ring);
    for (let r = 0; r < max; r++) {
      const next: number[] = [];
      let best = -1;
      let bd = Infinity;
      for (const c of ring) {
        for (let e = 0; e < 8; e++) {
          const m = this.nbr[c * 8 + e];
          if (m < 0 || seen.has(m)) continue;
          seen.add(m);
          next.push(m);
          if (this.open(m)) {
            const d = this.arc(k, m);
            if (d < bd) {
              bd = d;
              best = m;
            }
          }
        }
      }
      if (best >= 0) return best;
      ring = next;
    }
    return -1;
  }

  /**
   * Waypoints (planet-local unit vectors) from `from` toward `to`, the last one always `to` itself
   * (when it can't be reached, the route goes as close as it can first); null only when there's no
   * open ground near either end.
   * `avoid` blocks extra discs for this query only (someone standing in the way).
   */
  path(from: Vector3, to: Vector3, avoid: readonly NavBlock[] = []): Vector3[] | null {
    const tempList: number[] = [];
    // (never block where the walker itself stands, or its goal)
    for (const b of avoid) this.stampDisc(b.n, b.r + this.clearance, this.temp, tempList);
    const fromCell = this.cellOf(from);
    const toCell = this.cellOf(to);
    if (this.temp[fromCell]) {
      this.temp[fromCell] = 0;
    }
    try {
      return this.search(from, to, fromCell, toCell);
    } finally {
      for (const k of tempList) this.temp[k] = 0;
    }
  }

  private search(from: Vector3, to: Vector3, fromCell: number, toCell: number): Vector3[] | null {
    const s = this.nearestOpen(fromCell);
    const g = this.nearestOpen(toCell);
    if (s < 0 || g < 0) return null;
    const goalExact = g === toCell;
    if (s === g) return [to.clone()];
    if (this.visible(from, to)) return [to.clone()];
    const gen = ++this.gen;
    const gCost = this.gCost;
    const came = this.came;
    const heap: number[] = [];
    const push = (f: number, k: number) => {
      heap.push(f, k);
      let c = heap.length / 2 - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p * 2] <= heap[c * 2]) break;
        [heap[p * 2], heap[c * 2]] = [heap[c * 2], heap[p * 2]];
        [heap[p * 2 + 1], heap[c * 2 + 1]] = [heap[c * 2 + 1], heap[p * 2 + 1]];
        c = p;
      }
    };
    const pop = (): number => {
      const top = heap[1];
      const lastK = heap.pop()!;
      const lastF = heap.pop()!;
      if (heap.length) {
        heap[0] = lastF;
        heap[1] = lastK;
        let c = 0;
        const n = heap.length / 2;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < n && heap[l * 2] < heap[m * 2]) m = l;
          if (r < n && heap[r * 2] < heap[m * 2]) m = r;
          if (m === c) break;
          [heap[m * 2], heap[c * 2]] = [heap[c * 2], heap[m * 2]];
          [heap[m * 2 + 1], heap[c * 2 + 1]] = [heap[c * 2 + 1], heap[m * 2 + 1]];
          c = m;
        }
      }
      return top;
    };
    // a slightly greedy heuristic (×1.1): far fewer nodes, and the string-pulling straightens the result
    const h = (k: number) => this.arc(k, g) * 1.1;
    this.stamp[s] = gen;
    gCost[s] = 0;
    came[s] = -1;
    push(h(s), s);
    let found = false;
    let expanded = 0;
    // (the goal may sit in a pocket the grown obstacles seal off: then the route goes as near as it can,
    // a partial path as Detour returns, and the walker covers the last bit on its own)
    let nearest = s;
    let nearestD = this.arc(s, g);
    while (heap.length) {
      const k = pop();
      if (this.closed[k] === gen) continue;
      this.closed[k] = gen;
      expanded++;
      if (k === g) {
        found = true;
        break;
      }
      const dk = this.arc(k, g);
      if (dk < nearestD) {
        nearestD = dk;
        nearest = k;
      }
      for (let d = 0; d < 8; d++) {
        const m = this.nbr[k * 8 + d];
        if (m < 0 || !this.open(m) || this.closed[m] === gen) continue;
        if (d >= 4) {
          const [a, b] = DIAG_SIDES[d - 4];
          const na = this.nbr[k * 8 + a];
          const nb = this.nbr[k * 8 + b];
          if (na < 0 || nb < 0 || !this.open(na) || !this.open(nb)) continue;
        }
        const c = gCost[k] + this.cost[k * 8 + d];
        if (this.stamp[m] !== gen || c < gCost[m]) {
          this.stamp[m] = gen;
          gCost[m] = c;
          came[m] = k;
          push(c + h(m), m);
        }
      }
    }
    this.lastExpanded = expanded;
    const end = found ? g : nearest;
    if (!found && end === s) return [to.clone()];
    const cells: number[] = [];
    for (let k = end; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    // string-pulling: from each kept point, jump to the furthest cell in plain sight
    const pts: Vector3[] = [];
    let a = from.clone();
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.visible(a, this.centre(cells[j], _q))) j--;
      const p = this.centre(cells[j]);
      pts.push(p);
      a = p;
      i = j;
    }
    if (goalExact && found) {
      if (pts.length) pts[pts.length - 1] = to.clone();
      else pts.push(to.clone());
    } else pts.push(to.clone());
    return pts;
  }
}
