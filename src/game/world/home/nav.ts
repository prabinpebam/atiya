/**
 * Route planning for the family (docs: family.md §5): a navigation grid over the home ground and
 * A* on it, the standard recipe for NPCs in a small, static area. The ground round the home is
 * projected onto a grid of 0.25 u cells (azimuthal-equidistant about the home's centre, so cell
 * sizes stay true on the sphere); cells inside an obstacle (grown by the walker's radius and a
 * margin), in the pond or deep water are blocked. A path is found with 8-way A* (octile heuristic,
 * no corner cutting), then smoothed by string-pulling: each waypoint skips ahead to the furthest
 * point it can see in a straight, clear line. Pure: unit-tested against the real layout.
 */
import { Vector3 } from 'three';
import { arcDistance, moveAlong, tangentToward, type Obstacle } from '../../math/sphere';

export class NavGrid {
  readonly n: number;
  private readonly blocked: Uint8Array;
  private readonly east: Vector3;
  private readonly north: Vector3;
  private readonly half: number;

  constructor(
    readonly centre: Vector3,
    readonly R: number,
    obstacles: readonly Obstacle[],
    wet: (n: Vector3) => boolean,
    /** The walker's radius plus a margin (u): obstacles are grown by it. */
    readonly clearance = 0.28,
    readonly size = 18,
    readonly cell = 0.25,
  ) {
    this.n = Math.ceil(size / cell);
    this.half = (this.n * cell) / 2;
    this.north = tangentToward(centre, Math.abs(centre.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0))!;
    this.east = new Vector3().crossVectors(this.north, centre).normalize();
    this.blocked = new Uint8Array(this.n * this.n);
    const near = obstacles.filter((o) => arcDistance(o.n, centre, R) < this.half * 1.5 + o.radiusU);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const p = this.point(i, j);
        let b = wet(p);
        for (let k = 0; !b && k < near.length; k++) if (arcDistance(p, near[k].n, R) < near[k].radiusU + clearance) b = true;
        this.blocked[j * this.n + i] = b ? 1 : 0;
      }
    }
  }

  /** The planet-local unit vector at the centre of cell (i, j). */
  point(i: number, j: number, out = new Vector3()): Vector3 {
    const x = (i + 0.5) * this.cell - this.half;
    const y = (j + 0.5) * this.cell - this.half;
    const r = Math.hypot(x, y);
    if (r < 1e-9) return out.copy(this.centre);
    const dir = out.copy(this.east).multiplyScalar(x / r).addScaledVector(this.north, y / r);
    return moveAlong(this.centre, dir, r / this.R, out);
  }

  /** The cell holding `p` (may be outside the grid). */
  cellOf(p: Vector3): [number, number] {
    const r = arcDistance(p, this.centre, this.R);
    const t = tangentToward(this.centre, p);
    const x = t ? r * t.dot(this.east) : 0;
    const y = t ? r * t.dot(this.north) : 0;
    return [Math.floor((x + this.half) / this.cell), Math.floor((y + this.half) / this.cell)];
  }

  inside(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.n && j < this.n;
  }

  isFree(i: number, j: number): boolean {
    return this.inside(i, j) && this.blocked[j * this.n + i] === 0;
  }

  /** Is `p` on open ground in the grid? */
  freeAt(p: Vector3): boolean {
    const [i, j] = this.cellOf(p);
    return this.isFree(i, j);
  }

  /** The free cell nearest (i, j), searching outward ring by ring (null if none within `max`). */
  private nearestFree(i: number, j: number, max = 8): [number, number] | null {
    if (this.isFree(i, j)) return [i, j];
    for (let r = 1; r <= max; r++) {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.isFree(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bd) {
            bd = d;
            best = [i + di, j + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Can you walk straight from cell a to cell b (every cell the line crosses free)? */
  private visible(ai: number, aj: number, bi: number, bj: number): boolean {
    const steps = Math.ceil(Math.max(Math.abs(bi - ai), Math.abs(bj - aj)) * 2);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.isFree(Math.round(ai + (bi - ai) * t), Math.round(aj + (bj - aj) * t))) return false;
    }
    return true;
  }

  /**
   * Waypoints (planet-local unit vectors) from `from` toward `to`, the last one `to` itself when it's
   * reachable (or the nearest open ground to it); null if there's no way at all.
   */
  path(from: Vector3, to: Vector3): Vector3[] | null {
    const s0 = this.cellOf(from);
    const g0 = this.cellOf(to);
    const s = this.nearestFree(s0[0], s0[1]);
    const g = this.nearestFree(Math.max(0, Math.min(this.n - 1, g0[0])), Math.max(0, Math.min(this.n - 1, g0[1])));
    if (!s || !g) return null;
    const goalExact = this.isFree(g0[0], g0[1]);
    const N = this.n;
    const idx = (i: number, j: number) => j * N + i;
    const gCost = new Float32Array(N * N).fill(Infinity);
    const came = new Int32Array(N * N).fill(-1);
    const closed = new Uint8Array(N * N);
    // a small binary heap of [f, index]
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
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - g[0]);
      const dy = Math.abs(j - g[1]);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const start = idx(s[0], s[1]);
    const goal = idx(g[0], g[1]);
    gCost[start] = 0;
    push(h(s[0], s[1]), start);
    let found = false;
    while (heap.length) {
      const k = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === goal) {
        found = true;
        break;
      }
      const i = k % N;
      const j = (k / N) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!this.isFree(ni, nj)) continue;
          // no cutting a blocked corner diagonally
          if (di && dj && (!this.isFree(i + di, j) || !this.isFree(i, j + dj))) continue;
          const nk = idx(ni, nj);
          const c = gCost[k] + (di && dj ? Math.SQRT2 : 1);
          if (c < gCost[nk]) {
            gCost[nk] = c;
            came[nk] = k;
            push(c + h(ni, nj), nk);
          }
        }
      }
    }
    if (!found) return null;
    const cells: Array<[number, number]> = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push([k % N, (k / N) | 0]);
    cells.reverse();
    // string-pulling: from each kept cell, jump to the furthest one in plain sight
    const keep: Array<[number, number]> = [cells[0]];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !this.visible(cells[a][0], cells[a][1], cells[b][0], cells[b][1])) b--;
      keep.push(cells[b]);
      a = b;
    }
    const pts = keep.slice(1).map(([i, j]) => this.point(i, j));
    if (goalExact) pts[pts.length - 1] = to.clone();
    else pts.push(to.clone());
    return pts;
  }
}
