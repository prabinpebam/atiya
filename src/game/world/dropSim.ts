import { Vector3 } from 'three';
import { itemDef, type ItemId } from '../inventory/items';

/**
 * Items lying in the world (docs: collection-inventory.md §3.2–3.3). Pure simulation in the planet's
 * local frame (the planet-root group), so drops ride along as the planet turns under the player.
 */
export const DROP = {
  /** Radial gravity (u/s²). */
  gravity: 9,
  /** Share of the fall speed kept on a bounce, per model. */
  bounce: { fruit: 0.3, stone: 0.3, log: 0.2, leaves: 0, flower: 0.15 } as Record<string, number>,
  /** Ground friction on a resting / sliding drop (1/s). */
  friction: 7,
  /** Leaves: air drag (1/s) and flutter. */
  leafDrag: 3.2,
  /** A drop can be picked up this long after it appears (s): Minecraft's 10 ticks; thrown ones 40. */
  pickupDelay: 0.5,
  thrownDelay: 2,
  /** Pulled towards the character within this distance (u, from its feet, planet-local). */
  magnetU: 1.6,
  /** Collected when this close to the character's chest (u). */
  collectU: 0.3,
  /** Magnet pull (u/s²) and its top speed (u/s). */
  magnetAccel: 26,
  magnetMaxSpeed: 10,
  /** Resting drops of the same item within this distance merge (u). */
  mergeU: 0.5,
  /** Most drops at once (the oldest resting one goes first). */
  max: 160,
  /** Shrink time once collected (s). */
  collectTime: 0.12,
  /** Height of the character's chest above its feet (u): where drops fly to. */
  chestH: 0.55,
  /** Resting drops float this high, bobbing ± `bob`. */
  restH: 0.1,
  bob: 0.04,
} as const;

export type DropState = 'air' | 'rest' | 'magnet' | 'collected';

export interface Drop {
  uid: number;
  item: ItemId;
  count: number;
  /** Position (planet-local, absolute: |p| = R + height). */
  p: Vector3;
  v: Vector3;
  state: DropState;
  /** Seconds since it appeared, and when it can first be picked up. */
  age: number;
  delay: number;
  /** Spin angle (rad) and bob phase; `t` counts the collected shrink. */
  spin: number;
  phase: number;
  t: number;
}

export interface DropEnv {
  /** Planet radius. */
  R: number;
  /** Ground height (u above R) at unit direction `n`. */
  ground(n: Vector3): number;
  /** The character's feet (planet-local, absolute), or null while it can't collect (travelling, a screen open). */
  player: Vector3 | null;
  /** How many of `n` the backpack can take. */
  room(item: ItemId, n: number): number;
  /** Put `n` into the backpack (called once a drop reaches the character). */
  collect(item: ItemId, n: number): void;
  /** Frozen animation (reduced motion): no bob or spin. */
  still?: boolean;
}

const _n = new Vector3();
const _to = new Vector3();
const _t = new Vector3();

export class Drops {
  readonly list: Drop[] = [];
  private next = 1;
  /** Set when a drop wanted to fly to the character but the backpack was full (cleared by the reader). */
  blockedFull = false;

  /** Spawn a drop at planet-local `p` with velocity `v` (u/s). */
  spawn(item: ItemId, count: number, p: Vector3, v: Vector3, opts: { thrown?: boolean; rand?: () => number } = {}): Drop {
    const rand = opts.rand ?? Math.random;
    const d: Drop = {
      uid: this.next++,
      item,
      count,
      p: p.clone(),
      v: v.clone(),
      state: 'air',
      age: 0,
      delay: opts.thrown ? DROP.thrownDelay : DROP.pickupDelay,
      spin: rand() * Math.PI * 2,
      phase: rand() * Math.PI * 2,
      t: 0,
    };
    this.list.push(d);
    this.trim();
    return d;
  }

  private trim(): void {
    while (this.list.length > DROP.max) {
      const i = this.list.findIndex((d) => d.state === 'rest');
      this.list.splice(i >= 0 ? i : 0, 1);
    }
  }

  /** How high a drop floats above the ground right now (u), for drawing. */
  static floatH(d: Drop, still = false): number {
    return d.state === 'rest' && !still ? DROP.restH + Math.sin(d.age * 2.6 + d.phase) * DROP.bob : DROP.restH;
  }

