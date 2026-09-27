/**
 * The vegetable garden behind the house (docs: family.md §3.2): the watering can and each plant's
 * moisture. Pure: the home chunk draws it, the visitor and the family (Rojina, Prabin) use it.
 *
 * - One can, one holder at a time: the visitor or one of the family picks it up at its spot, waters
 *   plants one by one, and puts it back.
 * - A watered plant dries over `dryS`; it's thirsty again under `thirsty`.
 */
import { Vector3 } from 'three';
import { moveAlong } from '../../math/sphere';
import { YARD, type HomeSpot, type Homestead } from '../homestead';

export const GARDEN = {
  /** Seconds for a watered plant to dry out. */
  dryS: 300,
  /** Moisture under which a plant is thirsty (the family come to water it). */
  thirsty: 0.35,
  /** Moisture under which the visitor can water it (a plant just watered doesn't ask again). */
  full: 0.85,
  /** Into the pour (s) when the water reaches the plant (the `water` cycle, and the family's pour). */
  wetAt: 0.95,
  /** The family's pour (s). */
  pourS: 1.6,
  /** The visitor works this far from a plant (u; clear of the bed), and is offered it from its edge + `reachU`. */
  standU: 0.78,
  reachU: 0.8,
  /** The family water from this far out from the bed's middle line (u), on either long side. */
  sideU: 0.75,
  /** The soil's top above the bed's ground (u; models.ts `bed`). */
  soil: 0.13,
  /** Holding the can this far (u) from its spot, or flying off, puts it back. */
  leaveU: 6,
} as const;

export type Holder = 'visitor' | 'rojina' | 'prabin' | null;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** How far the can tips (rad) `t` s into a pour (the visitor's `water` cycle, or the family's). */
export const pourTilt = (t: number) => smooth((t - 0.2) / 0.3) * (1 - smooth((t - GARDEN.pourS + 0.4) / 0.3)) * 0.95;

/** Water falls from the spout while the can is tipped far enough. */
export const pouring = (t: number) => pourTilt(t) > 0.6;

export interface Plant {
  i: number;
  kind: 'cabbage' | 'tomato';
  n: Vector3;
  /** Its bed (index into `home.yard.beds`). */
  bed: number;
  /** The two places to water it from, one on each long side of its bed, facing it. */
  stands: [HomeSpot, HomeSpot];
}

/** The plants as the bed models lay them out (models.ts `bed`): two rows of four cabbages, four tomatoes. */
export function gardenPlants(home: Homestead, R: number): Plant[] {
  const out: Plant[] = [];
  const L = YARD.bedL;
  home.yard.beds.forEach((b, bed) => {
    const side = new Vector3().crossVectors(b.n, b.facing).normalize();
    const kind = bed ? 'tomato' : 'cabbage';
    const spots: [number, number][] = [];
    if (kind === 'cabbage') for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) spots.push([-L / 2 + 0.2 + i * ((L - 0.4) / 3), (row - 0.5) * 0.24]);
    else for (let i = 0; i < 4; i++) spots.push([-L / 2 + 0.18 + i * ((L - 0.36) / 3), 0]);
    for (const [x, z] of spots) {
      const along = moveAlong(b.n, side, x / R);
      const n = moveAlong(along, b.facing, z / R);
      const stand = (s: number): HomeSpot => {
        const at = moveAlong(along, b.facing, (s * GARDEN.sideU) / R);
        return { n: at, facing: b.facing.clone().multiplyScalar(-s) };
      };
      out.push({ i: out.length, kind, n, bed, stands: [stand(1), stand(-1)] });
    }
  });
  return out;
}

export class Garden {
  readonly plants: Plant[];
  /** Moisture, 0 (dry) … 1 (just watered). */
  readonly wet: number[];
  holder: Holder = null;
  /** Pours under way (drawn as falling water): the plant, who's pouring and from where, and for how long so far (s). */
  readonly pours: Array<{ i: number; from: Vector3; t: number }> = [];

  constructor(
    home: Homestead,
    R: number,
    rand: () => number = Math.random,
    /** The can's spot (by the beds). */
    readonly can: HomeSpot = home.yard.wateringCan,
  ) {
    this.plants = gardenPlants(home, R);
    // it's been a while: most of them could do with a drink
    this.wet = this.plants.map(() => rand() * 0.4);
  }

  take(by: Exclude<Holder, null>): boolean {
    if (this.holder && this.holder !== by) return false;
    this.holder = by;
    return true;
  }

  putBack(): void {
    this.holder = null;
    this.pours.length = 0;
  }

  /** Water plant `i` (by whoever holds the can): it's wet through. */
  water(i: number): void {
    if (this.wet[i] !== undefined) this.wet[i] = 1;
  }

  /** A pour from `from` onto plant `i` starts (the water falls for `GARDEN.pourS`). */
  pour(i: number, from: Vector3): void {
    this.pours.push({ i, from: from.clone(), t: 0 });
  }

  thirsty(): number[] {
    return this.plants.filter((p) => this.wet[p.i] < GARDEN.thirsty).map((p) => p.i);
  }

  step(dt: number): void {
    for (let i = 0; i < this.wet.length; i++) this.wet[i] = Math.max(0, this.wet[i] - dt / GARDEN.dryS);
    for (let k = this.pours.length - 1; k >= 0; k--) if ((this.pours[k].t += dt) > GARDEN.pourS) this.pours.splice(k, 1);
  }
}