  step(env: DropEnv, rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    if (dt === 0) return;
    const { R } = env;
    const player = env.player;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const d = this.list[k];
      d.age += dt;
      if (!env.still) d.spin += dt * (d.state === 'rest' ? 1.4 : 5);
      if (d.state === 'collected') {
        d.t += dt;
        if (d.t >= DROP.collectTime) this.list.splice(k, 1);
        continue;
      }
      _n.copy(d.p).normalize();
      // the magnet: once the delay is over, a drop near the character that fits flies to it
      if (player && d.age >= d.delay) {
        const feetDist = _to.copy(d.p).sub(player).length();
        if (d.state === 'magnet' || feetDist < DROP.magnetU) {
          const room = env.room(d.item, d.count);
          if (room > 0) {
            d.state = 'magnet';
            _t.copy(player).normalize().multiplyScalar(player.length() + DROP.chestH);
            _to.copy(_t).sub(d.p);
            const dist = _to.length();
            if (dist < DROP.collectU) {
              const k2 = Math.min(room, d.count);
              env.collect(d.item, k2);
              if (k2 < d.count) {
                d.count -= k2;
                d.state = 'air';
                d.v.set(0, 0, 0);
              } else {
                d.state = 'collected';
                d.t = 0;
              }
              continue;
            }
            _to.multiplyScalar(1 / Math.max(dist, 1e-6));
            // steer: accelerate along the line to the chest and bleed off sideways speed
            d.v.addScaledVector(_to, DROP.magnetAccel * dt);
            const along = d.v.dot(_to);
            _t.copy(d.v).addScaledVector(_to, -along);
            d.v.addScaledVector(_t, -Math.min(1, 8 * dt));
            const sp = d.v.length();
            if (sp > DROP.magnetMaxSpeed) d.v.multiplyScalar(DROP.magnetMaxSpeed / sp);
            // never overshoot the chest in one step
            const stepLen = Math.min(d.v.length() * dt, dist);
            d.p.addScaledVector(d.v.clone().normalize(), stepLen);
            continue;
          }
          if (feetDist < DROP.magnetU) this.blockedFull = true;
          if (d.state === 'magnet') {
            d.state = 'air';
            d.v.set(0, 0, 0);
          }
        }
      }
      this.physics(d, env, dt, R);
    }
    this.merge();
  }

  private physics(d: Drop, env: DropEnv, dt: number, R: number): void {
    const model = itemDef(d.item).model;
    const leaf = model === 'leaves';
    const g = this.groundR(d, env, R);
    if (d.state === 'rest') {
      // stay on the ground (the terrain under it doesn't move), sliding to a stop
      d.v.multiplyScalar(Math.exp(-DROP.friction * dt));
      if (d.v.lengthSq() > 1e-8) {
        d.p.addScaledVector(d.v, dt);
      }
      d.p.setLength(g);
      return;
    }
    // falling / flying
    d.v.addScaledVector(_n, -DROP.gravity * (leaf ? 0.35 : 1) * dt);
    if (leaf) {
      d.v.multiplyScalar(Math.exp(-DROP.leafDrag * dt));
      // side-to-side flutter, perpendicular to the fall
      _t.set(Math.cos(d.phase), 0, Math.sin(d.phase)).addScaledVector(_n, -_n.dot(_t)).normalize();
      d.p.addScaledVector(_t, Math.sin(d.age * 5 + d.phase) * 0.6 * dt);
    }
    d.p.addScaledVector(d.v, dt);
    const r = d.p.length();
    const gr = this.groundR(d, env, R);
    if (r <= gr) {
      d.p.setLength(gr);
      const radial = d.v.dot(_n.copy(d.p).normalize());
      const tangential = _t.copy(d.v).addScaledVector(_n, -radial);
      const b = DROP.bounce[model === 'fruit' ? 'fruit' : model === 'stone' ? 'stone' : model === 'log' ? 'log' : model === 'leaves' ? 'leaves' : 'flower'] ?? 0.2;
      if (radial < 0 && -radial * b > 0.6) {
        d.v.copy(tangential).multiplyScalar(0.7).addScaledVector(_n, -radial * b);
      } else {
        d.v.copy(tangential).multiplyScalar(0.6);
        d.state = 'rest';
      }
    }
  }

  /** Radius of the resting height at a drop's spot. */
  private groundR(d: Drop, env: DropEnv, R: number): number {
    _n.copy(d.p).normalize();
    return R + env.ground(_n) + DROP.restH;
  }

  /** Resting drops of the same item within `mergeU` combine (up to a stack). */
  private merge(): void {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.state !== 'rest') continue;
      const max = itemDef(a.item).maxStack;
      for (let j = L.length - 1; j > i; j--) {
        const b = L[j];
        if (b.state !== 'rest' || b.item !== a.item || a.count + b.count > max) continue;
        if (a.p.distanceToSquared(b.p) > DROP.mergeU * DROP.mergeU) continue;
        a.count += b.count;
        a.delay = Math.max(a.delay - a.age, b.delay - b.age) + a.age;
        L.splice(j, 1);
      }
    }
  }
}
